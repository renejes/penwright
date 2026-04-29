import '../editor/style.css';
import App from './App.svelte';
import { mount } from 'svelte';

// ─── Renderer-side crash capture ─────────────────────
// Window-level error / unhandled-rejection listeners forward to the
// main process which writes a plaintext report to <userData>/crash-reports/.
// Wrapped in try/catch so a broken IPC bridge can't infinite-loop.
const electronAPI = (window as unknown as {
  electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
}).electronAPI;

function reportToMain(payload: { message: string; stack: string; type: 'error' | 'unhandledrejection' }): void {
  try {
    electronAPI?.invoke('crash:report', payload).catch(() => {
      /* swallow — never re-throw from a crash handler */
    });
  } catch {
    /* ignore */
  }
}

window.addEventListener('error', (e) => {
  const stack = e.error instanceof Error
    ? (e.error.stack ?? `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`)
    : `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`;
  reportToMain({
    message: e.message || 'Unknown renderer error',
    stack,
    type: 'error',
  });
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? (reason.stack ?? message) : message;
  reportToMain({
    message,
    stack,
    type: 'unhandledrejection',
  });
});

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
