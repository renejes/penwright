<script lang="ts">
  /**
   * DesignPanel — Phase B sidebar tab for the visual style editor.
   *
   * Round 1 (Sessions 21–22): Color palette + font browser. Each control writes
   * back into the project's `.vswrite/style.json` via `style:save` IPC, which
   * regenerates `style.typ` and kicks off the compiler — the PDF preview reflects
   * the change within ~300 ms of the user releasing the slider.
   *
   * The panel intentionally caches its own copy of `ProjectStyle` and debounces
   * saves: hooking each color-slider tick straight to the compiler would burn
   * CPU and produce flicker. The debounce lives here, not in the IPC handler,
   * because save semantics from menus (Settings dialog) should remain immediate.
   */

  import { onMount, onDestroy } from 'svelte';
  import Coloris from '@melloware/coloris';
  import '@melloware/coloris/dist/coloris.css';
  import {
    type ProjectStyle,
    type StyleColors,
    DEFAULT_PROJECT_STYLE,
    COLOR_SLOTS,
    cloneProjectStyle,
  } from '../../shared/styleTypes';
  import { PALETTE_PRESETS } from '../../shared/palettePresets';

  type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let style: ProjectStyle = $state(cloneProjectStyle(DEFAULT_PROJECT_STYLE));
  let initialized = $state(false);
  let status: Status = $state('idle');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  // Set when we mutate `style` programmatically (preset / extraction). Keeps
  // the $effect-driven save from firing during the initial load.
  let suppressSave = true;

  // ─── Slot labels — short user-facing names for each semantic slot.
  const SLOT_LABEL: Record<keyof StyleColors, string> = {
    primary: 'Primary',
    accent: 'Accent',
    text: 'Text',
    background: 'Background',
    muted: 'Muted',
  };

  const SLOT_HINT: Record<keyof StyleColors, string> = {
    primary: 'Headings, dominant brand color',
    accent: 'Links, emphasis, callouts',
    text: 'Body copy',
    background: 'Page fill',
    muted: 'Captions, secondary info',
  };

  onMount(async () => {
    if (!api) return;
    status = 'loading';

    try {
      const result = await api.invoke('style:get') as
        { style: ProjectStyle; initialized: boolean } | null;
      if (result?.style) {
        style = cloneProjectStyle(result.style);
        initialized = result.initialized;
      }
    } catch (err) {
      console.warn('[DesignPanel] style:get failed:', err);
    }

    // Coloris attaches itself to inputs matching the selector. We pass an
    // onChange that writes back into our state — Svelte's $state proxy is
    // mutation-aware, so the $effect below picks the change up and triggers
    // the debounced save.
    try {
      Coloris.init();
      Coloris({
        el: '.coloris-slot',
        themeMode: 'auto',
        alpha: false,
        format: 'hex',
        margin: 6,
        swatches: [
          '#0f172a', '#1e293b', '#3b82f6', '#0ea5e9', '#10b981',
          '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#ffffff',
        ],
        onChange: (color: string, el: HTMLElement | undefined) => {
          const slot = el?.dataset.slot as keyof StyleColors | undefined;
          if (slot && COLOR_SLOTS.includes(slot)) {
            style.colors[slot] = color.toLowerCase();
          }
        },
      });
    } catch (err) {
      console.warn('[DesignPanel] Coloris init failed:', err);
    }

    // Allow the auto-save effect to fire from here on.
    suppressSave = false;
    status = 'idle';
  });

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
  });

  $effect(() => {
    // Touch every leaf so Svelte tracks all of them.
    const touched = JSON.stringify(style);
    if (suppressSave) return;
    scheduleSave(touched);
  });

  let lastSavedSerialized = '';

  function scheduleSave(serialized: string): void {
    if (!api) return;
    if (serialized === lastSavedSerialized) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      status = 'saving';
      try {
        // Spread to detach from the $state proxy (structured-clone safety).
        await api!.invoke('style:save', JSON.parse(serialized));
        lastSavedSerialized = serialized;
        status = 'saved';
        // Drop the "saved" pill after a moment so the panel feels quiet.
        setTimeout(() => { if (status === 'saved') status = 'idle'; }, 1500);
      } catch (err) {
        console.warn('[DesignPanel] style:save failed:', err);
        status = 'error';
      }
    }, 300);
  }

  function applyPreset(presetId: string): void {
    const preset = PALETTE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    style.colors = { ...preset.colors };
  }

  // The hex-input keeps a synchronized text representation. We accept any
  // three- or six-digit hex; longer strings get truncated.
  function onHexInput(slot: keyof StyleColors, raw: string): void {
    const trimmed = raw.trim();
    if (/^#?[0-9a-fA-F]{3,6}$/.test(trimmed)) {
      const hex = trimmed.startsWith('#') ? trimmed : '#' + trimmed;
      style.colors[slot] = hex.toLowerCase();
    }
  }
</script>

<div class="design-panel">
  <div class="design-header">
    <div class="design-title">Design</div>
    {#if status === 'saving'}
      <span class="design-status saving">Speichere…</span>
    {:else if status === 'saved'}
      <span class="design-status saved">Gespeichert</span>
    {:else if status === 'error'}
      <span class="design-status error">Fehler</span>
    {/if}
  </div>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Farbpalette</h3>
      {#if !initialized}
        <span class="design-section-hint">Defaults aktiv — beim ersten Speichern wird <code>style.json</code> angelegt.</span>
      {/if}
    </header>

    <div class="palette-grid">
      {#each COLOR_SLOTS as slot}
        <div class="palette-slot">
          <div class="palette-slot-label">
            <span class="palette-slot-name">{SLOT_LABEL[slot]}</span>
            <span class="palette-slot-hint">{SLOT_HINT[slot]}</span>
          </div>
          <div class="palette-slot-controls">
            <input
              type="text"
              class="coloris-slot palette-color-input"
              data-coloris
              data-slot={slot}
              value={style.colors[slot]}
              spellcheck="false"
              autocomplete="off"
              aria-label={`${SLOT_LABEL[slot]} color`}
              oninput={(e) => onHexInput(slot, e.currentTarget.value)}
            />
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Paletten-Presets</h3>
    </header>

    <div class="preset-grid">
      {#each PALETTE_PRESETS as preset}
        <button
          type="button"
          class="preset-card"
          onclick={() => applyPreset(preset.id)}
          title={preset.description}
        >
          <div class="preset-swatches">
            <span style="background: {preset.colors.primary}"></span>
            <span style="background: {preset.colors.accent}"></span>
            <span style="background: {preset.colors.text}"></span>
            <span style="background: {preset.colors.muted}"></span>
            <span style="background: {preset.colors.background}; border: 1px solid #ddd"></span>
          </div>
          <div class="preset-name">{preset.name}</div>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .design-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 12px;
    gap: 16px;
    font-size: 12px;
    color: #1a1a1a;
  }

  .design-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #eee;
  }

  .design-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #666;
  }

  .design-status {
    margin-left: auto;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
  }

  .design-status.saving { background: #f0f4ff; color: #3b82f6; }
  .design-status.saved  { background: #f0fdf4; color: #16a34a; }
  .design-status.error  { background: #fef2f2; color: #dc2626; }

  .design-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .design-section-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .design-section-header h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
  }

  .design-section-hint {
    font-size: 10.5px;
    color: #999;
    line-height: 1.4;
  }

  .design-section-hint code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }

  /* Palette */

  .palette-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .palette-slot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .palette-slot-label {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .palette-slot-name {
    font-size: 12px;
    font-weight: 500;
  }

  .palette-slot-hint {
    font-size: 10.5px;
    color: #999;
    line-height: 1.3;
  }

  .palette-slot-controls {
    flex-shrink: 0;
  }

  .palette-color-input {
    width: 96px;
    height: 28px;
    padding: 4px 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: #333;
    background: #fff;
  }

  .palette-color-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: transparent;
  }

  /* Presets */

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .preset-card {
    appearance: none;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .preset-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .preset-swatches {
    display: flex;
    gap: 0;
    height: 18px;
    border-radius: 3px;
    overflow: hidden;
  }

  .preset-swatches span {
    flex: 1 1 0;
    display: block;
  }

  .preset-name {
    font-size: 11px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Coloris theme override — vswrite uses a slightly lighter chrome than the
     Coloris default so the popover doesn't feel out of place. */

  :global(.clr-picker) {
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  }

  :global(.clr-field) {
    width: 100%;
  }

  :global(.clr-field button) {
    border-radius: 3px;
    width: 22px;
    height: 22px;
    top: 3px;
    right: 3px;
  }
</style>
