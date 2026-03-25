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
  baseUri: string;
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

export interface PreviewUpdateMessage {
  type: 'previewUpdate';
  pages: string[]; // SVG strings
}

export interface CompileErrorMessage {
  type: 'compileError';
  error: string;
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
  | PreviewUpdateMessage
  | CompileErrorMessage;

// Shared settings interface
export interface DocumentSettings {
  font: string;
  fontSize: string;
  lang: string;
  paper: string;
  margin: string;
  pageNumbering: string;
  pageHeader: string;
  pageFooter: string;
  columns: string;
  pageFill: string;
  leading: string;
  spacing: string;
  firstLineIndent: string;
  headingNumbering: string;
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

export interface QuickSettingsMessage {
  type: 'quickSettings';
  fontSize: string;
  leading: string;
  lang: string;
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
  | QuickSettingsMessage
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
