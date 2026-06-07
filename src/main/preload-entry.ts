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
  'git:stage',
  'git:unstage',
  'git:stageAll',
  'git:commit',
  'git:push',
  'git:pull',
  'git:init',
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
  'project:close',
  'project:newFolder',
  'project:addAssets',
  'export:getSections',
  'export:run',
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
  'persist:getZoteroBibPath',
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
