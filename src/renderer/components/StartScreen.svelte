<script lang="ts">
  import { onMount } from "svelte";
  import { t, i18nState, setLocale } from "@shared/i18n/store.svelte";
  import logoSvg from "../assets/penwright-logo.svg";

  // The Settings dialog (where the main language picker lives) needs an open
  // project, so the Start Screen carries its own compact switcher.
  const UI_LANGS = [
    { value: "en", label: "EN" },
    { value: "de", label: "DE" },
  ] as const;

  let {
    onNewProject,
    onOpenProject,
    onOpenSample,
    onOpenRecent,
  }: {
    onNewProject: () => void;
    onOpenProject: () => void;
    onOpenSample: () => void;
    onOpenRecent: (folderPath: string) => void;
  } = $props();

  let typstInstalled = $state<boolean | null>(null);
  let platform = $state("");
  let recentProjects = $state<
    Array<{ path: string; name: string; timestamp: number }>
  >([]);

  const api = (
    window as unknown as {
      electronAPI: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      };
    }
  ).electronAPI;

  onMount(async () => {
    platform = (await api.invoke("app:getPlatform")) as string;
    try {
      const result = (await api.invoke("app:checkTypst")) as boolean;
      typstInstalled = result;
    } catch {
      typstInstalled = false;
    }
    try {
      const recent = (await api.invoke(
        "persist:getRecentProjects",
      )) as typeof recentProjects;
      if (Array.isArray(recent)) recentProjects = recent;
    } catch {}
  });
</script>

<div class="start-screen">
  <!-- Compact UI-language switcher (the full picker lives in Settings, which
       requires an open project). -->
  <div class="lang-switch" role="group" aria-label={t().common.language}>
    {#each UI_LANGS as l}
      <button
        class="lang-btn"
        class:active={i18nState.locale === l.value}
        onclick={() => setLocale(l.value)}
        aria-pressed={i18nState.locale === l.value}
      >
        {l.label}
      </button>
    {/each}
  </div>

  <div class="start-content">
    <!-- Logo & Title -->
    <div class="start-header">
      <img class="start-logo" src={logoSvg} alt="Penwright logo" />
      <p class="subtitle">{t().startScreen.subtitle}</p>
    </div>

    <!-- Typst Status -->
    {#if typstInstalled === false}
      <div class="typst-warning">
        <span class="warning-icon">!</span>
        <div>
          <strong>{t().startScreen.typstNotFound}</strong>
          <p>
            {t().startScreen.typstNeeded}
            {#if platform === "darwin"}
              {t().startScreen.typstInstallMac} <code>brew install typst</code>
            {:else if platform === "win32"}
              {t().startScreen.typstInstallWin} <code>winget install typst</code>
            {:else}
              {t().startScreen.typstInstallOther} <code>https://typst.app</code>
            {/if}
          </p>
        </div>
      </div>
    {:else if typstInstalled === true}
      <div class="typst-ok">
        <span class="ok-icon">&#10003;</span>
        {t().startScreen.typstInstalled}
      </div>
    {/if}

    <!-- Actions -->
    <div class="start-actions">
      <button class="action-card action-primary" onclick={onNewProject}>
        <span class="action-icon">&#43;</span>
        <div>
          <strong>{t().startScreen.newProject}</strong>
          <span class="action-desc">{t().startScreen.newProjectDesc}</span>
        </div>
      </button>

      <button class="action-card" onclick={onOpenSample}>
        <span class="action-icon">&#9733;</span>
        <div>
          <strong>{t().startScreen.openSample}</strong>
          <span class="action-desc">{t().startScreen.openSampleDesc}</span>
        </div>
      </button>

      <button class="action-card" onclick={onOpenProject}>
        <span class="action-icon">&#9776;</span>
        <div>
          <strong>{t().startScreen.openProject}</strong>
          <span class="action-desc">{t().startScreen.openProjectDesc}</span>
        </div>
      </button>
    </div>

    <!-- Recent Projects -->
    {#if recentProjects.length > 0}
      <div class="recent-section">
        <h3 class="recent-title">{t().startScreen.recent}</h3>
        {#each recentProjects.slice(0, 5) as project}
          <button
            class="recent-item"
            onclick={() => onOpenRecent(project.path)}
            title={project.path}
          >
            <span class="recent-icon">&#9634;</span>
            <div class="recent-info">
              <span class="recent-name">{project.name}</span>
              <span class="recent-path"
                >{project.path.replace(/\/Users\/[^/]+/, "~")}</span
              >
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Terminal / AI Info -->
    <div class="info-section">
      <h3>{t().startScreen.terminalTitle}</h3>
      <p>
        {t().startScreen.terminalIntroBefore}<code>Cmd+`</code>{t().startScreen
          .terminalIntroAfter}
      </p>
      <p>
        {t().startScreen.skillsIntro}
        <code>.claude/skills/</code>:
      </p>
      <div class="skills-grid">
        <div class="skill-badge">
          <span class="skill-icon">T</span>
          <div>
            <strong>typst</strong>
            <span>{t().startScreen.skillTypst}</span>
          </div>
        </div>
        <div class="skill-badge">
          <span class="skill-icon">P</span>
          <div>
            <strong>penwright</strong>
            <span>{t().startScreen.skillPenwright}</span>
          </div>
        </div>
        <div class="skill-badge">
          <span class="skill-icon">R</span>
          <div>
            <strong>research</strong>
            <span>{t().startScreen.skillResearch}</span>
          </div>
        </div>
      </div>
      <p class="info-hint">
        {t().startScreen.aiHint}
      </p>
    </div>

    <!-- Keyboard shortcuts hint -->
    <div class="shortcuts-hint">
      <span><kbd>Cmd+N</kbd> {t().startScreen.shortcutNew}</span>
      <span><kbd>Cmd+O</kbd> {t().startScreen.shortcutOpen}</span>
      <span><kbd>Cmd+B</kbd> {t().startScreen.shortcutSidebar}</span>
      <span><kbd>Cmd+`</kbd> {t().startScreen.shortcutTerminal}</span>
    </div>
  </div>
</div>

<style>
  .start-screen {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fafafa;
    overflow-y: auto;
    padding: 20px 20px;
  }

  .lang-switch {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 2px;
    padding: 2px;
    background: #f1f0ec;
    border: 1px solid #e2e0da;
    border-radius: 7px;
    z-index: 2;
  }
  .lang-btn {
    border: none;
    background: transparent;
    color: #8a8174;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 3px 9px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .lang-btn:hover {
    color: #211e1a;
  }
  .lang-btn.active {
    background: #ffffff;
    color: #a8503a;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .start-content {
    max-width: 520px;
    width: 100%;
  }

  /* Header */
  .start-header {
    text-align: center;
    margin-bottom: 8px;
  }

  .start-logo {
    width: auto;
    height: 72px;
    margin-bottom: 8px;
  }

  .subtitle {
    margin: -4px 0 0;
    font-size: 15px;
    color: #999;
  }

  /* Typst Status */
  .typst-warning {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 18px;
    background: #fff8f0;
    border: 1px solid #f5dcc0;
    border-radius: 10px;
    margin-bottom: 24px;
    font-size: 13px;
    color: #7a5a2e;
    line-height: 1.5;
  }

  .typst-warning p {
    margin: 4px 0 0;
  }

  .typst-warning code {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .warning-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #e88a3a;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .typst-ok {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: #f0faf0;
    border: 1px solid #c8e8c8;
    border-radius: 10px;
    margin-bottom: 12px;
    font-size: 13px;
    color: #3a7a3a;
  }

  .ok-icon {
    color: #3a9a3a;
    font-size: 16px;
    font-weight: 700;
  }

  /* Action Cards */
  .start-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    font-family: inherit;
  }

  .action-card:hover {
    border-color: #d0d0d0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .action-card.action-primary {
    border-color: #4f7df9;
    background: #f8faff;
  }

  .action-card.action-primary:hover {
    background: #eef4ff;
    box-shadow: 0 2px 12px rgba(79, 125, 249, 0.12);
  }

  .action-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #f5f5f5;
    color: #888;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .action-primary .action-icon {
    background: #eef4ff;
    color: #4f7df9;
  }

  .action-card strong {
    font-size: 14px;
    color: #1a1a1a;
    display: block;
  }

  .action-desc {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
    display: block;
  }

  /* Recent Projects */
  .recent-section {
    margin-bottom: 24px;
  }

  .recent-title {
    font-size: 12px;
    font-weight: 600;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 8px 4px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    font-family: inherit;
  }

  .recent-item:hover {
    background: #f5f5f5;
  }

  .recent-icon {
    color: #bbb;
    font-size: 16px;
    flex-shrink: 0;
  }

  .recent-info {
    min-width: 0;
  }

  .recent-name {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #333;
  }

  .recent-path {
    display: block;
    font-size: 11px;
    color: #aaa;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Info Section */
  .info-section {
    padding: 20px 24px;
    background: #ffffff;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    margin-bottom: 24px;
  }

  .info-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 8px;
  }

  .info-section p {
    font-size: 13px;
    color: #666;
    line-height: 1.6;
    margin: 0 0 12px;
  }

  .info-section code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: #555;
  }

  .info-section strong {
    color: #333;
  }

  .skills-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .skill-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
  }

  .skill-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #eef4ff;
    color: #4f7df9;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .skill-badge strong {
    font-size: 12px;
    color: #333;
    display: block;
  }

  .skill-badge span {
    font-size: 10px;
    color: #999;
    line-height: 1.3;
  }

  .info-hint {
    font-size: 12px !important;
    color: #999 !important;
    font-style: italic;
    margin-bottom: 0 !important;
  }

  /* Shortcuts */
  .shortcuts-hint {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 12px;
    color: #bbb;
  }

  .shortcuts-hint kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #f0f0f0;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    color: #888;
    margin-right: 4px;
  }
</style>
