/** Folder access the writing host needs. Scoped storage on device, memory in tests. */

export interface DirItem {
  name: string;
  path: string;
  isDir: boolean;
}

export interface ProjectFs {
  readText(path: string): Promise<string>;
  writeText(path: string, contents: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  readDir(path: string): Promise<DirItem[]>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  removeDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeEntry[];
}
