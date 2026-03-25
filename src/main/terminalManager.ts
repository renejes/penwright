/**
 * Terminal Manager — manages a node-pty process and relays data via IPC.
 */

import type { BrowserWindow } from 'electron';

// node-pty is a native module, loaded dynamically to handle build failures gracefully
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
} catch {
  console.warn('[vswrite] node-pty not available — terminal disabled');
}

type IPty = import('node-pty').IPty;

export class TerminalManager {
  private process: IPty | null = null;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  get available(): boolean {
    return pty !== null;
  }

  spawn(cwd: string): void {
    if (!pty) return;

    this.dispose();

    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/zsh';

    this.process = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM_PROGRAM: 'vswrite',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    });

    this.process.onData((data: string) => {
      this.window.webContents.send('terminal:data', data);
    });

    this.process.onExit(() => {
      // Respawn on exit
      setTimeout(() => this.spawn(cwd), 100);
    });
  }

  write(data: string): void {
    this.process?.write(data);
  }

  resize(cols: number, rows: number): void {
    try {
      this.process?.resize(cols, rows);
    } catch {
      // Ignore resize errors (e.g. process already exited)
    }
  }

  dispose(): void {
    if (this.process) {
      try { this.process.kill(); } catch {}
      this.process = null;
    }
  }
}
