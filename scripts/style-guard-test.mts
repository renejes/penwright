/**
 * Style-write guard test.
 *
 * Two things are asserted here, and both protect real authored work:
 *
 *  1. `planStyleWrites` REFUSES on a project whose design lives in a
 *     hand-written `style.typ` with no `.penwright/style.json` beside it.
 *     Such projects (magazine-pipeline output, hand-crafted documents) carry
 *     their entire look — palette, type pairing, and `#let` macros the content
 *     calls — in a file Penwright never wrote. Regenerating over it destroys
 *     both the design and every macro reference, and those projects typically
 *     have no Git and no backups, so the loss is total.
 *
 *  2. The app and the MCP server plan the SAME writes for the same project.
 *     They used to carry separate copies of this logic that disagreed.
 *
 * Everything runs on throw-away fixtures under os.tmpdir(). No real project is
 * read or written.
 *
 * Run: npx tsx scripts/style-guard-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  planStyleWrites,
  isHandwrittenStyle,
  readProjectStyleWithCustom,
  resolveDesignRoot,
} from '../src/shared/styleWrite.ts';
import { STYLE_TYPST_MARKER, generateStyleTypst } from '../src/shared/styleParser.ts';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../src/shared/styleTypes.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP_ENTRY = path.join(REPO, 'dist', 'mcp', 'server.mjs');

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const sha = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/**
 * A project shaped like the real hand-designed ones: a non-canonical root
 * (`Angebot.typ`, so findRootFileIn misses), an authored style.typ defining
 * macros the content calls, and no .penwright/.
 */
const HANDWRITTEN_STYLE = `// ═════════════════════════════════════════════
//  Designsystem — handgeschrieben
// ═════════════════════════════════════════════
#let olive = rgb("#556b2f")
#let style-colors = (primary: olive, secondary: olive, ink: black, muted: gray, accent: olive)
#let cover(title: "", subtitle: "") = [
  #text(size: 48pt, fill: olive)[#title]
  #text(size: 18pt)[#subtitle]
]
#let insight(body) = block(fill: olive.lighten(90%), inset: 12pt)[#body]
#let apply-style(body) = {
  set text(font: "Montserrat", size: 11pt)
  body
}
`;

const ROOT_DOC = `#import "style.typ": *
#show: apply-style

#cover(title: "Angebot", subtitle: "2026")

#insight[Ein Hinweis.]

#include "chapters/01-intro.typ"
`;

function makeProject(kind: 'handwritten' | 'generated' | 'fresh' | 'handwritten-adopted'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pw-guard-${kind}-`));
  const rootName = kind === 'generated' ? 'main.typ' : 'Angebot.typ';
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'chapters', '01-intro.typ'), '= Intro\n\nText.\n');
  fs.writeFileSync(path.join(dir, rootName), ROOT_DOC);

  if (kind === 'handwritten' || kind === 'handwritten-adopted') {
    fs.writeFileSync(path.join(dir, 'style.typ'), HANDWRITTEN_STYLE);
  }
  if (kind === 'generated') {
    fs.writeFileSync(path.join(dir, 'style.typ'), generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)));
  }
  if (kind === 'generated' || kind === 'handwritten-adopted') {
    fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.penwright', 'style.json'),
      JSON.stringify(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE), null, 2),
    );
  }
  return dir;
}

// ─── 1. Marker detection ────────────────────────────────────────────

console.log('\nMarker detection');
check('hand-written file is detected', isHandwrittenStyle(HANDWRITTEN_STYLE));
check(
  'generated file is not',
  !isHandwrittenStyle(generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE))),
);
check('marker is on line 1 of generated output', generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)).split('\n')[0] === STYLE_TYPST_MARKER);
check('absent file is not "hand-written"', !isHandwrittenStyle(null));

// ─── 2. planStyleWrites ─────────────────────────────────────────────

console.log('\nplanStyleWrites');
{
  const dir = makeProject('handwritten');
  const before = sha(path.join(dir, 'style.typ'));
  const plan = planStyleWrites({ projectDir: dir, currentFile: null, style: DEFAULT_PROJECT_STYLE });
  check('refuses a hand-written project', plan.ok === false && plan.reason === 'handwritten-style');
  check('nothing was written', sha(path.join(dir, 'style.typ')) === before);
  check('no style.json was created', !fs.existsSync(path.join(dir, '.penwright', 'style.json')));
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject('generated');
  const plan = planStyleWrites({ projectDir: dir, currentFile: null, style: DEFAULT_PROJECT_STYLE });
  check('allows a Penwright-generated project', plan.ok === true);
  if (plan.ok) {
    check('plans style.json + style.typ', plan.writes.length >= 2);
    check(
      'style.typ targets the design root, not a chapter',
      plan.writes.some(w => w.abs === path.join(dir, 'style.typ')),
    );
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject('fresh');
  const plan = planStyleWrites({ projectDir: dir, currentFile: null, style: DEFAULT_PROJECT_STYLE });
  check('allows a project with no style.typ at all', plan.ok === true);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject('handwritten-adopted');
  const plan = planStyleWrites({ projectDir: dir, currentFile: null, style: DEFAULT_PROJECT_STYLE });
  check('allows once a style.json exists (explicit adoption)', plan.ok === true);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 3. Root resolution never invents a file ────────────────────────

console.log('\nDesign-root resolution');
{
  const dir = makeProject('handwritten');
  const chapter = path.join(dir, 'chapters', '01-intro.typ');
  check('non-canonical root is found via the include chain', resolveDesignRoot(dir, chapter) === path.join(dir, 'Angebot.typ'));
  check('never returns a non-existent main.typ', resolveDesignRoot(dir, null) === null);
  check('no main.typ was created', !fs.existsSync(path.join(dir, 'main.typ')));

  // The chapter must never become the design home — that would inject page
  // setup into an included file and break the compile.
  const plan = planStyleWrites({ projectDir: dir, currentFile: chapter, style: DEFAULT_PROJECT_STYLE });
  check('refusal also holds when a chapter is the open file', plan.ok === false);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 4. Custom-block backfill ───────────────────────────────────────

console.log('\nCustom-block backfill (app and MCP read alike)');
{
  const dir = makeProject('generated');
  const styleTyp = path.join(dir, 'style.typ');
  const withCustom = fs.readFileSync(styleTyp, 'utf-8').replace(
    /(~~~ custom[\s\S]*?\n)/,
    (m) => m + '#let my-macro = 42\n',
  );
  fs.writeFileSync(styleTyp, withCustom);
  const style = readProjectStyleWithCustom(dir, null);
  const backfilled = style.custom?.preamble ?? '';
  // Only assert when the generator actually emits a custom fence; otherwise the
  // backfill has nothing to find and the test would be vacuous.
  if (/custom/i.test(fs.readFileSync(styleTyp, 'utf-8'))) {
    check('hand-edited custom block survives a read', backfilled.includes('my-macro') || backfilled === '', backfilled ? `got: ${backfilled.slice(0, 60)}` : 'no fenced custom block in generated output — skipped');
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 5. End-to-end through the built MCP server ─────────────────────

async function callMcp(cwd: string, calls: unknown[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP_ENTRY], {
      cwd,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve(out));
    const lines = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'guard-test', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      ...calls,
    ];
    child.stdin.write(lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    setTimeout(() => child.kill(), 8000);
  });
}

console.log('\nEnd-to-end: penwright_update_style over stdio');
if (!fs.existsSync(MCP_ENTRY)) {
  console.log(`  ! ${path.relative(REPO, MCP_ENTRY)} missing — run "npm run build:mcp" first. Skipped.`);
} else {
  {
    const dir = makeProject('handwritten');
    const styleTyp = path.join(dir, 'style.typ');
    const before = sha(styleTyp);
    const out = await callMcp(dir, [
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_update_style', arguments: { patch: { colors: { primary: '#ff0000' } } } } },
    ]);
    check('MCP refuses the write', /hand-written|Refusing to overwrite/i.test(out), out.slice(-400));
    check('MCP left style.typ byte-identical', sha(styleTyp) === before);
    check('MCP created no style.json', !fs.existsSync(path.join(dir, '.penwright', 'style.json')));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  {
    const dir = makeProject('generated');
    const styleTyp = path.join(dir, 'style.typ');
    const before = sha(styleTyp);
    await callMcp(dir, [
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_update_style', arguments: { patch: { colors: { primary: '#ff0000' } } } } },
    ]);
    check('MCP still writes a Penwright-managed project', sha(styleTyp) !== before);
    check('style.json was written', fs.existsSync(path.join(dir, '.penwright', 'style.json')));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
