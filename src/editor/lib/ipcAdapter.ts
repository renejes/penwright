/**
 * IPC Adapter — abstracts communication between renderer and host process.
 * Electron (Mac), the old VS Code webview, and Tauri on iPad.
 * The iPad backend only carries the penwright channel. File and project
 * calls go through `window.electronAPI.invoke`, which the iPad entry fills
 * in before this module loads. On the Mac that object is the preload bridge
 * and this file still takes the Electron path.
 */

import type { WebviewMessage, ExtensionMessage } from './messages';
import { adapterKind, isIpadHost } from '../../shared/hostKind';

export interface IPCAdapter {
  send(msg: WebviewMessage): void;
  onMessage(handler: (msg: ExtensionMessage) => void): void;
}

declare global {
  interface Window {
    electronAPI?: {
      send(channel: string, data: unknown): void;
      on(channel: string, callback: (data: unknown) => void): void;
    };
    acquireVsCodeApi?: () => {
      postMessage(msg: unknown): void;
    };
  }
}

function createTauriAdapter(): IPCAdapter {
  return {
    send: (msg) => window.__penwrightIpad?.send(msg),
    onMessage: (handler) => window.__penwrightIpad?.onMessage((msg) => handler(msg as ExtensionMessage)),
  };
}

function createElectronAdapter(): IPCAdapter {
  return {
    send: (msg) => window.electronAPI!.send('penwright', msg),
    onMessage: (handler) =>
      window.electronAPI!.on('penwright', (data) =>
        handler(data as ExtensionMessage),
      ),
  };
}

function createVSCodeAdapter(): IPCAdapter {
  const vscode = window.acquireVsCodeApi!();
  return {
    send: (msg) => vscode.postMessage(msg),
    onMessage: (handler) =>
      window.addEventListener('message', (e: MessageEvent) =>
        handler(e.data as ExtensionMessage),
      ),
  };
}

function createNoopAdapter(): IPCAdapter {
  return {
    send: () => console.warn('[IPC] No adapter available'),
    onMessage: () => console.warn('[IPC] No adapter available'),
  };
}

export function createIPCAdapter(): IPCAdapter {
  const kind = adapterKind({
    ipad: isIpadHost(),
    electron: !!window.electronAPI,
    vscode: !!window.acquireVsCodeApi,
  });
  if (kind === 'ios') return createTauriAdapter();
  if (kind === 'electron') return createElectronAdapter();
  if (kind === 'vscode') return createVSCodeAdapter();
  return createNoopAdapter();
}

export const ipc = createIPCAdapter();
