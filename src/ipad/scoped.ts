/**
 * Calls into the vendored `tauri-plugin-scoped-storage`.
 * The plugin keeps the iOS security scope alive for the whole native call.
 * Desktop Tauri returns UNSUPPORTED — this module is only loaded by the iPad entry.
 */

import { invoke } from '@tauri-apps/api/core';
import type { DirItem, ProjectFs } from './projectFs';

export interface FolderHandle {
  id: string;
  name?: string | null;
  uri?: string | null;
}

interface DirEntryDto {
  name: string;
  path: string;
  isFile?: boolean;
  isDir?: boolean;
}

async function plugin<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(`plugin:scoped-storage|${command}`, args ?? {});
}

export async function pickFolder(): Promise<FolderHandle> {
  return plugin<FolderHandle>('pick_folder');
}

export async function listFolders(): Promise<FolderHandle[]> {
  const folders = await plugin<FolderHandle[] | { folders: FolderHandle[] }>('list_folders');
  return Array.isArray(folders) ? folders : folders.folders;
}

/**
 * A name with a dot is a file, except under `versions/`. There every chapter
 * folder is named like the file it belongs to (`main.typ`, `chapters/01.typ`),
 * so the dot is the folder. Only once that folder is open are the `.typ`
 * names inside it the version files.
 */
function directoryEntry(
  dir: string | undefined,
  name: string,
  hasExt: boolean,
  flaggedDir: boolean,
  flaggedFile: boolean,
): boolean {
  const folder = dir ?? '';
  const inVersions = folder === 'versions' || folder.startsWith('versions/');
  if (inVersions) {
    const rest = folder === 'versions' ? '' : folder.slice('versions/'.length);
    const insideChapter = rest.endsWith('.typ') || rest.endsWith('.typst');
    if (insideChapter) return false;
    if (!hasExt || name.endsWith('.typ') || name.endsWith('.typst')) return true;
  }
  return flaggedDir || (hasExt ? false : !flaggedFile);
}

export function scopedProjectFs(folderId: string): ProjectFs {
  return {
    async readText(path) {
      const res = await plugin<{ contents: string }>('read_text_file', {
        req: { folderId, path },
      });
      return res.contents;
    },
    async writeText(path, contents) {
      await plugin('write_text_file', {
        req: { folderId, path, contents, recursive: true },
      });
    },
    async writeBytes(path, data) {
      await plugin('write_file', {
        req: { folderId, path, data: Array.from(data), recursive: true },
      });
    },
    async readBytes(path) {
      const res = await plugin<{ data: number[] }>('read_file', {
        req: { folderId, path },
      });
      return Uint8Array.from(res.data);
    },
    async readDir(path) {
      const req: { folderId: string; path?: string } = { folderId };
      if (path) req.path = path;
      const entries = await plugin<DirEntryDto[] | { entries: DirEntryDto[] }>('read_dir', {
        req,
      });
      const list = Array.isArray(entries) ? entries : entries.entries;
      return list.map((e): DirItem => {
        const raw = (e.name || e.path || '').replace(/\\/g, '/');
        const name = raw.split('/').filter(Boolean).pop() || '';
        const hasExt = name.includes('.');
        const flaggedDir = e.isDir === true;
        const flaggedFile = e.isFile === true;
        const isDir = directoryEntry(path, name, hasExt, flaggedDir, flaggedFile);
        return {
          name,
          path: path ? `${path}/${name}` : name,
          isDir,
        };
      });
    },
    async mkdir(path) {
      await plugin('mkdir', { req: { folderId, path, recursive: true } });
    },
    async remove(path) {
      await plugin('remove_file', { req: { folderId, path } });
    },
    async removeDir(path) {
      await plugin('remove_dir', { req: { folderId, path, recursive: true } });
    },
    async exists(path) {
      const res = await plugin<{ exists: boolean }>('exists', {
        req: { folderId, path },
      });
      return !!res.exists;
    },
  };
}
