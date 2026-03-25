/**
 * Git IPC Handlers — extracted from index.ts
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import simpleGit from 'simple-git';
import { appState } from './appState';

function getGitDir(): string {
  return appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : process.cwd());
}

export function setupGitIPC(): void {
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

  ipcMain.handle('git:stage', async (_event, filePath: string) => {
    const git = simpleGit(getGitDir());
    await git.add(filePath);
  });

  ipcMain.handle('git:unstage', async (_event, filePath: string) => {
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
}
