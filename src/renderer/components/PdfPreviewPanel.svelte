<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import { TextLayer } from 'pdfjs-dist';

  // Set up worker from pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;

  let {
    pdfData = null,
    error = '',
    compiling = false,
  }: {
    pdfData: Uint8Array | null;
    error: string;
    compiling: boolean;
  } = $props();

  let scrollContainer: HTMLDivElement;
  let canvasContainer = $state<HTMLDivElement>(undefined!);
  let lastScrollTop = 0;
  let pageCount = $state(0);
  let currentPdf: pdfjsLib.PDFDocumentProxy | null = null;
  let renderedPages = new Set<number>();
  let observer: IntersectionObserver | null = null;
  let pageElements: HTMLDivElement[] = [];

  const SCALE = 1.5;

  $effect(() => {
    if (pdfData) {
      renderPdf(pdfData);
    }
  });

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

      // Restore scroll position
      await tick();
      if (scrollContainer && lastScrollTop > 0) {
        scrollContainer.scrollTop = lastScrollTop;
      }
    } catch (err) {
      console.error('[vswrite] PDF render error:', err);
    }
  }

  function setupPlaceholders() {
    if (!canvasContainer || !currentPdf) return;

    // Clear previous content
    canvasContainer.innerHTML = '';
    pageElements = [];

    for (let i = 0; i < pageCount; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page';
      wrapper.dataset.pageIndex = String(i);

      // Set a placeholder height based on A4 ratio (1:1.414)
      const width = canvasContainer.clientWidth - 32; // padding
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${Math.round(width * 1.414)}px`;
      wrapper.style.background = '#fff';
      wrapper.style.marginBottom = '16px';
      wrapper.style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)';
      wrapper.style.borderRadius = '4px';
      wrapper.style.overflow = 'hidden';

      canvasContainer.appendChild(wrapper);
      pageElements.push(wrapper);
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
      const viewport = page.getViewport({ scale: SCALE });

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
      await page.render({ canvasContext: ctx, viewport }).promise;

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
      console.error(`[vswrite] Failed to render PDF page ${index + 1}:`, err);
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
        <p>No preview</p>
        <p class="hint">Save a .typ file to see the PDF preview</p>
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
    overflow-y: auto;
    padding: 16px;
  }

  .pdf-pages {
    display: flex;
    flex-direction: column;
    align-items: center;
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

  .pdf-pages :global(.textLayer span::selection) {
    background: rgba(79, 125, 249, 0.3);
  }

  .pdf-pages :global(.textLayer span::-moz-selection) {
    background: rgba(79, 125, 249, 0.3);
  }
</style>
