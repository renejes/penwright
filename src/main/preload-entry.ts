/**
 * Electron Preload Script
 * Exposes a safe IPC bridge to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

const SEND_CHANNELS = ['penwright'];
const ON_CHANNELS = ['penwright'];
const INVOKE_CHANNELS = [
  'dialog:openFile',
  'dialog:saveFile',
  'dialog:saveFileAs',
  'app:getPlatform',
  'app:checkTypst',
  'app:getAbout',
  'app:getBundleLicenses',
  'app:openExternal',
  'app:getLocale',
  'app:setLocale',
  'filetree:list',
  'filetree:open',
  'filetree:navigateUp',
  'filetree:openFolder',
  'includes:validate',
  'includes:open',
  'includes:add',
  'textfile:read',
  'textfile:readBinary',
  'textfile:write',
  'git:status',
  'git:push',
  'git:pull',
  'git:ensureRepo',
  'git:saveVersion',
  'git:listVersions',
  'git:showVersion',
  'git:restoreVersion',
  'git:getRemote',
  'git:setRemote',
  'project:listBackups',
  'project:loadBackup',
  'project:applyBackup',
  'project:openBackupFolder',
  'project:getBackupConfig',
  'project:setBackupConfig',
  'ai:list',
  'ai:undoLast',
  'agent:activity',
  'project:showInFinder',
  'project:findSourceForCitation',
  'project:getInfo',
  'project:getPreferences',
  'project:setPreferences',
  'style:get',
  'style:save',
  'section:get',
  'section:context',
  'section:getStyle',
  'section:saveStyle',
  'section:apply',
  'section:clear',
  'design:undo',
  'design:canUndo',
  'project:lookFile',
  'selection:pin',
  'selection:get',
  'selection:clear',
  'project:open',
  'project:openSample',
  'preset:gallery',
  'preset:create',
  'preset:save',
  'preset:delete',
  'preset:styles',
  'preset:getStyle',
  'preset:preview',
  'project:close',
  'project:newFolder',
  'project:addAssets',
  'export:getSections',
  'export:run',
  'export:preflightImages',
  'project:search',
  'project:replaceAll',
  'project:listLabels',
  'comments:list',
  'comments:create',
  'comments:update',
  'comments:delete',
  'spellcheck:setLanguage',
  'persist:getPanelState',
  'persist:savePanelState',
  'persist:getRecentProjects',
  'persist:isOnboardingSeen',
  'persist:setOnboardingSeen',
  'persist:getPreviewMode',
  'persist:setPreviewMode',
  'preview:compile',
  'license:activate',
  'license:validate',
  'license:deactivate',
  'license:getStatus',
  'license:getEntitlement',
  'license:openCheckout',
  'crash:report',
  'crash:getLatest',
  'crash:markShown',
  'crash:deleteAll',
  'crash:openFolder',
  'crash:copyToClipboard',
  'crash:openMail',
  'mcp:checkClaudeDesktop',
  'mcp:setup',
  'mcp:openClaude',
  'mcp:getSetupStatus',
  'mcp:skipSetup',
  'mcp:getConnectionStatus',
  'mcp:setTarget',
];

contextBridge.exposeInMainWorld('electronAPI', {
  send(channel: string, data: unknown) {
    if (SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Returns an unsubscribe function — components that mount/unmount (the
  // sidebar tab panels) MUST call it in onDestroy, otherwise every tab visit
  // permanently stacks another ipcRenderer listener (contextBridge proxies
  // returned functions across the isolation boundary).
  on(channel: string, callback: (data: unknown) => void): () => void {
    if (ON_CHANNELS.includes(channel)) {
      const listener = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on(channel, listener as Parameters<typeof ipcRenderer.on>[1]);
      return () => ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.on>[1]);
    }
    return () => {};
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
