<script lang="ts">
  /**
   * MCP Setup Wizard — opt-in modal that registers the bundled Penwright MCP
   * server in Claude Desktop's `claude_desktop_config.json` so users don't
   * have to edit JSON by hand.
   *
   * Steps:  intro (probing) → no_claude | ready → running → done | error
   *
   * The "skip" path stashes the current setup version too, so closing the
   * modal doesn't reopen it on next launch. The Help menu has a manual
   * trigger if the user wants to re-run later.
   */

  import { onMount } from 'svelte';

  let { onClose }: { onClose: () => void } = $props();

  type WizardStep = 'intro' | 'no_claude' | 'unsupported' | 'ready' | 'running' | 'done' | 'error';

  interface ClaudeCheck { installed: boolean; pathsChecked: string[]; }
  interface SetupResult {
    binaryPath: string;
    configPath: string;
    alreadyConfigured: boolean;
    preservedServers: string[];
    backupPath: string | null;
  }
  interface SetupStatus { current: string; installed: string | null; needsSetup: boolean; supported: boolean; }

  let step = $state<WizardStep>('intro');
  let claudeCheck = $state<ClaudeCheck | null>(null);
  let result = $state<SetupResult | null>(null);
  let errorMsg = $state<string>('');

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  onMount(async () => {
    try {
      const status = await api.invoke('mcp:getSetupStatus') as SetupStatus;
      if (!status.supported) {
        step = 'unsupported';
        return;
      }
      const check = await api.invoke('mcp:checkClaudeDesktop') as ClaudeCheck;
      claudeCheck = check;
      step = check.installed ? 'ready' : 'no_claude';
    } catch (err) {
      console.warn('[penwright] mcp setup probe failed:', err);
      step = 'ready';
    }
  });

  async function runSetup() {
    step = 'running';
    errorMsg = '';
    try {
      result = await api.invoke('mcp:setup') as SetupResult;
      step = 'done';
    } catch (err) {
      errorMsg = String((err as Error).message ?? err);
      step = 'error';
    }
  }

  async function openClaude() {
    try {
      await api.invoke('mcp:openClaude');
    } catch (err) {
      console.warn('[penwright] open Claude Desktop failed:', err);
    }
  }

  async function skip() {
    // Stash the current version so we don't nag again. User can re-run
    // via Help → Connect to Claude Desktop.
    try { await api.invoke('mcp:skipSetup'); } catch { /* ignore */ }
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={skip} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="mcp-wizard-title">
    {#if step === 'intro'}
      <div class="icon-circle indigo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
      <h2 id="mcp-wizard-title">Mit Claude Desktop verbinden</h2>
      <p>Penwright kann den eingebauten MCP-Server bei Claude Desktop registrieren, damit du deine Typst-Projekte direkt aus Claude heraus bearbeiten kannst.</p>
      <div class="centered-loader">
        <div class="spinner"></div>
        <p class="hint">Pruefe ob Claude Desktop installiert ist…</p>
      </div>

    {:else if step === 'unsupported'}
      <div class="icon-circle amber">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h2 id="mcp-wizard-title">Derzeit nur unter macOS</h2>
      <p>Die automatische Einrichtung ist aktuell nur fuer macOS verfuegbar. Auf anderen Plattformen kannst du den MCP-Server manuell registrieren — siehe Dokumentation.</p>
      <div class="actions">
        <button class="btn btn-primary" onclick={skip}>OK</button>
      </div>

    {:else if step === 'no_claude'}
      <div class="icon-circle amber">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <h2 id="mcp-wizard-title">Claude Desktop nicht gefunden</h2>
      <p>Wir konnten Claude Desktop auf deinem Mac nicht finden. Installiere es zuerst — die Verbindung mit Penwright kannst du danach jederzeit ueber das Hilfe-Menue starten.</p>
      {#if claudeCheck}
        <details class="paths">
          <summary>Geprueft an diesen Pfaden</summary>
          <ul>
            {#each claudeCheck.pathsChecked as p}
              <li>{p}</li>
            {/each}
          </ul>
        </details>
      {/if}
      <div class="actions">
        <a class="btn btn-primary" href="https://claude.ai/download" target="_blank" rel="noreferrer">Claude Desktop laden</a>
        <button class="btn btn-secondary" onclick={skip}>Spaeter</button>
      </div>

    {:else if step === 'ready'}
      <div class="icon-circle indigo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      </div>
      <h2 id="mcp-wizard-title">Bereit zum Verbinden</h2>
      <p>Penwright installiert einen eigenstaendigen MCP-Server in deinem Benutzer-Verzeichnis und traegt ihn in Claude Desktops Konfiguration ein.</p>
      <ul class="bullets">
        <li>Server laeuft unabhaengig von Penwright — Reihenfolge beim Starten egal</li>
        <li>Andere MCP-Server in deiner Config bleiben unveraendert</li>
        <li>Vor jedem Schreibvorgang wird ein Backup deiner Config angelegt</li>
        <li>Wiederholtes Ausfuehren ist idempotent (kein Duplikat)</li>
        <li>Du kannst es jederzeit ueber das Hilfe-Menue erneut ausfuehren</li>
      </ul>
      <div class="actions">
        <button class="btn btn-secondary" onclick={skip}>Spaeter</button>
        <button class="btn btn-primary" onclick={runSetup}>Jetzt verbinden</button>
      </div>

    {:else if step === 'running'}
      <div class="centered-loader big">
        <div class="spinner big"></div>
        <p class="hint">Verbinde Penwright mit Claude Desktop…</p>
      </div>

    {:else if step === 'done' && result}
      <div class="icon-circle green">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 id="mcp-wizard-title">Verbunden!</h2>
      <p>
        {#if result.alreadyConfigured}
          Penwright war bereits in Claude Desktop registriert — alles unveraendert.
        {:else}
          Claude Desktop kennt jetzt den Penwright MCP-Server.
        {/if}
      </p>
      <div class="note amber">
        <strong>Wichtig:</strong> Starte Claude Desktop neu, damit die neue MCP-Verbindung aktiv wird.
      </div>

      {#if result.preservedServers.length > 0}
        <div class="note green">
          <strong>{result.preservedServers.length} weitere MCP-Server</strong> wurden in deiner Config unveraendert beibehalten: <code>{result.preservedServers.join(', ')}</code>
        </div>
      {/if}

      <details class="paths">
        <summary>Details</summary>
        <ul>
          <li>Binary: <code>{result.binaryPath}</code></li>
          <li>Config: <code>{result.configPath}</code></li>
          {#if result.backupPath}
            <li>Backup: <code>{result.backupPath}</code></li>
          {/if}
        </ul>
      </details>

      <div class="actions">
        <button class="btn btn-secondary" onclick={onClose}>Schliessen</button>
        <button class="btn btn-primary" onclick={openClaude}>Claude Desktop oeffnen</button>
      </div>

    {:else if step === 'error'}
      <div class="icon-circle red">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h2 id="mcp-wizard-title">Verbindung fehlgeschlagen</h2>
      <p>Das automatische Einrichten ist nicht durchgegangen. Details:</p>
      <pre class="error">{errorMsg}</pre>
      <div class="actions">
        <button class="btn btn-secondary" onclick={skip}>Schliessen</button>
        <button class="btn btn-primary" onclick={runSetup}>Erneut versuchen</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
  }

  p {
    color: #4b5563;
    line-height: 1.55;
    font-size: 14px;
    margin: 0;
  }

  .icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-circle.indigo { background: #eef2ff; color: #4f46e5; }
  .icon-circle.amber  { background: #fffbeb; color: #d97706; }
  .icon-circle.green  { background: #ecfdf5; color: #059669; }
  .icon-circle.red    { background: #fef2f2; color: #dc2626; }

  .bullets {
    color: #4b5563;
    font-size: 13px;
    line-height: 1.6;
    padding-left: 18px;
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }

  .btn {
    flex: 1;
    height: 42px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }
  .btn-primary { background: #4f46e5; color: #fff; }
  .btn-primary:hover { background: #4338ca; }
  .btn-secondary { background: #f3f4f6; color: #374151; }
  .btn-secondary:hover { background: #e5e7eb; }

  .note {
    border-radius: 10px;
    padding: 12px;
    font-size: 13px;
    line-height: 1.5;
  }
  .note.amber { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .note.green { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .note code {
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    word-break: break-all;
  }

  .paths {
    color: #6b7280;
    font-size: 12px;
  }
  .paths summary {
    cursor: pointer;
    user-select: none;
  }
  .paths ul {
    list-style: none;
    padding: 8px 0 0;
    margin: 0;
    font-family: 'SF Mono', monospace;
    word-break: break-all;
  }
  .paths li { padding: 2px 0; }
  .paths code {
    font-family: inherit;
    font-size: 11px;
  }

  pre.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 10px 12px;
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    color: #b91c1c;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .centered-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 4px 0 4px;
  }
  .centered-loader.big { padding: 28px 0; }

  .hint {
    font-size: 12px;
    color: #9ca3af;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e5e7eb;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .spinner.big { width: 36px; height: 36px; border-width: 3px; }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
