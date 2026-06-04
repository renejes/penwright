/**
 * Git IPC Handlers — Git as the storage engine for project versions.
 *
 * The "Versionen" UI in the renderer talks to the high-level handlers
 * (`git:saveVersion`, `git:listVersions`, `git:showVersion`, `git:restoreVersion`).
 * The low-level Git verbs (`git:stage`, `git:commit`, `git:push`, ...) are kept
 * for the optional "Erweitert" cloud-sync section.
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit, { type SimpleGit } from 'simple-git';
import { appState } from './appState';
import { isPathWithin } from './pathSecurity';

function getGitDir(): string {
  return appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : process.cwd());
}

function isPathWithinGitDir(filePath: string): boolean {
  const gitDir = getGitDir();
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(gitDir, filePath);
  return isPathWithin(absPath, gitDir);
}

const GITIGNORE_REQUIRED_LINES = ['.penwright/', '*.pdf'];

async function ensureGitignore(dir: string): Promise<void> {
  const gitignorePath = path.join(dir, '.gitignore');
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const lines = existing.split('\n').map(l => l.trim());
  const missing = GITIGNORE_REQUIRED_LINES.filter(req => !lines.includes(req));
  if (missing.length === 0) return;

  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const addition = (existing.length === 0 ? '# Penwright\n' : prefix + '\n# Penwright\n') + missing.join('\n') + '\n';
  fs.writeFileSync(gitignorePath, existing + addition, 'utf-8');
}

async function ensureRepo(dir: string): Promise<{ initialized: boolean }> {
  if (!fs.existsSync(dir)) return { initialized: false };
  const git = simpleGit(dir);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    // Set a sensible default branch — older Git versions still default to "master".
    try { await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); } catch {}
  }
  await ensureGitignore(dir);
  return { initialized: !isRepo };
}

interface VersionEntry {
  sha: string;
  message: string;
  date: string;
  author: string;
  isAuto: boolean;
}

async function listVersions(git: SimpleGit): Promise<VersionEntry[]> {
  try {
    const log = await git.log({ '--max-count': 200 });
    return log.all.map(c => ({
      sha: c.hash,
      message: c.message,
      date: c.date,
      author: c.author_name,
      isAuto: c.message.startsWith('[auto]'),
    }));
  } catch {
    return [];
  }
}

interface DiffFileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  patch: string;
}

async function showVersion(git: SimpleGit, sha: string): Promise<DiffFileEntry[]> {
  // Use `git show --stat=10000` style to get a per-file patch; simple-git exposes raw().
  const raw = await git.raw(['show', '--no-color', '--format=', sha]);
  return parseUnifiedDiff(raw);
}

function parseUnifiedDiff(diff: string): DiffFileEntry[] {
  const result: DiffFileEntry[] = [];
  const fileChunks = diff.split(/^diff --git /m).slice(1);
  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    const headerMatch = lines[0].match(/a\/(.+) b\/(.+)/);
    if (!headerMatch) continue;
    const filePath = headerMatch[2];

    let status: DiffFileEntry['status'] = 'modified';
    if (lines.some(l => l.startsWith('new file mode'))) status = 'added';
    else if (lines.some(l => l.startsWith('deleted file mode'))) status = 'deleted';
    else if (lines.some(l => l.startsWith('rename from'))) status = 'renamed';

    // Trim leading metadata lines until we hit the first hunk header (@@).
    const hunkStart = lines.findIndex(l => l.startsWith('@@'));
    const patch = hunkStart >= 0 ? lines.slice(hunkStart).join('\n') : '';

    result.push({ path: filePath, status, patch });
  }
  return result;
}

export function setupGitIPC(): void {
  // ─── High-level "Versionen" API ───────────────────────────────
  // Note: `git:ensureRepo` is registered in ipcHandlers.ts because the
  // full project setup (incl. `.penwright/` skeleton) lives in projectManager.

  ipcMain.handle('git:saveVersion', async (_event, args: { message: string; files?: string[]; auto?: boolean }) => {
    const dir = getGitDir();
    await ensureRepo(dir);
    const git = simpleGit(dir);

    if (args.files && args.files.length > 0) {
      for (const f of args.files) {
        if (!isPathWithinGitDir(f)) throw new Error('Access denied: path is outside the project.');
      }
      await git.add(args.files);
    } else {
      await git.add('-A');
    }

    const status = await git.status();
    if (status.staged.length === 0 && status.created.length === 0 && status.deleted.length === 0 && status.renamed.length === 0) {
      return { sha: null, skipped: true };
    }

    const message = (args.auto ? '[auto] ' : '') + (args.message || 'Untitled version');
    const result = await git.commit(message);
    return { sha: result.commit, skipped: false };
  });

  ipcMain.handle('git:listVersions', async () => {
    const dir = getGitDir();
    const git = simpleGit(dir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return [];
    return listVersions(git);
  });

  ipcMain.handle('git:showVersion', async (_event, sha: string) => {
    const dir = getGitDir();
    const git = simpleGit(dir);
    if (!/^[0-9a-f]{4,40}$/i.test(sha)) throw new Error('Invalid version id.');
    const files = await showVersion(git, sha);
    return { sha, files };
  });

  ipcMain.handle('git:restoreVersion', async (_event, args: { sha: string; files?: string[] }) => {
    const dir = getGitDir();
    const git = simpleGit(dir);
    if (!/^[0-9a-f]{4,40}$/i.test(args.sha)) throw new Error('Invalid version id.');

    if (args.files && args.files.length > 0) {
      for (const f of args.files) {
        if (!isPathWithinGitDir(f)) throw new Error('Access denied: path is outside the project.');
      }
      await git.raw(['checkout', args.sha, '--', ...args.files]);
    } else {
      // Restore all files of that commit into the working tree.
      await git.raw(['checkout', args.sha, '--', '.']);
    }
    return { ok: true };
  });

  // ─── Status (used by ProjectPanel "changes since last version") ─

  ipcMain.handle('git:status', async () => {
    const dir = getGitDir();
    try {
      const git = simpleGit(dir);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) return { branch: '', ahead: 0, behind: 0, files: [], isRepo: false };

      const status = await git.status();
      const files = [
        ...status.staged.map(f => ({ path: f, status: 'M', staged: true })),
        ...status.created.filter(f => status.staged.includes(f)).map(f => ({ path: f, status: 'A', staged: true })),
        ...status.modified.filter(f => !status.staged.includes(f)).map(f => ({ path: f, status: 'M', staged: false })),
        ...status.not_added.map(f => ({ path: f, status: '?', staged: false })),
        ...status.deleted.map(f => ({ path: f, status: 'D', staged: false })),
      ];
      const seen = new Set<string>();
      const unique = files.filter(f => {
        const key = `${f.path}:${f.staged}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        branch: status.current || '',
        ahead: status.ahead,
        behind: status.behind,
        files: unique,
        isRepo: true,
      };
    } catch {
      return { branch: '', ahead: 0, behind: 0, files: [], isRepo: false };
    }
  });

  // ─── Low-level verbs (kept for "Erweitert" cloud-sync section) ──

  ipcMain.handle('git:stage', async (_event, filePath: string) => {
    if (!isPathWithinGitDir(filePath)) throw new Error('Access denied: path is outside the project.');
    const git = simpleGit(getGitDir());
    await git.add(filePath);
  });

  ipcMain.handle('git:unstage', async (_event, filePath: string) => {
    if (!isPathWithinGitDir(filePath)) throw new Error('Access denied: path is outside the project.');
    const git = simpleGit(getGitDir());
    await git.reset(['HEAD', '--', filePath]);
  });

  ipcMain.handle('git:stageAll', async () => {
    const git = simpleGit(getGitDir());
    await git.add('-A');
  });

  ipcMain.handle('git:commit', async (_event, message: string) => {
    const git = simpleGit(getGitDir());
    await git.commit(message);
  });

  ipcMain.handle('git:push', async () => {
    const git = simpleGit(getGitDir());
    await git.push();
  });

  ipcMain.handle('git:pull', async () => {
    const git = simpleGit(getGitDir());
    await git.pull();
  });

  ipcMain.handle('git:init', async () => {
    const git = simpleGit(getGitDir());
    await git.init();
  });

  ipcMain.handle('git:getRemote', async () => {
    try {
      const git = simpleGit(getGitDir());
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      return origin ? origin.refs.fetch || origin.refs.push || '' : '';
    } catch {
      return '';
    }
  });

  ipcMain.handle('git:setRemote', async (_event, url: string) => {
    const git = simpleGit(getGitDir());
    const remotes = await git.getRemotes();
    const hasOrigin = remotes.some(r => r.name === 'origin');
    if (hasOrigin) {
      await git.remote(['set-url', 'origin', url]);
    } else {
      await git.addRemote('origin', url);
    }
    return { ok: true };
  });
}
