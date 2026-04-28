<script lang="ts">
  interface Chapter {
    includePath: string;
    title: string;
  }

  interface Sections {
    multiChapter: boolean;
    rootFile: string;
    chapters: Chapter[];
    hasBibliography: boolean;
  }

  interface Props {
    initialFormat: 'pdf' | 'docx';
    sections: Sections;
    onClose: () => void;
  }

  let { initialFormat, sections, onClose }: Props = $props();

  let format: 'pdf' | 'docx' = $state(initialFormat);
  let selectedIncludes: Set<string> = $state(new Set(sections.chapters.map(c => c.includePath)));
  let includeBibliography = $state(sections.hasBibliography);
  let exporting = $state(false);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  function toggleChapter(p: string) {
    const next = new Set(selectedIncludes);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    selectedIncludes = next;
  }

  function selectAll() {
    selectedIncludes = new Set(sections.chapters.map(c => c.includePath));
    if (sections.hasBibliography) includeBibliography = true;
  }

  function selectNone() {
    selectedIncludes = new Set();
    includeBibliography = false;
  }

  async function runExport() {
    exporting = true;
    try {
      const allSelected = selectedIncludes.size === sections.chapters.length
        && (!sections.hasBibliography || includeBibliography);

      const result = await api.invoke('export:run', {
        format,
        selectedIncludes: allSelected ? null : Array.from(selectedIncludes),
        includeBibliography,
      }) as { ok: boolean; path: string | null };

      if (result.ok) onClose();
    } catch (err) {
      alert('Export fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      exporting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !exporting) onClose();
  }

  const selectedCount = $derived(selectedIncludes.size + (includeBibliography ? 1 : 0));
  const totalCount = $derived(sections.chapters.length + (sections.hasBibliography ? 1 : 0));
  const canExport = $derived(selectedCount > 0 || sections.chapters.length === 0);
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="overlay"
  onclick={() => { if (!exporting) onClose(); }}
  onkeydown={(e) => { if (e.key === 'Escape' && !exporting) onClose(); }}
  role="dialog"
  tabindex="-1"
  aria-label="Export"
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div class="modal-title">Export</div>
      <button class="close-btn" onclick={onClose} aria-label="Schließen" disabled={exporting}>×</button>
    </div>

    <div class="modal-body">
      <!-- Format -->
      <div class="block">
        <div class="block-label">Format</div>
        <div class="format-row">
          <label class="format-option" class:selected={format === 'pdf'}>
            <input type="radio" name="format" value="pdf" bind:group={format} />
            <div>
              <div class="format-name">PDF</div>
              <div class="format-desc">Druckfertig, mit Layout & Schriften</div>
            </div>
          </label>
          <label class="format-option" class:selected={format === 'docx'}>
            <input type="radio" name="format" value="docx" bind:group={format} />
            <div>
              <div class="format-name">Word (DOCX)</div>
              <div class="format-desc">Mit Word-Stilen & Live-Nummerierung</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Sections -->
      <div class="block">
        <div class="block-header">
          <span class="block-label">Was soll exportiert werden?</span>
          <div class="block-actions">
            <button class="link-btn" onclick={selectAll}>alle</button>
            <button class="link-btn" onclick={selectNone}>keine</button>
          </div>
        </div>

        <ul class="section-list">
          {#each sections.chapters as ch, i}
            <li>
              <label class="section-item">
                <input
                  type="checkbox"
                  checked={selectedIncludes.has(ch.includePath)}
                  onchange={() => toggleChapter(ch.includePath)}
                />
                <div class="section-info">
                  <div class="section-title">{i + 1}. {ch.title}</div>
                  <div class="section-path">{ch.includePath}</div>
                </div>
              </label>
            </li>
          {/each}
          {#if sections.hasBibliography}
            <li>
              <label class="section-item">
                <input type="checkbox" bind:checked={includeBibliography} />
                <div class="section-info">
                  <div class="section-title">Literaturverzeichnis</div>
                  <div class="section-path">#bibliography</div>
                </div>
              </label>
            </li>
          {/if}
        </ul>

        <div class="hint">
          Die Titelseite, das Inhaltsverzeichnis und alles vor dem ersten Kapitel werden immer mit-exportiert.
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="secondary" onclick={onClose} disabled={exporting}>Abbrechen</button>
      <span class="spacer"></span>
      <span class="counter">{selectedCount} / {totalCount} ausgewählt</span>
      <button
        class="primary"
        onclick={runExport}
        disabled={!canExport || exporting}
      >
        {exporting ? 'Exportiere…' : `Als ${format.toUpperCase()} exportieren`}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #fff;
    border-radius: 12px;
    width: min(580px, 92vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #eee;
  }
  .modal-title { flex: 1; font-size: 14px; font-weight: 600; color: #222; }
  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 18px;
  }
  .close-btn:hover:not(:disabled) { background: #f0f0f0; color: #444; }
  .close-btn:disabled { opacity: 0.3; cursor: default; }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .block { margin-bottom: 18px; }
  .block:last-child { margin-bottom: 0; }

  .block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .block-label {
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .block-actions { display: flex; gap: 10px; }

  .link-btn {
    border: none;
    background: none;
    color: #4f7df9;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    padding: 0;
  }
  .link-btn:hover { text-decoration: underline; }

  .format-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .format-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .format-option:hover { border-color: #c5c5c5; }
  .format-option.selected {
    border-color: #4f7df9;
    background: #f8faff;
  }
  .format-option input { margin: 0; }
  .format-name { font-size: 13px; font-weight: 600; color: #222; }
  .format-desc { font-size: 11px; color: #999; margin-top: 1px; }

  .section-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid #efefef;
    border-radius: 8px;
    overflow: hidden;
  }

  .section-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid #f5f5f5;
  }
  .section-list li:last-child .section-item { border-bottom: none; }
  .section-item:hover { background: #fafafa; }
  .section-item input { margin: 0; cursor: pointer; }

  .section-info { flex: 1; min-width: 0; }
  .section-title {
    font-size: 13px;
    color: #333;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .section-path {
    font-size: 11px;
    color: #aaa;
    font-family: 'SF Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 1px;
  }

  .hint {
    font-size: 11px;
    color: #999;
    margin-top: 8px;
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-top: 1px solid #eee;
  }
  .spacer { flex: 1; }
  .counter { font-size: 11px; color: #999; }

  .modal-footer button {
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
  }
  .secondary {
    background: #fff;
    border-color: #e5e5e5;
    color: #555;
  }
  .secondary:hover:not(:disabled) { background: #f5f5f5; }
  .secondary:disabled { opacity: 0.4; cursor: default; }
  .primary {
    background: #4f7df9;
    color: #fff;
  }
  .primary:hover:not(:disabled) { background: #3d6ce8; }
  .primary:disabled { opacity: 0.4; cursor: default; }
</style>
