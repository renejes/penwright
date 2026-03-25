#!/usr/bin/env node

/**
 * vswrite-cli — CLI tool for AI agents to work with Typst documents.
 *
 * All commands are stateless: read input, produce output, exit.
 * No VS Code dependency. Pure Node.js.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseSettings, applySettings, generateSetBlocks, type DocumentSettings } from '../shared/settingsParser';
import { parseBibFile, serializeBibFile, type BibEntry } from '../shared/bibParser';
import { resolveIncludes } from '../shared/mergeDocument';
import { splitIntoChapters, slugify } from '../shared/splitDocument';
import { styleTemplates } from '../shared/styleTemplates';
import { templates } from '../shared/projectTemplates';
import { SourceImporter } from '../shared/sourceImporter';
import { deserializeTypst } from '../editor/lib/deserializer';
import { serializeDocx } from '../shared/docxSerializer';

// ─── Argument Parsing ────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

switch (command) {
  case 'info':           handleInfo(args.slice(1)); break;
  case 'outline':        handleOutline(args.slice(1)); break;
  case 'get-settings':   handleGetSettings(args.slice(1)); break;
  case 'set':            handleSet(args.slice(1)); break;
  case 'list-styles':    handleListStyles(); break;
  case 'apply-style':    handleApplyStyle(args.slice(1)); break;
  case 'merge':          handleMerge(args.slice(1)); break;
  case 'split':          handleSplit(args.slice(1)); break;
  case 'parse-bib':      handleParseBib(args.slice(1)); break;
  case 'add-citation':   handleAddCitation(args.slice(1)); break;
  case 'import-sources': handleImportSources(args.slice(1)); break;
  case 'check':          handleCheck(args.slice(1)); break;
  case 'compile':        handleCompile(args.slice(1)); break;
  case 'new-project':    handleNewProject(args.slice(1)); break;
  case 'validate':       handleValidate(args.slice(1)); break;
  case 'export-docx':    handleExportDocx(args.slice(1)); break;
  default:
    error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}

// ─── Command Implementations ────────────────────────────────

function handleInfo(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');
  const jsonFlag = args.includes('--json');

  // Word count (visual text only, exclude #set/#show/math etc.)
  const visualLines = text.split('\n').filter(l => {
    const t = l.trim();
    return t && !t.startsWith('#') && !t.startsWith('//') && !t.startsWith('$');
  });
  const words = visualLines.join(' ').split(/\s+/).filter(w => w.length > 0).length;

  // Headings
  const h1 = (text.match(/^= /gm) || []).length;
  const h2 = (text.match(/^== /gm) || []).length;
  const h3 = (text.match(/^=== /gm) || []).length;

  // Images
  const images = (text.match(/#image\(/g) || []).length;

  // Citations
  const citations = (text.match(/@[a-zA-Z][\w-]*/g) || []).length;

  // Includes
  const includes = (text.match(/^#include\s+"/gm) || []).length;

  // Settings
  const settings = parseSettings(text);
  const activeSettings = Object.entries(settings)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`);

  if (jsonFlag) {
    console.log(JSON.stringify({
      file: path.basename(file),
      words,
      headings: { total: h1 + h2 + h3, h1, h2, h3 },
      images,
      citations,
      includes,
      settings: Object.fromEntries(Object.entries(settings).filter(([, v]) => v)),
    }, null, 2));
  } else {
    console.log(`File: ${path.basename(file)}`);
    console.log(`Words: ${words}`);
    console.log(`Headings: ${h1 + h2 + h3} (${h1}x H1, ${h2}x H2, ${h3}x H3)`);
    console.log(`Images: ${images}`);
    console.log(`Citations: ${citations}`);
    console.log(`Includes: ${includes}`);
    if (activeSettings.length > 0) {
      console.log(`Settings: ${activeSettings.join(', ')}`);
    }
  }
}

function handleOutline(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');
  const jsonFlag = args.includes('--json');
  const lines = text.split('\n');

  const headings: { level: number; title: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(={1,4})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        title: match[2].trim(),
        line: i + 1,
      });
    }
  }

  if (jsonFlag) {
    console.log(JSON.stringify(headings, null, 2));
  } else {
    for (const h of headings) {
      const indent = '  '.repeat(h.level - 1);
      console.log(`${indent}${h.title} (L${h.line})`);
    }
  }
}

function handleGetSettings(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');
  const jsonFlag = args.includes('--json');
  const settings = parseSettings(text);

  if (jsonFlag) {
    console.log(JSON.stringify(
      Object.fromEntries(Object.entries(settings).filter(([, v]) => v)),
      null, 2,
    ));
  } else {
    for (const [key, value] of Object.entries(settings)) {
      if (value) console.log(`${key}: ${value}`);
    }
  }
}

function handleSet(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');
  const settings = parseSettings(text);

  // Parse --key "value" pairs from remaining args
  let changed = false;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') && i + 1 < args.length) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as keyof DocumentSettings;
      if (key in settings) {
        (settings as unknown as Record<string, string>)[key] = args[i + 1];
        changed = true;
        i++; // skip value
      }
    }
  }

  if (!changed) {
    error('No settings provided. Use --font "Arial" --font-size "12pt" etc.');
    process.exit(1);
  }

  const result = applySettings(text, settings);
  fs.writeFileSync(file, result, 'utf-8');
  console.log(`Updated settings in ${path.basename(file)}`);
}

function handleListStyles() {
  for (const style of styleTemplates) {
    console.log(`${style.id.padEnd(15)} ${style.label} — ${style.description}`);
  }
}

function handleApplyStyle(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');

  const styleFlag = args.indexOf('--style');
  const styleId = styleFlag >= 0 ? args[styleFlag + 1] : args[1];

  if (!styleId) {
    error('No style specified. Use --style <id> or see: vswrite-cli list-styles');
    process.exit(1);
  }

  const style = styleTemplates.find(s => s.id === styleId);
  if (!style) {
    error(`Unknown style: ${styleId}. Available: ${styleTemplates.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  // Find end of existing preamble (all #set/#show/#import lines at the top)
  const lines = text.split('\n');
  let preambleEnd = 0;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track brace depth for multi-line #show rules
    for (const ch of lines[i]) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    }

    if (braceDepth > 0) {
      preambleEnd = i + 1;
      continue;
    }

    if (
      trimmed.startsWith('#set ') ||
      trimmed.startsWith('#show ') ||
      trimmed.startsWith('#import ') ||
      trimmed === ''
    ) {
      preambleEnd = i + 1;
    } else if (trimmed) {
      break;
    }
  }

  const body = lines.slice(preambleEnd).join('\n');
  const result = style.preamble + '\n\n' + body;
  fs.writeFileSync(file, result, 'utf-8');
  console.log(`Applied style "${style.label}" to ${path.basename(file)}`);
}

function handleMerge(args: string[]) {
  const file = requireFile(args[0]);
  const outputFlag = args.indexOf('--output');
  const merged = resolveIncludes(file);

  if (outputFlag >= 0 && args[outputFlag + 1]) {
    fs.writeFileSync(args[outputFlag + 1], merged, 'utf-8');
    console.log(`Merged to ${args[outputFlag + 1]}`);
  } else {
    process.stdout.write(merged);
  }
}

function handleSplit(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');
  const outputDirFlag = args.indexOf('--output-dir');
  const outputDir = outputDirFlag >= 0 ? args[outputDirFlag + 1] : 'chapters';

  const { config, chapters } = splitIntoChapters(text);

  if (chapters.length < 2) {
    console.log('Document has fewer than 2 headings — nothing to split.');
    return;
  }

  const docDir = path.dirname(file);
  const chaptersDir = path.join(docDir, outputDir);
  fs.mkdirSync(chaptersDir, { recursive: true });

  const includes: string[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const slug = slugify(chapter.title, i);
    const fileName = `${slug}.typ`;
    const filePath = path.join(chaptersDir, fileName);
    fs.writeFileSync(filePath, chapter.content + '\n', 'utf-8');
    includes.push(`#include "${outputDir}/${fileName}"`);
    console.log(`  Created ${outputDir}/${fileName}`);
  }

  // Create main.typ
  const mainLines: string[] = [];
  if (config) mainLines.push(config, '');
  mainLines.push(...includes, '');

  const mainPath = path.join(docDir, 'main.typ');
  let targetMainPath = mainPath;
  if (path.resolve(file) !== path.resolve(mainPath) && fs.existsSync(mainPath)) {
    const baseName = path.basename(file, '.typ');
    targetMainPath = path.join(docDir, `${baseName}-main.typ`);
  }

  fs.writeFileSync(targetMainPath, mainLines.join('\n'), 'utf-8');
  console.log(`  Created ${path.basename(targetMainPath)}`);
  console.log(`Split into ${chapters.length} chapters.`);
}

function handleParseBib(args: string[]) {
  const file = requireFile(args[0]);
  const content = fs.readFileSync(file, 'utf-8');
  const entries = parseBibFile(content);
  const jsonFlag = args.includes('--json');

  if (jsonFlag) {
    console.log(JSON.stringify(entries.map(e => ({
      citekey: e.citekey,
      type: e.type,
      author: e.author,
      title: e.title,
      year: e.year,
    })), null, 2));
  } else {
    for (const e of entries) {
      console.log(`@${e.citekey} (${e.type}): ${e.author} — "${e.title}" (${e.year})`);
    }
    if (entries.length === 0) {
      console.log('No entries found.');
    }
  }
}

function handleAddCitation(args: string[]) {
  const bibFile = getFlag(args, '--bib') || 'references.bib';
  const title = getFlag(args, '--title');
  const author = getFlag(args, '--author');
  const year = getFlag(args, '--year') || '';
  const type = getFlag(args, '--type') || 'misc';

  if (!title || !author) {
    error('Required: --title "..." --author "..." [--year "..."] [--type article] [--bib file.bib]');
    process.exit(1);
  }

  const dir = path.dirname(path.resolve(bibFile));
  const importer = new SourceImporter(dir);
  const entry = importer.createManualEntry({ title, author, year, type });

  // Read existing or create new
  const existing: BibEntry[] = fs.existsSync(bibFile)
    ? parseBibFile(fs.readFileSync(bibFile, 'utf-8'))
    : [];

  if (existing.some(e => e.citekey === entry.citekey)) {
    console.log(`Entry @${entry.citekey} already exists.`);
    return;
  }

  existing.push(entry);
  fs.writeFileSync(bibFile, serializeBibFile(existing), 'utf-8');
  console.log(`Added @${entry.citekey} to ${bibFile}`);
}

async function handleImportSources(args: string[]) {
  const sourcesDir = getFlag(args, '--sources-dir') || 'sources';
  const bibFile = getFlag(args, '--bib') || 'references.bib';
  const root = path.dirname(path.resolve(bibFile));

  if (!fs.existsSync(path.join(root, sourcesDir))) {
    error(`Sources directory not found: ${sourcesDir}`);
    process.exit(1);
  }

  const importer = new SourceImporter(root);
  const { imported, manual } = await importer.importAll((file) => {
    process.stderr.write(`Processing: ${file.filename}\n`);
  });

  if (imported.length > 0) {
    console.log(`Imported ${imported.length} citation(s) to ${bibFile}`);
    for (const e of imported) {
      console.log(`  @${e.citekey}: ${e.title}`);
    }
  }
  if (manual.length > 0) {
    console.log(`${manual.length} file(s) need manual metadata entry.`);
  }
  if (imported.length === 0 && manual.length === 0) {
    console.log('No new sources found to import.');
  }
}

function handleCheck(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');
  const jsonFlag = args.includes('--json');

  const issues: { type: 'error' | 'warning'; message: string; file?: string; line?: number }[] = [];

  // ── 1. Structural validation (same as validate) ────────────
  const lines = text.split('\n');

  // Check for unmatched braces
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```')) continue;
    for (const ch of lines[i]) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
      if (ch === '[') bracketDepth++;
      if (ch === ']') bracketDepth--;
      if (ch === '(') parenDepth++;
      if (ch === ')') parenDepth--;
    }
    if (braceDepth < 0) { issues.push({ type: 'error', message: `Unmatched closing brace }`, file: path.basename(file), line: i + 1 }); braceDepth = 0; }
    if (bracketDepth < 0) { issues.push({ type: 'error', message: `Unmatched closing bracket ]`, file: path.basename(file), line: i + 1 }); bracketDepth = 0; }
    if (parenDepth < 0) { issues.push({ type: 'error', message: `Unmatched closing paren )`, file: path.basename(file), line: i + 1 }); parenDepth = 0; }
  }
  if (braceDepth > 0) issues.push({ type: 'error', message: `Unclosed brace(s): ${braceDepth} open`, file: path.basename(file) });
  if (bracketDepth > 0) issues.push({ type: 'error', message: `Unclosed bracket(s): ${bracketDepth} open`, file: path.basename(file) });
  if (parenDepth > 0) issues.push({ type: 'error', message: `Unclosed paren(s): ${parenDepth} open`, file: path.basename(file) });

  // Check for broken includes
  const docDir = path.dirname(path.resolve(file));
  const includeRegex = /^#include\s+"([^"]+)"\s*$/gm;
  let match;
  while ((match = includeRegex.exec(text)) !== null) {
    const includePath = path.resolve(docDir, match[1]);
    if (!fs.existsSync(includePath)) {
      issues.push({ type: 'error', message: `Broken include: ${match[1]} (file not found)`, file: path.basename(file) });
    }
  }

  // Check for missing bibliography file
  const bibMatch = text.match(/#bibliography\("([^"]+)"\)/);
  if (bibMatch) {
    const bibPath = path.resolve(docDir, bibMatch[1]);
    if (!fs.existsSync(bibPath)) {
      issues.push({ type: 'error', message: `Missing bibliography file: ${bibMatch[1]}`, file: path.basename(file) });
    }
  }

  // Check for missing images
  const imageRegex = /#image\("([^"]+)"/g;
  while ((match = imageRegex.exec(text)) !== null) {
    const imgPath = path.resolve(docDir, match[1]);
    if (!fs.existsSync(imgPath)) {
      issues.push({ type: 'warning', message: `Missing image: ${match[1]}`, file: path.basename(file) });
    }
  }

  // Also check included files for bibliography/image references
  const includeRegex2 = /^#include\s+"([^"]+)"\s*$/gm;
  while ((match = includeRegex2.exec(text)) !== null) {
    const includePath = path.resolve(docDir, match[1]);
    if (fs.existsSync(includePath)) {
      const includeText = fs.readFileSync(includePath, 'utf-8');
      const includeDir = path.dirname(includePath);

      // Check bibliography in included files
      const incBibMatch = includeText.match(/#bibliography\("([^"]+)"\)/);
      if (incBibMatch) {
        const bibPath = path.resolve(includeDir, incBibMatch[1]);
        if (!fs.existsSync(bibPath)) {
          issues.push({ type: 'error', message: `Missing bibliography file: ${incBibMatch[1]}`, file: match[1] });
        }
      }

      // Check images in included files
      const incImageRegex = /#image\("([^"]+)"/g;
      let incMatch;
      while ((incMatch = incImageRegex.exec(includeText)) !== null) {
        const imgPath = path.resolve(includeDir, incMatch[1]);
        if (!fs.existsSync(imgPath)) {
          issues.push({ type: 'warning', message: `Missing image: ${incMatch[1]}`, file: match[1] });
        }
      }
    }
  }

  // ── 2. Typst compilation check ─────────────────────────────
  const { spawnSync } = require('child_process');
  const typstCheck = spawnSync('typst', ['--version'], { encoding: 'utf-8' });

  if (typstCheck.error) {
    issues.push({ type: 'warning', message: 'Typst CLI not installed — skipping compilation check' });
  } else {
    // Compile to a temp file, then delete it
    const tmpOutput = path.join(
      require('os').tmpdir(),
      `vswrite-check-${Date.now()}.pdf`,
    );

    const result = spawnSync('typst', ['compile', path.resolve(file), tmpOutput], {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: docDir,
    });

    // Clean up temp file
    try { fs.unlinkSync(tmpOutput); } catch {}

    if (result.status !== 0 && result.stderr) {
      // Parse typst error output into structured issues
      const typstErrors = parseTypstErrors(result.stderr);
      issues.push(...typstErrors);
    }
  }

  // ── 3. Output results ──────────────────────────────────────
  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  if (jsonFlag) {
    console.log(JSON.stringify({
      ok: errors.length === 0,
      errors: errors.length,
      warnings: warnings.length,
      issues,
    }, null, 2));
  } else {
    if (issues.length === 0) {
      console.log(`${path.basename(file)}: OK — compiles without issues.`);
    } else {
      for (const issue of issues) {
        const loc = issue.file ? (issue.line ? `${issue.file}:${issue.line}` : issue.file) : '';
        const prefix = issue.type === 'error' ? 'ERROR' : 'WARN';
        console.log(`  [${prefix}] ${loc ? loc + ': ' : ''}${issue.message}`);
      }
      console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
    }
  }

  if (errors.length > 0) process.exit(1);
}

/**
 * Parse typst stderr output into structured error objects.
 * Typst error format:
 *   error: <message>
 *      ┌─ path/to/file.typ:line:col
 */
function parseTypstErrors(stderr: string): { type: 'error' | 'warning'; message: string; file?: string; line?: number }[] {
  const results: { type: 'error' | 'warning'; message: string; file?: string; line?: number }[] = [];
  const lines = stderr.split('\n');

  let currentType: 'error' | 'warning' = 'error';
  let currentMessage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match "error: message" or "warning: message"
    const msgMatch = line.match(/^(error|warning):\s*(.+)$/);
    if (msgMatch) {
      currentType = msgMatch[1] as 'error' | 'warning';
      currentMessage = msgMatch[2];
      continue;
    }

    // Match location line: "┌─ file.typ:line:col" or "┌─ file.typ:line"
    const locMatch = line.match(/[┌├│]─\s*(.+?):(\d+)/);
    if (locMatch && currentMessage) {
      results.push({
        type: currentType,
        message: currentMessage,
        file: locMatch[1],
        line: parseInt(locMatch[2], 10),
      });
      currentMessage = '';
      continue;
    }

    // Match "help: message"
    const helpMatch = line.match(/^help:\s*(.+)$/);
    if (helpMatch && results.length > 0) {
      results[results.length - 1].message += ` (hint: ${helpMatch[1]})`;
    }
  }

  // If we have a message without a location
  if (currentMessage) {
    results.push({ type: currentType, message: currentMessage });
  }

  return results;
}

function handleCompile(args: string[]) {
  const file = requireFile(args[0]);
  const outputFlag = args.indexOf('--output');
  const output = outputFlag >= 0 ? args[outputFlag + 1] : file.replace(/\.typ$/, '.pdf');

  const { spawnSync } = require('child_process');

  // Check if typst is available
  const check = spawnSync('typst', ['--version'], { encoding: 'utf-8' });
  if (check.error) {
    error('Typst CLI not found. Install with: brew install typst');
    process.exit(1);
  }

  const result = spawnSync('typst', ['compile', file, output], {
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.status === 0) {
    console.log(`Compiled to ${output}`);
  } else {
    error(`Compilation failed:\n${result.stderr}`);
    process.exit(1);
  }
}

function handleNewProject(args: string[]) {
  const name = args[0];
  const templateFlag = args.indexOf('--template');
  const templateId = templateFlag >= 0 ? args[templateFlag + 1] : 'document';
  const dirFlag = args.indexOf('--dir');
  const parentDir = dirFlag >= 0 ? args[dirFlag + 1] : '.';

  if (!name) {
    error('Required: vswrite-cli new-project <name> [--template document|thesis|paper|letter|book] [--dir .]');
    process.exit(1);
  }

  const template = templates.find(t => t.id === templateId);
  if (!template) {
    error(`Unknown template: ${templateId}. Available: ${templates.map(t => t.id).join(', ')}`);
    process.exit(1);
  }

  const projectDir = path.join(parentDir, name);

  if (fs.existsSync(projectDir)) {
    error(`Directory already exists: ${projectDir}`);
    process.exit(1);
  }

  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(projectDir, filePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  Created ${filePath}`);
  }

  console.log(`Project "${name}" created with template "${template.label}" in ${projectDir}`);
}

async function handleExportDocx(args: string[]) {
  const file = requireFile(args[0]);
  const outputFlag = args.indexOf('--output');
  const output = outputFlag >= 0 ? args[outputFlag + 1] : file.replace(/\.typ$/, '.docx');

  const resolvedFile = path.resolve(file);
  const docDir = path.dirname(resolvedFile);

  // Merge includes if present
  let typstContent: string;
  try {
    typstContent = resolveIncludes(resolvedFile);
  } catch {
    typstContent = fs.readFileSync(file, 'utf-8');
  }

  const doc = deserializeTypst(typstContent);
  const buffer = await serializeDocx(doc, docDir, typstContent);
  fs.writeFileSync(output, buffer);
  console.log(`Exported to ${output}`);
}

function handleValidate(args: string[]) {
  const file = requireFile(args[0]);
  const text = fs.readFileSync(file, 'utf-8');

  // We can't use the webview serializer/deserializer directly here since they
  // rely on TipTap JSON types. Instead, we do a basic structural validation.
  const lines = text.split('\n');
  const issues: string[] = [];

  // Check for unmatched braces
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```')) continue; // skip code blocks
    for (const ch of lines[i]) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
      if (ch === '[') bracketDepth++;
      if (ch === ']') bracketDepth--;
      if (ch === '(') parenDepth++;
      if (ch === ')') parenDepth--;
    }
    if (braceDepth < 0) { issues.push(`Line ${i + 1}: Unmatched closing brace }`); braceDepth = 0; }
    if (bracketDepth < 0) { issues.push(`Line ${i + 1}: Unmatched closing bracket ]`); bracketDepth = 0; }
    if (parenDepth < 0) { issues.push(`Line ${i + 1}: Unmatched closing paren )`); parenDepth = 0; }
  }
  if (braceDepth > 0) issues.push(`Unclosed brace(s): ${braceDepth} open`);
  if (bracketDepth > 0) issues.push(`Unclosed bracket(s): ${bracketDepth} open`);
  if (parenDepth > 0) issues.push(`Unclosed paren(s): ${parenDepth} open`);

  // Check for broken includes
  const includeRegex = /^#include\s+"([^"]+)"\s*$/gm;
  let match;
  const docDir = path.dirname(file);
  while ((match = includeRegex.exec(text)) !== null) {
    const includePath = path.resolve(docDir, match[1]);
    if (!fs.existsSync(includePath)) {
      issues.push(`Broken include: ${match[1]} (file not found)`);
    }
  }

  // Check for missing bibliography file
  const bibMatch = text.match(/#bibliography\("([^"]+)"\)/);
  if (bibMatch) {
    const bibPath = path.resolve(docDir, bibMatch[1]);
    if (!fs.existsSync(bibPath)) {
      issues.push(`Missing bibliography file: ${bibMatch[1]}`);
    }
  }

  // Check for missing images
  const imageRegex = /#image\("([^"]+)"/g;
  while ((match = imageRegex.exec(text)) !== null) {
    const imgPath = path.resolve(docDir, match[1]);
    if (!fs.existsSync(imgPath)) {
      issues.push(`Missing image: ${match[1]}`);
    }
  }

  if (issues.length === 0) {
    console.log(`${path.basename(file)}: OK — no issues found.`);
  } else {
    console.log(`${path.basename(file)}: ${issues.length} issue(s) found:`);
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
    process.exit(1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function requireFile(filePath: string | undefined): string {
  if (!filePath || filePath.startsWith('--')) {
    error('No file specified.');
    printUsage();
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return filePath;
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function error(msg: string) {
  process.stderr.write(`Error: ${msg}\n`);
}

function printUsage() {
  console.log(`vswrite-cli — CLI tools for Typst documents

Usage: vswrite-cli <command> [options]

Document Operations:
  info <file.typ> [--json]           Document overview (words, headings, images, citations)
  outline <file.typ> [--json]        Heading hierarchy with line numbers
  validate <file.typ>                Check for structural issues (broken includes, missing images)
  check <file.typ> [--json]          Validate + compile check — returns all errors for AI agents
  merge <file.typ> [--output out.typ] Resolve all #include statements
  split <file.typ> [--output-dir dir] Split at H1 headings into chapter files
  compile <file.typ> [--output f.pdf] Compile to PDF (requires typst CLI)
  export-docx <file.typ> [--output f.docx] Export as Word document (.docx)

Settings & Styling:
  get-settings <file.typ> [--json]   Read current document settings
  set <file.typ> --key "value"       Update document settings (--font, --font-size, --lang, --paper, --margin, --leading, --spacing)
  list-styles                        Show available style templates
  apply-style <file.typ> --style <id> Apply a style template

Bibliography:
  parse-bib <file.bib> [--json]      Parse and display .bib entries
  add-citation --bib f.bib --title "..." --author "..." [--year "..."] [--type article]
  import-sources [--sources-dir dir] [--bib f.bib]  Auto-import DOIs from PDFs

Scaffolding:
  new-project <name> [--template document|thesis|paper|letter|book] [--dir .]`);
}
