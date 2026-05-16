<script lang="ts">
  import { onMount } from 'svelte';
  import { uiState } from '../appState.svelte';
  import logoUrl from '../assets/vswrite-logo.svg';
  import AcknowledgmentsDialog from './AcknowledgmentsDialog.svelte';

  let {
    onClose,
  }: {
    onClose: () => void;
  } = $props();

  let showAcknowledgments = $state(false);

  interface AboutInfo {
    version: string;
    electron: string;
    chrome: string;
    node: string;
    platform: string;
    arch: string;
  }

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let info = $state<AboutInfo | null>(null);
  let copyHint = $state('');

  onMount(async () => {
    try {
      info = (await api.invoke('app:getAbout')) as AboutInfo;
    } catch {
      info = null;
    }
  });

  function tierLabel(): string {
    if (uiState.licenseStatus !== 'active') return 'Unlicensed';
    return uiState.licenseTier === 'pro' ? 'Pro' : 'Basic';
  }

  function platformLabel(p: string): string {
    switch (p) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return p;
    }
  }

  function openExternal(url: string) {
    api.invoke('app:openExternal', url);
  }

  async function copyDiagnostics() {
    if (!info) return;
    const text = [
      `vswrite ${info.version}`,
      `Platform: ${platformLabel(info.platform)} (${info.arch})`,
      `Electron ${info.electron} / Chromium ${info.chrome} / Node ${info.node}`,
      `License: ${tierLabel()}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyHint = 'Copied';
      setTimeout(() => { copyHint = ''; }, 1500);
    } catch {
      copyHint = 'Copy failed';
      setTimeout(() => { copyHint = ''; }, 1500);
    }
  }
</script>

<div
  class="about-overlay"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  role="dialog"
  tabindex="-1"
  aria-label="About vswrite"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
  <div class="about-dialog" onclick={(e) => e.stopPropagation()} role="document">
    <button class="close-btn" onclick={onClose} aria-label="Close">×</button>

    <div class="hero">
      <img src={logoUrl} alt="vswrite logo" class="logo" />
      <div class="app-meta">
        <h1>vswrite</h1>
        <div class="version">{info ? `Version ${info.version}` : 'Version …'}</div>
        <div class="tier-badge" class:pro={uiState.licenseTier === 'pro'} class:active={uiState.licenseStatus === 'active'}>
          {tierLabel()}
        </div>
      </div>
    </div>

    <p class="tagline">A WYSIWYG editor for Typst documents.</p>

    {#if info}
      <dl class="specs">
        <div>
          <dt>Platform</dt>
          <dd>{platformLabel(info.platform)} · {info.arch}</dd>
        </div>
        <div>
          <dt>Electron</dt>
          <dd>{info.electron}</dd>
        </div>
        <div>
          <dt>Chromium</dt>
          <dd>{info.chrome}</dd>
        </div>
        <div>
          <dt>Node</dt>
          <dd>{info.node}</dd>
        </div>
      </dl>
    {/if}

    <div class="links">
      <button class="link-btn" onclick={() => openExternal('https://vswrite.netlify.app/de/docs')}>
        User Guide
      </button>
      <button class="link-btn" onclick={() => openExternal('https://vswrite.com')}>
        Website
      </button>
      <button class="link-btn" onclick={() => openExternal('https://github.com/renejes/vswrite-desktop/issues')}>
        Report Issue
      </button>
      <button class="link-btn" onclick={() => (showAcknowledgments = true)}>
        Open Source Lizenzen
      </button>
    </div>

    {#if showAcknowledgments}
      <AcknowledgmentsDialog onClose={() => (showAcknowledgments = false)} />
    {/if}

    <div class="footer">
      <button class="btn-text" onclick={copyDiagnostics}>
        {copyHint || 'Copy diagnostics'}
      </button>
      <span class="copyright">© {new Date().getFullYear()} René Jesser · MIT</span>
    </div>
  </div>
</div>

<style>
  .about-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }

  .about-dialog {
    position: relative;
    background: #fff;
    border-radius: 16px;
    width: 460px;
    max-width: 92vw;
    padding: 32px 32px 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #f5f5f5;
    color: #555;
  }

  .hero {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 12px;
  }

  .logo {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
  }

  .app-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .app-meta h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    color: #1a1a1a;
    letter-spacing: -0.02em;
  }

  .version {
    font-size: 13px;
    color: #888;
    font-family: 'SF Mono', 'Menlo', monospace;
  }

  .tier-badge {
    align-self: flex-start;
    margin-top: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    background: #f0f0f0;
    color: #777;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tier-badge.active {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .tier-badge.pro.active {
    background: #eef4ff;
    color: #4f7df9;
  }

  .tagline {
    margin: 0 0 20px;
    font-size: 14px;
    color: #666;
    line-height: 1.5;
  }

  .specs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;
    margin: 0 0 20px;
    padding: 14px 16px;
    background: #fafafa;
    border-radius: 10px;
    font-size: 12px;
  }

  .specs div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .specs dt {
    color: #999;
  }

  .specs dd {
    margin: 0;
    color: #333;
    font-family: 'SF Mono', 'Menlo', monospace;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }

  .link-btn {
    flex: 1;
    min-width: 120px;
    padding: 9px 14px;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    background: #fff;
    color: #333;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    transition: all 0.15s;
  }

  .link-btn:hover {
    background: #f5f5f5;
    border-color: #ccc;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
  }

  .btn-text {
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    border-radius: 6px;
  }

  .btn-text:hover {
    color: #555;
    background: #f5f5f5;
  }

  .copyright {
    font-size: 11px;
    color: #999;
  }
</style>
