/**
 * Project Manager — extracted from index.ts
 * New Project, File Tree, Claude Skills, Image Handlers, Settings
 */

import { dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { templates as projectTemplates } from '../shared/projectTemplates';
import { parseSettings, applySettings } from '../shared/settingsParser';
import { findRootFile } from '../shared/rootFinder';
import { appState } from './appState';

const GITIGNORE_TEMPLATE = `# vswrite
.vswrite/
*.pdf

# OS
.DS_Store
Thumbs.db
`;

/**
 * Ensures a project has a Git repo + .gitignore + initial commit so that
 * "Version speichern" works immediately. Idempotent — safe to call on
 * existing projects.
 */
export async function ensureProjectInfrastructure(dir: string, initialMessage = 'Initial version'): Promise<void> {
  if (!fs.existsSync(dir)) return;

  // .gitignore — create or extend
  const gitignorePath = path.join(dir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, GITIGNORE_TEMPLATE, 'utf-8');
  } else {
    const existing = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = existing.split('\n').map(l => l.trim());
    const required = ['.vswrite/', '*.pdf'];
    const missing = required.filter(req => !lines.includes(req));
    if (missing.length > 0) {
      const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(gitignorePath, existing + prefix + '\n# vswrite\n' + missing.join('\n') + '\n', 'utf-8');
    }
  }

  // .vswrite/ skeleton
  const vswriteDir = path.join(dir, '.vswrite');
  if (!fs.existsSync(vswriteDir)) fs.mkdirSync(vswriteDir, { recursive: true });
  const backupsDir = path.join(vswriteDir, 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const aiDir = path.join(vswriteDir, 'ai-snapshots');
  if (!fs.existsSync(aiDir)) fs.mkdirSync(aiDir, { recursive: true });

  // Git repo + initial commit (idempotent)
  try {
    const git = simpleGit(dir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      await git.init();
      try { await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); } catch {}
      await git.add('-A');
      const status = await git.status();
      if (status.staged.length > 0 || status.created.length > 0) {
        await git.commit(initialMessage);
      }
    }
  } catch (err) {
    console.warn('[vswrite] Failed to initialise git repo for project:', err);
  }
}

// ─── File Tree ────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}

const IGNORED_DIRS = new Set(['.git', '.vswrite', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'dist', 'build']);
const ALLOWED_EXTENSIONS = new Set(['.typ', '.bib', '.yaml', '.yml', '.toml', '.txt', '.md', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.pdf', '.docx', '.doc', '.csv', '.json', '.tex']);

export function readDirTree(dir: string, depth = 0): FileEntry[] {
  if (depth > 5) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '.claude') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Show all directories — including empty ones — so the user can
        // see where to drop assets/sources/etc.
        const children = readDirTree(fullPath, depth + 1);
        result.push({ name: entry.name, path: fullPath, isDir: true, children });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext)) {
          result.push({ name: entry.name, path: fullPath, isDir: false });
        }
      }
    }

    result.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch {
    return [];
  }
}

// ─── Project Creation ─────────────────────────────────

export async function handleCreateProject(templateId: string, projectName: string): Promise<void> {
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose location for project',
    buttonLabel: 'Create Here',
  });
  if (result.canceled || !result.filePaths[0]) return;

  const parentDir = result.filePaths[0];
  const dir = projectName ? path.join(parentDir, projectName) : parentDir;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const template = projectTemplates.find(t => t.id === templateId);
  if (!template) return;

  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(dir, filePath);
    const fileDir = path.dirname(fullPath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
  }

  // Standard project folders — created in every project so the file tree
  // always shows where assets and sources belong, even when empty.
  for (const sub of ['assets', 'sources']) {
    const p = path.join(dir, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }

  ensureClaudeSkills(dir);

  // Initialise Git repo, .gitignore, and the .vswrite/ folder so the
  // "Versionen" UI works from the very first save.
  await ensureProjectInfrastructure(dir, `Initial version (${template.label})`);

  appState.projectDir = dir;
  const { openFile } = await import('./fileManager');
  openFile(path.join(dir, 'main.typ'));
  appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
}

// ─── Open Project ────────────────────────────────────
// Project = folder with at least one .typ file. The folder is the project's
// identity; everything else is derived. If a project is currently open,
// we tear it down cleanly first.

function findEntryFile(dir: string): string | null {
  // Prefer main.typ, then any .typ in the project root
  const mainPath = path.join(dir, 'main.typ');
  if (fs.existsSync(mainPath)) return mainPath;
  try {
    const candidate = fs.readdirSync(dir).find(f => f.endsWith('.typ'));
    return candidate ? path.join(dir, candidate) : null;
  } catch {
    return null;
  }
}

/**
 * Opens a project from a folder. If `projectDir` is omitted, shows a
 * folder-picker dialog. Returns the project dir if loaded, otherwise null.
 */
export async function openProject(projectDir?: string): Promise<string | null> {
  if (!projectDir) {
    const result = await dialog.showOpenDialog(appState.mainWindow!, {
      properties: ['openDirectory'],
      title: 'Open Project',
      buttonLabel: 'Open Project',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    projectDir = result.filePaths[0];
  }

  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    await dialog.showMessageBox(appState.mainWindow!, {
      type: 'error',
      message: 'Folder not found.',
      detail: `The path "${projectDir}" does not exist or is not a folder.`,
    });
    return null;
  }

  // Tear down any currently-open project (with save prompt if dirty)
  const { closeProjectInteractive, openFile } = await import('./fileManager');
  if (appState.projectDir) {
    const closed = await closeProjectInteractive();
    if (!closed) return null;
  }

  appState.projectDir = projectDir;

  const entry = findEntryFile(projectDir);
  if (entry) {
    await openFile(entry);
  } else {
    // Empty folder — still treat it as the project so the file tree shows
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
    appState.mainWindow?.webContents.send('vswrite', { type: 'projectOpened', dir: projectDir });
  }

  return projectDir;
}

// ─── Folder Creation ─────────────────────────────────

/**
 * Creates a new folder inside the current project. Pass `parentRelPath`
 * to nest it (e.g. "assets/diagrams"); pass an empty string to create at
 * the project root.
 */
export async function handleNewFolder(parentRelPath: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!appState.projectDir) return { ok: false, error: 'No project open.' };
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: 'Folder name is empty.' };
  if (/[/\\:*?"<>|]/.test(cleanName) || cleanName.startsWith('.')) {
    return { ok: false, error: 'Folder name contains invalid characters.' };
  }

  const target = path.join(appState.projectDir, parentRelPath || '', cleanName);
  // Stay within the project — symlink-safe via realpath check downstream isn't
  // needed here because we control the components, but we double-check the
  // resolved path doesn't escape via ".." segments.
  const projectAbs = path.resolve(appState.projectDir);
  const targetAbs = path.resolve(target);
  if (!targetAbs.startsWith(projectAbs + path.sep) && targetAbs !== projectAbs) {
    return { ok: false, error: 'Folder is outside the project.' };
  }
  if (fs.existsSync(targetAbs)) {
    return { ok: false, error: 'A folder with that name already exists.' };
  }

  try {
    fs.mkdirSync(targetAbs, { recursive: true });
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Asset Import ────────────────────────────────────

/**
 * Opens a file picker, copies the selected files into the project's
 * `assets/` folder. Returns the list of relative paths created.
 */
export async function handleAddAssets(): Promise<{ added: string[]; error?: string }> {
  if (!appState.projectDir) return { added: [], error: 'No project open.' };

  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    title: 'Add assets to project',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Common assets', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'pdf', 'csv', 'json', 'bib'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { added: [] };

  const assetsDir = path.join(appState.projectDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const added: string[] = [];
  for (const src of result.filePaths) {
    const baseName = path.basename(src);
    let dest = path.join(assetsDir, baseName);
    // If the name already exists, append " (1)" / " (2)" etc.
    if (fs.existsSync(dest)) {
      const ext = path.extname(baseName);
      const stem = baseName.slice(0, baseName.length - ext.length);
      let n = 1;
      while (fs.existsSync(dest)) {
        dest = path.join(assetsDir, `${stem} (${n})${ext}`);
        n++;
      }
    }
    try {
      fs.copyFileSync(src, dest);
      added.push(path.relative(appState.projectDir, dest).replace(/\\/g, '/'));
    } catch (err) {
      console.warn('[vswrite] Failed to copy asset:', src, err);
    }
  }

  if (added.length > 0) {
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  }
  return { added };
}

// ─── Image Handlers ──────────────────────────────────

export async function handlePickImage(): Promise<void> {
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return;

  const imagePath = result.filePaths[0];
  if (appState.currentFilePath) {
    const docDir = path.dirname(appState.currentFilePath);
    const assetsDir = path.join(docDir, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const destPath = path.join(assetsDir, path.basename(imagePath));
    fs.copyFileSync(imagePath, destPath);

    const relPath = 'assets/' + path.basename(imagePath);
    appState.mainWindow?.webContents.send('vswrite', { type: 'insertImage', src: relPath });
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  }
}

export function handleDropImage(name: string, dataBase64: string): void {
  if (!appState.currentFilePath) return;
  const docDir = path.dirname(appState.currentFilePath);
  const assetsDir = path.join(docDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const destPath = path.join(assetsDir, name);
  const buffer = Buffer.from(dataBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  fs.writeFileSync(destPath, buffer);

  const relPath = 'assets/' + name;
  appState.mainWindow?.webContents.send('vswrite', { type: 'insertImage', src: relPath });
  appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
}

export function handleDropImagePath(imagePath: string): void {
  if (!appState.currentFilePath) return;
  const cleanPath = imagePath.replace('file://', '');
  const docDir = appState.projectDir || path.dirname(appState.currentFilePath);
  const rootDir = path.dirname(findRootFile(appState.currentFilePath));

  if (cleanPath.startsWith(docDir) || cleanPath.startsWith(rootDir)) {
    const relPath = path.relative(path.dirname(appState.currentFilePath), cleanPath).replace(/\\/g, '/');
    appState.mainWindow?.webContents.send('vswrite', { type: 'insertImage', src: relPath });
    return;
  }

  const assetsDir = path.join(docDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const destPath = path.join(assetsDir, path.basename(cleanPath));
  try {
    fs.copyFileSync(cleanPath, destPath);
    const relPath = 'assets/' + path.basename(cleanPath);
    appState.mainWindow?.webContents.send('vswrite', { type: 'insertImage', src: relPath });
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  } catch (err) {
    console.error('[vswrite] Failed to copy image:', err);
  }
}

// ─── Settings Handlers ────────────────────────────────

export function handleRequestSettings(): void {
  const settings = parseSettings(appState.currentContent);
  appState.mainWindow?.webContents.send('vswrite', {
    type: 'settingsData',
    settings,
  });
}

export function handleUpdateSettings(settings: Record<string, string>): void {
  appState.currentContent = applySettings(appState.currentContent, settings as unknown as import('../shared/settingsParser').DocumentSettings);
  appState.isDirty = true;
  import('./fileManager').then(({ updateTitle, autoSave }) => {
    updateTitle();
    autoSave();
  });

  appState.mainWindow?.webContents.send('vswrite', {
    type: 'update',
    content: appState.currentContent,
  });
}

// ─── Claude Code Skills ──────────────────────────────

export function ensureClaudeSkills(dir: string): void {
  const skillsDir = path.join(dir, '.claude', 'skills');

  if (fs.existsSync(skillsDir)) return;

  fs.mkdirSync(skillsDir, { recursive: true });

  // Typst skill
  fs.mkdirSync(path.join(skillsDir, 'typst'), { recursive: true });
  fs.writeFileSync(path.join(skillsDir, 'typst', 'SKILL.md'), `---
name: typst
description: Comprehensive Typst language reference for writing correct, idiomatic Typst markup and code
---

# Typst Language Reference

Typst is a modern typesetting system. Use this reference to write correct Typst code.

## Key Syntax

- Headings: \`= H1\`, \`== H2\`, \`=== H3\`
- Bold: \`*bold*\`, Italic: \`_italic_\`, Code: \`\\\`code\\\`\`
- Links: \`#link("url")[text]\`
- Images: \`#image("path.png", width: 80%)\`
- Lists: \`- item\` (unordered), \`+ item\` (ordered)
- Math: \`$x^2$\` (inline), \`$ x^2 $\` (block)
- Code blocks: \`\\\`\\\`\\\`lang ... \\\`\\\`\\\`\`

## Document Settings

\`\`\`typst
#set text(font: "Georgia", size: 11pt)
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.6em)
#set heading(numbering: "1.1")
\`\`\`

## Multi-File Projects

Use \`#include "chapters/file.typ"\` to split documents.
The main.typ file contains settings + includes.
`, 'utf-8');

  // vswrite skill
  fs.mkdirSync(path.join(skillsDir, 'vswrite'), { recursive: true });
  fs.writeFileSync(path.join(skillsDir, 'vswrite', 'SKILL.md'), `---
name: vswrite
description: CLI tools for working with Typst documents in vswrite projects
---

# vswrite CLI — Agent Instructions

You are working in a project that uses **vswrite**, a WYSIWYG editor for Typst (.typ) files.

## Important

- The .typ files on disk are the source of truth
- Edit .typ files directly — the WYSIWYG editor updates automatically
- Use standard Typst syntax (not HTML, not LaTeX)
- Settings are in the first lines of main.typ (#set rules)
- Chapters live in the chapters/ folder
- Images go in assets/
- Bibliography in references.bib
`, 'utf-8');

  // Research skill
  fs.mkdirSync(path.join(skillsDir, 'research'), { recursive: true });
  fs.writeFileSync(path.join(skillsDir, 'research', 'SKILL.md'), `---
name: research
description: Deep web research with structured output — search for academic sources, synthesize findings, save results and citations to the project
---

# Deep Research — Agent Instructions

When the user asks you to research a topic, follow this workflow:

1. Search for relevant sources (academic, institutional)
2. Evaluate source quality
3. Create BibTeX entries in references.bib
4. Save research notes as markdown in sources/
5. Suggest how to integrate findings into the document
`, 'utf-8');
}
