/**
 * IPC Adapter — abstracts communication between renderer and host process.
 * Works for both VS Code webview (postMessage) and Electron (contextBridge).
 */

import type { WebviewMessage, ExtensionMessage } from './messages';

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
  if (window.electronAPI) return createElectronAdapter();
  if (window.acquireVsCodeApi) return createVSCodeAdapter();
  return createNoopAdapter();
}

export const ipc = createIPCAdapter();
