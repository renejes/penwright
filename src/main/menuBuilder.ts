/**
 * Application Menu Builder
 *
 * Native macOS / Windows / Linux menu bar. The menu is the primary
 * discovery surface for project- and document-level actions — the old
 * in-app "CommandHub" hamburger menu has been retired in favour of
 * this and the slash-command palette in the editor.
 */

import { app, Menu, shell } from 'electron';
import type { AppState } from './appState';

export function buildMenu(state: AppState): void {
  const isMac = process.platform === 'darwin';

  const send = (type: string, extra: Record<string, unknown> = {}) =>
    state.mainWindow?.webContents.send('vswrite', { type, ...extra });

  const showAbout = () => send('showAbout');

  const styleTemplate = (id: string, label: string): Electron.MenuItemConstructorOptions => ({
    label,
    click: () => send('applyStyle', { styleId: id }),
  });

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

    // ─── File ─────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project…',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('newProject'),
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => state.openProject(),
        },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => state.closeProject(),
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
        {
          label: 'Open Sources Folder',
          click: () => send('importSources'),
        },
        {
          label: 'Add Citation Manually…',
          click: () => send('addCitationManually'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // ─── Edit ─────────────────────────────────────────────
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
        { type: 'separator' },
        {
          label: 'Find & Replace',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('showSearch'),
        },
        {
          label: 'Find in Project…',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('showProjectSearch'),
        },
        { type: 'separator' },
        {
          label: 'Add Comment',
          accelerator: 'CmdOrCtrl+Alt+M',
          click: () => send('addComment'),
        },
        {
          label: 'Insert Reference…',
          accelerator: 'CmdOrCtrl+Alt+L',
          click: () => send('showReferencePicker'),
        },
        { type: 'separator' },
        {
          label: 'Undo AI Edit',
          click: () => send('undoLastAiEdit'),
        },
      ],
    },

    // ─── View ─────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('togglePanel', { panel: 'sidebar' }),
        },
        {
          label: 'Toggle Preview',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send('togglePanel', { panel: 'preview' }),
        },
        {
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => send('togglePanel', { panel: 'terminal' }),
        },
        { type: 'separator' },
        {
          label: 'Focus Mode',
          click: () => send('toggleFocusMode'),
        },
        {
          label: 'Typewriter Mode',
          click: () => send('toggleTypewriterMode'),
        },
        {
          label: 'Reading Mode',
          accelerator: 'CmdOrCtrl+Alt+R',
          click: () => send('toggleReadingMode'),
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

    // ─── Document ─────────────────────────────────────────
    {
      label: 'Document',
      submenu: [
        {
          label: 'Document Settings…',
          click: () => send('requestSettings'),
        },
        { type: 'separator' },
        {
          label: 'Style Templates',
          submenu: [
            styleTemplate('classic', 'Classic Academic'),
            styleTemplate('modern', 'Modern Clean'),
            styleTemplate('minimal', 'Minimal'),
            styleTemplate('vibrant', 'Vibrant'),
            styleTemplate('elegant', 'Elegant'),
            styleTemplate('professional', 'Professional Report'),
            styleTemplate('artsy', 'Artsy'),
            { type: 'separator' },
            {
              label: 'Import Custom Template…',
              click: () => send('importStyleTemplate'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Merge Document',
          click: () => send('mergeDocument'),
        },
        {
          label: 'Split into Chapters',
          click: () => send('splitDocument'),
        },
        { type: 'separator' },
        {
          label: 'Open as Typst Source',
          click: () => send('openSource'),
        },
        {
          label: 'Ensure Bibliography',
          click: () => send('ensureBibliography'),
        },
      ],
    },

    // ─── Help ─────────────────────────────────────────────
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
          label: 'Keyboard Shortcuts',
          click: () => send('showShortcuts'),
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/renejes/vswrite-desktop/issues');
          },
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              { label: `About ${app.name}`, click: showAbout },
            ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
