<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import { TextLayer } from 'pdfjs-dist';
  import { zoomState, zoomPdfIn, zoomPdfOut, resetPdfZoom } from '../appState.svelte';

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href;

  let {
    filePath = '',
    onClose,
  }: {
    filePath: string;
    onClose: () => void;
  } = $props();

  let scrollContainer: HTMLDivElement;
  let canvasContainer = $state<HTMLDivElement>(undefined!);
  let pageCount = $state(0);
  let loading = $state(true);
  let errorMsg = $state('');
  let fileName = $derived(filePath.split('/').pop() || '');

  let currentPdf: pdfjsLib.PDFDocumentProxy | null = null;
  let renderedPages = new Set<number>();
  let observer: IntersectionObserver | null = null;
  let pageElements: HTMLDivElement[] = [];

  const BASE_SCALE = 1.5;

  // Re-render pages whenever the shared pdfZoom changes so the file viewer
  // and the live preview stay in sync.
  let lastZoom = zoomState.pdf;
  $effect(() => {
    const z = zoomState.pdf;
    if (z !== lastZoom && currentPdf) {
      lastZoom = z;
      void rebuildAtCurrentZoom();
    } else {
      lastZoom = z;
    }
  });

  async function rebuildAtCurrentZoom() {
    renderedPages.clear();
    observer?.disconnect();
    await tick();
    setupPlaceholders();
    setupIntersectionObserver();
  }

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  onMount(() => {
    loadPdf();
  });

  $effect(() => {
    if (filePath) loadPdf();
  });

  async function loadPdf() {
    if (!filePath) return;
    loading = true;
    errorMsg = '';
    renderedPages.clear();
    observer?.disconnect();

    try {
      const base64 = await api.invoke('textfile:readBinary', filePath) as string;
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      if (currentPdf) {
        currentPdf.destroy();
      }
      currentPdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      pageCount = currentPdf.numPages;

      await tick();
      setupPlaceholders();
      setupIntersectionObserver();
    } catch (err) {
      errorMsg = `Failed to load PDF: ${err}`;
      console.error('[vswrite] PDF load error:', err);
    }
    loading = false;
  }

  function setupPlaceholders() {
    if (!canvasContainer || !currentPdf) return;

    canvasContainer.innerHTML = '';
    pageElements = [];

    const baseWidth = Math.max(120, canvasContainer.clientWidth - 32);
    const width = Math.round(baseWidth * zoomState.pdf);

    for (let i = 0; i < pageCount; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page';
      wrapper.dataset.pageIndex = String(i);

      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${Math.round(width * 1.414)}px`;

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
        rootMargin: '300px 0px',
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
      const page = await currentPdf.getPage(index + 1);
      const viewport = page.getViewport({ scale: BASE_SCALE * zoomState.pdf });

      const wrapper = pageElements[index];
      if (!wrapper) return;

      wrapper.innerHTML = '';
      wrapper.style.height = 'auto';
      wrapper.style.position = 'relative';

      // Canvas layer
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
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

  onDestroy(() => {
    observer?.disconnect();
    currentPdf?.destroy();
    currentPdf = null;
  });
</script>

<div class="pdf-viewer">
  <div class="viewer-header">
    <div class="header-left">
      <span class="file-badge">pdf</span>
      <span class="file-title">{fileName}</span>
      {#if pageCount > 0}
        <span class="page-count">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
      {/if}
    </div>
    <div class="header-right">
      <div class="zoom-controls" role="group" aria-label="PDF zoom">
        <button class="zoom-btn" onclick={zoomPdfOut} title="Zoom Out" aria-label="Zoom out">−</button>
        <button class="zoom-percent" onclick={resetPdfZoom} title="Reset zoom" aria-label="Reset zoom">{Math.round(zoomState.pdf * 100)}%</button>
        <button class="zoom-btn" onclick={zoomPdfIn} title="Zoom In" aria-label="Zoom in">+</button>
      </div>
      <button class="close-btn" onclick={onClose} title="Close">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>

  <div class="pdf-scroll" bind:this={scrollContainer}>
    {#if loading}
      <div class="pdf-status">Loading PDF...</div>
    {:else if errorMsg}
      <div class="pdf-error"><pre>{errorMsg}</pre></div>
    {:else}
      <div class="pdf-pages" bind:this={canvasContainer}></div>
    {/if}
  </div>
</div>

<style>
  .pdf-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f5f5f5;
  }

  .viewer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    background: #fafafa;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .zoom-btn {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
  }

  .zoom-btn:hover {
    background: #f0f0f0;
    color: #444;
  }

  .zoom-percent {
    min-width: 42px;
    height: 22px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    border-radius: 4px;
    padding: 0 4px;
  }

  .zoom-percent:hover {
    background: #f0f0f0;
    color: #444;
  }

  .file-badge {
    padding: 2px 8px;
    border-radius: 4px;
    background: #f0f0f0;
    color: #888;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .file-title {
    font-size: 13px;
    font-weight: 500;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .page-count {
    font-size: 11px;
    color: #aaa;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #555;
  }

  .pdf-scroll {
    flex: 1;
    overflow: auto;
    padding: 16px;
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
    /* Let the column be as wide as its widest child so horizontal scroll
       kicks in cleanly when the zoom pushes pages past the panel width. */
    min-width: min-content;
  }

  .pdf-pages :global(.pdf-page) {
    background: #fff;
    box-shadow: 0 1px 6px rgba(0,0,0,0.08);
    margin-bottom: 16px;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  /* Text layer: selectable text overlay on top of canvas */
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

  /* Reset opacity when selecting so highlight is visible */
  .pdf-pages :global(.textLayer.selecting),
  .pdf-pages :global(.textLayer span.highlight) {
    opacity: 1;
  }

  .pdf-status {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #aaa;
    font-size: 13px;
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
</style>
