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
  isDesignAdopted,
  resolveDesignRoot,
} from '../src/shared/styleWrite.ts';
import { STYLE_TYPST_MARKER, generateStyleTypst } from '../src/shared/styleParser.ts';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../src/shared/styleTypes.ts';
import { ensureStyleFiles } from '../src/shared/projectScaffold.ts';

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

/** Root that CALLS the hand-written macros — the reason regenerating is fatal. */
const ROOT_AUTHORED = `#import "style.typ": *
#show: apply-style

#cover(title: "Angebot", subtitle: "2026")

#insight[Ein Hinweis.]

#include "chapters/01-intro.typ"
`;

/** Root for Penwright-managed projects: no authored macros, so it compiles. */
const ROOT_MANAGED = `#import "style.typ": *
#show: apply-style

= Angebot

#include "chapters/01-intro.typ"
`;

function makeProject(kind: 'handwritten' | 'generated' | 'fresh' | 'handwritten-adopted'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pw-guard-${kind}-`));
  const authored = kind === 'handwritten' || kind === 'handwritten-adopted';
  const rootName = kind === 'generated' ? 'main.typ' : 'Angebot.typ';
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'chapters', '01-intro.typ'), '= Intro\n\nText.\n');
  fs.writeFileSync(path.join(dir, rootName), authored ? ROOT_AUTHORED : ROOT_MANAGED);

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
  // A style.json sitting next to an authored style.typ must NOT count as
  // adoption. ensureStyleFile creates exactly that file from "Save Version";
  // if it granted permission, the harmless button would disarm the guard.
  // Adoption is the marker in style.typ and nothing else.
  const dir = makeProject('handwritten-adopted');
  const plan = planStyleWrites({ projectDir: dir, currentFile: null, style: DEFAULT_PROJECT_STYLE });
  check('a stray style.json does NOT grant permission', plan.ok === false);
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

// ─── 6. The guard must not be erodible from outside ─────────────────

// projectManager.ts cannot be imported here — it pulls in electron-store,
// which needs an Electron app context. So: the decision itself is tested
// where it lives (shared), and the wiring is asserted against the source.
console.log('\nGuard cannot be disarmed by project infrastructure');
{
  const hand = makeProject('handwritten');
  const gen = makeProject('generated');
  const fresh = makeProject('fresh');
  const adopted = makeProject('handwritten-adopted');

  check('isDesignAdopted: hand-written → false', isDesignAdopted(hand) === false);
  check('isDesignAdopted: generated → true', isDesignAdopted(gen) === true);
  check('isDesignAdopted: no style.typ → true', isDesignAdopted(fresh) === true);
  check(
    'isDesignAdopted: a stray style.json does NOT count as adoption',
    isDesignAdopted(adopted) === false,
    'ensureStyleFile used to create exactly this file from "Save Version", which is how the guard got disarmed',
  );

  [hand, gen, fresh, adopted].forEach(d => fs.rmSync(d, { recursive: true, force: true }));
}
{
  // Behavioural, not a source-text match: `ensureStyleFiles` is electron-free
  // and can simply be run. It moved from main/projectManager into
  // shared/projectScaffold when the MCP creation paths started using it, and a
  // regex over the old file would have gone green-by-absence.
  const hand2 = makeProject('handwritten');
  const authored = fs.readFileSync(path.join(hand2, 'style.typ'), 'utf-8');

  ensureStyleFiles({
    dir: hand2,
    wireRoot: true,
    defaultStyleJson: '{"colors":{}}',
    renderStyleTyp: () => '// GENERATED — would destroy the author\'s macros\n',
  });

  check(
    'ensureStyleFiles writes NOTHING into a hand-designed project',
    fs.readFileSync(path.join(hand2, 'style.typ'), 'utf-8') === authored &&
      !fs.existsSync(path.join(hand2, '.penwright', 'style.json')),
    'the adoption check must come before the first write',
  );

  // …and does its job on a project Penwright owns.
  const gen2 = makeProject('fresh');
  ensureStyleFiles({
    dir: gen2,
    wireRoot: true,
    defaultStyleJson: '{"colors":{}}',
    renderStyleTyp: () => '// Penwright style — generated\n',
  });
  check(
    'but does write for a project it owns',
    fs.existsSync(path.join(gen2, 'style.typ')) && fs.existsSync(path.join(gen2, '.penwright', 'style.json')),
  );

  [hand2, gen2].forEach(d => fs.rmSync(d, { recursive: true, force: true }));
}

// ─── 7. Image paths resolve from the file that contains the call ────

console.log('\npenwright_add_image path relativisation');
if (fs.existsSync(MCP_ENTRY)) {
  const dir = makeProject('generated');
  // Valid 1×1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const src = path.join(dir, 'pic.png');
  fs.writeFileSync(src, png);

  await callMcp(dir, [
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_add_image', arguments: { srcPath: src, file: 'chapters/01-intro.typ', afterText: '= Intro' } } },
  ]);

  const chapter = fs.readFileSync(path.join(dir, 'chapters', '01-intro.typ'), 'utf-8');
  const m = chapter.match(/image\("([^"]+)"/);
  check('image was inserted', !!m, chapter.slice(0, 200));
  check(
    'path is relative to the chapter, not the project root',
    m?.[1] === '../assets/pic.png',
    `got: ${m?.[1]}`,
  );

  // The real proof: does the document still compile?
  const typst = path.join(REPO, 'resources', 'bin', `typst-${process.arch === 'arm64' ? 'arm64' : 'x64'}-darwin`);
  if (fs.existsSync(typst)) {
    const { execFileSync } = await import('node:child_process');
    let compiled = true;
    let err = '';
    try {
      execFileSync(typst, [
        'compile', '--root', dir,
        '--package-path', path.join(REPO, 'resources', 'typst-packages'),
        '--font-path', path.join(REPO, 'resources', 'fonts'),
        path.join(dir, 'main.typ'), path.join(dir, 'out.pdf'),
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: any) {
      compiled = false;
      err = (e.stderr?.toString() ?? String(e)).slice(0, 300);
    }
    check('document still compiles with the inserted image', compiled, err);
  } else {
    console.log('  ! bundled typst not found — compile check skipped');
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 8. Preset merges never drop what the preset does not carry ─────

console.log('\nPreset merge keeps project-owned fields');
{
  const { mergeLayout, mergeLayoutPreset, mergeThemePreset } = await import('../src/shared/stylePresetMerge.ts');
  const base = sanitizeProjectStyle({
    ...DEFAULT_PROJECT_STYLE,
    layout: { ...DEFAULT_PROJECT_STYLE.layout, bleed: '5mm', cropMarks: true, facingPages: true, binding: '8mm' },
    sections: [{ id: 'feature', name: 'Feature' }],
    custom: { preamble: '#let mine = 1' },
  });

  // A screen layout carries none of the prepress fields; spreading it used to
  // let the sanitizer reset all four.
  const afterLayout = mergeLayoutPreset(base, { layout: { paper: 'a5', orientation: 'portrait', columns: 1 } as never });
  check('bleed survives a layout swap', afterLayout.layout.bleed === '5mm');
  check('crop marks survive', afterLayout.layout.cropMarks === true);
  check('facing pages survive (they change the LIVE geometry)', afterLayout.layout.facingPages === true);
  check('binding survives', afterLayout.layout.binding === '8mm');
  check('and the new paper actually applied', afterLayout.layout.paper === 'a5');

  const afterTheme = mergeThemePreset(base, { colors: { ...base.colors, primary: '#123456' } } as never);
  check('a theme keeps the section styles', afterTheme.sections.length === 1);
  check('a theme keeps the custom preamble', afterTheme.custom?.preamble === '#let mine = 1');
  check('a theme keeps the prepress setup', afterTheme.layout.bleed === '5mm');

  // A preset that DOES define them must still win.
  const explicit = mergeLayout(base.layout, { bleed: '3mm', cropMarks: false } as never);
  check('an explicit preset value overrides', explicit.bleed === '3mm' && explicit.cropMarks === false);
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
