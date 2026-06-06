import type { MainDialogsMessages } from '../en/mainDialogs';
export const mainDialogs: MainDialogsMessages = {
  // ─── Shared ──────────────────────────────────────────
  ok: 'OK',
  cancel: 'Abbrechen',

  // ─── Export ──────────────────────────────────────────
  exportFailedTitle: 'Export fehlgeschlagen',
  openProjectFirst: 'Bitte zuerst ein Projekt öffnen.',
  exportFailedFmt: (fmt: string) => `${fmt}-Export fehlgeschlagen`,
  exportedTo: (fmt: string, file: string) => `${fmt} nach ${file} exportiert`,
  openPdf: 'PDF öffnen',
  openDocx: 'DOCX öffnen',
  filterPdf: 'PDF',
  filterWordDocument: 'Word-Dokument',

  // ─── Import Markdown ─────────────────────────────────
  importMarkdownTitle: 'Markdown-Datei importieren',
  filterMarkdownFiles: 'Markdown-Dateien',
  filterTypstFiles: 'Typst-Dateien',
  importedAsTypst: (file: string) => `"${file}" als Typst importiert.`,
  importedMarkdownDetail: 'Prüfe die konvertierte Datei — einige komplexe Markdown-Konstrukte müssen eventuell manuell angepasst werden.',
  importFailedTitle: 'Import fehlgeschlagen',

  // ─── Import Style Template ───────────────────────────
  importStyleTemplateTitle: 'Stilvorlage importieren',
  noStyleRules: 'Keine Stilregeln (#set, #show) in der Datei gefunden.',
  styleImportedApplied: (label: string) => `Stil "${label}" importiert und angewendet.`,
  styleImportedDetail: 'Die Vorlage wurde in .claude/style-templates/ für die spätere Verwendung gespeichert.',

  // ─── Zotero ──────────────────────────────────────────
  filterBibtexFiles: 'BibTeX-Dateien',
  selectZoteroExportTitle: 'Zotero-Better-BibTeX-Auto-Export-Datei auswählen',
  selectZoteroExportMessage: 'Wähle die .bib-Datei aus, die Zotero Better BibTeX aktuell hält',
  noProjectOpenTitle: 'Kein Projekt geöffnet',
  zoteroLinkedTitle: 'Zotero-Bibliothek verknüpft!',
  zoteroLinkedDetail: (file: string) =>
    `"${file}" wurde als zotero.bib ins Projekt kopiert.\nÄnderungen in Zotero werden automatisch synchronisiert, solange die App läuft.`,
  zoteroLinkFailedTitle: 'Zotero-Verknüpfung fehlgeschlagen',

  // ─── Apply Style Template (root-file guard) ──────────
  styleCannotChangeHereTitle: 'Stil kann hier nicht geändert werden',
  styleBelongsInRoot: (rootFile: string) => `Stile gehören in die Hauptdatei (${rootFile}).`,
  styleBelongsInRootDetail:
    'Wechsle erst zur Hauptdatei und wende den Stil dort an. Sonst würde der Stil-Vorspann an den Anfang dieses Kapitels gehängt und die Datei kaputtmachen.',

  // ─── File operations (fileManager) ───────────────────
  // File lock (shared folders)
  fileLockedTitle: 'Datei ist gesperrt',
  fileLockedMessage: (user: string, machine: string) =>
    `Diese Datei wird gerade von ${user} auf ${machine} bearbeitet.`,
  fileLockedDetail:
    'Sie gleichzeitig zu öffnen kann zu Konflikten führen, wenn dein Projekt in einem geteilten Ordner liegt (Dropbox, iCloud usw.).',
  openReadOnly: 'Schreibgeschützt öffnen',
  openAnyway: 'Trotzdem öffnen',

  // Crash recovery
  unsavedChangesFoundTitle: 'Ungespeicherte Änderungen gefunden',
  unsavedChangesFoundMessage: 'Für diese Datei wurde ein Backup mit ungespeicherten Änderungen gefunden.',
  unsavedChangesFoundDetail: (when: string) =>
    `Letztes Backup: ${when}\n\nMöchtest du das Backup wiederherstellen?`,
  recover: 'Wiederherstellen',
  discardBackup: 'Backup verwerfen',

  // File open/save errors
  couldNotOpenFile: 'Datei konnte nicht geöffnet werden',
  couldNotSaveFile: 'Datei konnte nicht gespeichert werden',

  // Close project (unsaved changes prompt)
  unsavedChangesMessage: 'Du hast ungespeicherte Änderungen.',
  unsavedChangesDetail: 'Möchtest du vor dem Schließen des Projekts speichern?',
  save: 'Speichern',
  dontSave: 'Nicht speichern',

  // ─── Project operations (projectManager) ─────────────
  // Create project
  chooseProjectLocationTitle: 'Speicherort für das Projekt wählen',
  createHere: 'Hier erstellen',

  // Open project
  openProjectTitle: 'Projekt öffnen',
  folderNotFound: 'Ordner nicht gefunden.',
  folderNotFoundDetail: (p: string) => `Der Pfad "${p}" existiert nicht oder ist kein Ordner.`,

  // Sample project
  sampleProjectNotFound: 'Beispielprojekt nicht gefunden.',
  sampleProjectNotFoundDetail: 'Die mitgelieferte Beispielprojekt-Ressource fehlt in diesem Build.',
  sampleProjectCreateFailed: 'Das Beispielprojekt konnte nicht erstellt werden.',
  sampleProjectTargetTitle: 'Wo soll das Beispielprojekt gespeichert werden?',
  sampleProjectCreateHere: 'Hier erstellen',

  // Add assets
  addAssetsTitle: 'Assets zum Projekt hinzufügen',
  filterCommonAssets: 'Gängige Assets',
  filterAllFiles: 'Alle Dateien',

  // Images
  filterImages: 'Bilder',

  // ─── ipcHandlers dialogs ─────────────────────────────
  mergeFailedTitle: 'Zusammenführen fehlgeschlagen',
  splitFailedTitle: 'Aufteilen fehlgeschlagen',
  noAiEditsToUndo: 'Keine KI-Änderungen zum Rückgängigmachen.',

  // ─── New folder / Add assets (returned to renderer, shown in Sidebar) ─
  noProjectOpen: 'Kein Projekt geöffnet.',
  folderNameEmpty: 'Der Ordnername ist leer.',
  folderNameInvalid: 'Der Ordnername enthält ungültige Zeichen.',
  folderOutside: 'Der Ordner liegt außerhalb des Projekts.',
  folderExists: 'Ein Ordner mit diesem Namen existiert bereits.',

  // ─── Quit-while-dirty dialog (index.ts) ──────────────
  unsavedChangesQuitDetail: 'Möchtest du vor dem Schließen speichern?',

  // ─── Design-undo labels (shown as the undo-button tooltip) ───────────
  undoLabelDesignChanged: 'Design geändert',
  undoLabelChapterLook: 'Kapitel-Look angepasst',
  undoLabelChapterLookSet: (id: string) => `Kapitel-Look: ${id}`,
  undoLabelChapterLookRemoved: 'Kapitel-Look entfernt',

  // ─── License status messages (shown in the license UI) ───────────────
  licenseRevoked: 'Deine Lizenz wurde widerrufen oder ist abgelaufen.',
  licenseOfflineMode: (days: number) => `Offline-Modus (noch ${days} Tage)`,
  licenseOfflineExpired: 'Offline-Kulanzzeitraum abgelaufen. Bitte verbinde dich mit dem Internet, um neu zu validieren.',
};
