<script lang="ts">
  import { t } from '@shared/i18n/store.svelte';
  import { untrack } from 'svelte';

  interface Chapter {
    includePath: string;
    title: string;
  }

  interface PrintDefaults {
    bleed: string;
    cropMarks: boolean;
    facingPages: boolean;
    binding: string;
  }

  interface Sections {
    multiChapter: boolean;
    rootFile: string;
    chapters: Chapter[];
    hasBibliography: boolean;
    printDefaults: PrintDefaults;
  }

  interface Props {
    initialFormat: 'pdf' | 'docx';
    sections: Sections;
    onClose: () => void;
  }

  let { initialFormat, sections, onClose }: Props = $props();

  let format: 'pdf' | 'docx' = $state(untrack(() => initialFormat));
  let selectedIncludes: Set<string> = $state(untrack(() => new Set(sections.chapters.map(c => c.includePath))));
  let includeBibliography = $state(untrack(() => sections.hasBibliography));
  let exporting = $state(false);

  // ── Print ("Für den Druck") mode — PDF only, pre-filled from style.json ──
  const pd = untrack(() => sections.printDefaults);
  let printMode = $state(untrack(() => !!(pd.bleed || pd.cropMarks || pd.facingPages || pd.binding)));
  let bleedChoice = $state(untrack(() => {
    const b = pd.bleed || '3mm';
    return (b === '3mm' || b === '5mm') ? b : 'custom';
  }));
  let bleedCustom = $state(untrack(() => (pd.bleed && pd.bleed !== '3mm' && pd.bleed !== '5mm') ? pd.bleed : ''));
  let cropMarks = $state(untrack(() => pd.cropMarks || !pd.bleed)); // default on when freshly enabling
  let facingPages = $state(untrack(() => pd.facingPages));
  let binding = $state(untrack(() => pd.binding || '5mm'));
  let rememberDefault = $state(false);
  let preflightWarnings: string[] = $state([]);

  const effectiveBleed = $derived(bleedChoice === 'custom' ? (bleedCustom.trim() || '3mm') : bleedChoice);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  // Coarse dpi pre-flight: re-run whenever print mode / format / chapter
  // selection changes. A token guards against out-of-order async results.
  let preflightToken = 0;
  $effect(() => {
    const pm = printMode;
    const fmt = format;
    // touch the selection so the effect re-runs when chapters toggle
    const sel = selectedIncludes.size === sections.chapters.length ? null : Array.from(selectedIncludes);
    const bib = includeBibliography;
    if (!pm || fmt !== 'pdf') { preflightWarnings = []; return; }
    const token = ++preflightToken;
    api.invoke('export:preflightImages', { format: 'pdf', selectedIncludes: sel, includeBibliography: bib })
      .then((r) => { if (token === preflightToken) preflightWarnings = (r as { warnings: string[] }).warnings || []; })
      .catch(() => {});
  });

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

      const usePrint = printMode && format === 'pdf';
      const printConfig = usePrint
        ? { bleed: effectiveBleed, cropMarks, facingPages, binding: binding.trim() }
        : undefined;

      // "Remember as default" → merge the print fields into style.json and
      // regenerate style.typ via the normal safe-apply style:save path.
      if (usePrint && rememberDefault) {
        try {
          const cur = await api.invoke('style:get') as { style: Record<string, unknown> } | null;
          if (cur?.style) {
            const layout = { ...(cur.style.layout as Record<string, unknown> ?? {}), ...printConfig };
            await api.invoke('style:save', { ...cur.style, layout });
          }
        } catch { /* non-fatal — the per-export print still applies */ }
      }

      const result = await api.invoke('export:run', {
        format,
        selectedIncludes: allSelected ? null : Array.from(selectedIncludes),
        includeBibliography,
        print: printConfig,
      }) as { ok: boolean; path: string | null };

      if (result.ok) onClose();
    } catch (err) {
      alert(t().exportDialog.failed(err instanceof Error ? err.message : String(err)));
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
  aria-label={t().exportDialog.title}
>
  <div class="modal" role="presentation" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div class="modal-title">{t().exportDialog.title}</div>
      <button class="close-btn" onclick={onClose} aria-label={t().common.close} disabled={exporting}>×</button>
    </div>

    <div class="modal-body">
      <!-- Format -->
      <div class="block">
        <div class="block-label">{t().exportDialog.formatLabel}</div>
        <div class="format-row">
          <label class="format-option" class:selected={format === 'pdf'}>
            <input type="radio" name="format" value="pdf" bind:group={format} />
            <div>
              <div class="format-name">{t().exportDialog.pdfName}</div>
              <div class="format-desc">{t().exportDialog.pdfDesc}</div>
            </div>
          </label>
          <label class="format-option" class:selected={format === 'docx'}>
            <input type="radio" name="format" value="docx" bind:group={format} />
            <div>
              <div class="format-name">{t().exportDialog.docxName}</div>
              <div class="format-desc">{t().exportDialog.docxDesc}</div>
            </div>
          </label>
        </div>
      </div>

      {#if sections.chapters.length > 0 || sections.hasBibliography}
      <!-- Sections -->
      <div class="block">
        <div class="block-header">
          <span class="block-label">{t().exportDialog.sectionsLabel}</span>
          <div class="block-actions">
            <button class="link-btn" onclick={selectAll}>{t().exportDialog.selectAll}</button>
            <button class="link-btn" onclick={selectNone}>{t().exportDialog.selectNone}</button>
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
                  <div class="section-title">{t().exportDialog.bibliography}</div>
                  <div class="section-path">#bibliography</div>
                </div>
              </label>
            </li>
          {/if}
        </ul>

        <div class="hint">
          {t().exportDialog.hint}
        </div>
      </div>
      {/if}

      <!-- Print mode (PDF only) -->
      {#if format === 'pdf'}
        <div class="block">
          <div class="block-label">{t().exportDialog.print.label}</div>
          <label class="print-toggle">
            <input type="checkbox" bind:checked={printMode} />
            <span>{t().exportDialog.print.toggle}</span>
          </label>

          {#if printMode}
            <div class="print-opts">
              <div class="print-row">
                <span class="print-opt-label">{t().exportDialog.print.bleedLabel}</span>
                <select class="print-select" bind:value={bleedChoice}>
                  <option value="3mm">3 mm</option>
                  <option value="5mm">5 mm</option>
                  <option value="custom">{t().exportDialog.print.bleedCustom}</option>
                </select>
                {#if bleedChoice === 'custom'}
                  <input class="len-input" type="text" bind:value={bleedCustom} placeholder="4mm" />
                {/if}
              </div>

              <label class="print-check">
                <input type="checkbox" bind:checked={cropMarks} />
                <span>{t().exportDialog.print.cropMarks}</span>
              </label>

              <label class="print-check">
                <input type="checkbox" bind:checked={facingPages} />
                <span>{t().exportDialog.print.facingPages}</span>
              </label>
              {#if facingPages}
                <div class="print-row indent">
                  <span class="print-opt-label">{t().exportDialog.print.bindingLabel}</span>
                  <input class="len-input" type="text" bind:value={binding} placeholder="5mm" />
                </div>
              {/if}

              <label class="print-check">
                <input type="checkbox" bind:checked={rememberDefault} />
                <span>{t().exportDialog.print.rememberDefault}</span>
              </label>

              {#if preflightWarnings.length > 0}
                <div class="preflight-warn">
                  <div class="preflight-title">⚠ {t().exportDialog.print.lowResTitle(preflightWarnings.length)}</div>
                  <ul>
                    {#each preflightWarnings as w}<li>{w}</li>{/each}
                  </ul>
                </div>
              {/if}

              <div class="hint print-hint">{t().exportDialog.print.hint}</div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="secondary" onclick={onClose} disabled={exporting}>{t().common.cancel}</button>
      <span class="spacer"></span>
      <span class="counter">{t().exportDialog.counter(selectedCount, totalCount)}</span>
      <button
        class="primary"
        onclick={runExport}
        disabled={!canExport || exporting}
      >
        {exporting ? t().exportDialog.exporting : t().exportDialog.exportAs(format.toUpperCase())}
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

  /* ── Print mode ── */
  .print-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
  }
  .print-toggle input { margin: 0; cursor: pointer; }

  .print-opts {
    margin-top: 10px;
    padding: 12px;
    border: 1px solid #efefef;
    border-radius: 8px;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .print-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .print-row.indent { padding-left: 24px; }
  .print-opt-label { font-size: 12px; color: #555; min-width: 96px; }
  .print-select,
  .len-input {
    font-size: 12px;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    font-family: inherit;
    color: #333;
  }
  .len-input { width: 72px; }
  .print-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #444;
    cursor: pointer;
  }
  .print-check input { margin: 0; cursor: pointer; }

  .preflight-warn {
    background: #fff8ec;
    border: 1px solid #f3e2c0;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .preflight-title { font-size: 11px; font-weight: 600; color: #a8742a; }
  .preflight-warn ul {
    margin: 4px 0 0;
    padding-left: 18px;
    font-size: 11px;
    color: #8a6d3b;
    font-family: 'SF Mono', monospace;
  }
  .print-hint { margin-top: 2px; }

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
