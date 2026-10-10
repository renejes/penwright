/**
 * Which host is painting this page.
 *
 * The Mac app is Electron. The iPad app is a Tauri shell in the same repo.
 * Everything that must stay disabled on the iPad checks `isIpadHost()` so the
 * Electron path is unchanged when the flag is absent.
 */

export type PenwrightHostKind = 'ios' | 'electron' | 'vscode' | 'noop';

declare global {
  interface Window {
    __PENWRIGHT_HOST__?: 'ios';
    __penwrightIpad?: {
      send(msg: unknown): void;
      onMessage(handler: (msg: unknown) => void): void;
      readImage(src: string, baseDir: string): Promise<string | null>;
    };
  }
}

export function isIpadHost(): boolean {
  return typeof window !== 'undefined' && window.__PENWRIGHT_HOST__ === 'ios';
}

/** Which IPC backend `createIPCAdapter` selects. iPad wins when the flag is set. */
export function adapterKind(flags: {
  ipad: boolean;
  electron: boolean;
  vscode: boolean;
}): PenwrightHostKind {
  if (flags.ipad) return 'ios';
  if (flags.electron) return 'electron';
  if (flags.vscode) return 'vscode';
  return 'noop';
}
