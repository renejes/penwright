<script lang="ts">
  import PdfPreviewPanel from './PdfPreviewPanel.svelte';
  import { zoomState, zoomPdfIn, zoomPdfOut, resetPdfZoom, togglePdfSpread } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';

  let {
    pdfData = null,
    error = '',
    compiling = false,
    mode = 'auto',
    dirty = false,
    scrollTarget = '',
    onRefresh,
  }: {
    pdfData: Uint8Array | null;
    error: string;
    compiling: boolean;
    mode?: 'auto' | 'manual';
    dirty?: boolean;
    scrollTarget?: string;
    onRefresh?: () => void;
  } = $props();
</script>

<div class="preview">
  <div class="preview-header">
    <span class="preview-label">{t().pickers.previewLabel}</span>
    <div class="preview-header-right">
      {#if compiling}
        <span class="badge compiling">{t().pickers.previewCompiling}</span>
      {:else if error}
        <span class="badge error">{t().pickers.previewError}</span>
      {:else if mode === 'manual' && dirty}
        <span class="badge outdated">{t().pickers.previewOutdated}</span>
      {/if}
      <button
        class="refresh-btn"
        class:attention={mode === 'manual' && dirty && !compiling}
        onclick={() => onRefresh?.()}
        title={t().pickers.previewRefresh}
        aria-label={t().pickers.previewRefresh}
      >↻</button>
      <button
        class="spread-btn"
        class:active={zoomState.spread}
        onclick={togglePdfSpread}
        title={zoomState.spread ? t().pickers.previewSpreadOff : t().pickers.previewSpreadOn}
        aria-label={zoomState.spread ? t().pickers.previewSpreadOff : t().pickers.previewSpreadOn}
        aria-pressed={zoomState.spread}
      >▭▭</button>
      <div class="zoom-controls" role="group" aria-label={t().pickers.previewLabel}>
        <button class="zoom-btn" onclick={zoomPdfOut} title={t().pickers.previewZoomOut} aria-label={t().pickers.previewZoomOut}>−</button>
        <button class="zoom-percent" onclick={resetPdfZoom} title={t().pickers.previewResetZoom} aria-label={t().pickers.previewResetZoom}>{Math.round(zoomState.pdf * 100)}%</button>
        <button class="zoom-btn" onclick={zoomPdfIn} title={t().pickers.previewZoomIn} aria-label={t().pickers.previewZoomIn}>+</button>
      </div>
    </div>
  </div>

  <PdfPreviewPanel {pdfData} {error} {compiling} {scrollTarget} spread={zoomState.spread} />
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
  .badge.outdated { color: #c98a3a; }

  .refresh-btn {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    border-radius: 4px;
    padding: 0;
  }
  .refresh-btn:hover { background: #f0f0f0; color: #444; }
  .refresh-btn.attention { color: #a8503a; }

  .spread-btn {
    height: 22px;
    min-width: 30px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 11px;
    letter-spacing: -2px;
    border-radius: 4px;
    padding: 0 5px;
    line-height: 1;
  }
  .spread-btn:hover { background: #f0f0f0; color: #444; }
  .spread-btn.active { color: #4f7df9; background: #eef3ff; }

  .zoom-controls {
    display: flex;
    align-items: center;
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
</style>
