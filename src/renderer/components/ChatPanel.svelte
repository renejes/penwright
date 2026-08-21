<script lang="ts">
  /**
   * In-app Cursor chat. Mounted at App.svelte level (not a sidebar tab) so
   * toggling visibility does not unmount the draft or the stream listener.
   * Renderer never imports `@cursor/sdk` — every call goes through IPC.
   */
  import { untrack } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';
  import { chatUi } from '../appState.svelte';
  import {
    isFastParam,
    isThinkingParam,
    normalizeChatModel,
    paramValue,
    upsertParam,
  } from '../../shared/chatModels';
  import { shortToolName } from '../../shared/chatStream';
  import type {
    ChatAttachment,
    ChatFileRef,
    ChatModelInfo,
    ChatModelParam,
    ChatSendResult,
    ChatSessionMeta,
    ChatSessionsSnapshot,
    ChatStatus,
    ChatTurn,
  } from '../../shared/chatTypes';

  let {
    hasProject,
    onOpenSettings,
    liveContent,
  }: {
    hasProject: boolean;
    onOpenSettings: () => void;
    liveContent: () => string | undefined;
  } = $props();

  let threadEl: HTMLDivElement | undefined = $state();
  let menuRoot: HTMLDivElement | undefined = $state();
  let historyRoot: HTMLDivElement | undefined = $state();
  let loggingIn = $state(false);
  let menuOpen = $state(false);
  let historyOpen = $state(false);
  let elapsedSec = $state(0);
  let quietSec = $state(0);
  let sendTicket = 0;
  let projectFiles = $state<ChatFileRef[]>([]);
  let models = $state<ChatModelInfo[]>([]);
  let mentionIndex = $state(0);

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  async function refreshStatus(): Promise<void> {
    try {
      chatUi.status = await api.invoke('chat:status') as ChatStatus;
    } catch {
      chatUi.status = null;
    }
  }

  async function refreshModels(): Promise<void> {
    if (!chatUi.status?.loggedIn) {
      models = [];
      return;
    }
    try {
      const list = await api.invoke('chat:models') as ChatModelInfo[];
      models = Array.isArray(list) ? list : [];
    } catch {
      models = [];
    }
  }

  async function refreshHistory(): Promise<void> {
    try {
      const turns = await api.invoke('chat:history') as ChatTurn[];
      if (Array.isArray(turns)) chatUi.turns = turns;
    } catch {
      /* keep local */
    }
  }

  async function refreshSessions(): Promise<void> {
    if (!hasProject) {
      chatUi.sessions = { activeId: null, open: [], all: [] };
      return;
    }
    try {
      const snap = await api.invoke('chat:sessions') as ChatSessionsSnapshot;
      if (snap && Array.isArray(snap.open) && Array.isArray(snap.all)) {
        chatUi.sessions = snap;
      }
    } catch {
      /* keep local */
    }
  }

  function applySessionResult(res: {
    ok: boolean;
    error?: string;
    sessions?: ChatSessionsSnapshot;
    turns?: ChatTurn[];
  }): void {
    if (res.sessions) chatUi.sessions = res.sessions;
    if (Array.isArray(res.turns)) {
      chatUi.turns = res.turns.map(turn => ({ ...turn, tools: turn.tools?.map(c => ({ ...c })) }));
    }
    chatUi.draft = '';
    chatUi.pendingAnchors = [];
    chatUi.pendingFiles = [];
    chatUi.pendingAttachments = [];
    chatUi.usageLine = '';
    chatUi.lastError = res.ok ? '' : (res.error || t().chat.errorPrefix);
  }

  function sessionTitle(title: string): string {
    return title.trim() || t().chat.newChat;
  }

  type TreeEntry = { name: string; path: string; isDir: boolean; children?: TreeEntry[] };

  function flattenFiles(dir: string, entries: TreeEntry[]): ChatFileRef[] {
    const out: ChatFileRef[] = [];
    const walk = (items: TreeEntry[]) => {
      for (const e of items) {
        if (e.isDir && e.children) walk(e.children);
        else if (!e.isDir && /\.(typ|bib)$/i.test(e.name)) {
          const rel = e.path.startsWith(dir + '/')
            ? e.path.slice(dir.length + 1).replace(/\\/g, '/')
            : e.name;
          out.push({ file: rel, label: rel });
        }
      }
    };
    walk(entries);
    return out;
  }

  async function refreshFiles(): Promise<void> {
    if (!hasProject) {
      projectFiles = [];
      return;
    }
    try {
      const tree = await api.invoke('filetree:list') as { dir?: string; entries?: TreeEntry[] };
      projectFiles = flattenFiles(tree?.dir ?? '', tree?.entries ?? []);
    } catch {
      projectFiles = [];
    }
  }

  const mentionQuery = $derived.by(() => {
    const m = chatUi.draft.match(/(^|\s)@([^\s]*)$/);
    return m ? m[2].toLowerCase() : null;
  });

  const mentionHits = $derived.by(() => {
    if (mentionQuery === null) return [] as ChatFileRef[];
    const q = mentionQuery;
    return projectFiles
      .filter(f => !q || f.file.toLowerCase().includes(q) || f.label.toLowerCase().includes(q))
      .slice(0, 12);
  });

  $effect(() => {
    void hasProject;
    void refreshStatus().then(() => {
      void refreshModels();
    });
    if (!untrack(() => chatUi.streaming)) {
      void refreshHistory();
      void refreshSessions();
    }
    void refreshFiles();
  });

  $effect(() => {
    void chatUi.turns.length;
    void chatUi.streaming;
    void chatUi.turns.at(-1)?.thinking;
    void chatUi.turns.at(-1)?.tools?.length;
    if (!threadEl) return;
    threadEl.scrollTop = threadEl.scrollHeight;
  });

  $effect(() => {
    if (!chatUi.streaming) {
      elapsedSec = 0;
      quietSec = 0;
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      elapsedSec = Math.floor((Date.now() - started) / 1000);
      quietSec = chatUi.lastActivityAt
        ? Math.floor((Date.now() - chatUi.lastActivityAt) / 1000)
        : elapsedSec;
    }, 1000);
    return () => clearInterval(id);
  });

  async function signIn(): Promise<void> {
    loggingIn = true;
    chatUi.lastError = '';
    try {
      const res = await api.invoke('chat:login') as { ok: boolean; error?: string };
      if (!res?.ok) chatUi.lastError = res?.error || t().chat.loginFailed;
      await refreshStatus();
      await refreshModels();
    } finally {
      loggingIn = false;
    }
  }

  function chipPreview(text: string): string {
    const one = text.replace(/\s+/g, ' ').trim();
    return one.length > 72 ? `${one.slice(0, 72)}…` : one;
  }

  function removeChip(index: number): void {
    chatUi.pendingAnchors = chatUi.pendingAnchors.filter((_, i) => i !== index);
  }

  function removeFileChip(index: number): void {
    chatUi.pendingFiles = chatUi.pendingFiles.filter((_, i) => i !== index);
  }

  function removeAttachment(index: number): void {
    chatUi.pendingAttachments = chatUi.pendingAttachments.filter((_, i) => i !== index);
  }

  function pickMention(file: ChatFileRef): void {
    chatUi.draft = chatUi.draft.replace(/@([^\s]*)$/, `@${file.file} `);
    if (!chatUi.pendingFiles.some(f => f.file === file.file)) {
      chatUi.pendingFiles = [...chatUi.pendingFiles, file];
    }
    mentionIndex = 0;
  }

  function mentionsFromDraft(): ChatFileRef[] {
    const names = new Set(projectFiles.map(f => f.file));
    const found: ChatFileRef[] = [];
    for (const m of chatUi.draft.matchAll(/(?:^|\s)@([^\s]+)/g)) {
      const name = m[1];
      if (names.has(name) && !found.some(f => f.file === name)) {
        found.push({ file: name, label: name });
      }
    }
    return found;
  }

  function renderBody(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function toolChipLabel(tool: { name: string; detail?: string }): string {
    const name = shortToolName(tool.name);
    return tool.detail ? `${name} · ${tool.detail}` : name;
  }

  const canSend = $derived(
    !!(chatUi.draft.trim()
      || chatUi.pendingAttachments.length
      || chatUi.pendingFiles.length
      || chatUi.pendingAnchors.length),
  );

  async function send(): Promise<void> {
    if (!canSend || chatUi.streaming) return;
    await refreshStatus();
    if (!chatUi.status?.loggedIn || chatUi.status.expired) return;
    if (!hasProject) return;

    const text = chatUi.draft.trim();
    const anchors = chatUi.pendingAnchors.slice();
    const files = [
      ...chatUi.pendingFiles,
      ...mentionsFromDraft().filter(f => !chatUi.pendingFiles.some(p => p.file === f.file)),
    ];
    const attachments = chatUi.pendingAttachments.slice();
    chatUi.draft = '';
    chatUi.pendingAnchors = [];
    chatUi.pendingFiles = [];
    chatUi.pendingAttachments = [];
    chatUi.lastError = '';
    chatUi.streaming = true;
    chatUi.lastActivityAt = Date.now();
    chatUi.turns.push({ id: `u-${Date.now()}`, role: 'user', text: text || attachments.map(a => a.name).join(', ') });
    chatUi.turns.push({ id: `a-${Date.now()}`, role: 'assistant', text: '' });

    const ticket = ++sendTicket;
    try {
      const res = await api.invoke('chat:send', $state.snapshot({
        text,
        mode: chatUi.mode,
        anchors,
        files,
        attachments,
        liveContent: liveContent() ?? '',
      })) as ChatSendResult;
      if (ticket !== sendTicket) return;
      if (!res?.ok) {
        failSend(text, anchors, files, attachments, res?.error || t().chat.errorPrefix);
      } else {
        void refreshSessions();
      }
    } catch (err) {
      if (ticket !== sendTicket) return;
      failSend(text, anchors, files, attachments, err instanceof Error ? err.message : t().chat.errorPrefix);
    }
  }

  function failSend(
    text: string,
    anchors: typeof chatUi.pendingAnchors,
    files: typeof chatUi.pendingFiles,
    attachments: typeof chatUi.pendingAttachments,
    message: string,
  ): void {
    chatUi.streaming = false;
    chatUi.lastError = message;
    chatUi.turns = chatUi.turns.slice(0, -2);
    chatUi.draft = text;
    chatUi.pendingAnchors = anchors;
    chatUi.pendingFiles = files;
    chatUi.pendingAttachments = attachments;
  }

  async function newSession(): Promise<void> {
    historyOpen = false;
    if (chatUi.streaming) {
      chatUi.lastError = t().chat.busySwitch;
      return;
    }
    const optimistic: ChatSessionMeta = {
      id: `pending-${Date.now()}`,
      title: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    chatUi.turns = [];
    chatUi.lastError = '';
    chatUi.sessions = {
      activeId: optimistic.id,
      open: [optimistic, ...chatUi.sessions.open.filter(s => s.id !== chatUi.sessions.activeId)].slice(0, 7),
      all: [optimistic, ...chatUi.sessions.all],
    };
    try {
      applySessionResult(await api.invoke('chat:new') as Parameters<typeof applySessionResult>[0]);
    } catch (err) {
      chatUi.lastError = err instanceof Error ? err.message : t().chat.errorPrefix;
      await refreshSessions();
      await refreshHistory();
    }
  }

  async function switchSession(id: string): Promise<void> {
    historyOpen = false;
    if (id === chatUi.sessions.activeId) return;
    if (chatUi.streaming) {
      chatUi.lastError = t().chat.busySwitch;
      return;
    }
    chatUi.turns = [];
    try {
      applySessionResult(await api.invoke('chat:switch', id) as Parameters<typeof applySessionResult>[0]);
    } catch (err) {
      chatUi.lastError = err instanceof Error ? err.message : t().chat.errorPrefix;
    }
  }

  async function closeTab(id: string): Promise<void> {
    if (chatUi.streaming && id === chatUi.sessions.activeId) {
      chatUi.lastError = t().chat.busySwitch;
      return;
    }
    try {
      applySessionResult(await api.invoke('chat:closeTab', id) as Parameters<typeof applySessionResult>[0]);
    } catch (err) {
      chatUi.lastError = err instanceof Error ? err.message : t().chat.errorPrefix;
    }
  }

  async function deleteSession(id: string): Promise<void> {
    if (chatUi.streaming && id === chatUi.sessions.activeId) {
      chatUi.lastError = t().chat.busySwitch;
      return;
    }
    try {
      applySessionResult(await api.invoke('chat:delete', id) as Parameters<typeof applySessionResult>[0]);
    } catch (err) {
      chatUi.lastError = err instanceof Error ? err.message : t().chat.errorPrefix;
    }
  }

  async function cancel(): Promise<void> {
    sendTicket += 1;
    chatUi.streaming = false;
    const last = chatUi.turns.at(-1);
    if (last?.role === 'assistant' && !last.text && !last.thinking && !(last.tools && last.tools.length)) {
      chatUi.turns = chatUi.turns.slice(0, -1);
    }
    try {
      await api.invoke('chat:cancel');
    } catch {
      /* UI is already unlocked */
    }
  }

  function onComposerKey(e: KeyboardEvent): void {
    if (mentionQuery !== null && mentionHits.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionIndex = (mentionIndex + 1) % mentionHits.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionIndex = (mentionIndex - 1 + mentionHits.length) % mentionHits.length;
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        pickMention(mentionHits[mentionIndex] ?? mentionHits[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        chatUi.draft = chatUi.draft.replace(/@([^\s]*)$/, '');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      void send();
    }
  }

  async function persistModel(id: string, params: ChatModelParam[]): Promise<void> {
    await api.invoke('chat:setModel', $state.snapshot({ modelId: id, params }));
    await refreshStatus();
  }

  async function onModelChange(e: Event): Promise<void> {
    const id = (e.target as HTMLSelectElement).value;
    const model = catalog.find(m => m.id === id);
    const def = model?.variants.find(v => v.isDefault) ?? model?.variants[0];
    await persistModel(id, def?.params ?? []);
  }

  async function onParamChange(paramId: string, e: Event): Promise<void> {
    if (!chatUi.status) return;
    const value = (e.target as HTMLSelectElement).value;
    await persistModel(chatUi.status.modelId, upsertParam(currentParams, paramId, value));
  }

  async function onVariantChange(e: Event): Promise<void> {
    const name = (e.target as HTMLSelectElement).value;
    const variant = selectedModel?.variants.find(v => v.displayName === name);
    if (!chatUi.status || !variant) return;
    await persistModel(chatUi.status.modelId, variant.params);
  }

  async function attachFiles(): Promise<void> {
    const picked = await api.invoke('chat:pickFiles') as ChatAttachment[] | null;
    if (!picked?.length) return;
    const next = [...chatUi.pendingAttachments];
    for (const file of picked) {
      if (!next.some(p => p.path === file.path)) next.push(file);
    }
    chatUi.pendingAttachments = next.slice(0, 8);
    menuOpen = false;
  }

  function onWindowPointer(e: PointerEvent): void {
    if (menuOpen && !menuRoot?.contains(e.target as Node)) menuOpen = false;
    if (historyOpen && !historyRoot?.contains(e.target as Node)) historyOpen = false;
  }

  function paramsMatch(a: ChatModelParam[], b: ChatModelParam[]): boolean {
    if (a.length !== b.length) return false;
    const map = new Map(b.map(p => [p.id, p.value]));
    return a.every(p => map.get(p.id) === p.value);
  }

  const loggedIn = $derived(!!chatUi.status?.loggedIn);
  const expired = $derived(!!chatUi.status?.expired);
  const currentParams = $derived(chatUi.status?.modelParams ?? []);
  const catalog = $derived.by(() => {
    if (models.length > 0) return models;
    const id = chatUi.status?.modelId;
    return id ? [normalizeChatModel({ id, displayName: id })] : [];
  });
  const selectedModel = $derived(catalog.find(m => m.id === chatUi.status?.modelId) ?? catalog[0] ?? null);
  const activeVariantName = $derived.by(() => {
    const hit = selectedModel?.variants.find(v => paramsMatch(v.params, currentParams));
    return hit?.displayName ?? selectedModel?.variants.find(v => v.isDefault)?.displayName ?? '';
  });
  const showVariantSelect = $derived(
    !!selectedModel && selectedModel.variants.length > 0 && selectedModel.parameters.length === 0,
  );
  const modeLabel = $derived(chatUi.mode === 'plan' ? t().chat.modePlan : t().chat.modeAgent);
  const lastAssistant = $derived([...chatUi.turns].reverse().find(t => t.role === 'assistant') ?? null);
  const runningTool = $derived(lastAssistant?.tools?.find(c => c.status === 'running') ?? null);
  const stalling = $derived(chatUi.streaming && quietSec >= 45);
</script>

<svelte:window onpointerdown={onWindowPointer} />

<aside class="chat-panel" aria-label={t().chat.title}>
  <header class="chat-header">
    <strong>{t().chat.title}</strong>
    {#if loggedIn && hasProject && !expired}
      <div class="chat-header-actions" bind:this={historyRoot}>
        <button
          type="button"
          class="chat-icon-btn"
          class:active={historyOpen}
          onclick={() => { historyOpen = !historyOpen; }}
          title={t().chat.chatHistory}
          aria-label={t().chat.chatHistory}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>
            <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button
          type="button"
          class="chat-icon-btn"
          onclick={() => void newSession()}
          title={t().chat.newChat}
          aria-label={t().chat.newChat}
        >+</button>
        {#if historyOpen}
          <div class="chat-history" role="listbox">
            {#if chatUi.sessions.all.length === 0}
              <p class="chat-history-empty">{t().chat.historyEmpty}</p>
            {:else}
              {#each chatUi.sessions.all as session (session.id)}
                <div class="chat-history-row" class:active={session.id === chatUi.sessions.activeId}>
                  <button
                    type="button"
                    class="chat-history-pick"
                    onclick={() => void switchSession(session.id)}
                  >{sessionTitle(session.title)}</button>
                  <button
                    type="button"
                    class="chat-history-delete"
                    onclick={() => void deleteSession(session.id)}
                    title={t().chat.deleteChat}
                    aria-label={t().chat.deleteChat}
                  >×</button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </header>

  {#if !loggedIn}
    <div class="chat-empty">
      <h3>{t().chat.signInTitle}</h3>
      <p>{t().chat.signInBody}</p>
      <button class="chat-primary" onclick={() => void signIn()} disabled={loggingIn}>{t().chat.signIn}</button>
      <button class="chat-link" onclick={onOpenSettings}>{t().chat.openSettings}</button>
      {#if chatUi.lastError}<p class="chat-error">{chatUi.lastError}</p>{/if}
    </div>
  {:else if expired}
    <div class="chat-empty">
      <h3>{t().chat.expired}</h3>
      <button class="chat-primary" onclick={() => void signIn()} disabled={loggingIn}>{t().chat.signIn}</button>
      <button class="chat-link" onclick={onOpenSettings}>{t().chat.openSettings}</button>
    </div>
  {:else if !hasProject}
    <div class="chat-empty">
      <h3>{t().chat.noProjectTitle}</h3>
      <p>{t().chat.noProjectBody}</p>
      {#if chatUi.status?.email}<p class="chat-meta">{t().chat.signedInAs(chatUi.status.email)}</p>{/if}
    </div>
  {:else}
    {#key chatUi.sessions.activeId}
    <div class="chat-thread" bind:this={threadEl}>
      {#each chatUi.turns as turn (`${chatUi.sessions.activeId ?? ''}:${turn.id}`)}
        <article class="chat-turn" class:user={turn.role === 'user'} class:assistant={turn.role === 'assistant'}>
          {#if turn.thinking || (chatUi.streaming && turn.id === lastAssistant?.id)}
            <details class="chat-thinking" open={chatUi.streaming && turn.id === lastAssistant?.id}>
              <summary>
                {t().chat.thinking}
                {#if chatUi.streaming && turn.id === lastAssistant?.id && elapsedSec > 0}
                  <span> · {elapsedSec}s</span>
                {/if}
              </summary>
              {#if turn.thinking}<p class="chat-thinking-body">{turn.thinking}</p>{/if}
            </details>
          {/if}
          {#if turn.tools && turn.tools.length}
            <ul class="chat-tools">
              {#each turn.tools as tool (tool.id || tool.name)}
                <li class="chat-tool" data-status={tool.status}>{toolChipLabel(tool)}</li>
              {/each}
            </ul>
          {/if}
          {#if turn.text}
            <div class="chat-body">{@html renderBody(turn.text)}</div>
          {:else if turn.role === 'assistant' && chatUi.streaming && turn.id === lastAssistant?.id}
            <div class="chat-body chat-busy">
              {#if runningTool}
                {t().chat.usingTool(shortToolName(runningTool.name))}
              {:else}
                {t().chat.workingElapsed(elapsedSec)}
              {/if}
            </div>
          {/if}
        </article>
      {/each}
      {#if stalling}<p class="chat-stall">{t().chat.stallHint}</p>{/if}
      {#if chatUi.lastError}<p class="chat-error">{chatUi.lastError}</p>{/if}
    </div>
    {/key}

    <div class="chat-composer">
      {#if chatUi.pendingAnchors.length || chatUi.pendingFiles.length || chatUi.pendingAttachments.length}
        <ul class="chat-chips">
          {#each chatUi.pendingAttachments as chip, i (chip.path)}
            <li>
              <span title={chip.path}>{chip.name}</span>
              <button type="button" onclick={() => removeAttachment(i)} aria-label={t().chat.removeChip}>×</button>
            </li>
          {/each}
          {#each chatUi.pendingFiles as chip, i (chip.file)}
            <li>
              <span title={chip.file}>@{chip.label}</span>
              <button type="button" onclick={() => removeFileChip(i)} aria-label={t().chat.removeChip}>×</button>
            </li>
          {/each}
          {#each chatUi.pendingAnchors as chip, i (i)}
            <li>
              <span title={chip.selectionText}>{chipPreview(chip.selectionText)}</span>
              <button type="button" onclick={() => removeChip(i)} aria-label={t().chat.removeChip}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if mentionQuery !== null}
        <ul class="chat-mentions" role="listbox">
          {#if mentionHits.length === 0}
            <li class="chat-mentions-empty">{t().chat.mentionEmpty}</li>
          {:else}
            {#each mentionHits as hit, i (hit.file)}
              <li>
                <button
                  type="button"
                  class:active={i === mentionIndex}
                  onclick={() => pickMention(hit)}
                >{hit.label}</button>
              </li>
            {/each}
          {/if}
        </ul>
      {/if}
      <textarea
        bind:value={chatUi.draft}
        placeholder={t().chat.composerPlaceholder}
        rows="3"
        onkeydown={onComposerKey}
        disabled={chatUi.streaming}
      ></textarea>
        <div class="chat-composer-bar">
        <div class="chat-bar-left">
          <div class="chat-menu" bind:this={menuRoot}>
          <button
            type="button"
            class="chat-menu-toggle"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onclick={() => {
              menuOpen = !menuOpen;
              if (menuOpen) {
                void refreshStatus().then(() => refreshModels());
              }
            }}
          >{modeLabel} ▾</button>
          {#if menuOpen}
            <div class="chat-menu-panel" role="menu">
              <label class="chat-menu-field">
                <span>{t().chat.modeLabel}</span>
                <select bind:value={chatUi.mode}>
                  <option value="agent">{t().chat.modeAgent}</option>
                  <option value="plan">{t().chat.modePlan}</option>
                </select>
              </label>
              <label class="chat-menu-field">
                <span>{t().chat.cursorModel}</span>
                <select value={chatUi.status?.modelId} onchange={e => void onModelChange(e)}>
                  {#each catalog as m (m.id)}
                    <option value={m.id}>{m.displayName}</option>
                  {/each}
                </select>
              </label>
              {#if showVariantSelect && selectedModel}
                <label class="chat-menu-field">
                  <span>{t().chat.cursorVariant}</span>
                  <select value={activeVariantName} onchange={e => void onVariantChange(e)}>
                    {#each selectedModel.variants as v (v.displayName)}
                      <option value={v.displayName}>{v.displayName}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if selectedModel}
                {#each selectedModel.parameters as p (p.id)}
                  {#if p.values.length > 0}
                    <label class="chat-menu-field">
                      <span>
                        {#if isFastParam(p)}{t().chat.fastLabel}
                        {:else if isThinkingParam(p)}{t().chat.cursorThinking}
                        {:else}{p.displayName}{/if}
                      </span>
                      <select
                        value={paramValue(currentParams, p.id, p.values[0].value)}
                        onchange={e => void onParamChange(p.id, e)}
                      >
                        {#each p.values as v (v.value)}
                          <option value={v.value}>{v.displayName}</option>
                        {/each}
                      </select>
                    </label>
                  {/if}
                {/each}
              {/if}
              {#if chatUi.usageLine}
                <p class="chat-menu-usage">{t().chat.contextUsed(chatUi.usageLine)}</p>
              {/if}
            </div>
          {/if}
        </div>
        <button
          type="button"
          class="chat-attach"
          onclick={() => void attachFiles()}
          title={t().chat.attachFiles}
          aria-label={t().chat.attachFiles}
        >+</button>
        </div>
        {#if chatUi.streaming}
          <button type="button" class="chat-primary" onclick={() => void cancel()}>{t().chat.cancel}</button>
        {:else}
          <button type="button" class="chat-primary" onclick={() => void send()} disabled={!canSend}>{t().chat.send}</button>
        {/if}
      </div>
    </div>
    {#if chatUi.sessions.open.length > 0}
      <nav class="chat-tabs" aria-label={t().chat.chatHistory}>
        {#each chatUi.sessions.open as session (session.id)}
          <div class="chat-tab" class:active={session.id === chatUi.sessions.activeId}>
            <button
              type="button"
              class="chat-tab-label"
              onclick={() => void switchSession(session.id)}
              title={sessionTitle(session.title)}
            >{sessionTitle(session.title)}</button>
            {#if chatUi.sessions.open.length > 1}
              <button
                type="button"
                class="chat-tab-close"
                title={t().chat.closeTab}
                aria-label={t().chat.closeTab}
                onclick={() => void closeTab(session.id)}
              >×</button>
            {/if}
          </div>
        {/each}
      </nav>
    {/if}
  {/if}
</aside>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fafafa;
    color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
  }
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    position: relative;
  }
  .chat-header strong { font-size: 13px; }
  .chat-header-actions {
    position: relative;
    display: flex;
    gap: 2px;
  }
  .chat-icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    color: #444;
    font-size: 15px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .chat-icon-btn:hover, .chat-icon-btn.active { background: #ececec; }
  .chat-history {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 240px;
    max-height: 280px;
    overflow: auto;
    background: #fff;
    border: 1px solid #e6e6e6;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,.08);
    z-index: 20;
    padding: 4px;
  }
  .chat-history-empty { margin: 8px 10px; color: #888; font-size: 12px; }
  .chat-history-row {
    display: flex;
    align-items: center;
    gap: 2px;
    border-radius: 6px;
  }
  .chat-history-row.active { background: #eef4ff; }
  .chat-history-pick {
    flex: 1;
    text-align: left;
    border: none;
    background: transparent;
    padding: 7px 8px;
    cursor: pointer;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chat-history-delete {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .chat-history-delete:hover { background: #f3f3f3; color: #111; }
  .chat-tabs {
    display: flex;
    gap: 2px;
    padding: 4px 8px 6px;
    border-top: 1px solid #f0f0f0;
    overflow-x: auto;
    flex-shrink: 0;
    background: #f6f6f6;
  }
  .chat-tab {
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: 140px;
    padding: 2px 4px 2px 6px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    font-size: 11px;
    color: #555;
    flex-shrink: 0;
  }
  .chat-tab:hover { background: #ececec; }
  .chat-tab.active {
    background: #fff;
    border-color: #e0e0e0;
    color: #111;
  }
  .chat-tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: none;
    background: transparent;
    padding: 2px 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    min-width: 0;
  }
  .chat-tab-close {
    font-size: 13px;
    color: #999;
    line-height: 1;
    padding: 0 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }
  .chat-tab-close:hover { color: #111; }
  .chat-empty, .chat-thread { flex: 1; overflow: auto; padding: 16px 14px; }
  .chat-empty h3 { font-size: 15px; margin: 0 0 8px; }
  .chat-empty p, .chat-meta { color: #666; line-height: 1.45; margin: 0 0 12px; }
  .chat-thread { display: flex; flex-direction: column; gap: 12px; }
  .chat-turn { padding: 8px 10px; border-radius: 8px; background: #fff; border: 1px solid #f0f0f0; }
  .chat-turn.user { background: #eef4ff; border-color: #d9e4ff; }
  .chat-body { white-space: normal; line-height: 1.45; overflow-wrap: anywhere; }
  .chat-body :global(code) { font-size: 12px; background: #f3f3f3; padding: 1px 4px; border-radius: 3px; }
  .chat-busy { color: #888; font-style: italic; }
  .chat-tools { display: flex; flex-wrap: wrap; gap: 4px; list-style: none; margin: 0 0 6px; padding: 0; }
  .chat-tool {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 999px;
    background: #f0f0f0;
    color: #555;
  }
  .chat-tool[data-status='running'] { background: #eef4ff; color: #4f7df9; }
  .chat-tool[data-status='error'] { background: #fde8e8; color: #b42318; }
  .chat-thinking {
    color: #888;
    font-size: 11px;
    margin: 0 0 6px;
  }
  .chat-thinking summary { cursor: pointer; }
  .chat-thinking-body { color: #888; font-size: 12px; margin: 6px 0 8px; white-space: pre-wrap; }
  .chat-stall { color: #9a6700; font-size: 12px; margin: 0; }
  .chat-error { color: #b42318; font-size: 12px; }
  .chat-composer {
    border-top: 1px solid #f0f0f0;
    padding: 8px 10px 10px;
    background: #fff;
    flex-shrink: 0;
  }
  .chat-chips { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chat-chips li {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    background: #eef4ff;
    border-radius: 6px;
    padding: 3px 6px 3px 8px;
    font-size: 12px;
  }
  .chat-chips span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chat-chips button { border: none; background: none; cursor: pointer; color: #666; }
  .chat-mentions {
    list-style: none;
    margin: 0 0 6px;
    padding: 4px;
    max-height: 160px;
    overflow: auto;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
  }
  .chat-mentions-empty { color: #888; font-size: 12px; padding: 6px 8px; }
  .chat-mentions button {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 5px 8px;
    border-radius: 6px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .chat-mentions button.active,
  .chat-mentions button:hover { background: #eef4ff; }
  .chat-composer textarea {
    width: 100%;
    resize: none;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 8px;
    font: inherit;
    line-height: 1.4;
  }
  .chat-composer-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; gap: 8px; }
  .chat-bar-left { display: flex; align-items: center; gap: 6px; }
  .chat-menu { position: relative; }
  .chat-menu-toggle {
    border: 1px solid #e5e5e5;
    background: #fff;
    border-radius: 6px;
    padding: 4px 10px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .chat-menu-panel {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    width: 240px;
    padding: 10px;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 20;
  }
  .chat-menu-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #666; }
  .chat-menu-field select {
    font: inherit;
    font-size: 12px;
    color: #1a1a1a;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 4px 6px;
    background: #fff;
  }
  .chat-attach {
    border: 1px solid #e5e5e5;
    background: #fff;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    padding: 0;
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: #444;
  }
  .chat-attach:hover { border-color: #4f7df9; color: #4f7df9; }
  .chat-primary {
    border: none;
    background: #4f7df9;
    color: #fff;
    border-radius: 8px;
    padding: 7px 14px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }
  .chat-primary:disabled { opacity: 0.45; cursor: default; }
  .chat-link {
    display: block;
    margin-top: 10px;
    border: none;
    background: none;
    color: #4f7df9;
    cursor: pointer;
    font: inherit;
    padding: 0;
  }
</style>
