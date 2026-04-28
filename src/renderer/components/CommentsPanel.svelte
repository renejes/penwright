<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { tabState, editorRef } from '../appState.svelte';
  import { setCommentMarks, type CommentMark } from '../../editor/lib/commentDecorations';

  interface CommentEntry {
    id: string;
    file: string;
    anchor: string;
    rangeStart: number;
    rangeEnd: number;
    author: string;
    date: string;
    resolved: boolean;
    body: string;
    filePath: string;
    orphaned?: boolean;
  }

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, callback: (data: unknown) => void): void;
  } }).electronAPI;

  let comments: CommentEntry[] = $state([]);
  let showResolved = $state(false);
  let scope: 'file' | 'project' = $state('file');
  let activeId = $state('');
  let bodyDrafts: Record<string, string> = $state({});
  let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  // ── Path helpers ──────────────────────────────────────
  let projectDir = $state('');

  async function loadProjectInfo() {
    try {
      const info = await api.invoke('project:getInfo') as { projectDir: string | null };
      projectDir = info.projectDir ?? '';
    } catch {
      projectDir = '';
    }
  }

  function relPathForCurrentFile(): string {
    if (!projectDir || !tabState.currentFile) return '';
    const rel = tabState.currentFile.startsWith(projectDir + '/')
      ? tabState.currentFile.slice(projectDir.length + 1)
      : tabState.currentFile;
    return rel.replace(/\\/g, '/');
  }

  // ── Loading ───────────────────────────────────────────
  async function loadComments() {
    if (!projectDir) {
      comments = [];
      return;
    }
    try {
      const opts = scope === 'file' && tabState.currentFile
        ? { forFile: relPathForCurrentFile(), includeResolved: showResolved }
        : { includeResolved: showResolved };
      const list = await api.invoke('comments:list', opts) as CommentEntry[];
      comments = list;
      // Seed body drafts (don't clobber in-progress edits the user has made)
      for (const c of list) {
        if (bodyDrafts[c.id] === undefined) bodyDrafts[c.id] = c.body;
      }
    } catch (err) {
      console.error('[vswrite] Failed to load comments:', err);
      comments = [];
    }
    pushDecorations();
  }

  function pushDecorations() {
    const editor = editorRef.current;
    if (!editor) return;
    // Decorations only for comments anchored to the *current* file
    const rel = relPathForCurrentFile();
    const marks: CommentMark[] = comments
      .filter((c) => c.file === rel)
      .map((c) => ({ id: c.id, anchor: c.anchor, resolved: c.resolved, orphaned: c.orphaned }));
    setCommentMarks(editor, marks);
  }

  // Reload when the current file changes — anchor positions are file-scoped.
  // The decoration plugin re-derives highlights on docChanged itself, so we
  // do NOT push decorations on every editorVersion bump (that would dispatch
  // a transaction → onTransaction → editorVersion++ → infinite loop).
  $effect(() => {
    void tabState.currentFile;
    void scope;
    void showResolved;
    if (projectDir) loadComments();
  });

  // ── Listeners ─────────────────────────────────────────
  function onFiletreeChanged() {
    loadComments();
  }

  function onCommentClick(e: Event) {
    const detail = (e as CustomEvent<{ id: string }>).detail;
    if (!detail?.id) return;
    activeId = detail.id;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-comment-card-id="${CSS.escape(detail.id)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function onCreateComment(e: Event) {
    const detail = (e as CustomEvent<CommentEntry>).detail;
    if (!detail?.id) return;
    // The creator already wrote the file; just refresh.
    await loadComments();
    activeId = detail.id;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-comment-card-id="${CSS.escape(detail.id)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const ta = el?.querySelector('textarea') as HTMLTextAreaElement | null;
      ta?.focus();
    });
  }

  onMount(async () => {
    await loadProjectInfo();
    await loadComments();
    api.on('vswrite', (data: unknown) => {
      const msg = data as { type: string };
      if (msg.type === 'filetreeChanged' || msg.type === 'currentFile') onFiletreeChanged();
    });
    window.addEventListener('vswrite:comment-click', onCommentClick as EventListener);
    window.addEventListener('vswrite:comment-created', onCreateComment as EventListener);
  });

  onDestroy(() => {
    window.removeEventListener('vswrite:comment-click', onCommentClick as EventListener);
    window.removeEventListener('vswrite:comment-created', onCreateComment as EventListener);
    for (const id of Object.keys(saveTimers)) clearTimeout(saveTimers[id]);
  });

  // ── Actions ───────────────────────────────────────────
  function scheduleBodySave(id: string) {
    clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      try {
        await api.invoke('comments:update', id, { body: bodyDrafts[id] ?? '' });
      } catch (err) {
        console.error('[vswrite] Could not save comment body:', err);
      }
    }, 400);
  }

  async function toggleResolved(c: CommentEntry) {
    try {
      await api.invoke('comments:update', c.id, { resolved: !c.resolved });
      await loadComments();
    } catch (err) {
      console.error('[vswrite] Could not toggle resolved:', err);
    }
  }

  async function deleteComment(c: CommentEntry) {
    if (!confirm('Diesen Kommentar wirklich löschen?')) return;
    try {
      await api.invoke('comments:delete', c.id);
      delete bodyDrafts[c.id];
      await loadComments();
    } catch (err) {
      console.error('[vswrite] Could not delete comment:', err);
    }
  }

  function jumpToAnchor(c: CommentEntry) {
    activeId = c.id;
    const editor = editorRef.current;
    if (!editor) return;
    // Find the anchor in the current document via DOM walk and scroll.
    const root = editor.view.dom;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      const idx = text.indexOf(c.anchor);
      if (idx >= 0) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + c.anchor.length);
        const rect = range.getBoundingClientRect();
        const container = root.closest('.editor-container');
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const offset = rect.top - containerRect.top + container.scrollTop - containerRect.height / 3;
          container.scrollTo({ top: offset, behavior: 'smooth' });
        } else {
          (node.parentElement as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Briefly flash the matching highlight
        const el = root.querySelector(`[data-comment-id="${CSS.escape(c.id)}"]`) as HTMLElement | null;
        if (el) {
          el.classList.add('vswrite-comment-active');
          setTimeout(() => el.classList.remove('vswrite-comment-active'), 1600);
        }
        return;
      }
    }
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function shortenAnchor(a: string): string {
    if (a.length <= 60) return a;
    return a.slice(0, 60) + '…';
  }
</script>

<div class="comments-panel" role="region" aria-label="Comments and annotations">
  <div class="cp-header">
    <div class="cp-tabs">
      <button class="cp-tab" class:active={scope === 'file'} onclick={() => (scope = 'file')}>
        Aktuelle Datei
      </button>
      <button class="cp-tab" class:active={scope === 'project'} onclick={() => (scope = 'project')}>
        Ganzes Projekt
      </button>
    </div>
    <label class="cp-resolved-toggle">
      <input type="checkbox" bind:checked={showResolved} />
      Erledigte zeigen
    </label>
  </div>

  <div class="cp-info">
    Kommentare werden als Markdown in <code>comments/</code> gespeichert. Sie kompilieren nicht ins PDF/DOCX.
  </div>

  <div class="cp-list">
    {#if comments.length === 0}
      <div class="cp-empty">
        <p>Keine Kommentare {scope === 'file' ? 'in dieser Datei' : 'im Projekt'}.</p>
        <p class="cp-hint">Markiere Text im Editor und klicke „Comment hinzufügen" in der Toolbar.</p>
      </div>
    {:else}
      {#each comments as c (c.id)}
        <div
          class="cp-card"
          class:active={activeId === c.id}
          class:resolved={c.resolved}
          class:orphaned={c.orphaned}
          data-comment-card-id={c.id}
        >
          <div class="cp-card-header">
            <button class="cp-anchor" onclick={() => jumpToAnchor(c)} title="Zur Stelle im Editor springen">
              {#if c.orphaned}
                <span class="cp-orphan-badge" title="Ankertext nicht mehr gefunden">⚠</span>
              {/if}
              <span class="cp-anchor-text">„{shortenAnchor(c.anchor)}"</span>
            </button>
            <button class="cp-icon-btn" onclick={() => toggleResolved(c)} title={c.resolved ? 'Wieder öffnen' : 'Als erledigt markieren'}>
              {c.resolved ? '↺' : '✓'}
            </button>
            <button class="cp-icon-btn cp-delete" onclick={() => deleteComment(c)} title="Löschen">×</button>
          </div>
          {#if scope === 'project'}
            <div class="cp-card-file" title={c.file}>{c.file}</div>
          {/if}
          <textarea
            class="cp-body"
            bind:value={bodyDrafts[c.id]}
            oninput={() => scheduleBodySave(c.id)}
            placeholder="Notiz schreiben…"
            rows="3"
          ></textarea>
          <div class="cp-card-meta">
            <span>{c.author}</span>
            <span>·</span>
            <span title={c.date}>{formatDate(c.date)}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .comments-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: 12px;
    color: #444;
  }

  .cp-header {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafafa;
  }

  .cp-tabs {
    display: flex;
    gap: 4px;
  }

  .cp-tab {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: #888;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cp-tab:hover { background: #f0f0f0; color: #555; }
  .cp-tab.active {
    background: #eef4ff;
    color: #4f7df9;
    border-color: rgba(79, 125, 249, 0.35);
  }

  .cp-resolved-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #888;
    cursor: pointer;
  }

  .cp-info {
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: 10px;
    color: #999;
    background: #fdfbf2;
    border-bottom: 1px solid #f0f0f0;
    line-height: 1.4;
  }
  .cp-info code {
    background: rgba(0, 0, 0, 0.05);
    padding: 0 3px;
    border-radius: 2px;
    font-size: 10px;
  }

  .cp-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .cp-empty {
    padding: 24px 16px;
    text-align: center;
    color: #999;
  }
  .cp-empty p { margin: 0 0 6px; }
  .cp-hint { font-size: 11px; color: #bbb; line-height: 1.5; }

  .cp-card {
    margin-bottom: 8px;
    padding: 8px 10px;
    border: 1px solid #e8e8e8;
    border-left: 3px solid #ffd54f;
    border-radius: 6px;
    background: #ffffff;
    transition: all 0.15s;
  }
  .cp-card:hover { border-color: #d0d0d0; }
  .cp-card.active { border-color: #4f7df9; background: #f7faff; }
  .cp-card.resolved {
    opacity: 0.55;
    border-left-color: #b0b0b0;
    background: #f9f9f9;
  }
  .cp-card.orphaned {
    border-left-color: #d04444;
  }

  .cp-card-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }

  .cp-anchor {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: none;
    background: transparent;
    color: #666;
    font-size: 11px;
    font-style: italic;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }
  .cp-anchor:hover { color: #4f7df9; }

  .cp-anchor-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp-orphan-badge {
    color: #d04444;
    font-style: normal;
    margin-right: 4px;
  }

  .cp-icon-btn {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .cp-icon-btn:hover { background: #f0f0f0; color: #555; }
  .cp-icon-btn.cp-delete:hover { background: #ffe9e6; color: #d04444; }

  .cp-card-file {
    font-size: 10px;
    color: #aaa;
    font-family: 'SF Mono', monospace;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cp-body {
    width: 100%;
    min-height: 50px;
    padding: 6px 8px;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    background: #fafafa;
    color: #333;
    font-size: 12px;
    font-family: inherit;
    line-height: 1.45;
    resize: vertical;
    outline: none;
    transition: border 0.15s;
    box-sizing: border-box;
  }
  .cp-body:focus {
    border-color: #4f7df9;
    background: #ffffff;
  }

  .cp-card-meta {
    display: flex;
    gap: 4px;
    font-size: 10px;
    color: #aaa;
    margin-top: 6px;
  }
</style>
