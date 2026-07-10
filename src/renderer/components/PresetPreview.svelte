<script lang="ts">
  import { onMount } from 'svelte';
  import { getLocale } from '@shared/i18n/store.svelte';

  let { title, presetId, canUse = true, onClose, onUse }: {
    title: string;
    presetId: string;
    canUse?: boolean;
    onClose: () => void;
    onUse?: () => void;
  } = $props();

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<any>;
  } }).electronAPI;

  const de = getLocale() === 'de';
  const T = {
    loading: de ? 'Vorschau wird gerendert…' : 'Rendering preview…',
    empty: de ? 'Keine Vorschau verfügbar.' : 'No preview available.',
    use: de ? 'Diese Vorlage verwenden' : 'Use this preset',
    close: de ? 'Schließen' : 'Close',
    page: (i: number, n: number) => de ? `Seite ${i} / ${n}` : `Page ${i} / ${n}`,
  };

  let pages = $state<string[]>([]);
  let loading = $state(true);
  let idx = $state(0);

  onMount(async () => {
    try { pages = (await api.invoke('preset:preview', presetId)) as string[] ?? []; }
    catch { pages = []; }
    loading = false;
  });

  function prev() { if (idx > 0) idx--; }
  function next() { if (idx < pages.length - 1) idx++; }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pv-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="pv-modal" role="dialog" aria-modal="true" aria-label={title}>
    <div class="pv-header">
      <span class="pv-title">{title}</span>
      <button class="pv-close" onclick={onClose} aria-label={T.close}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div class="pv-stage">
      {#if loading}
        <div class="pv-status"><span class="pv-spinner"></span>{T.loading}</div>
      {:else if !pages.length}
        <div class="pv-status">{T.empty}</div>
      {:else}
        <button class="pv-arrow pv-arrow-left" onclick={prev} disabled={idx === 0} aria-label="prev">‹</button>
        <div class="pv-page">
          <img src={pages[idx]} alt={T.page(idx + 1, pages.length)} />
        </div>
        <button class="pv-arrow pv-arrow-right" onclick={next} disabled={idx === pages.length - 1} aria-label="next">›</button>
      {/if}
    </div>

    <div class="pv-footer">
      {#if pages.length}
        <div class="pv-dots">
          {#each pages as _, i}
            <button class="pv-dot" class:active={i === idx} onclick={() => idx = i} aria-label={T.page(i + 1, pages.length)}></button>
          {/each}
          <span class="pv-counter">{T.page(idx + 1, pages.length)}</span>
        </div>
      {:else}
        <div></div>
      {/if}
      <div class="pv-actions">
        <button class="pv-btn-secondary" onclick={onClose}>{T.close}</button>
        {#if canUse && onUse}
          <button class="pv-btn-primary" onclick={onUse}>{T.use}</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .pv-overlay {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(10, 10, 12, 0.62);
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    padding: 3vh 3vw;
  }
  .pv-modal {
    background: #fff; border-radius: 12px; overflow: hidden;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.35);
    width: min(920px, 94vw); max-height: 94vh;
    display: flex; flex-direction: column;
  }
  .pv-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid #f0f0f0; flex: 0 0 auto;
  }
  .pv-title { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .pv-close {
    width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent;
    color: #aaa; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .pv-close:hover { background: #f0f0f0; color: #555; }

  .pv-stage {
    position: relative; flex: 1 1 auto; min-height: 0;
    display: flex; align-items: center; justify-content: center;
    background: #eceef1; padding: 20px;
  }
  .pv-page { max-height: 100%; display: flex; }
  .pv-page img {
    max-height: min(74vh, 900px); max-width: 100%;
    object-fit: contain; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
    background: #fff;
  }
  .pv-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 40px; height: 40px; border: none; border-radius: 50%;
    background: rgba(255, 255, 255, 0.9); color: #333; font-size: 24px; line-height: 1;
    cursor: pointer; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    display: flex; align-items: center; justify-content: center;
  }
  .pv-arrow:hover { background: #fff; }
  .pv-arrow:disabled { opacity: 0.25; cursor: default; }
  .pv-arrow-left { left: 14px; }
  .pv-arrow-right { right: 14px; }

  .pv-status {
    display: flex; align-items: center; gap: 10px;
    color: #8a8a8a; font-size: 13px;
  }
  .pv-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid #ccc; border-top-color: #4f7df9;
    animation: pv-spin 0.7s linear infinite;
  }
  @keyframes pv-spin { to { transform: rotate(360deg); } }

  .pv-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; border-top: 1px solid #f0f0f0; flex: 0 0 auto; gap: 12px;
  }
  .pv-dots { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .pv-dot {
    width: 7px; height: 7px; border-radius: 50%; border: none; padding: 0;
    background: #cfd3da; cursor: pointer;
  }
  .pv-dot.active { background: #4f7df9; }
  .pv-counter { font-size: 11.5px; color: #999; margin-left: 6px; }

  .pv-actions { display: flex; gap: 8px; }
  .pv-btn-secondary {
    padding: 8px 16px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fff;
    color: #666; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer;
  }
  .pv-btn-secondary:hover { background: #f8f8f8; }
  .pv-btn-primary {
    padding: 8px 18px; border: none; border-radius: 8px; background: #4f7df9;
    color: #fff; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer;
  }
  .pv-btn-primary:hover { background: #3d6ce8; }
</style>
