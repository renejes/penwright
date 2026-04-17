<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import DOMPurify from 'dompurify';
  import PdfPreviewPanel from './PdfPreviewPanel.svelte';

  let {
    pages = [],
    pdfData = null,
    previewMode = 'svg',
    error = '',
    compiling = false,
    scrollToPage = 0,
    onModeChange,
  }: {
    pages: string[];
    pdfData: Uint8Array | null;
    previewMode: 'svg' | 'pdf';
    error: string;
    compiling: boolean;
    scrollToPage: number;
    onModeChange: (mode: 'svg' | 'pdf') => void;
  } = $props();

  let scrollContainer: HTMLDivElement | undefined = $state();
  let lastScrollTop = 0;
  let hasScrolledToChapter = false;

  // Lazy-sanitized cache: sanitizing a single SVG page can run into the tens
  // of milliseconds; doing it eagerly for 100+ pages stalls the UI. We only
  // sanitize when a page scrolls into (or near) the viewport and cache the
  // result so subsequent scrolls are free.
  const SANITIZE_OPTIONS = {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use', 'clipPath', 'mask'],
    ADD_ATTR: ['xlink:href', 'clip-path', 'mask'],
  };
  let sanitized: string[] = $state([]);
  let observer: IntersectionObserver | null = null;
  // Pages that were attached before the observer existed — we queue them
  // and observe on first setup (avoids a race between DOM creation and
  // the $effect that binds the scroll container).
  const pendingNodes = new Set<HTMLDivElement>();

  function sanitizeIndex(i: number) {
    if (sanitized[i] !== undefined) return;
    sanitized[i] = DOMPurify.sanitize(pages[i], SANITIZE_OPTIONS);
  }

  // Reset sanitization cache when a new compile arrives.
  $effect(() => {
    pages;
    sanitized = new Array(pages.length);
    // Eagerly sanitize the first 2 pages so the initial view isn't blank
    // while the IntersectionObserver warms up.
    for (let i = 0; i < Math.min(2, pages.length); i++) sanitizeIndex(i);
  });

  // Create the observer as soon as the scroll container is bound.
  $effect(() => {
    if (!scrollContainer || observer) return;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) sanitizeIndex(idx);
          }
        }
      },
      {
        root: scrollContainer,
        // Pre-sanitize pages one viewport ahead to avoid flicker on scroll.
        rootMargin: '200% 0px',
        threshold: 0,
      },
    );
    for (const node of pendingNodes) observer.observe(node);
    pendingNodes.clear();
  });

  function observeNode(node: HTMLDivElement) {
    if (observer) {
      observer.observe(node);
    } else {
      pendingNodes.add(node);
    }
    return {
      destroy() {
        observer?.unobserve(node);
        pendingNodes.delete(node);
      },
    };
  }

  onDestroy(() => {
    observer?.disconnect();
    observer = null;
    pendingNodes.clear();
  });

  // Preserve scroll position on content updates, scroll to chapter on first load
  $effect(() => {
    if (pages.length > 0 && scrollContainer) {
      const container = scrollContainer;
      tick().then(() => {
        if (scrollToPage > 0 && !hasScrolledToChapter) {
          const pageEls = container.querySelectorAll('.page');
          if (pageEls[scrollToPage]) {
            pageEls[scrollToPage].scrollIntoView({ behavior: 'smooth', block: 'start' });
            hasScrolledToChapter = true;
          }
        } else if (lastScrollTop > 0) {
          container.scrollTop = lastScrollTop;
        }
      });
    }
  });

  $effect(() => {
    if (scrollToPage !== undefined) {
      hasScrolledToChapter = false;
    }
  });

  function onScroll() {
    if (scrollContainer) {
      lastScrollTop = scrollContainer.scrollTop;
    }
  }
</script>

<div class="preview">
  <div class="preview-header">
    <span class="preview-label">Preview</span>
    <div class="preview-header-right">
      {#if compiling}
        <span class="badge compiling">Compiling...</span>
      {:else if error}
        <span class="badge error">Error</span>
      {:else if previewMode === 'svg' && pages.length > 0}
        <span class="badge">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
      {/if}
      <div class="mode-toggle">
        <button class="mode-btn" class:active={previewMode === 'svg'} onclick={() => onModeChange('svg')}>SVG</button>
        <button class="mode-btn" class:active={previewMode === 'pdf'} onclick={() => onModeChange('pdf')}>PDF</button>
      </div>
    </div>
  </div>

  {#if previewMode === 'pdf'}
    <PdfPreviewPanel {pdfData} {error} {compiling} />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="preview-scroll" bind:this={scrollContainer} onscroll={onScroll}>
      {#if error}
        <div class="preview-error">
          <pre>{error}</pre>
        </div>
      {:else if pages.length === 0}
        <div class="preview-empty">
          <p>No preview</p>
          <p class="hint">Save a .typ file to see the preview</p>
        </div>
      {:else}
        {#each pages as _page, i (i)}
          <div
            class="page"
            data-index={i}
            use:observeNode
          >
            {#if sanitized[i] !== undefined}
              {@html sanitized[i]}
            {:else}
              <div class="page-placeholder" aria-label="Loading page {i + 1}"></div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f5f5f5;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;
  }

  .preview-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mode-toggle {
    display: flex;
    background: #f0f0f0;
    border-radius: 6px;
    padding: 2px;
  }

  .mode-btn {
    padding: 2px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    transition: all 0.15s;
  }

  .mode-btn:hover {
    color: #666;
  }

  .mode-btn.active {
    background: #fff;
    color: #333;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .preview-label {
    font-size: 12px;
    font-weight: 600;
    color: #999;
  }

  .badge {
    font-size: 11px;
    color: #aaa;
  }

  .badge.compiling { color: #4f7df9; }
  .badge.error { color: #e55; }

  .preview-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .page {
    background: #fff;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
    margin-bottom: 16px;
    border-radius: 4px;
    overflow: hidden;
    /* Browser-level virtualisation: skip layout/paint for off-screen pages. */
    content-visibility: auto;
    contain-intrinsic-size: 842px;
  }

  .page-placeholder {
    /* Reserve vertical space so scroll position stays stable while a page
       is waiting to be sanitized. Matches contain-intrinsic-size above. */
    height: 842px;
    background: repeating-linear-gradient(
      0deg,
      #fafafa 0,
      #fafafa 20px,
      #f3f3f3 20px,
      #f3f3f3 40px
    );
    opacity: 0.4;
  }

  .page :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }

  .preview-empty {
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

  .preview-error {
    padding: 14px;
    background: #fff5f5;
    border: 1px solid #fee;
    border-radius: 8px;
  }

  .preview-error pre {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    margin: 0;
    color: #c44;
  }
</style>
