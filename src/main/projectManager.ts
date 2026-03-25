/**
 * Project Manager — extracted from index.ts
 * New Project, File Tree, Claude Skills, Image Handlers, Settings
 */

import { dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { templates as projectTemplates } from '../shared/projectTemplates';
import { parseSettings, applySettings } from '../shared/settingsParser';
import { findRootFile } from '../shared/rootFinder';
import { appState } from './appState';

// ─── File Tree ────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'dist', 'build']);
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
        const children = readDirTree(fullPath, depth + 1);
        if (children.length > 0) {
          result.push({ name: entry.name, path: fullPath, isDir: true, children });
        }
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

  const assetsDir = path.join(dir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  ensureClaudeSkills(dir);

  appState.projectDir = dir;
  const { openFile } = await import('./fileManager');
  openFile(path.join(dir, 'main.typ'));
  appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
}

// ─── New File ─────────────────────────────────────────

export async function handleNewFile(): Promise<void> {
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    defaultPath: 'untitled.typ',
  });
  if (result.canceled || !result.filePath) return;

  const template = '#set text(font: "Georgia", size: 11pt)\n#set page(paper: "a4", margin: 2.5cm)\n\n= New Document\n\n';
  fs.writeFileSync(result.filePath, template, 'utf-8');

  ensureClaudeSkills(path.dirname(result.filePath));

  const { openFile } = await import('./fileManager');
  openFile(result.filePath);
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
