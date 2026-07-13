// Messages from Extension → Webview
export interface UpdateMessage {
  type: 'update';
  content: string;
}

export interface SettingsDataMessage {
  type: 'settingsData';
  settings: DocumentSettings;
}

export interface DocumentBaseUriMessage {
  type: 'documentBaseUri';
  /** Directory of the open document — the base for relative image paths.
   *  Field name matches what BOTH main-process senders actually emit. */
  uri: string;
}

export interface InsertImageMessage {
  type: 'insertImage';
  src: string;
}

export interface WordGoalMessage {
  type: 'wordGoal';
  goal: number;
  current: number;
}

export interface ScrollToHeadingMessage {
  type: 'scrollToHeading';
  title: string;
}

export interface CitationDataMessage {
  type: 'citationData';
  entries: Array<{
    citekey: string;
    author: string;
    title: string;
    year: string;
    type: string;
  }>;
}

export interface DocumentLangMessage {
  type: 'documentLang';
  lang: string;
}

export interface WelcomeDataMessage {
  type: 'welcomeData';
  showWelcome: boolean;
  typstInstalled: boolean;
  platform: string;
}

export interface CompileErrorMessage {
  type: 'compileError';
  error: string;
}

export interface PreviewPdfUpdateMessage {
  type: 'previewPdfUpdate';
  pdfData: string; // base64-encoded PDF buffer
}

export interface ExportStatusMessage {
  type: 'exportStatus';
  exporting: boolean;
  format: string;
}

export type ExtensionMessage =
  | UpdateMessage
  | SettingsDataMessage
  | DocumentBaseUriMessage
  | InsertImageMessage
  | WordGoalMessage
  | ScrollToHeadingMessage
  | CitationDataMessage
  | DocumentLangMessage
  | WelcomeDataMessage
  | CompileErrorMessage
  | PreviewPdfUpdateMessage
  | ExportStatusMessage;

/**
 * Shared settings interface. Trimmed in Session 22 — typography / layout
 * tokens (font, size, leading, paper, margin, columns, pageNumbering /
 * Header / Footer / Fill, paragraphSpacing, firstLineIndent, headingNumbering)
 * now live in `style.json` and are edited via the Design sidebar tab.
 * What remains here is document-content metadata that legitimately stays
 * inline in main.typ: language + bibliography style.
 */
export interface DocumentSettings {
  lang: string;
  bibliographyStyle: string;
}

// Messages from Webview → Extension
export interface ReadyMessage {
  type: 'ready';
}

export interface EditMessage {
  type: 'edit';
  content: string;
}

export interface ExportPdfMessage {
  type: 'exportPdf';
}

export interface ExportDocxMessage {
  type: 'exportDocx';
}

export interface OpenSourceMessage {
  type: 'openSource';
}

export interface NewProjectMessage {
  type: 'newProject';
}

export interface NewFileMessage {
  type: 'newFile';
}

export interface MergeDocumentMessage {
  type: 'mergeDocument';
}

export interface PickImageMessage {
  type: 'pickImage';
}

export interface DropImageMessage {
  type: 'dropImage';
  name: string;
  data: string; // base64
}

export interface DropImagePathMessage {
  type: 'dropImagePath';
  path: string; // file URI or path
}

export interface RequestSettingsMessage {
  type: 'requestSettings';
}

export interface UpdateSettingsMessage {
  type: 'updateSettings';
  settings: DocumentSettings;
}

export interface SplitDocumentMessage {
  type: 'splitDocument';
}

export interface SetWordGoalMessage {
  type: 'setWordGoal';
  goal: number;
}

export interface ApplyStyleMessage {
  type: 'applyStyle';
  styleId: string;
}

export interface RequestCitationsMessage {
  type: 'requestCitations';
}

export interface EnsureBibliographyMessage {
  type: 'ensureBibliography';
}

export interface ImportSourcesMessage {
  type: 'importSources';
}

export interface AddCitationManuallyMessage {
  type: 'addCitationManually';
}

export interface ImportStyleTemplateMessage {
  type: 'importStyleTemplate';
}

export interface UndoLastAiEditMessage {
  type: 'undoLastAiEdit';
}

export interface DismissWelcomeMessage {
  type: 'dismissWelcome';
  dontShowAgain: boolean;
}

export interface OpenUserGuideMessage {
  type: 'openUserGuide';
}

export interface DeserializeErrorMessage {
  type: 'deserializeError';
  error: string;
}

export type WebviewMessage =
  | ReadyMessage
  | EditMessage
  | ExportPdfMessage
  | ExportDocxMessage
  | OpenSourceMessage
  | NewProjectMessage
  | NewFileMessage
  | MergeDocumentMessage
  | PickImageMessage
  | DropImageMessage
  | DropImagePathMessage
  | RequestSettingsMessage
  | UpdateSettingsMessage
  | SplitDocumentMessage
  | SetWordGoalMessage
  | ApplyStyleMessage
  | RequestCitationsMessage
  | EnsureBibliographyMessage
  | ImportSourcesMessage
  | AddCitationManuallyMessage
  | ImportStyleTemplateMessage
  | UndoLastAiEditMessage
  | DismissWelcomeMessage
  | OpenUserGuideMessage
  | DeserializeErrorMessage;

// VS Code API available in webview context
export interface VsCodeApi {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}
