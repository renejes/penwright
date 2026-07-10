<script lang="ts">
  import { onMount } from 'svelte';
  import { t, getLocale } from '@shared/i18n/store.svelte';
  import { PROJECT_TYPES, localize, type GalleryItem } from '@shared/presetTypes';
  import PresetPreview from './PresetPreview.svelte';

  // `templates` is kept for back-compat with the caller but no longer used —
  // the gallery (blank starters + rich presets) is fetched from main.
  let { onClose }: { templates?: unknown; onClose: () => void } = $props();

  const api = (window as unknown as { electronAPI: {
    send(channel: string, data: unknown): void;
    invoke(channel: string, ...args: unknown[]): Promise<any>;
  } }).electronAPI;

  let gallery = $state<GalleryItem[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let selectedKey = $state('');
  let projectName = $state('');
  let previewItem = $state<GalleryItem | null>(null);

  const locale = getLocale();
  const de = locale === 'de';

  function openPreview(item: GalleryItem, e: MouseEvent) {
    e.stopPropagation();
    selectedKey = item.key;
    previewItem = item;
  }

  function useFromPreview() {
    const item = previewItem;
    previewItem = null;
    if (item) { selectedKey = item.key; create(); }
  }

  async function loadGallery() {
    loading = true;
    try {
      gallery = (await api.invoke('preset:gallery')) ?? [];
    } catch { gallery = []; }
    if (!gallery.some((g) => g.key === selectedKey)) selectedKey = gallery[0]?.key ?? '';
    loading = false;
  }

  onMount(loadGallery);

  // Group the flat gallery by project type, in the canonical type order.
  const groups = $derived(
    PROJECT_TYPES
      .map((type) => ({
        id: type.id,
        label: localize(type.label, locale),
        icon: type.icon,
        items: gallery.filter((g) => g.type === type.id),
      }))
      .filter((g) => g.items.length > 0),
  );

  const selected = $derived(gallery.find((g) => g.key === selectedKey));
  const needsName = $derived(selected?.kind === 'template');
  const createDisabled = $derived(creating || !selected || (needsName && !projectName.trim()));

  function slug(s: string): string {
    return s.trim().replace(/\s+/g, '-').toLowerCase();
  }

  async function create() {
    if (!selected || creating) return;
    if (selected.kind === 'template') {
      if (!projectName.trim()) return;
      api.send('penwright', { type: 'createProject', templateId: selected.id, projectName: slug(projectName) });
      onClose();
    } else {
      creating = true;
      try {
        const res = await api.invoke('preset:create', selected.id, projectName.trim() || undefined);
        if (res?.ok) onClose();
      } finally {
        creating = false;
      }
    }
  }

  async function deletePreset(item: GalleryItem, e: MouseEvent) {
    e.stopPropagation();
    const msg = locale === 'de' ? `Preset „${item.label}" löschen?` : `Delete preset “${item.label}”?`;
    if (!confirm(msg)) return;
    try { await api.invoke('preset:delete', item.id); } catch { /* ignore */ }
    await loadGallery();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !createDisabled) create();
    if (e.key === 'Escape') onClose();
  }

  function focusOnMount(node: HTMLElement) { node.focus(); }

  const savedLabel = locale === 'de' ? 'Meins' : 'Yours';
</script>

<div class="dialog-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={t().pickers.newProjectTitle} tabindex="-1" onkeydown={handleKeydown}>
    <div class="dialog-header">
      <h2>{t().pickers.newProjectTitle}</h2>
      <button class="close-btn" onclick={onClose} aria-label={t().common.close}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div class="dialog-body">
      <label class="field-label" for="np-project-name">{t().pickers.newProjectNameLabel}</label>
      <input
        id="np-project-name"
        class="field-input"
        type="text"
        bind:value={projectName}
        placeholder={t().pickers.newProjectNamePlaceholder}
        use:focusOnMount
      />

      {#if loading}
        <div class="gallery-loading">…</div>
      {:else}
        {#each groups as group (group.id)}
          <div class="type-group">
            <div class="type-header"><span class="type-icon">{group.icon}</span><span>{group.label}</span></div>
            <div class="card-grid">
              {#each group.items as item (item.key)}
                <div
                  class="card"
                  class:selected={selectedKey === item.key}
                  class:blank={item.kind === 'template'}
                  role="button"
                  tabindex="0"
                  onclick={() => selectedKey = item.key}
                  ondblclick={() => { selectedKey = item.key; if (!createDisabled) create(); }}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectedKey = item.key; if (e.key === ' ') e.preventDefault(); } }}
                  title={item.tagline}
                >
                  <div class="thumb">
                    {#if item.thumbnail}
                      <img src={item.thumbnail} alt="" loading="lazy" />
                    {:else}
                      <span class="thumb-icon">{item.icon}</span>
                    {/if}
                    {#if item.kind === 'preset'}
                      <button class="preview-btn" onclick={(e) => openPreview(item, e)}>{de ? 'Vorschau' : 'Preview'}</button>
                    {/if}
                    {#if item.origin === 'user'}
                      <span class="badge">{savedLabel}</span>
                      <button class="del" title={t().common.delete ?? 'Delete'} onclick={(e) => deletePreset(item, e)} aria-label="delete">×</button>
                    {/if}
                  </div>
                  <span class="card-label">{item.label}</span>
                  <span class="card-tagline">{item.tagline}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="dialog-footer">
      {#if selected && selected.highlights.length}
        <div class="footer-highlights" title={selected.highlights.join(' · ')}>{selected.highlights[0]}</div>
      {/if}
      <button class="btn-secondary" onclick={onClose}>{t().common.cancel}</button>
      <button class="btn-primary" onclick={create} disabled={createDisabled}>
        {creating ? '…' : t().pickers.newProjectCreate}
      </button>
    </div>
  </div>
</div>

{#if previewItem}
  <PresetPreview
    title={previewItem.label}
    presetId={previewItem.id}
    onClose={() => previewItem = null}
    onUse={useFromPreview}
  />
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    backdrop-filter: blur(2px);
  }

  .dialog {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    width: 760px;
    max-width: 94vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 12px;
  }

  .dialog-header h2 { font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0; }

  .close-btn {
    width: 28px; height: 28px; border: none; border-radius: 6px;
    background: transparent; color: #aaa; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .close-btn:hover { background: #f0f0f0; color: #555; }

  .dialog-body { padding: 8px 24px 20px; overflow-y: auto; }

  .field-label {
    display: block; font-size: 12px; font-weight: 600; color: #888;
    margin-bottom: 6px; margin-top: 16px; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .field-label:first-child { margin-top: 0; }

  .field-input {
    width: 100%; padding: 10px 14px; border: 1px solid #e5e5e5; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #333; outline: none; transition: border-color 0.15s;
  }
  .field-input:focus { border-color: #4f7df9; }

  .gallery-loading { color: #bbb; text-align: center; padding: 40px; font-size: 24px; }

  .type-group { margin-top: 22px; }
  .type-header {
    display: flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 700; color: #444; margin-bottom: 10px;
  }
  .type-icon { font-size: 15px; }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .card {
    display: flex; flex-direction: column; text-align: left;
    padding: 0; border: 2px solid #eee; border-radius: 10px; background: #fff;
    cursor: pointer; overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .card:hover { border-color: #cfd8f5; }
  .card.selected { border-color: #4f7df9; box-shadow: 0 0 0 3px rgba(79, 125, 249, 0.12); }

  .thumb {
    position: relative;
    aspect-ratio: 4 / 5;
    background: #f4f4f2;
    display: flex; align-items: center; justify-content: center;
    border-bottom: 1px solid #f0f0f0;
    overflow: hidden;
  }
  .thumb img { width: 100%; height: 100%; object-fit: contain; object-position: center top; }
  .card.blank .thumb { background: repeating-linear-gradient(45deg, #fafafa, #fafafa 8px, #f4f4f4 8px, #f4f4f4 16px); }
  .thumb-icon { font-size: 34px; opacity: 0.5; }

  .preview-btn {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    padding: 5px 12px; border: none; border-radius: 20px;
    background: rgba(20, 22, 28, 0.82); color: #fff;
    font-size: 11.5px; font-weight: 600; font-family: inherit;
    cursor: pointer; opacity: 0; transition: opacity 0.12s; white-space: nowrap;
  }
  .card:hover .preview-btn { opacity: 1; }
  .preview-btn:hover { background: rgba(20, 22, 28, 0.96); }

  .badge {
    position: absolute; top: 6px; left: 6px;
    background: rgba(79, 125, 249, 0.92); color: #fff;
    font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
    padding: 2px 6px; border-radius: 5px;
  }
  .del {
    position: absolute; top: 5px; right: 5px;
    width: 20px; height: 20px; border: none; border-radius: 5px;
    background: rgba(0, 0, 0, 0.45); color: #fff; font-size: 14px; line-height: 1;
    cursor: pointer; opacity: 0; transition: opacity 0.12s;
  }
  .card:hover .del { opacity: 1; }
  .del:hover { background: rgba(200, 40, 40, 0.9); }

  .card-label { font-size: 13px; font-weight: 600; color: #333; padding: 8px 10px 0; }
  .card-tagline {
    font-size: 11px; color: #999; line-height: 1.3; padding: 2px 10px 10px;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }

  .dialog-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: 8px;
    padding: 14px 24px; border-top: 1px solid #f0f0f0;
  }
  .footer-highlights {
    margin-right: auto; font-size: 12px; color: #888;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%;
  }

  .btn-secondary {
    padding: 8px 18px; border: 1px solid #e5e5e5; border-radius: 8px;
    background: #fff; color: #666; font-size: 13px; font-family: inherit; font-weight: 500; cursor: pointer;
  }
  .btn-secondary:hover { background: #f8f8f8; }

  .btn-primary {
    padding: 8px 20px; border: none; border-radius: 8px;
    background: #4f7df9; color: #fff; font-size: 13px; font-family: inherit; font-weight: 500;
    cursor: pointer; transition: background 0.15s;
  }
  .btn-primary:hover { background: #3d6ce8; }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }
</style>
