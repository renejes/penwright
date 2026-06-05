<script lang="ts">
  /**
   * Design-with-AI popover — the momentary handoff card shown at the pinned
   * selection (right-click → "✨ Design with AI"). Replaces the old permanent
   * hub card in the Design tab: the spot *is* the place, so the card appears
   * right there and goes away once Claude applies the change (or you dismiss
   * it). Reads the pin from `.penwright/selection.json` via `selection:get`.
   */

  import { onMount, onDestroy } from 'svelte';
  import type { SelectionPin } from '../../shared/selectionTypes';
  import { THEME_PRESETS } from '../../shared/themePresets';
  import { getSectionPreset } from '../../shared/sectionPresets';

  let { x, y, onClose }: { x: number; y: number; onClose: () => void } = $props();

  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let pin = $state<SelectionPin | null>(null);
  let copied = $state(false);
  let applied = $state(false);

  const STARTER_PROMPT = [
    'Gestalte die in Penwright gepinnte Auswahl — ruf zuerst `penwright_get_selection` auf,',
    'um den Text und den aktuellen Look zu sehen. Mach daraus: <hier beschreiben>.',
    'Halte es konsistent mit dem bestehenden Theme, der Palette und dem Layout.',
  ].join(' ');

  // Clamp into the viewport (the rect is captured at pin time and fixed).
  const left = $derived(Math.max(12, Math.min(x, window.innerWidth - 320)));
  const top = $derived(Math.max(12, Math.min(y, window.innerHeight - 260)));

  async function loadPin(): Promise<void> {
    if (!api) return;
    try { pin = (await api.invoke('selection:get')) as SelectionPin | null; } catch { pin = null; }
  }

  function onApplied(): void {
    applied = true;
    pin = null;
    setTimeout(onClose, 1800);
  }

  onMount(() => {
    loadPin();
    window.addEventListener('penwright:selection-applied', onApplied);
  });
  onDestroy(() => window.removeEventListener('penwright:selection-applied', onApplied));

  function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
  }
  function themeName(p: SelectionPin): string {
    if (!p.context.theme) return 'Eigenes Design';
    return THEME_PRESETS.find(t => t.id === p.context.theme)?.name ?? p.context.theme;
  }
  function sectionName(id: string): string {
    return getSectionPreset(id)?.name ?? id;
  }

  async function copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(STARTER_PROMPT);
      copied = true;
      setTimeout(() => { copied = false; }, 1800);
    } catch { /* ignore */ }
  }
  function openClaude(): void { api?.invoke('mcp:openClaude'); }
  async function unpin(): Promise<void> {
    try { await api?.invoke('selection:clear'); } catch {}
    onClose();
  }
</script>

<div class="dap" style="left: {left}px; top: {top}px">
  {#if applied}
    <div class="dap-toast">✓ Dokument aktualisiert</div>
  {:else if pin}
    <div class="dap-head">
      <span class="dap-title">✨ Design with AI</span>
      <button class="dap-x" onclick={unpin} title="Lösen" aria-label="Lösen">×</button>
    </div>
    <blockquote class="dap-preview">{truncate(pin.selectionText, 160)}</blockquote>
    <ul class="dap-ctx">
      <li><span>Theme</span><strong>{themeName(pin)}</strong></li>
      <li><span>Akzent</span><strong><i class="dap-swatch" style="background:{pin.context.palette.accent}"></i>{pin.context.palette.accent}</strong></li>
      {#if pin.context.sectionStyle}<li><span>Rubrik</span><strong>{sectionName(pin.context.sectionStyle)}</strong></li>{/if}
    </ul>
    <div class="dap-actions">
      <button class="dap-btn primary" onclick={copyPrompt}>{copied ? '✓ Kopiert' : 'Prompt kopieren'}</button>
      <button class="dap-btn" onclick={openClaude}>Claude öffnen</button>
    </div>
    <p class="dap-hint">In Claude einfügen, „&lt;hier beschreiben&gt;“ ersetzen, absenden. Erscheint danach automatisch hier.</p>
  {/if}
</div>

<style>
  .dap {
    position: fixed;
    z-index: 900;
    width: 300px;
    background: #fbfaf7;
    border: 1px solid #ece6dd;
    border-left: 3px solid #a8503a;
    border-radius: 8px;
    box-shadow: 0 12px 36px rgba(33, 30, 26, 0.22);
    padding: 12px;
    font-size: 12px;
    color: #3a352e;
  }

  .dap-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .dap-title { font-weight: 700; color: #a8503a; font-size: 12.5px; }
  .dap-x { border: none; background: transparent; color: #998f7f; font-size: 17px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .dap-x:hover { color: #6b6356; }

  .dap-preview {
    margin: 0 0 8px;
    padding: 6px 9px;
    border-left: 2px solid #d8cfc1;
    background: #fff;
    border-radius: 0 3px 3px 0;
    font-style: italic;
    font-size: 11.5px;
    line-height: 1.4;
    color: #3a352e;
    max-height: 5em;
    overflow: hidden;
  }

  .dap-ctx { list-style: none; margin: 0 0 9px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .dap-ctx li { display: flex; align-items: center; gap: 8px; font-size: 11px; }
  .dap-ctx li span { flex: 0 0 54px; color: #998f7f; }
  .dap-ctx li strong { font-weight: 500; color: #3a352e; display: inline-flex; align-items: center; gap: 5px; }
  .dap-swatch { width: 11px; height: 11px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.12); display: inline-block; }

  .dap-actions { display: flex; gap: 6px; }
  .dap-btn {
    flex: 1; padding: 6px 8px; border: 1px solid #d8cfc1; border-radius: 5px;
    background: #fff; color: #3a352e; font-size: 11px; font-weight: 500; cursor: pointer;
  }
  .dap-btn:hover { background: #f4f1ec; }
  .dap-btn.primary { background: #a8503a; border-color: #a8503a; color: #fff; }
  .dap-btn.primary:hover { background: #95462f; }

  .dap-hint { margin: 8px 0 0; font-size: 10px; color: #998f7f; line-height: 1.4; }

  .dap-toast { color: #16a34a; font-weight: 600; font-size: 12px; padding: 6px 4px; text-align: center; }
</style>
