/**
 * Application Menu Builder
 * Extracted from index.ts — builds the native macOS/Windows menu bar.
 */

import { app, Menu, shell } from 'electron';
import type { AppState } from './appState';

export function buildMenu(state: AppState): void {
  const isMac = process.platform === 'darwin';

  const showAbout = () =>
    state.mainWindow?.webContents.send('vswrite', { type: 'showAbout' });

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: `About ${app.name}`, click: showAbout },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => state.newFile(),
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => state.openFile(),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => state.saveFile(),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => state.saveFileAs(),
        },
        { type: 'separator' },
        {
          label: 'Export as PDF…',
          click: () => state.handleExportPdf(),
        },
        {
          label: 'Export as DOCX…',
          click: () => state.handleExportDocx(),
        },
        { type: 'separator' },
        {
          label: 'Import Markdown…',
          click: () => state.handleImportMarkdown(),
        },
        {
          label: 'Link Zotero Library…',
          click: () => state.handleLinkZotero(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => state.mainWindow?.webContents.send('vswrite', { type: 'togglePanel', panel: 'sidebar' }),
        },
        {
          label: 'Toggle Preview',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => state.mainWindow?.webContents.send('vswrite', { type: 'togglePanel', panel: 'preview' }),
        },
        {
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => state.mainWindow?.webContents.send('vswrite', { type: 'togglePanel', panel: 'terminal' }),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          click: () => {
            shell.openExternal('https://vswrite.netlify.app/de/docs');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/renejes/vswrite-desktop/issues');
          },
        },
        // On macOS an "About" entry is already in the application menu;
        // add it to Help only on Windows/Linux where no equivalent exists.
        ...(isMac ? [] : [
          { type: 'separator' as const },
          { label: `About ${app.name}`, click: showAbout },
        ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
