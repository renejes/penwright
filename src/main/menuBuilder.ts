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
import { getLocale } from './persistenceManager';
import { resolveDict } from '../shared/i18n';

export function buildMenu(state: AppState): void {
  const isMac = process.platform === 'darwin';
  const m = resolveDict(getLocale()).menu;

  const send = (type: string, extra: Record<string, unknown> = {}) =>
    state.mainWindow?.webContents.send('penwright', { type, ...extra });

  const showAbout = () => send('showAbout');

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: m.about(app.name), click: showAbout },
              { type: 'separator' as const },
              {
                label: m.documentSettings,
                accelerator: 'CmdOrCtrl+,',
                click: () => send('requestSettings'),
              },
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
      label: m.file,
      submenu: [
        {
          label: m.newProject,
          accelerator: 'CmdOrCtrl+N',
          click: () => send('newProject'),
        },
        {
          label: m.openProject,
          accelerator: 'CmdOrCtrl+O',
          click: () => state.openProject(),
        },
        {
          label: m.closeProject,
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => state.closeProject(),
        },
        {
          label: m.saveAsPreset,
          click: () => send('saveAsPreset'),
        },
        { type: 'separator' },
        {
          label: m.save,
          accelerator: 'CmdOrCtrl+S',
          click: () => state.saveFile(),
        },
        {
          label: m.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => state.saveFileAs(),
        },
        { type: 'separator' },
        {
          label: m.exportPdf,
          click: () => state.handleExportPdf(),
        },
        {
          label: m.exportDocx,
          click: () => state.handleExportDocx(),
        },
        {
          label: m.exportWeb,
          click: () => state.handleExportWeb(),
        },
        { type: 'separator' },
        {
          label: m.importMarkdown,
          click: () => state.handleImportMarkdown(),
        },
        {
          label: m.linkZotero,
          click: () => state.handleLinkZotero(),
        },
        {
          label: m.openSources,
          click: () => send('importSources'),
        },
        {
          label: m.addCitation,
          click: () => send('addCitationManually'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // ─── Edit ─────────────────────────────────────────────
    {
      label: m.edit,
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
          label: m.findReplace,
          accelerator: 'CmdOrCtrl+F',
          click: () => send('showSearch'),
        },
        {
          label: m.findInProject,
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('showProjectSearch'),
        },
        { type: 'separator' },
        {
          label: m.addComment,
          accelerator: 'CmdOrCtrl+Alt+M',
          click: () => send('addComment'),
        },
        {
          label: m.insertReference,
          accelerator: 'CmdOrCtrl+Alt+L',
          click: () => send('showReferencePicker'),
        },
        { type: 'separator' },
        {
          label: m.undoAiEdit,
          click: () => send('undoLastAiEdit'),
        },
      ],
    },

    // ─── View ─────────────────────────────────────────────
    {
      label: m.view,
      submenu: [
        {
          label: m.toggleSidebar,
          // NOT CmdOrCtrl+B (editor Bold) and NOT CmdOrCtrl+Shift+B (editor
          // Blockquote) — a native accelerator swallows the key before the
          // renderer ever sees it.
          accelerator: 'CmdOrCtrl+Alt+B',
          click: () => send('togglePanel', { panel: 'sidebar' }),
        },
        {
          label: m.togglePreview,
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send('togglePanel', { panel: 'preview' }),
        },
        {
          label: m.toggleChat,
          accelerator: 'CmdOrCtrl+J',
          click: () => send('togglePanel', { panel: 'chat' }),
        },
        { type: 'separator' },
        {
          label: m.editorZoom,
          submenu: [
            {
              label: m.zoomIn,
              accelerator: 'CmdOrCtrl+Alt+=',
              click: () => send('zoomEditorIn'),
            },
            {
              label: m.zoomOut,
              accelerator: 'CmdOrCtrl+Alt+-',
              click: () => send('zoomEditorOut'),
            },
            {
              label: m.reset,
              accelerator: 'CmdOrCtrl+Alt+0',
              click: () => send('zoomEditorReset'),
            },
          ],
        },
        {
          label: m.previewZoom,
          submenu: [
            {
              label: m.zoomIn,
              accelerator: 'CmdOrCtrl+Shift+=',
              click: () => send('zoomPdfIn'),
            },
            {
              label: m.zoomOut,
              accelerator: 'CmdOrCtrl+Shift+-',
              click: () => send('zoomPdfOut'),
            },
            {
              label: m.reset,
              accelerator: 'CmdOrCtrl+Shift+0',
              click: () => send('zoomPdfReset'),
            },
          ],
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: m.resetWindowZoom },
        { role: 'zoomIn', label: m.zoomWindowIn },
        { role: 'zoomOut', label: m.zoomWindowOut },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // ─── Document ─────────────────────────────────────────
    {
      label: m.document,
      submenu: [
        {
          label: m.documentSettings,
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
          label: m.mergeDocument,
          click: () => send('mergeDocument'),
        },
        {
          label: m.splitDocument,
          click: () => send('splitDocument'),
        },
        { type: 'separator' },
        {
          label: m.openAsTypst,
          click: () => send('openSource'),
        },
        {
          label: m.ensureBibliography,
          click: () => send('ensureBibliography'),
        },
      ],
    },

    // ─── Help ─────────────────────────────────────────────
    {
      label: m.help,
      submenu: [
        {
          label: m.showIntroduction,
          click: () => send('showOnboarding'),
        },
        {
          label: m.userGuide,
          click: () => send('showHandbook'),
        },
        {
          label: m.keyboardShortcuts,
          accelerator: 'CmdOrCtrl+/',
          click: () => send('showShortcuts'),
        },
        {
          label: m.reportIssue,
          click: () => {
            shell.openExternal('https://github.com/renejes/vswrite-desktop/issues');
          },
        },
        { type: 'separator' as const },
        {
          label: m.mcpConnection,
          click: () => send('showMcpConnection'),
        },
        { type: 'separator' as const },
        {
          label: m.openCrashReports,
          click: () => { shell.openPath(getReportsDir()); },
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              { label: m.about(app.name), click: showAbout },
            ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
