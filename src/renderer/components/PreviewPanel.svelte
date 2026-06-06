<script lang="ts">
  import PdfPreviewPanel from './PdfPreviewPanel.svelte';
  import { zoomState, zoomPdfIn, zoomPdfOut, resetPdfZoom } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';

  let {
    pdfData = null,
    error = '',
    compiling = false,
  }: {
    pdfData: Uint8Array | null;
    error: string;
    compiling: boolean;
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
      {/if}
      <div class="zoom-controls" role="group" aria-label={t().pickers.previewLabel}>
        <button class="zoom-btn" onclick={zoomPdfOut} title={t().pickers.previewZoomOut} aria-label={t().pickers.previewZoomOut}>−</button>
        <button class="zoom-percent" onclick={resetPdfZoom} title={t().pickers.previewResetZoom} aria-label={t().pickers.previewResetZoom}>{Math.round(zoomState.pdf * 100)}%</button>
        <button class="zoom-btn" onclick={zoomPdfIn} title={t().pickers.previewZoomIn} aria-label={t().pickers.previewZoomIn}>+</button>
      </div>
    </div>
  </div>

  <PdfPreviewPanel {pdfData} {error} {compiling} />
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
