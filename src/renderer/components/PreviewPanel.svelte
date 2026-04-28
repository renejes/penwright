<script lang="ts">
  import PdfPreviewPanel from './PdfPreviewPanel.svelte';

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
    <span class="preview-label">Preview</span>
    <div class="preview-header-right">
      {#if compiling}
        <span class="badge compiling">Compiling…</span>
      {:else if error}
        <span class="badge error">Error</span>
      {/if}
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
</style>
