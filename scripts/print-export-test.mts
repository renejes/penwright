/**
 * Print-export test — the branch the MCP tool was missing.
 *
 * Two project shapes, two correct answers:
 *
 *   Token project (.penwright/style.json exists) — style.typ is generated, so
 *   regenerating it in print mode and repointing the import loses nothing.
 *
 *   Hand-designed project (no style.json) — the whole look lives in a style.typ
 *   Penwright never wrote, usually with #let macros the content calls.
 *   Repointing the import there swaps the author's design for Penwright's
 *   defaults: either the compile dies on `unknown variable: cover`, or a
 *   generic-looking PDF goes to the print shop.
 *
 * The app branched. penwright_export_print always took the first path.
 *
 * Run: npx tsx scripts/print-export-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { planPrintExport, TEMP_EXPORT_BASENAME } from '../src/shared/printExportPlan.ts';
import { buildPrintGeometryOverlay, injectAfterPrologue } from '../src/main/printOverlay.ts';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../src/shared/styleTypes.ts';
import { generateStyleTypst } from '../src/shared/styleParser.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(REPO, 'dist', 'mcp', 'server.mjs');
const TYPST = path.join(REPO, 'resources', 'bin', `typst-${process.arch === 'arm64' ? 'arm64' : 'x64'}-darwin`);

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

/** Its whole design — and a macro the content calls, so a swap is fatal. */
const AUTHORED_STYLE = `// ═══════════════════════════════
//  Designsystem — handgeschrieben
// ═══════════════════════════════
#let olive = rgb("#556b2f")
#let cover(title: "") = text(size: 42pt, fill: olive)[#title]
#let apply-style(body) = {
  set page(paper: "a4", margin: 2cm)
  set text(font: "Libertinus Serif", size: 11pt)
  body
}
`;

const AUTHORED_ROOT = `#import "style.typ": *
#show: apply-style

#cover(title: "Heft")

Ein Absatz.
`;

function makeProject(kind: 'authored' | 'tokens'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pw-print-${kind}-`));
  if (kind === 'authored') {
    fs.writeFileSync(path.join(dir, 'style.typ'), AUTHORED_STYLE);
    fs.writeFileSync(path.join(dir, 'main.typ'), AUTHORED_ROOT);
  } else {
    const style = sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
    fs.writeFileSync(path.join(dir, 'style.typ'), generateStyleTypst(style));
    fs.writeFileSync(path.join(dir, 'main.typ'), '#import "style.typ": *\n#show: apply-style\n\n= Heft\n\nEin Absatz.\n');
    fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.penwright', 'style.json'), JSON.stringify(style, null, 2));
  }
  return dir;
}

const PRINT = { bleed: '5mm', cropMarks: true, facingPages: true, binding: '5mm' };

console.log('\nThe plan branches on the project shape');
{
  const dir = makeProject('authored');
  const root = path.join(dir, 'main.typ');
  const src = fs.readFileSync(root, 'utf-8');
  const plan = planPrintExport({
    rootFile: root, rootContent: src, originalRoot: src, print: PRINT,
    style: null, buildOverlay: buildPrintGeometryOverlay, injectOverlay: injectAfterPrologue,
  });
  check('hand-designed → overlay, not token regeneration', plan.mode === 'overlay');
  check('no print style.typ is written', !plan.writes.some(w => w.abs.includes('style-print')));
  check('the import is NOT repointed', !plan.writes[0].content.includes('.penwright-style-print'));
  check('the author\'s macro call survives', plan.writes[0].content.includes('#cover(title: "Heft")'));
  check('and the caller is told what the overlay cannot do',
    plan.warnings.some(w => /facing pages|binding/i.test(w)), plan.warnings.join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject('tokens');
  const root = path.join(dir, 'main.typ');
  const src = fs.readFileSync(root, 'utf-8');
  const plan = planPrintExport({
    rootFile: root, rootContent: src, originalRoot: src, print: PRINT,
    style: sanitizeProjectStyle(DEFAULT_PROJECT_STYLE),
    buildOverlay: buildPrintGeometryOverlay, injectOverlay: injectAfterPrologue,
  });
  check('token project → regeneration', plan.mode === 'tokens');
  check('a print style.typ is staged', plan.writes.some(w => w.abs.includes('style-print')));
  check('and the temp root imports it',
    plan.writes.some(w => w.abs.endsWith(TEMP_EXPORT_BASENAME) && w.content.includes('.penwright-style-print')));
  check('no warnings — this path implements everything', plan.warnings.length === 0, plan.warnings.join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── What the user would actually have got ──────────────────────────

console.log('\nEnd-to-end through the MCP tool');
if (!fs.existsSync(MCP) || !fs.existsSync(TYPST)) {
  console.log('  ! built server or bundled typst missing — skipped');
} else {
  const dir = makeProject('authored');
  const styleBefore = fs.readFileSync(path.join(dir, 'style.typ'), 'utf-8');

  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd: dir,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let o = '';
    child.stdout.on('data', d => { o += d.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve(o));
    const calls = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_export_print', arguments: { outputPath: 'exports/print.pdf' } } },
    ];
    child.stdin.write(calls.map(c => JSON.stringify(c)).join('\n') + '\n');
    setTimeout(() => child.kill(), 20000);
  });

  const pdf = path.join(dir, 'exports', 'print.pdf');
  check('the export succeeded', fs.existsSync(pdf), out.slice(-400));
  check('the authored style.typ is byte-identical',
    fs.readFileSync(path.join(dir, 'style.typ'), 'utf-8') === styleBefore);
  check('every temp file was cleaned up',
    !fs.readdirSync(dir).some(f => f.startsWith('.penwright-')),
    fs.readdirSync(dir).filter(f => f.startsWith('.penwright-')).join(', '));
  check('the result says the design was left alone', /hand-designed/i.test(out), out.slice(-400));
  check('and names what it could not apply', /facing pages|binding/i.test(out), out.slice(-400));

  // A PDF is only proof if it is bigger than the trim size — that is the bleed.
  if (fs.existsSync(pdf)) {
    let dims = '';
    try {
      dims = execFileSync(TYPST, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    } catch { /* version probe only */ }
    check('the PDF is non-empty', fs.statSync(pdf).size > 1000, `${fs.statSync(pdf).size} bytes ${dims}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
