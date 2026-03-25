/**
 * Electron Preload Script
 * Exposes a safe IPC bridge to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

const SEND_CHANNELS = ['vswrite', 'terminal:input', 'terminal:resize', 'terminal:create'];
const ON_CHANNELS = ['vswrite', 'terminal:data'];
const INVOKE_CHANNELS = [
  'dialog:openFile',
  'dialog:saveFile',
  'dialog:saveFileAs',
  'app:getPlatform',
  'app:checkTypst',
  'filetree:list',
  'filetree:open',
  'filetree:navigateUp',
  'filetree:openFolder',
  'includes:validate',
  'includes:open',
  'includes:add',
  'textfile:read',
  'textfile:write',
  'git:status',
  'git:stage',
  'git:unstage',
  'git:stageAll',
  'git:commit',
  'git:push',
  'git:pull',
  'git:init',
];

contextBridge.exposeInMainWorld('electronAPI', {
  send(channel: string, data: unknown) {
    if (SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  on(channel: string, callback: (data: unknown) => void) {
    if (ON_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, data) => callback(data));
    }
  },

  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  },

  // Convenience wrappers for dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  saveFileAs: (defaultName: string, filters: unknown) =>
    ipcRenderer.invoke('dialog:saveFileAs', defaultName, filters),

  // App info
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
});
