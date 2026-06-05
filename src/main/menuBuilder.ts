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
import { getReportsDir } from './crashReporter';

export function buildMenu(state: AppState): void {
  const isMac = process.platform === 'darwin';

  const send = (type: string, extra: Record<string, unknown> = {}) =>
    state.mainWindow?.webContents.send('penwright', { type, ...extra });

  const showAbout = () => send('showAbout');

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
        {
          label: 'Editor Zoom',
          submenu: [
            {
              label: 'Zoom In',
              accelerator: 'CmdOrCtrl+Alt+=',
              click: () => send('zoomEditorIn'),
            },
            {
              label: 'Zoom Out',
              accelerator: 'CmdOrCtrl+Alt+-',
              click: () => send('zoomEditorOut'),
            },
            {
              label: 'Reset',
              accelerator: 'CmdOrCtrl+Alt+0',
              click: () => send('zoomEditorReset'),
            },
          ],
        },
        {
          label: 'Preview Zoom',
          submenu: [
            {
              label: 'Zoom In',
              accelerator: 'CmdOrCtrl+Shift+=',
              click: () => send('zoomPdfIn'),
            },
            {
              label: 'Zoom Out',
              accelerator: 'CmdOrCtrl+Shift+-',
              click: () => send('zoomPdfOut'),
            },
            {
              label: 'Reset',
              accelerator: 'CmdOrCtrl+Shift+0',
              click: () => send('zoomPdfReset'),
            },
          ],
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reset Window Zoom' },
        { role: 'zoomIn', label: 'Zoom Window In' },
        { role: 'zoomOut', label: 'Zoom Window Out' },
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
        // The legacy "Style Templates" submenu (Classic / Modern / Minimal /
        // Vibrant / Elegant / Professional / Artsy) has been removed from the
        // in-app menu. Style editing now happens in the Design sidebar tab,
        // which writes into .penwright/style.json instead of injecting raw
        // preamble into main.typ. The applyStyleTemplate / handleImportStyleTemplate
        // IPC handlers stay in importExport.ts as legacy entry points for
        // the MCP tools `penwright_list_styles` / `penwright_apply_style` until
        // those are migrated to the new theme-preset format.
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
          label: 'Show Introduction',
          click: () => send('showOnboarding'),
        },
        {
          label: 'User Guide',
          click: () => send('showHandbook'),
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('showShortcuts'),
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/renejes/vswrite-desktop/issues');
          },
        },
        { type: 'separator' as const },
        {
          label: 'Mit Claude Desktop verbinden…',
          click: () => send('showMcpSetupWizard'),
        },
        { type: 'separator' as const },
        {
          label: 'Open Crash Reports',
          click: () => { shell.openPath(getReportsDir()); },
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
