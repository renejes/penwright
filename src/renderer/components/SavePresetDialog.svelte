<script lang="ts">
  import { getLocale } from '@shared/i18n/store.svelte';
  import { PROJECT_TYPES, localize } from '@shared/presetTypes';

  let { onClose }: { onClose: () => void } = $props();

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<any>;
  } }).electronAPI;

  const locale = getLocale();
  const de = locale === 'de';

  let label = $state('');
  let type = $state('document');
  let tagline = $state('');
  let saving = $state(false);
  let error = $state('');
  let done = $state(false);

  const types = PROJECT_TYPES.map((t) => ({ id: t.id, label: localize(t.label, locale) }));

  const T = {
    title: de ? 'Als Preset speichern' : 'Save as Preset',
    intro: de
      ? 'Speichert das aktuelle Projekt als wiederverwendbares Preset — es erscheint dann in „Neues Projekt".'
      : 'Saves the current project as a reusable preset — it then appears under “New Project”.',
    nameLabel: de ? 'Name' : 'Name',
    namePh: de ? 'Mein Preset' : 'My preset',
    typeLabel: de ? 'Kategorie' : 'Category',
    taglineLabel: de ? 'Kurzbeschreibung (optional)' : 'Tagline (optional)',
    taglinePh: de ? 'Wofür ist dieses Preset?' : 'What is this preset for?',
    save: de ? 'Preset speichern' : 'Save preset',
    cancel: de ? 'Abbrechen' : 'Cancel',
    close: de ? 'Schließen' : 'Close',
    saving: de ? 'Speichere…' : 'Saving…',
    okMsg: de ? 'Preset gespeichert. Du findest es in „Neues Projekt".' : 'Preset saved. Find it under “New Project”.',
    errNoProject: de ? 'Kein Projekt geöffnet.' : 'No project is open.',
    errNoLabel: de ? 'Bitte einen Namen eingeben.' : 'Please enter a name.',
    errGeneric: de ? 'Speichern fehlgeschlagen.' : 'Could not save the preset.',
  };

  async function save() {
    if (saving) return;
    if (!label.trim()) { error = T.errNoLabel; return; }
    saving = true;
    error = '';
    try {
      const res = await api.invoke('preset:save', { label: label.trim(), type, tagline: tagline.trim() });
      if (res?.ok) { done = true; }
      else error = res?.error === 'no-project' ? T.errNoProject : res?.error === 'no-label' ? T.errNoLabel : T.errGeneric;
    } catch {
      error = T.errGeneric;
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !done) save();
    if (e.key === 'Escape') onClose();
  }
  function focusOnMount(node: HTMLElement) { node.focus(); }
</script>

<div class="dialog-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={T.title} tabindex="-1" onkeydown={handleKeydown}>
    <div class="dialog-header">
      <h2>{T.title}</h2>
      <button class="close-btn" onclick={onClose} aria-label={T.close}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div class="dialog-body">
      {#if done}
        <p class="ok">{T.okMsg}</p>
      {:else}
        <p class="intro">{T.intro}</p>

        <label class="field-label" for="sp-label">{T.nameLabel}</label>
        <input id="sp-label" class="field-input" type="text" bind:value={label} placeholder={T.namePh} use:focusOnMount />

        <label class="field-label" for="sp-type">{T.typeLabel}</label>
        <select id="sp-type" class="field-input" bind:value={type}>
          {#each types as t}
            <option value={t.id}>{t.label}</option>
          {/each}
        </select>

        <label class="field-label" for="sp-tagline">{T.taglineLabel}</label>
        <input id="sp-tagline" class="field-input" type="text" bind:value={tagline} placeholder={T.taglinePh} />

        {#if error}<p class="error">{error}</p>{/if}
      {/if}
    </div>

    <div class="dialog-footer">
      {#if done}
        <button class="btn-primary" onclick={onClose}>{T.close}</button>
      {:else}
        <button class="btn-secondary" onclick={onClose}>{T.cancel}</button>
        <button class="btn-primary" onclick={save} disabled={saving || !label.trim()}>{saving ? T.saving : T.save}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 300; backdrop-filter: blur(2px); }
  .dialog { background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); width: 460px; max-width: 90vw; display: flex; flex-direction: column; overflow: hidden; }
  .dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 8px; }
  .dialog-header h2 { font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0; }
  .close-btn { width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: #aaa; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .close-btn:hover { background: #f0f0f0; color: #555; }
  .dialog-body { padding: 4px 24px 20px; }
  .intro { font-size: 13px; color: #777; line-height: 1.4; margin: 0 0 4px; }
  .ok { font-size: 14px; color: #2f7d4f; line-height: 1.5; margin: 8px 0; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: #888; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-input { width: 100%; padding: 10px 14px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; font-family: inherit; color: #333; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .field-input:focus { border-color: #4f7df9; }
  .error { font-size: 12.5px; color: #c0392b; margin: 12px 0 0; }
  .dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px; border-top: 1px solid #f0f0f0; }
  .btn-secondary { padding: 8px 18px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fff; color: #666; font-size: 13px; font-family: inherit; font-weight: 500; cursor: pointer; }
  .btn-secondary:hover { background: #f8f8f8; }
  .btn-primary { padding: 8px 20px; border: none; border-radius: 8px; background: #4f7df9; color: #fff; font-size: 13px; font-family: inherit; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: #3d6ce8; }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }
</style>
