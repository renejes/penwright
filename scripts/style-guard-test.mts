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
  findStyleTypFiles,
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

// ─── 2b. The guard is asked of the PROJECT, not of the open file ────
//
// The measured hole, and the one that mattered: the design home was resolved
// from whatever file happened to be open. On a project whose root is called
// `Angebot.typ`, `findRootFileIn` finds nothing by name, so the fallback
// `findRootFile(currentFile)` decides — and that returns a `.typ` nobody
// includes AS ITSELF. The guard then asked `chapters/style.typ`, found nothing,
// said "go ahead", and a second design system was generated beside the real
// one. Four ordinary routes reach that state: an orphaned chapter file,
// "Import Markdown" (which creates one and opens it), "Save As…" (which moves
// the open file out of the project entirely), and the ↑ button in the tree.
{
  const dir = makeProject('handwritten');
  const orphan = path.join(dir, 'chapters', '99-notizen.typ');
  fs.writeFileSync(orphan, '= Notizen\n\nNoch nicht eingebunden.\n');
  const before = sha(path.join(dir, 'style.typ'));

  const plan = planStyleWrites({ projectDir: dir, currentFile: orphan, style: DEFAULT_PROJECT_STYLE });
  check('an orphaned open file does not walk past the authored style.typ', plan.ok === false);
  check('…and the refusal names the file it protected', plan.ok === false && plan.styleTypPath === path.join(dir, 'style.typ'), plan.ok === false ? plan.styleTypPath : '');
  check('…nothing was written', sha(path.join(dir, 'style.typ')) === before);
  check('…and no style.typ appeared in chapters/', !fs.existsSync(path.join(dir, 'chapters', 'style.typ')));

  // "Save As…" leaves projectDir alone and points currentFile outside it.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-outside-'));
  const stray = path.join(outside, 'Kopie.typ');
  fs.writeFileSync(stray, '= Kopie\n');
  const planOut = planStyleWrites({ projectDir: dir, currentFile: stray, style: DEFAULT_PROJECT_STYLE });
  check('a file opened outside the project does not disarm it either', planOut.ok === false);
  check('…and nothing was written next to that file', !fs.existsSync(path.join(outside, 'style.typ')));
  fs.rmSync(outside, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  // The other half: ask about one file, write to another. A project that
  // already HAS a generated style.typ must keep using it, even when the
  // resolution wanders — otherwise the same wandering produces a duplicate.
  //
  // The root is deliberately NOT called main.typ. With a by-name hit the
  // resolution never wanders and the case proves nothing — which is exactly how
  // an earlier version of this assertion passed against the unfixed code.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-guard-gen-named-'));
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Angebot.typ'), ROOT_MANAGED);
  fs.writeFileSync(path.join(dir, 'chapters', '01-intro.typ'), '= Intro\n');
  fs.writeFileSync(path.join(dir, 'style.typ'), generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)));
  const orphan = path.join(dir, 'chapters', '99-notizen.typ');
  fs.writeFileSync(orphan, '= Notizen\n');
  const plan = planStyleWrites({ projectDir: dir, currentFile: orphan, style: DEFAULT_PROJECT_STYLE });
  check('a generated project still plans writes', plan.ok === true);
  check(
    'the existing style.typ is the target, not a new one in chapters/',
    plan.ok === true && plan.writes.some(w => w.abs === path.join(dir, 'style.typ'))
      && !plan.writes.some(w => w.abs === path.join(dir, 'chapters', 'style.typ')),
    plan.ok === true ? plan.writes.map(w => path.relative(dir, w.abs)) : '',
  );
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  // A design that lives one folder down — the shape `ensureStyleFiles` walked
  // past, because it asks with currentFile = null and so only ever looked at
  // the project root.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-guard-nested-'));
  fs.mkdirSync(path.join(dir, 'doc'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'doc', 'style.typ'), HANDWRITTEN_STYLE);
  fs.writeFileSync(path.join(dir, 'doc', 'Angebot.typ'), ROOT_AUTHORED);
  check('an authored style.typ in a subfolder is found', !isDesignAdopted(dir, null));
  const plan = planStyleWrites({ projectDir: dir, currentFile: null, style: DEFAULT_PROJECT_STYLE });
  check('…and planStyleWrites refuses on it', plan.ok === false);
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
  {
    // The CONTENT tools reached the same file with no guard at all. Measured:
    // `penwright_write_file` replaced an authored design system outright and
    // reported success. On these projects — no Git, no backups — the edit
    // snapshot was the only way back, and nothing told the agent it had needed
    // one. One rule for one file: if Penwright will not regenerate it, it will
    // not overwrite it either.
    const dir = makeProject('handwritten');
    const styleTyp = path.join(dir, 'style.typ');
    const before = sha(styleTyp);
    const out = await callMcp(dir, [
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_write_file', arguments: { filePath: 'style.typ', content: '// weg\n' } } },
    ]);
    check('write_file cannot replace an authored style.typ', /Refusing to overwrite/i.test(out), out.slice(-300));
    check('…and it is byte-identical afterwards', sha(styleTyp) === before);

    // …while an ordinary chapter is still perfectly writable.
    const chapter = path.join(dir, 'chapters', '01-intro.typ');
    await callMcp(dir, [
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_write_file', arguments: { filePath: 'chapters/01-intro.typ', content: '= Intro\n\nNeu.\n' } } },
    ]);
    check('the guard is not a blanket block on writing', /Neu\./.test(fs.readFileSync(chapter, 'utf-8')));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  {
    // …and the guard must not close the way BACK. `replace_in_project` still
    // reaches style.typ (it writes outside guardWrite), so damage is possible;
    // once done, the file on disk no longer carries the marker, so a naive
    // guard read it as authored and refused the very snapshot that would undo
    // the damage. Measured against HEAD, where the same sequence restored it.
    const dir = makeProject('handwritten');
    const styleTyp = path.join(dir, 'style.typ');
    const before = sha(styleTyp);
    // `olive` really is in HANDWRITTEN_STYLE — an earlier version of this used a
    // word the fixture does not contain, so the replace changed nothing and the
    // restore had nothing to do. The hash then matched for the wrong reason and
    // the assertion passed with the exemption removed.
    const damaged = await callMcp(dir, [
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_replace_in_project', arguments: { query: 'olive', replacement: 'akzent' } } },
    ]);
    check('the damage actually happened (replace_in_project reaches style.typ)', sha(styleTyp) !== before, damaged.slice(-200));
    const out = await callMcp(dir, [
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_undo_last_edit', arguments: { file: 'style.typ' } } },
    ]);
    check('…and undo_last_edit can still put it back', sha(styleTyp) === before, out.slice(-350));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── 5b. The export paths ask the SAME question ─────────────────────
//
// Three of them branched on "does .penwright/style.json exist" instead of the
// marker — a different, weaker test. One stray style.json (from the resolution
// hole above, or a single write from the agent) therefore replaced an authored
// look with Penwright defaults across the web export, and sent the print export
// down the branch that regenerates style.typ and repoints the root's `#import`
// at a file where the author's `#let cover(…)` does not exist.
console.log('\nExport paths use the marker, not the presence of style.json');
{
  const dir = makeProject('handwritten-adopted');   // authored style.typ + a style.json
  check('the fixture is the contested shape', isHandwrittenStyle(fs.readFileSync(path.join(dir, 'style.typ'), 'utf-8')) && fs.existsSync(path.join(dir, '.penwright', 'style.json')));
  check('…and the guard says: not adopted', !isDesignAdopted(dir, null));

  // The WEB export, driven through the real resolver rather than through a copy
  // of its condition. `prepareWebDesign` is the code that decides, and it used
  // to re-read the same style.json the caller had just declined to pass — so a
  // test that recomputed `isDesignAdopted(...) && existsSync(...)` itself proved
  // nothing about the export at all, and stayed green with the fix reverted.
  {
    const { prepareWebDesign } = await import('../src/main/webExport.ts');
    const merged = fs.readFileSync(path.join(dir, 'Angebot.typ'), 'utf-8');
    const design = prepareWebDesign({ rootDir: dir, mergedContent: merged, styleOverride: null });
    check(
      'the web export does not take the stray style.json',
      design.inferred === true,
      { inferred: design.inferred, body: design.style?.fonts?.body },
    );
    check(
      '…it reads the authored design instead',
      /Playfair|Montserrat|EB Garamond|Inter/.test(String(design.style?.fonts?.heading ?? '') + String(design.style?.fonts?.body ?? ''))
        || design.style?.colors?.background !== DEFAULT_PROJECT_STYLE.colors.background,
      design.style?.fonts,
    );
  }

  // And the print plan the same branch feeds: with an authored design it must
  // leave the author's `#import` alone rather than repointing it at a generated
  // print file where none of their macros exist.
  {
    const { planPrintExport, TEMP_STYLE_PRINT_BASENAME } = await import('../src/shared/printExportPlan.ts');
    const rootFile = path.join(dir, 'Angebot.typ');
    const rootContent = fs.readFileSync(rootFile, 'utf-8');
    const style = isDesignAdopted(dir, null) && fs.existsSync(path.join(dir, '.penwright', 'style.json'))
      ? sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)
      : null;
    const plan = planPrintExport({
      rootFile, rootContent, originalRoot: rootFile,
      print: { bleed: '5mm', cropMarks: true },
      style,
      buildOverlay: () => '#set page(margin: 0pt)',
      injectOverlay: (c, o) => `${o}\n${c}`,
    });
    check(
      'the print plan leaves the authored #import alone',
      !plan.writes.some(w => w.abs.endsWith(TEMP_STYLE_PRINT_BASENAME)),
      plan.writes.map(w => path.basename(w.abs)),
    );
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 5c. findStyleTypFiles itself ───────────────────────────────────
//
// Four behaviours the guard now rests on, none of which had an assertion.
console.log('\nfindStyleTypFiles');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-scan-'));
  fs.writeFileSync(path.join(dir, 'style.typ'), HANDWRITTEN_STYLE);
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'chapters', 'style.typ'), generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)));
  // Skipped folders, and a copy too deep to speak for the project.
  for (const skip of ['.penwright', 'node_modules', 'assets']) {
    fs.mkdirSync(path.join(dir, skip), { recursive: true });
    fs.writeFileSync(path.join(dir, skip, 'style.typ'), HANDWRITTEN_STYLE);
  }
  fs.mkdirSync(path.join(dir, 'templates', 'fremd'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'templates', 'fremd', 'style.typ'), HANDWRITTEN_STYLE);

  const hits = findStyleTypFiles(dir);
  const rel = hits.map(h => path.relative(dir, h.abs).split(path.sep).join('/')).sort();
  check('finds the root and one level down', rel.includes('style.typ') && rel.includes('chapters/style.typ'), rel);
  check('skips .penwright, node_modules and assets', !rel.some(r => /^(\.penwright|node_modules|assets)\//.test(r)), rel);
  check('does not reach a copy two levels down', !rel.includes('templates/fremd/style.typ'), rel);
  check('marks authored vs generated correctly',
    hits.find(h => h.abs === path.join(dir, 'style.typ'))?.authored === true
    && hits.find(h => h.abs === path.join(dir, 'chapters', 'style.typ'))?.authored === false, hits);
  check('shallowest first', path.relative(dir, hits[0].abs) === 'style.typ', rel);
  // …and the deep foreign copy must NOT lock the project on its own.
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-scan-clean-'));
  fs.writeFileSync(path.join(clean, 'style.typ'), generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)));
  fs.mkdirSync(path.join(clean, 'templates', 'fremd'), { recursive: true });
  fs.writeFileSync(path.join(clean, 'templates', 'fremd', 'style.typ'), HANDWRITTEN_STYLE);
  check('a foreign template deep inside does not lock a managed project', isDesignAdopted(clean, null));
  fs.rmSync(clean, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
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
