<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import '@xterm/xterm/css/xterm.css';
  import { t } from '@shared/i18n/store.svelte';

  let terminalEl: HTMLDivElement;
  let term: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const api = (window as unknown as { electronAPI: {
    send(channel: string, data: unknown): void;
    on(channel: string, callback: (data: unknown) => void): void;
  } }).electronAPI;

  onMount(() => {
    term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', 'Menlo', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f48771',
        green: '#4ec9b0',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4fc1ff',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f48771',
        brightGreen: '#4ec9b0',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4fc1ff',
        brightWhite: '#ffffff',
      },
      scrollback: 5000,
      allowProposedApi: true,
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalEl);

    // Fit after a short delay to ensure container is sized
    setTimeout(() => {
      fitAddon?.fit();
      sendResize();
    }, 50);

    // User input → main process
    term.onData((data: string) => {
      api.send('terminal:input', data);
    });

    // Main process → terminal display
    api.on('terminal:data', (data: unknown) => {
      term?.write(data as string);
    });

    // Request terminal creation
    api.send('terminal:create', null);

    // Resize on container size change
    resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        fitAddon?.fit();
        sendResize();
      }, 10);
    });
    resizeObserver.observe(terminalEl);
  });

  function sendResize() {
    if (term) {
      api.send('terminal:resize', { cols: term.cols, rows: term.rows });
    }
  }

  onDestroy(() => {
    resizeObserver?.disconnect();
    term?.dispose();
  });
</script>

<div class="terminal-panel">
  <div class="terminal-header">
    <span class="terminal-label">{t().pickers.terminalLabel}</span>
  </div>
  <div class="terminal-content" bind:this={terminalEl}></div>
</div>

<style>
  .terminal-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: #252526;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    border-top: 1px solid #333;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .terminal-content {
    flex: 1;
    overflow: hidden;
    padding: 4px;
  }

  /* Override xterm.js defaults to fill container */
  .terminal-content :global(.xterm) {
    height: 100%;
  }

  .terminal-content :global(.xterm-viewport) {
    overflow-y: auto !important;
  }
</style>
