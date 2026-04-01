<script lang="ts">
  import { tick } from 'svelte';
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

  let scrollContainer: HTMLDivElement;
  let lastScrollTop = 0;
  let hasScrolledToChapter = false;

  // Preserve scroll position on content updates, but scroll to chapter on first load
  $effect(() => {
    if (pages.length > 0 && scrollContainer) {
      tick().then(() => {
        if (scrollToPage > 0 && !hasScrolledToChapter) {
          // Scroll to the chapter's page
          const pageEls = scrollContainer.querySelectorAll('.page');
          if (pageEls[scrollToPage]) {
            pageEls[scrollToPage].scrollIntoView({ behavior: 'smooth', block: 'start' });
            hasScrolledToChapter = true;
          }
        } else if (lastScrollTop > 0) {
          // Restore previous scroll position on recompile
          scrollContainer.scrollTop = lastScrollTop;
        }
      });
    }
  });

  // Reset chapter scroll flag when scrollToPage changes
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
        {#each pages as page}
          <div class="page">
            {@html DOMPurify.sanitize(page, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['use', 'clipPath', 'mask'], ADD_ATTR: ['xlink:href', 'clip-path', 'mask'] })}
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
