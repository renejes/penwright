<script lang="ts">
  /**
   * The iPad stand-in for the Mac menu bar. Same names, same order.
   * An entry that cannot run here stays in place and says so.
   */
  import { t } from '@shared/i18n/store.svelte';
  import { ipc } from '../../editor/lib/ipcAdapter';
  import {
    editorRef,
    panelState,
    projectState,
    resetEditorZoom,
    tabState,
    uiState,
    zoomEditorIn,
    zoomEditorOut,
  } from '../appState.svelte';

  let open = $state(false);

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  type Row = {
    id: string;
    kind: 'head' | 'item';
    label: string;
    macOnly?: boolean;
    dim?: boolean;
    run?: () => void;
  };

  function macOnly() {
    uiState.banner = t().app.macOnly;
    open = false;
  }

  function save() {
    window.dispatchEvent(new CustomEvent('penwright:read-editor', {
      detail: { content: '', send: true },
    }));
  }

  async function chooseZoteroPdfs() {
    open = false;
    try {
      const result = await api.invoke('project:pickZoteroPdfFolder') as { ok?: boolean; name?: string };
      if (result?.ok && result.name) uiState.banner = t().menu.zoteroPdfFolderReady(result.name);
    } catch (err) {
      uiState.banner = err instanceof Error ? err.message : String(err);
    }
  }

  async function closeProject() {
    save();
    await api.invoke('project:close');
  }

  function edit(run: (editor: NonNullable<typeof editorRef.current>) => void) {
    const editor = editorRef.current;
    if (!editor) return;
    run(editor);
  }

  function rows(): Row[] {
    const m = t().menu;
    const file = !!editorRef.current && !!tabState.currentFile;
    const project = projectState.open || !!tabState.currentFile;
    const item = (
      id: string,
      label: string,
      run: () => void,
      opts?: { macOnly?: boolean; dim?: boolean },
    ): Row => ({ id, kind: 'item', label, run, macOnly: opts?.macOnly, dim: opts?.dim });
    const head = (id: string, label: string): Row => ({ id, kind: 'head', label });
    return [
      head('file', m.file),
      item('new', m.newProject, () => ipc.send({ type: 'newProject' })),
      item('open', m.openProject, () => { void api.invoke('project:open'); }),
      item('close', m.closeProject, () => { void closeProject(); }, { dim: !project }),
      item('preset', m.saveAsPreset, macOnly, { macOnly: true }),
      item('save', m.save, save, { dim: !file }),
      item('save-as', m.saveAs, macOnly, { macOnly: true }),
      item('pdf', m.exportPdf, macOnly, { macOnly: true }),
      item('docx', m.exportDocx, macOnly, { macOnly: true }),
      item('web', m.exportWeb, macOnly, { macOnly: true }),
      item('import', m.importMarkdown, macOnly, { macOnly: true }),
      item('zotero', m.zoteroPdfFolder, () => { void chooseZoteroPdfs(); }),
      item('sources', m.openSources, macOnly, { macOnly: true }),
      item('cite', m.addCitation, macOnly, { macOnly: true }),

      head('edit', m.edit),
      item('undo', m.undo, () => edit((e) => { e.chain().focus().undo().run(); }), { dim: !file }),
      item('redo', m.redo, () => edit((e) => { e.chain().focus().redo().run(); }), { dim: !file }),
      item('cut', m.cut, () => edit((e) => { e.commands.focus(); document.execCommand('cut'); }), { dim: !file }),
      item('copy', m.copy, () => edit((e) => { e.commands.focus(); document.execCommand('copy'); }), { dim: !file }),
      item('paste', m.paste, () => edit((e) => { e.commands.focus(); document.execCommand('paste'); }), { dim: !file }),
      item('all', m.selectAll, () => edit((e) => { e.chain().focus().selectAll().run(); }), { dim: !file }),
      item('find', m.findReplace, () => { uiState.showSearch = true; }, { dim: !file }),
      item('find-project', m.findInProject, macOnly, { macOnly: true }),
      item('comment', m.addComment, () => window.dispatchEvent(new CustomEvent('penwright:add-comment')), { dim: !file }),
      item('ref', m.insertReference, () => window.dispatchEvent(new CustomEvent('penwright:open-reference-picker')), { dim: !file }),
      item('undo-ai', m.undoAiEdit, macOnly, { macOnly: true }),

      head('view', m.view),
      item('sidebar', m.toggleSidebar, () => { panelState.showSidebar = !panelState.showSidebar; }, { dim: !project }),
      item('preview', m.togglePreview, macOnly, { macOnly: true }),
      item('chat', m.toggleChat, macOnly, { macOnly: true }),
      head('editor-zoom', m.editorZoom),
      item('zin', m.zoomIn, zoomEditorIn),
      item('zout', m.zoomOut, zoomEditorOut),
      item('zreset', m.reset, resetEditorZoom),
      head('preview-zoom', m.previewZoom),
      item('pzin', `${m.previewZoom} · ${m.zoomIn}`, macOnly, { macOnly: true }),
      item('pzout', `${m.previewZoom} · ${m.zoomOut}`, macOnly, { macOnly: true }),
      item('pzreset', `${m.previewZoom} · ${m.reset}`, macOnly, { macOnly: true }),

      head('document', m.document),
      item('settings', m.documentSettings, macOnly, { macOnly: true }),
      item('merge', m.mergeDocument, macOnly, { macOnly: true }),
      item('split', m.splitDocument, macOnly, { macOnly: true }),
      item('source', m.openAsTypst, macOnly, { macOnly: true }),
      item('bib', m.ensureBibliography, macOnly, { macOnly: true }),

      head('help', m.help),
      item('intro', m.showIntroduction, macOnly, { macOnly: true }),
      item('guide', m.userGuide, () => { uiState.showHandbook = true; }),
      item('keys', m.keyboardShortcuts, () => { uiState.showShortcuts = true; }),
      item('issue', m.reportIssue, () => { window.location.href = 'mailto:feedback@penwright.online'; }),
      item('mcp', m.mcpConnection, macOnly, { macOnly: true }),
      item('crash', m.openCrashReports, macOnly, { macOnly: true }),
      item('about', m.about('Penwright'), () => { uiState.showAbout = true; }),
    ];
  }

  function choose(row: Row) {
    if (row.kind !== 'item') return;
    if (row.macOnly) {
      macOnly();
      return;
    }
    if (row.dim) return;
    row.run?.();
    open = false;
  }

  function onKey(event: KeyboardEvent) {
    if (open && event.key === 'Escape') open = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="ipad-menu">
  <button
    class="menu-btn"
    type="button"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={t().app.menuButton}
    onclick={() => { open = !open; }}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <span>{t().app.menuButton}</span>
  </button>

  {#if open}
    <button class="backdrop" type="button" aria-label={t().common.close} onclick={() => { open = false; }}></button>
    <div class="sheet" role="menu">
      {#each rows() as row (row.id)}
        {#if row.kind === 'head'}
          <div class="head" role="presentation">{row.label}</div>
        {:else}
          <button
            class="row"
            class:mac={row.macOnly}
            class:dim={row.dim && !row.macOnly}
            type="button"
            role="menuitem"
            onclick={() => choose(row)}
          >
            <span>{row.label}</span>
            {#if row.macOnly}<span class="hint">{t().app.macOnly}</span>{/if}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .ipad-menu { position: relative; flex-shrink: 0; }
  .menu-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: #333;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    border: none;
    background: transparent;
    z-index: 40;
  }
  .sheet {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 41;
    width: min(320px, 86vw);
    max-height: min(70vh, 560px);
    overflow: auto;
    background: #fff;
    border: 1px solid #e6e6e6;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
    padding: 6px 0 10px;
  }
  .head {
    padding: 12px 14px 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #999;
  }
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: #222;
    font: inherit;
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: #f4f7ff; }
  .row.mac, .row.dim { color: #9a9a9a; }
  .hint { flex-shrink: 0; font-size: 12px; color: #b0b0b0; }
</style>
