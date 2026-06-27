<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import { TextLayer } from 'pdfjs-dist';
  import { zoomState } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';

  // Set up worker from pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;

  let {
    pdfData = null,
    error = '',
    compiling = false,
    scrollTarget = '',
    spread = false,
  }: {
    pdfData: Uint8Array | null;
    error: string;
    compiling: boolean;
    scrollTarget?: string;
    /** 2-up facing-pages view: page 1 alone, then 2–3, 4–5 … side by side. */
    spread?: boolean;
  } = $props();

  let scrollContainer: HTMLDivElement;
  let canvasContainer = $state<HTMLDivElement>(undefined!);
  let lastScrollTop = 0;
  let pageCount = $state(0);
  let currentPdf: pdfjsLib.PDFDocumentProxy | null = null;
  let renderedPages = new Set<number>();
  let observer: IntersectionObserver | null = null;
  let pageElements: HTMLDivElement[] = [];
  // Chapter-follow: `lastScrolledTarget` de-dupes repeated targets; on a switch
  // the target is also stashed in `pendingScrollTarget` so the scroll is
  // (re)applied AFTER the switch-triggered recompile renders — otherwise that
  // render would restore the old scroll position over our jump (the race that
  // made it land on page 1).
  let lastScrolledTarget = '';
  let pendingScrollTarget = '';

  // Base scale chosen for crispness at 100% zoom. The pdfZoom multiplier is
  // applied to pdfjs' viewport scale (rather than via CSS transform) so the
  // canvas rasterizes at the correct DPI — no blurriness when zooming in.
  const BASE_SCALE = 1.5;

  $effect(() => {
    if (pdfData) {
      renderPdf(pdfData);
    }
  });

  // Preview → Source: a plain click on a rendered word jumps the editor to its
  // source. Attached imperatively (the pages/text layers are built imperatively)
  // to avoid an a11y lint on a non-interactive container.
  $effect(() => {
    const el = scrollContainer;
    if (!el) return;
    el.addEventListener('click', onPreviewClick);
    return () => el.removeEventListener('click', onPreviewClick);
  });

  // Re-render whenever the PDF zoom changes. We MUST NOT re-call
  // pdfjsLib.getDocument(): the ArrayBuffer was transferred to the worker on
  // first load and is detached. Instead, keep the loaded `currentPdf` and
  // just rebuild placeholders (with the new width) — the IntersectionObserver
  // re-renders visible pages at the new viewport scale.
  let lastZoom = zoomState.pdf;
  let lastSpread = untrack(() => spread);
  $effect(() => {
    const z = zoomState.pdf;
    const sp = spread;
    if ((z !== lastZoom || sp !== lastSpread) && currentPdf) {
      lastZoom = z;
      lastSpread = sp;
      void rebuildAtCurrentZoom();
    } else {
      lastZoom = z;
      lastSpread = sp;
    }
  });

  async function rebuildAtCurrentZoom() {
    if (scrollContainer) lastScrollTop = scrollContainer.scrollTop;
    renderedPages.clear();
    observer?.disconnect();
    await tick();
    setupPlaceholders();
    setupIntersectionObserver();
  }

  async function renderPdf(data: Uint8Array) {
    // Save scroll position
    if (scrollContainer) {
      lastScrollTop = scrollContainer.scrollTop;
    }

    // Clean up previous
    renderedPages.clear();
    observer?.disconnect();

    try {
      if (currentPdf) {
        currentPdf.destroy();
      }
      currentPdf = await pdfjsLib.getDocument({ data }).promise;
      pageCount = currentPdf.numPages;

      // Create placeholder divs for each page
      await tick();
      setupPlaceholders();
      setupIntersectionObserver();

      // Restore scroll position — unless a chapter switch is pending, in which
      // case jump to that chapter instead (and consume the pending target so
      // later recompiles, e.g. while typing, just keep the position).
      await tick();
      if (pendingScrollTarget) {
        const tgt = pendingScrollTarget;
        pendingScrollTarget = '';
        void scrollToChapter(tgt);
      } else if (scrollContainer && lastScrollTop > 0) {
        scrollContainer.scrollTop = lastScrollTop;
      }
    } catch (err) {
      console.error('[penwright] PDF render error:', err);
    }
  }

  // Chapter switch → scroll the preview to that chapter's first page. Fires only
  // when the target CHANGES (never on plain recompiles). Tries immediately on
  // the current PDF, and stashes the target so the switch-triggered recompile's
  // render re-applies it (see renderPdf) — avoiding the restore-over-jump race.
  $effect(() => {
    const target = scrollTarget;
    if (!target || target === lastScrolledTarget) return;
    lastScrolledTarget = target;
    pendingScrollTarget = target;
    if (currentPdf && pageElements.length > 0) void scrollToChapter(target);
  });

  function normalizeTitle(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/^[\d.\s]+/, '')        // drop a leading numbering like "1.2 "
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  interface OutlineNode { title: string; dest: string | unknown[] | null; items?: OutlineNode[]; }

  async function scrollToChapter(title: string): Promise<void> {
    const pdf = currentPdf;
    if (!pdf || !scrollContainer) return;
    try {
      const outline = (await pdf.getOutline()) as OutlineNode[] | null;
      if (!outline || outline.length === 0) return; // no PDF bookmarks → no jump

      const flat: OutlineNode[] = [];
      const walk = (items: OutlineNode[]) => {
        for (const it of items) { flat.push(it); if (it.items?.length) walk(it.items); }
      };
      walk(outline);

      const want = normalizeTitle(title);
      if (!want) return;
      let match = flat.find((it) => normalizeTitle(it.title) === want);
      if (!match) {
        match = flat.find((it) => {
          const n = normalizeTitle(it.title);
          return n.length > 0 && (n.includes(want) || want.includes(n));
        });
      }
      if (!match || !match.dest) return;

      let dest = match.dest;
      if (typeof dest === 'string') {
        dest = ((await pdf.getDestination(dest)) as unknown[] | null) ?? [];
      }
      if (!Array.isArray(dest) || dest.length === 0) return;
      const pageIndex = await pdf.getPageIndex(dest[0] as Parameters<typeof pdf.getPageIndex>[0]);

      const el = pageElements[pageIndex];
      if (!el) return;
      const top = el.getBoundingClientRect().top
        - scrollContainer.getBoundingClientRect().top
        + scrollContainer.scrollTop;
      scrollContainer.scrollTop = Math.max(0, top - 8);
    } catch {
      // outline missing / destination unresolvable → leave the scroll as-is
    }
  }

  // ─── Preview → Source (click a word to jump to the .typ) ──────────────
  // The deepest outline bookmark whose page is at or above `pageIndex` — used
  // as section context to disambiguate / fall back when the clicked phrase
  // isn't found verbatim in the source.
  async function headingForPage(pageIndex: number): Promise<string> {
    const pdf = currentPdf;
    if (!pdf || pageIndex < 0) return '';
    try {
      const outline = (await pdf.getOutline()) as OutlineNode[] | null;
      if (!outline) return '';
      const flat: OutlineNode[] = [];
      const walk = (items: OutlineNode[]) => {
        for (const it of items) { flat.push(it); if (it.items?.length) walk(it.items); }
      };
      walk(outline);
      let best = '';
      let bestPage = -1;
      for (const it of flat) {
        let dest = it.dest;
        if (typeof dest === 'string') dest = ((await pdf.getDestination(dest)) as unknown[] | null) ?? [];
        if (!Array.isArray(dest) || dest.length === 0) continue;
        const pg = await pdf.getPageIndex(dest[0] as Parameters<typeof pdf.getPageIndex>[0]);
        if (pg <= pageIndex && pg >= bestPage) { bestPage = pg; best = it.title; }
      }
      return best;
    } catch {
      return '';
    }
  }

  function onPreviewClick(e: MouseEvent) {
    // Only a plain click navigates. If the user drag-selected text (to copy),
    // leave the selection alone.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    const target = e.target as HTMLElement | null;
    const span = target?.closest('.textLayer span') as HTMLElement | null;
    const layer = span?.parentElement;
    if (!span || !layer) return;

    // Build a short, contextual phrase from the clicked span + following ones,
    // so the source lookup is unique enough (a single word often isn't).
    const spans = Array.from(layer.children) as HTMLElement[];
    const idx = spans.indexOf(span);
    let phrase = '';
    for (let i = idx; i < spans.length && phrase.length < 45; i++) {
      phrase += spans[i].textContent || '';
    }
    phrase = phrase.replace(/\s+/g, ' ').trim().slice(0, 60);
    // Need some real letters/digits — ignore clicks on pure punctuation/space.
    if (phrase.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return;

    const wrapper = span.closest('.pdf-page') as HTMLElement | null;
    const pageIndex = wrapper ? Number(wrapper.dataset.pageIndex) : -1;

    void headingForPage(pageIndex).then((heading) => {
      window.dispatchEvent(
        new CustomEvent('penwright:preview-jump', { detail: { text: phrase, heading } }),
      );
    });
  }

  const SPREAD_GAP = 14;

  function setupPlaceholders() {
    if (!canvasContainer || !currentPdf) return;

    // Clear previous content
    canvasContainer.innerHTML = '';
    pageElements = [];

    // Width fills the scroll container at 100% zoom; higher zoom grows
    // beyond it (horizontal scroll kicks in via the parent's overflow). In
    // spread mode two pages share the width, so each page is ~half as wide.
    const avail = Math.max(120, canvasContainer.clientWidth - 32);
    const perPage = spread
      ? Math.round(((avail - SPREAD_GAP) / 2) * zoomState.pdf)
      : Math.round(avail * zoomState.pdf);

    const makePage = (i: number): HTMLDivElement => {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page';
      wrapper.dataset.pageIndex = String(i);
      // Placeholder height based on A4 ratio (1:1.414) until the real page renders.
      wrapper.style.width = `${perPage}px`;
      wrapper.style.height = `${Math.round(perPage * 1.414)}px`;
      wrapper.style.background = '#fff';
      wrapper.style.marginBottom = spread ? '0' : '16px';
      wrapper.style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)';
      wrapper.style.borderRadius = '4px';
      wrapper.style.overflow = 'hidden';
      pageElements.push(wrapper);
      return wrapper;
    };

    if (!spread) {
      for (let i = 0; i < pageCount; i++) canvasContainer.appendChild(makePage(i));
      return;
    }

    // Spread layout: page 1 alone on the right (like an opened magazine), then
    // 2–3, 4–5 … as facing pairs. Each row is a flex container; a hidden ghost
    // keeps the lone first page on the right half.
    const addRow = (children: HTMLElement[]) => {
      const row = document.createElement('div');
      row.className = 'pdf-spread-row';
      for (const c of children) row.appendChild(c);
      canvasContainer.appendChild(row);
    };
    const ghost = () => {
      const g = document.createElement('div');
      g.className = 'pdf-page-ghost';
      g.style.width = `${perPage}px`;
      return g;
    };

    if (pageCount > 0) addRow([ghost(), makePage(0)]);
    for (let i = 1; i < pageCount; i += 2) {
      const row: HTMLElement[] = [makePage(i)];
      if (i + 1 < pageCount) row.push(makePage(i + 1));
      else row.push(ghost());
      addRow(row);
    }
  }

  function setupIntersectionObserver() {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.pageIndex);
          if (entry.isIntersecting && !renderedPages.has(idx)) {
            renderPage(idx);
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: '200px 0px', // pre-render 200px above/below viewport
      },
    );

    for (const el of pageElements) {
      observer.observe(el);
    }
  }

  async function renderPage(index: number) {
    if (!currentPdf || renderedPages.has(index)) return;
    renderedPages.add(index);

    try {
      const page = await currentPdf.getPage(index + 1); // pdf.js pages are 1-based
      const viewport = page.getViewport({ scale: BASE_SCALE * zoomState.pdf });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';

      const wrapper = pageElements[index];
      if (!wrapper) return;

      wrapper.innerHTML = '';
      wrapper.style.height = 'auto';
      wrapper.style.position = 'relative';
      wrapper.appendChild(canvas);

      const ctx = canvas.getContext('2d')!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      // Text layer (for selection & copy)
      const textContent = await page.getTextContent();
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      wrapper.appendChild(textLayerDiv);

      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport,
      });
      await textLayer.render();
    } catch (err) {
      console.error(`[penwright] Failed to render PDF page ${index + 1}:`, err);
    }
  }

  function onScroll() {
    if (scrollContainer) {
      lastScrollTop = scrollContainer.scrollTop;
    }
  }

  onDestroy(() => {
    observer?.disconnect();
    currentPdf?.destroy();
    currentPdf = null;
  });
</script>

<div class="pdf-preview">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="pdf-scroll" bind:this={scrollContainer} onscroll={onScroll}>
    {#if error}
      <div class="pdf-error">
        <pre>{error}</pre>
      </div>
    {:else if !pdfData}
      <div class="pdf-empty">
        <p>{t().pickers.previewNoPreview}</p>
        <p class="hint">{t().pickers.previewNoPreviewHint}</p>
      </div>
    {:else}
      <div class="pdf-pages" bind:this={canvasContainer}></div>
    {/if}
  </div>
</div>

<style>
  .pdf-preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f5f5f5;
  }

  .pdf-scroll {
    flex: 1;
    overflow: auto;
    padding: 16px;
    /* Always show scrollbars so users can tell that zoomed content is
       scrollable in both directions, even on macOS where the default is to
       hide them. */
    scrollbar-gutter: stable;
  }

  .pdf-scroll::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  .pdf-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .pdf-scroll::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.18);
    border-radius: 6px;
    border: 3px solid transparent;
    background-clip: padding-box;
  }

  .pdf-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.32);
    background-clip: padding-box;
    border: 3px solid transparent;
  }

  .pdf-scroll::-webkit-scrollbar-corner {
    background: transparent;
  }

  .pdf-pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: min-content;
  }

  /* 2-up spread rows (built imperatively, so target via :global). */
  .pdf-pages :global(.pdf-spread-row) {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    justify-content: center;
    margin-bottom: 16px;
  }
  .pdf-pages :global(.pdf-page-ghost) {
    flex: 0 0 auto;
    visibility: hidden;
  }

  .pdf-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #ccc;
    font-size: 13px;
  }

  .hint {
    font-size: 12px;
    margin-top: 4px;
    opacity: 0.6;
  }

  .pdf-error {
    padding: 14px;
    background: #fff5f5;
    border: 1px solid #fee;
    border-radius: 8px;
  }

  .pdf-error pre {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    margin: 0;
    color: #c44;
  }

  /* Text layer for selection & copy */
  .pdf-pages :global(.textLayer) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    line-height: 1;
    opacity: 0.3;
    mix-blend-mode: multiply;
  }

  .pdf-pages :global(.textLayer span),
  .pdf-pages :global(.textLayer br) {
    color: transparent;
    position: absolute;
    white-space: pre;
    transform-origin: 0% 0%;
  }

  /* Click a word to jump to its source location (Preview → Source). */
  .pdf-pages :global(.textLayer span) {
    cursor: pointer;
  }

  .pdf-pages :global(.textLayer span::selection) {
    background: rgba(79, 125, 249, 0.3);
  }

  .pdf-pages :global(.textLayer span::-moz-selection) {
    background: rgba(79, 125, 249, 0.3);
  }
</style>
