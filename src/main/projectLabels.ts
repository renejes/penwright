/**
 * Project-wide label scanner.
 *
 * Walks every .typ file and pulls out Typst labels (`<label>`) plus a
 * best-effort "caption" — the heading text, the nearest `caption: [...]`
 * inside a `#figure(...)`, or the first piece of text on the same line
 * before the label. The result powers the Cross-Reference picker.
 *
 * The picker only needs to be fast and correct on the common cases:
 * `<fig:foo>` after a `#figure(image("…"), caption: […])`, `<sec:bar>`
 * after a `= Heading`, etc. Edge cases (labels inside math, on tables
 * with manual layout, etc.) degrade gracefully — they still appear in
 * the list, just without a caption preview.
 */

import * as fs from 'fs';
import * as path from 'path';
import { appState } from './appState';
import { refTypeFromLabel } from '../shared/refLabels';
import { isPathWithin } from './pathSecurity';

const IGNORED_DIRS = new Set([
  '.git', '.penwright', 'node_modules', 'dist', 'build', 'assets', 'sources', 'comments',
]);

const MAX_LABELS = 2000;

export type LabelType = 'figure' | 'table' | 'equation' | 'heading' | 'other';

export interface ProjectLabel {
  label: string;
  type: LabelType;
  caption: string;
  filePath: string;
  relPath: string;
  line: number;
}

export interface ProjectLabelResults {
  labels: ProjectLabel[];
  truncated: boolean;
}

function walkTypFiles(root: string, depth = 0): string[] {
  if (depth > 6) return [];
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTypFiles(full, depth + 1));
    } else if (entry.name.toLowerCase().endsWith('.typ')) {
      out.push(full);
    }
  }
  return out;
}

function readContent(absPath: string): string | null {
  try {
    if (
      appState.currentFilePath &&
      path.resolve(absPath) === path.resolve(appState.currentFilePath)
    ) {
      return appState.currentContent;
    }
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

// Shared classifier (refLabels.ts) — same vocabulary as the editor badges,
// so the picker rows and the in-text pills can never disagree.
const classifyLabel = (label: string): LabelType => refTypeFromLabel(label);

/**
 * Best-effort caption extraction.
 *
 * For headings: grab the heading text on the same line if present,
 * otherwise scan back for the most recent `=+ heading` line.
 *
 * For figures/tables: scan back up to ~12 lines for `caption: [...]`
 * (figures usually fit; multiline figures get the closest caption).
 *
 * For everything else: take whatever text precedes the label on the
 * same line, with markup softly cleaned up.
 */
function extractCaption(
  lines: string[],
  labelLineIdx: number,
  labelOnLineCol: number,
  type: LabelType,
  rawLabel: string,
): string {
  const sameLine = lines[labelLineIdx] ?? '';

  if (type === 'heading') {
    // Heading + label on same line: `= My Title <sec:my-title>`
    const headSame = sameLine.match(/^={1,6}\s+(.+?)\s*<[^>]+>\s*$/);
    if (headSame) return cleanInline(headSame[1]);
    // Heading on a previous line, label on its own
    for (let i = labelLineIdx - 1; i >= Math.max(0, labelLineIdx - 4); i--) {
      const m = lines[i].match(/^={1,6}\s+(.+?)\s*$/);
      if (m) return cleanInline(m[1]);
    }
  }

  if (type === 'figure' || type === 'table') {
    for (let i = labelLineIdx; i >= Math.max(0, labelLineIdx - 12); i--) {
      const m = lines[i].match(/caption:\s*\[([^\]]*)\]/);
      if (m && m[1]) return cleanInline(m[1]);
    }
  }

  if (type === 'equation') {
    // Common: `$ equation $ <eq:foo>` — show a snippet of the equation
    const sl = sameLine;
    const before = sl.slice(0, labelOnLineCol);
    const eqMatch = before.match(/\$([^$]{1,80})\$\s*$/);
    if (eqMatch) return `$${eqMatch[1].trim()}$`;
  }

  // Generic: text before the label on the same line
  const before = sameLine.slice(0, labelOnLineCol).trim();
  if (before && before !== '#') {
    // Heading line with the label after the title
    const head = before.match(/^={1,6}\s+(.+)$/);
    if (head) return cleanInline(head[1]);
    return cleanInline(before).slice(0, 80);
  }

  return rawLabel;
}

function cleanInline(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, '$1')        // bold
    .replace(/_([^_]+)_/g, '$1')          // italic
    .replace(/`([^`]+)`/g, '$1')          // inline code
    .replace(/#text\([^)]*\)\[([^\]]*)\]/g, '$1') // unwrap #text
    .replace(/\s+/g, ' ')
    .trim();
}

const LABEL_REGEX = /<([a-zA-Z][\w:.-]*)>/g;

export function listProjectLabels(projectDir?: string | null): ProjectLabelResults {
  const root = projectDir ?? appState.projectDir;
  if (!root || !isPathWithin(root, root)) {
    return { labels: [], truncated: false };
  }

  const out: ProjectLabel[] = [];
  let truncated = false;

  for (const filePath of walkTypFiles(root)) {
    if (out.length >= MAX_LABELS) { truncated = true; break; }
    const content = readContent(filePath);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      LABEL_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = LABEL_REGEX.exec(line)) !== null) {
        const labelName = match[1];
        const type = classifyLabel(labelName);
        const caption = extractCaption(lines, i, match.index, type, labelName);
        const relPath = path.relative(root, filePath).replace(/\\/g, '/');
        out.push({
          label: labelName,
          type,
          caption,
          filePath,
          relPath,
          line: i + 1,
        });
        if (out.length >= MAX_LABELS) { truncated = true; break; }
      }
      if (truncated) break;
    }
    if (truncated) break;
  }

  return { labels: out, truncated };
}
