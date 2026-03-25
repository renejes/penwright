/**
 * Electron Preload Script
 * Exposes a safe IPC bridge to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send(channel: string, data: unknown) {
    // Only allow our channel
    if (channel === 'vswrite') {
      ipcRenderer.send(channel, data);
    }
  },

  on(channel: string, callback: (data: unknown) => void) {
    if (channel === 'vswrite') {
      ipcRenderer.on(channel, (_event, data) => callback(data));
    }
  },

  // File dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  saveFileAs: (defaultName: string, filters: unknown) =>
    ipcRenderer.invoke('dialog:saveFileAs', defaultName, filters),

  // App info
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
});
