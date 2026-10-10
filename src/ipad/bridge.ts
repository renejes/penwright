/**
 * Installs the iPad host before the Svelte app loads.
 * `window.electronAPI` exists so the shell's existing invoke() calls resolve;
 * the penwright channel itself is the third IPC adapter (see ipcAdapter.ts).
 * Nothing here starts a second process or compiles Typst. Recovery writes
 * `.penwright/backups` and `.penwright/ai-snapshots` — the same stores as the Mac.
 */

import type { ExtensionMessage, WebviewMessage } from '../editor/lib/messages';
import { bytesToBase64, IpadProject, type HostMessage } from './session';
import { listFolders, pickFolder, scopedProjectFs, type FolderHandle } from './scoped';
import { presetBundle, projectGallery, rootedFs, safeProjectName, templateFiles } from './newProject';
import { sanitizeBackupConfig, DEFAULT_BACKUP_CONFIG, type BackupConfig } from './recovery';
import { collectPdfRels, isSafePdfRel, linkedPdfPath, linkedPdfRel } from './zoteroPdfs';
import { locateIpadCitationPdf } from '../shared/zoteroPdfMatch';
import { MAC_ONLY_HINT } from './writingSurface';

const LOCALE_KEY = 'penwright-ipad-locale';
const PANEL_KEY = 'penwright-ipad-panels';
const PREF_PREFIX = 'penwright-ipad-prefs:';
const BACKUP_KEY = 'penwright-ipad-backup';
const ZOTERO_PDF_KEY = 'penwright-ipad-zotero-pdf-folder';

type Listener = (msg: ExtensionMessage) => void;

const CHAT_STATUS = {
  loggedIn: false,
  projectBound: false,
  modelId: '',
  modelParams: [] as unknown[],
  running: false,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export class IpadHost {
  private project: IpadProject | null = null;
  private folderId: string | null = null;
  private backupTimer: ReturnType<typeof setTimeout> | null = null;
  private backupErrorTold = false;
  private zoteroPdfList: string[] | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly imageUrls = new Map<string, string>();

  addListener(handler: Listener): void {
    this.listeners.add(handler);
  }

  removeListener(handler: Listener): void {
    this.listeners.delete(handler);
  }

  emit(msg: HostMessage): void {
    for (const listener of this.listeners) listener(msg as unknown as ExtensionMessage);
  }

  closeProject(): void {
    this.clearBackupTimer();
    this.project = null;
    this.folderId = null;
    this.backupErrorTold = false;
    this.emit({ type: 'projectClosed' });
  }

  send(msg: WebviewMessage): void {
    if (msg.type === 'newProject') {
      this.emit({
        type: 'showNewProjectDialog',
        templates: [],
      });
      return;
    }
    const incoming = msg as HostMessage;
    if (incoming.type === 'createProject') {
      const templateId = typeof incoming.templateId === 'string' ? incoming.templateId : '';
      const projectName = typeof incoming.projectName === 'string' ? incoming.projectName : '';
      void this.createProject(templateId, projectName);
      return;
    }
    if (msg.type === 'pickImage') {
      void this.addAssets();
      return;
    }
    if (msg.type === 'edit') this.armBackup();
    if (msg.type === 'dropImage') {
      const payload = msg.data.replace(/^data:image\/\w+;base64,/, '');
      const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
      void this.project?.placeImage(msg.name, bytes);
      return;
    }
    void this.project?.handle(msg as HostMessage);
  }

  async readImage(src: string, baseDir: string): Promise<string | null> {
    if (!this.project) return null;
    const key = `${baseDir}/${src}`;
    const cached = this.imageUrls.get(key);
    if (cached) return cached;
    const bytes = await this.project.readImage(src, baseDir);
    if (!bytes) return null;
    const type = mimeFor(src);
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([copy], { type }));
    this.imageUrls.set(key, url);
    return url;
  }

  async invoke(channel: string, args: unknown[]): Promise<unknown> {
    switch (channel) {
      case 'project:open':
        try {
          await this.openProject(typeof args[0] === 'string' ? args[0] : null);
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.notice(message);
          return { ok: false, error: message };
        }
      case 'preset:gallery':
        return projectGallery(this.locale());
      case 'preset:create':
        try {
          await this.createBundled(String(args[0] ?? ''), typeof args[1] === 'string' ? args[1] : '');
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.notice(message);
          return { ok: false, error: message };
        }
      case 'project:close':
        this.closeProject();
        return { ok: true };
      case 'project:listLabels':
        return this.project?.listLabels() ?? { labels: [], truncated: false };
      case 'project:openSample':
      case 'project:lookFile':
        return null;
      case 'filetree:list':
        return this.project
          ? this.project.listTree()
          : { dir: '', entries: [], hasParent: false };
      case 'filetree:open':
        return this.project?.openRel(String(args[0] ?? '')) ?? undefined;
      case 'filetree:navigateUp':
        return null;
      case 'project:newFolder': {
        const name = (args[0] as { name?: string } | undefined)?.name ?? '';
        return this.project?.mkdir(name) ?? { ok: false, error: MAC_ONLY_HINT };
      }
      case 'includes:add':
        return this.project?.addChapter() ?? { ok: false, error: 'Kein Projekt geöffnet.' };
      case 'includes:validate':
        return this.project?.validateIncludes((args[0] as string[]) ?? []) ?? [];
      case 'includes:open':
        await this.project?.openInclude(String(args[0] ?? ''));
        return true;
      case 'comments:list':
        return this.project?.listComments((args[0] as { forFile?: string; includeResolved?: boolean }) ?? {}) ?? [];
      case 'comments:create':
        return this.project?.createComment((args[0] as { file?: string; anchor?: string; rangeStart?: number; rangeEnd?: number; body?: string }) ?? {}) ?? null;
      case 'comments:update':
        return this.project?.updateComment(String(args[0] ?? ''), (args[1] as { body?: string; resolved?: boolean }) ?? {}) ?? null;
      case 'comments:delete':
        return this.project?.deleteComment(String(args[0] ?? '')) ?? false;
      case 'project:addAssets':
        return this.addAssets();
      case 'project:getInfo':
        return {
          projectDir: this.folderId,
          currentFilePath: this.project?.currentRel ?? null,
          projectName: this.project?.folderName ?? null,
          name: this.project?.folderName ?? null,
        };
      case 'versions:list':
        return this.project?.listVersions() ?? [];
      case 'versions:suggest':
        return this.project?.suggestVersion(String((args[0] as { sourceRel?: string } | undefined)?.sourceRel ?? '')) ?? '';
      case 'versions:create': {
        const body = (args[0] as { sourceRel?: string; name?: string; content?: string } | undefined) ?? {};
        return this.project?.createVersion(String(body.sourceRel ?? ''), String(body.name ?? ''), String(body.content ?? ''))
          ?? { ok: false, error: 'missing' };
      }
      case 'versions:swap': {
        const body = (args[0] as { versionRel?: string; liveContent?: string; versionContent?: string } | undefined) ?? {};
        return this.project?.swapVersion(String(body.versionRel ?? ''), body.liveContent, body.versionContent)
          ?? { ok: false, error: 'missing' };
      }
      case 'versions:rename': {
        const body = (args[0] as { versionRel?: string; name?: string } | undefined) ?? {};
        return this.project?.renameVersion(String(body.versionRel ?? ''), String(body.name ?? ''))
          ?? { ok: false, error: 'missing' };
      }
      case 'versions:delete': {
        const body = (args[0] as { versionRel?: string } | undefined) ?? {};
        return this.project?.deleteVersion(String(body.versionRel ?? '')) ?? { ok: false, error: 'missing' };
      }
      case 'project:listBackups':
        return this.project?.projectBackups() ?? [];
      case 'project:applyBackup':
        return this.project?.restoreBackup(String(args[0] ?? '')) ?? { ok: false, restored: 0 };
      case 'project:openBackupFolder':
        return { ok: false };
      case 'project:getBackupConfig':
        return this.backupConfig();
      case 'project:setBackupConfig': {
        const saved = sanitizeBackupConfig((args[0] ?? {}) as Partial<BackupConfig>);
        localStorage.setItem(BACKUP_KEY, JSON.stringify(saved));
        await this.project?.publishAiLimit(saved.maxAiSnapshots);
        return saved;
      }
      case 'ai:list':
        return this.project?.aiSnapshots() ?? [];
      case 'ai:undoLast':
        return this.project?.undoAiSnapshot() ?? { undone: false, count: 0 };
      case 'project:getPreferences':
        return readJson(PREF_PREFIX + (this.folderId ?? ''), { editorZoom: 1, pdfZoom: 1, pdfSpread: false });
      case 'project:setPreferences':
        localStorage.setItem(PREF_PREFIX + (this.folderId ?? ''), JSON.stringify(args[0] ?? {}));
        return args[0];
      case 'project:listMacros':
        return { macros: [] };
      case 'project:findSourceForCitation':
        return this.findCitationPdf(String(args[0] ?? ''));
      case 'project:openCitationPdf':
        return (await this.findCitationPdf(String(args[0] ?? ''))).path;
      case 'project:pickZoteroPdfFolder':
        return this.pickZoteroPdfFolder();
      case 'project:search':
        return { files: [], totalMatches: 0, truncated: false, error: MAC_ONLY_HINT };
      case 'project:replaceAll':
        return { filesChanged: 0, totalReplacements: 0, error: MAC_ONLY_HINT };
      case 'textfile:read':
        return this.project?.readTextFile(String(args[0] ?? '')) ?? '';
      case 'textfile:readBinary': {
        const rel = String(args[0] ?? '');
        const linked = linkedPdfRel(rel);
        if (linked) return this.readLinkedPdf(linked);
        return this.project?.readBinaryFile(rel) ?? '';
      }
      case 'textfile:write':
        await this.project?.writeTextFile(String(args[0] ?? ''), String(args[1] ?? ''));
        return true;
      case 'persist:getRecentProjects':
        return this.recent();
      case 'persist:getPanelState': {
        const stored = readJson<Record<string, unknown>>(PANEL_KEY, {});
        return { ...stored, showPreview: false, showChat: false };
      }
      case 'persist:savePanelState': {
        const incoming = (args[0] ?? {}) as Record<string, unknown>;
        localStorage.setItem(PANEL_KEY, JSON.stringify({ ...incoming, showPreview: false, showChat: false }));
        return true;
      }
      case 'persist:isOnboardingSeen':
        return true;
      case 'persist:setOnboardingSeen':
        return true;
      case 'persist:getPreviewMode':
        return 'manual';
      case 'persist:setPreviewMode':
        return 'manual';
      case 'app:getLocale':
        return localStorage.getItem(LOCALE_KEY);
      case 'app:setLocale':
        if (typeof args[0] === 'string') localStorage.setItem(LOCALE_KEY, args[0]);
        return true;
      case 'app:getPlatform':
        return 'ios';
      case 'app:checkTypst':
        return null;
      case 'app:openExternal': {
        const url = typeof args[0] === 'string' ? args[0] : '';
        if (url.startsWith('https://')) window.open(url, '_blank');
        return url.startsWith('https://');
      }
      case 'spellcheck:setLanguage':
        return true;
      case 'chat:status':
        return CHAT_STATUS;
      case 'chat:models':
        return [];
      case 'chat:history':
        return [];
      case 'chat:sessions':
        return { activeId: null, open: [], all: [] };
      case 'agent:activity':
      case 'crash:getLatest':
        return null;
      case 'crash:report':
      case 'crash:markShown':
        return true;
      default:
        console.info('[penwright ipad] not on this device:', channel);
        return { ok: false, macOnly: true, error: MAC_ONLY_HINT };
    }
  }

  private locale(): 'de' | 'en' {
    return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'de';
  }

  private zoteroFolder(): { id: string; name: string } | null {
    const saved = readJson<{ id?: string; name?: string } | null>(ZOTERO_PDF_KEY, null);
    if (!saved?.id) return null;
    return { id: saved.id, name: saved.name || 'PDFs' };
  }

  private async pickZoteroPdfFolder(): Promise<{ ok: boolean; name?: string }> {
    try {
      const folder = this.folderFrom(await pickFolder());
      const name = folder.name || 'PDFs';
      localStorage.setItem(ZOTERO_PDF_KEY, JSON.stringify({ id: folder.id, name }));
      this.zoteroPdfList = null;
      return { ok: true, name };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(message)) return { ok: false };
      this.notice(message);
      return { ok: false };
    }
  }

  private async attachmentPdfs(): Promise<string[]> {
    if (this.zoteroPdfList) return this.zoteroPdfList;
    const saved = this.zoteroFolder();
    if (!saved) return [];
    const known = await listFolders().catch(() => [] as FolderHandle[]);
    if (!known.some((folder) => folder.id === saved.id)) return [];
    const listed = await collectPdfRels(scopedProjectFs(saved.id));
    this.zoteroPdfList = listed;
    return listed;
  }

  private async findCitationPdf(citekey: string): Promise<{ path: string | null; linked: boolean; inProject: boolean }> {
    const empty = { path: null, linked: false, inProject: false };
    if (!this.project || !citekey) return empty;
    const bib = await this.project.readOptional('zotero.bib');
    const folder = this.zoteroFolder();
    const linked = bib !== null || folder !== null;
    const attachment = folder ? await this.attachmentPdfs() : [];
    const sources = await this.project.listSourcePdfs();
    const hit = locateIpadCitationPdf(citekey, bib, attachment, sources);
    if (!hit) return { path: null, linked, inProject: false };
    if (hit.where === 'sources') return { path: hit.rel, linked, inProject: true };
    return { path: linkedPdfPath(hit.rel), linked, inProject: false };
  }

  private async readLinkedPdf(rel: string): Promise<string> {
    if (!isSafePdfRel(rel)) throw new Error('missing');
    const saved = this.zoteroFolder();
    if (!saved) throw new Error('missing');
    const bytes = await scopedProjectFs(saved.id).readBytes(rel);
    return bytesToBase64(bytes);
  }

  private notice(message: string): void {
    this.emit({ type: 'hostNotice', message });
  }

  private backupConfig(): BackupConfig {
    return sanitizeBackupConfig(readJson<Partial<BackupConfig>>(BACKUP_KEY, DEFAULT_BACKUP_CONFIG));
  }

  private clearBackupTimer(): void {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
    }
  }

  /** One snapshot per interval for as long as the project stays open. */
  private startBackups(): void {
    this.clearBackupTimer();
    void this.project?.publishAiLimit(this.backupConfig().maxAiSnapshots);
    this.armBackup();
  }

  private armBackup(): void {
    if (this.backupTimer || !this.project) return;
    const wait = Math.max(5, this.backupConfig().intervalSec) * 1000;
    this.backupTimer = setTimeout(() => {
      this.backupTimer = null;
      void this.runBackup();
    }, wait);
  }

  private async runBackup(): Promise<void> {
    const project = this.project;
    if (!project) return;
    try {
      const snap = await project.createProjectBackup(this.backupConfig().maxCount);
      if (snap) this.emit({ type: 'backupCreated', timestamp: snap.timestampMs, backupId: snap.timestamp });
    } catch (err) {
      if (!this.backupErrorTold) {
        this.backupErrorTold = true;
        this.notice(err instanceof Error ? err.message : String(err));
      }
    }
    this.armBackup();
  }

  private folderFrom(value: unknown): FolderHandle {
    const wrapped = value as { folder?: FolderHandle; id?: string };
    const folder = wrapped?.folder?.id ? wrapped.folder : (value as FolderHandle);
    if (!folder?.id) throw new Error('Der Ordnerdialog hat keinen Ordner zurückgegeben.');
    return folder;
  }

  private async openProject(folderId: string | null): Promise<void> {
    let folder: FolderHandle | undefined;
    if (folderId) {
      const known = await listFolders().catch(() => [] as FolderHandle[]);
      folder = known.find((f) => f.id === folderId);
    }
    if (!folder) folder = this.folderFrom(await pickFolder());
    this.useFolder(folder);
    await this.project!.activate(folder.name || 'Projekt');
    this.startBackups();
  }

  private useFolder(folder: FolderHandle, fs = scopedProjectFs(folder.id)): void {
    this.clearBackupTimer();
    this.backupErrorTold = false;
    this.imageUrls.forEach((url) => URL.revokeObjectURL(url));
    this.imageUrls.clear();
    this.folderId = folder.id;
    this.project = new IpadProject(fs, (msg) => this.emit(msg));
  }

  private async createProject(templateId: string, projectName: string): Promise<void> {
    const files = templateFiles(templateId);
    const name = safeProjectName(projectName);
    if (!files || !name) {
      this.notice(this.locale() === 'de' ? 'Projektname fehlt.' : 'Missing project name.');
      return;
    }
    try {
      const folder = this.folderFrom(await pickFolder());
      const parent = scopedProjectFs(folder.id);
      try { await parent.mkdir(name); } catch { /* the folder may already exist */ }
      const already = await parent.exists(`${name}/main.typ`).catch(() => false)
        || await parent.exists(`${name}/chapters/01-chapter.typ`).catch(() => false);
      if (!already) {
        for (const [rel, content] of Object.entries(files)) {
          await parent.writeText(`${name}/${rel}`, content);
        }
      }
      this.useFolder(folder, rootedFs(parent, name));
      const prefer = files['chapters/01-chapter.typ'] ? 'chapters/01-chapter.typ' : undefined;
      await this.project!.activate(name, prefer);
      this.startBackups();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(message)) this.notice(message);
    }
  }

  private async createBundled(presetId: string, projectName: string): Promise<void> {
    const preset = presetBundle(presetId);
    const name = safeProjectName(projectName || preset?.manifest.label.de || presetId);
    if (!preset || !name) {
      this.notice(this.locale() === 'de' ? 'Diese Vorlage gibt es hier nicht.' : 'That template is not available here.');
      return;
    }
    const folder = this.folderFrom(await pickFolder());
    const parent = scopedProjectFs(folder.id);
    try { await parent.mkdir(name); } catch { /* already there */ }
    const already = await parent.exists(`${name}/main.typ`).catch(() => false);
    if (!already) {
      for (const [rel, content] of Object.entries(preset.files)) {
        await parent.writeText(`${name}/${rel}`, content);
      }
    }
    this.useFolder(folder, rootedFs(parent, name));
    await this.project!.activate(name, preset.manifest.openFile);
    this.startBackups();
  }

  private async recent(): Promise<Array<{ path: string; name: string; timestamp: number }>> {
    const folders = await listFolders().catch(() => [] as FolderHandle[]);
    return folders.map((f) => ({
      path: f.id,
      name: f.name || 'Projekt',
      timestamp: Date.now(),
    }));
  }

  private async addAssets(): Promise<{ added: string[]; error?: string }> {
    const picked = await pickLocalFile();
    if (!picked || !this.project) return { added: [] };
    const src = await this.project.placeImage(picked.name, picked.bytes);
    return src ? { added: [src] } : { added: [], error: MAC_ONLY_HINT };
  }
}

function mimeFor(src: string): string {
  const ext = src.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

function pickLocalFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/svg+xml,image/webp';
    let settled = false;
    const finish = (value: { name: string; bytes: Uint8Array } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      void file.arrayBuffer().then((buf) => {
        finish({ name: file.name, bytes: new Uint8Array(buf) });
      });
    };
    // Cancelling the picker fires no change event. The window regains focus.
    window.addEventListener('focus', () => {
      setTimeout(() => finish(null), 400);
    }, { once: true });
    input.click();
  });
}

export function installIpadHost(): IpadHost {
  const host = new IpadHost();
  window.__PENWRIGHT_HOST__ = 'ios';
  window.__penwrightIpad = {
    send: (msg) => host.send(msg as WebviewMessage),
    onMessage: (handler) => host.addListener(handler as Listener),
    readImage: (src, baseDir) => host.readImage(src, baseDir),
  };
  const api = {
    send(channel: string, data: unknown) {
      if (channel === 'penwright') host.send(data as WebviewMessage);
    },
    on(channel: string, callback: (data: unknown) => void) {
      if (channel !== 'penwright') return () => {};
      const handler = (msg: ExtensionMessage) => callback(msg);
      host.addListener(handler);
      return () => host.removeListener(handler);
    },
    invoke(channel: string, ...args: unknown[]) {
      return host.invoke(channel, args);
    },
  };
  (window as unknown as { electronAPI: typeof api }).electronAPI = api;
  return host;
}
