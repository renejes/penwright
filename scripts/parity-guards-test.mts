/**
 * The four guards this session added, each proved against the thing it guards.
 *
 *  P4  A design change that breaks the document is rolled back on BOTH sides.
 *      The app has done this since Session 23; the MCP server wrote the same
 *      files unverified, so one apply_layout could leave the document
 *      uncompilable with no way back — and the tool reported success, because
 *      the write itself had succeeded.
 *
 *  P4  The undo net is readable. `.penwright/ai-snapshots/` was written by
 *      both processes and read by neither properly: the app kept an in-memory
 *      ring buffer that only ever held its own snapshots, so every file the
 *      agent rescued was invisible in the one UI built to surface it.
 *
 *  P1  All four creation paths produce the same project. `create_project`
 *      made three files; the app made twelve plus Git, .gitignore, sources/,
 *      skills and style.typ.
 *
 *  P1  An image entering the project never destroys one that is already there.
 *      Two of the app's three entry points called copyFileSync with no
 *      existence check.
 *
 * The compile-verify checks need the bundled Typst and are skipped without it.
 *
 * Run: npx tsx scripts/parity-guards-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { safeApply, fsIO } from '../src/shared/safeApply.ts';
import {
  recordSnapshot,
  listSnapshots,
  listSnapshotRefs,
  takeLastSnapshot,
  countSnapshots,
  publishSnapshotLimit,
  snapshotLimit,
  DEFAULT_SNAPSHOT_LIMIT,
} from '../src/shared/editHistory.ts';
import { scaffoldProject, planGitignore } from '../src/shared/projectScaffold.ts';
import { placeAsset, placeAssetFromPath, assetPathFrom, safeAssetName } from '../src/shared/assetPlacement.ts';
import { writeAgentActivity, readAgentActivity, agentActivityPath, writeSession } from '../src/shared/sessionState.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(REPO, 'dist', 'mcp', 'server.mjs');
const TYPST = ['typst-arm64-darwin', 'typst-x64-darwin']
  .map(n => path.join(REPO, 'resources', 'bin', n))
  .find(p => fs.existsSync(p));

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ─── 1. safeApply: the engine both processes now share ──────────────

console.log('\nA design change that breaks the document is rolled back');
{
  const dir = tmp('pw-safeapply-');
  const a = path.join(dir, 'a.txt');
  const b = path.join(dir, 'b.txt');
  fs.writeFileSync(a, 'original A');
  // b deliberately does not exist — a rollback has to REMOVE it again, which
  // is the case `section:apply` used to get wrong (the freshly created
  // style.json survived a rollback that claimed to have undone everything).

  const res = await safeApply({
    writes: [{ abs: a, content: 'new A' }, { abs: b, content: 'new B' }],
    verify: async () => ({ ok: false, errors: ['unknown variable: style-colors'] }),
  });

  check('the call reports failure', res.ok === false);
  check('the existing file is back to what it was', fs.readFileSync(a, 'utf-8') === 'original A');
  check('the file that did not exist is gone again', !fs.existsSync(b));
  if (!res.ok) check('the compile error reaches the caller', res.error.includes('style-colors'));

  // Success commits everything.
  const ok = await safeApply({
    writes: [{ abs: a, content: 'good A' }, { abs: b, content: 'good B' }],
    verify: async () => ({ ok: true }),
  });
  check('a verified change commits', ok.ok === true && fs.readFileSync(a, 'utf-8') === 'good A' && fs.readFileSync(b, 'utf-8') === 'good B');

  // Already-broken document: the change must NOT be blamed for it.
  fs.writeFileSync(a, 'was already broken');
  const probe = await safeApply({
    writes: [{ abs: a, content: 'my change' }],
    verify: async () => ({ ok: false, errors: ['pre-existing error'] }),
    baseline: 'probe',
  });
  check(
    'a pre-existing break does not veto the change',
    probe.ok === true && probe.baselineBroken === true && fs.readFileSync(a, 'utf-8') === 'my change',
  );

  // …but a change that is genuinely the cause still rolls back. The verifier
  // fails only while the new content is present.
  fs.writeFileSync(a, 'fine');
  const guilty = await safeApply({
    writes: [{ abs: a, content: 'breaks it' }],
    verify: async () => (fs.readFileSync(a, 'utf-8') === 'breaks it'
      ? { ok: false, errors: ['caused by the change'] }
      : { ok: true }),
    baseline: 'probe',
  });
  check('a change that IS the cause still rolls back', guilty.ok === false && fs.readFileSync(a, 'utf-8') === 'fine');

  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 2. safeApply end-to-end through the MCP server ─────────────────

/**
 * Runs a batch of tool calls against the built server over stdio.
 *
 * Resolves as soon as the LAST call's response arrives rather than on a fixed
 * timer — some of these compile real documents and some do nothing, and a
 * timer long enough for the first makes the whole suite take minutes.
 */
async function callMcp(cwd: string, calls: { id: number }[]): Promise<string> {
  const lastId = Math.max(...calls.map(c => c.id));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999', ...(TYPST ? { TYPST_BIN: TYPST } : {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(cap);
      child.kill();
      resolve(out);
    };
    const cap = setTimeout(finish, 90000);   // hard stop for a hung compile

    child.stdout.on('data', d => {
      out += d.toString();
      // Responses are newline-delimited JSON; the id we want is the last one.
      if (new RegExp(`"id":${lastId}(\\D|$)`).test(out)) setTimeout(finish, 50);
    });
    child.on('error', (err) => { if (!settled) { settled = true; clearTimeout(cap); reject(err); } });
    child.on('close', finish);

    const lines = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      ...calls,
    ];
    child.stdin.write(lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  });
}

const call = (id: number, name: string, args: unknown = {}) =>
  ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

/**
 * The text of one specific response, not the whole stream.
 *
 * Substring-matching raw stdout looked fine until `initialize` started
 * carrying `instructions` — which necessarily describes the very notes some of
 * these checks assert the ABSENCE of. Two tests went red for a sentence in the
 * server's own documentation. Asking the right response is the fix.
 */
function replyText(out: string, id: number): string {
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== id || !msg.result) continue;
      return (msg.result.content ?? [])
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text ?? '')
        .join('\n');
    } catch { /* partial line */ }
  }
  return '';
}

if (!fs.existsSync(MCP)) {
  console.log(`\n! ${path.relative(REPO, MCP)} missing — run "npm run build:mcp" first.\n`);
  process.exit(1);
}

if (!TYPST) {
  console.log('\n(bundled Typst not found — skipping the end-to-end compile checks)');
} else {
  console.log('\nThe agent cannot leave the document uncompilable');
  {
    const dir = tmp('pw-mcp-verify-');
    // A project whose design Penwright owns, so the design tools engage, and
    // whose CONTENT is fine — so any break is attributable to the change.
    fs.writeFileSync(path.join(dir, 'main.typ'), '#import "style.typ": *\n#show: apply-style\n\n= Title\n\nBody text.\n');
    fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });

    const out = await callMcp(dir, [
      call(2, 'penwright_set_project', { projectDir: dir }),
      call(3, 'penwright_apply_palette', { presetId: 'editorial' }),
      call(4, 'penwright_compile', {}),
    ]);

    // penwright_compile's payload is a JSON string INSIDE the JSON-RPC
    // envelope, so its quotes arrive escaped.
    const compiled = out.includes('\\"success\\": true');
    check('the document still compiles after a design change', compiled, out.slice(-600));
    check('the tool says it verified', out.includes('Verified: the document still compiles'), out.slice(-600));
    check('style.typ was generated', fs.existsSync(path.join(dir, 'style.typ')));

    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('\nA design change that WOULD break the document is refused');
  {
    const dir = tmp('pw-mcp-rollback-');
    fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'main.typ'), '#import "style.typ": *\n#show: apply-style\n\n#include "chapters/01.typ"\n');
    // The chapter does NOT import style.typ. Typst evaluates an #include in
    // its own scope, so a design element referencing style-colors here is an
    // unknown variable and the whole document stops compiling. Before this
    // session the write went in anyway and the tool reported success.
    const chapter = path.join(dir, 'chapters', '01.typ');
    const before = '= Chapter\n\nUntouched prose.\n';
    fs.writeFileSync(chapter, before);
    fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });

    // Give the project a generated style.typ so main.typ compiles to begin
    // with — the baseline has to be green for the rollback to be attributable.
    const seed = await callMcp(dir, [
      call(2, 'penwright_set_project', { projectDir: dir }),
      call(3, 'penwright_apply_palette', { presetId: 'editorial' }),
    ]);
    check('the project compiles before the bad change', seed.includes('Verified: the document still compiles'), seed.slice(-400));

    const out = await callMcp(dir, [
      call(2, 'penwright_set_project', { projectDir: dir }),
      call(3, 'penwright_open_file', { filePath: 'chapters/01.typ' }),
      call(4, 'penwright_insert_design_element', {
        elementId: 'pull-quote',
        afterText: 'Untouched prose.',
        params: { text: 'A quote.' },
      }),
    ]);

    const after = fs.readFileSync(chapter, 'utf-8');
    check('the chapter is byte-for-byte what it was', after === before, after.slice(0, 300));
    check('and the agent is told it was NOT applied', out.includes('was NOT applied'), out.slice(-600));
    check('with the Typst error, so it can fix the cause', /Typst reported/.test(out), out.slice(-600));

    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('\nThe agent can see the page it is talking about');
  {
    const dir = tmp('pw-mcp-render-');
    fs.writeFileSync(path.join(dir, 'main.typ'), '= One\n\nFirst.\n\n#pagebreak()\n\n= Two\n\nSecond.\n');

    const out = await callMcp(dir, [
      call(2, 'penwright_set_project', { projectDir: dir }),
      call(3, 'penwright_render_page', { page: 2, ppi: 96 }),
    ]);
    check('a rendered page comes back as an image', out.includes('"type":"image"') && out.includes('image/png'), out.slice(-400));
    check(
      'the temp PNGs are cleaned up',
      fs.readdirSync(dir).every(f => !f.endsWith('.png')),
      fs.readdirSync(dir).join(', '),
    );

    const past = await callMcp(dir, [
      call(2, 'penwright_set_project', { projectDir: dir }),
      call(3, 'penwright_render_page', { page: 40 }),
    ]);
    check('asking past the end says so instead of hanging', past.includes('fewer pages'), past.slice(-400));

    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── 3. Every writing tool warns about unsaved editor work ──────────

console.log('\nThe unsaved-work warning is on every writing tool, not three');
{
  const dir = tmp('pw-contested-');
  fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });
  const file = path.join(dir, 'main.typ');
  fs.writeFileSync(file, '= Title\n\nSome prose here.\n');

  // The app has this file open with unsaved edits.
  writeSession({ projectDir: dir, currentFile: file, isDirty: true, lastCompileOk: true });

  // add_footnote is one of the twenty-five that never carried the note.
  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_add_footnote', { file: 'main.typ', afterText: 'Some prose here.', body: 'A note.' }),
  ]);
  check('a tool that never had the note now carries it', replyText(out, 3).includes('open in Penwright with unsaved changes'), replyText(out, 3).slice(-300));

  // And it must NOT ride along on a tool that touched nothing.
  const clean = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_list_fonts', {}),
  ]);
  check('but not on one that touched no document', !replyText(clean, 3).includes('unsaved changes'), replyText(clean, 3).slice(-300));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nAn already-broken document is not blamed on the agent');
{
  const dir = tmp('pw-broken-');
  fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });
  const file = path.join(dir, 'main.typ');
  fs.writeFileSync(file, '= Title\n\nProse.\n');
  writeSession({ projectDir: dir, currentFile: file, isDirty: false, lastCompileOk: false });

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_get_document', {}),
  ]);
  check('the agent is warned before it starts', replyText(out, 3).includes('already failing to compile'), replyText(out, 3).slice(-300));

  writeSession({ projectDir: dir, currentFile: file, isDirty: false, lastCompileOk: true });
  const fine = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_get_document', {}),
  ]);
  check('and not warned when the document is fine', !replyText(fine, 3).includes('already failing to compile'), replyText(fine, 3).slice(-300));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nget_style admits when it is showing defaults');
{
  const dir = tmp('pw-getstyle-');
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Title\n');

  const fresh = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_get_style', {}),
  ]);
  check('an untouched project reports initialized: false', fresh.includes('\\"initialized\\": false'), fresh.slice(-500));
  check('and says the tokens describe nothing yet', fresh.includes('Penwright defaults'), fresh.slice(-500));

  // A hand-written style.typ has to be called out — the design tools will
  // refuse, and the agent should know that before it plans a redesign.
  fs.writeFileSync(path.join(dir, 'style.typ'), '#let cover(t) = block[#t]\n');
  const authored = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_get_style', {}),
  ]);
  check('a hand-written style.typ reports adopted: false', authored.includes('\\"adopted\\": false'), authored.slice(-500));
  check('and warns the design tools will refuse', authored.includes('hand-written style.typ'), authored.slice(-500));

  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 4. The undo net is readable from both sides ────────────────────

console.log('\nThe undo net can be read, not just written');
{
  const dir = tmp('pw-undo-');
  const one = path.join(dir, 'one.typ');
  const two = path.join(dir, 'two.typ');
  fs.writeFileSync(one, 'first');
  fs.writeFileSync(two, 'second');

  recordSnapshot(dir, one, 'one before');
  // Distinct timestamps: the filename carries them and ordering depends on it.
  await new Promise(r => setTimeout(r, 5));
  recordSnapshot(dir, two, 'two before');

  check('both files are listed, newest first', listSnapshots(dir).length === 2 && listSnapshots(dir)[0].filePath === path.resolve(two));
  check('a file the editor never had is included', listSnapshots(dir, two).length === 1);
  check('refs carry the file and no content', listSnapshotRefs(dir)[0].diskName.endsWith('.json'));
  check('counting matches listing', countSnapshots(dir) === 2 && countSnapshots(dir, one) === 1);

  // Undo across the whole project: the newest entry wins regardless of file.
  const taken = takeLastSnapshot(dir);
  check('undo reaches a file the user never opened', taken?.snapshot.filePath === path.resolve(two));

  // The entry survives until the restore is committed — an undo that failed
  // halfway must not also have consumed its own way back.
  check('the entry is still there before commit', countSnapshots(dir) === 2);
  taken?.commit();
  check('and gone after it', countSnapshots(dir) === 1);

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nOne retention limit, not two');
{
  const dir = tmp('pw-retention-');
  const f = path.join(dir, 'x.typ');
  fs.writeFileSync(f, 'x');

  check('falls back to the shared default', snapshotLimit(dir) === DEFAULT_SNAPSHOT_LIMIT);

  publishSnapshotLimit(dir, 3);
  check('reads what the app published', snapshotLimit(dir) === 3);

  for (let i = 0; i < 6; i++) {
    recordSnapshot(dir, f, `v${i}`);
    await new Promise(r => setTimeout(r, 3));
  }
  check('pruning honours the published number, not the hard-coded 40', countSnapshots(dir) === 3, `got ${countSnapshots(dir)}`);
  check('the limit marker is not mistaken for a snapshot', listSnapshots(dir).length === 3);

  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 4. All creation paths produce the same project ─────────────────

console.log('\nEvery creation path produces the same project');
{
  const dir = tmp('pw-scaffold-');
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Title\n\nBody.\n');

  const res = await scaffoldProject({
    dir,
    skills: [{ slug: 'typst', content: '# Typst\n' }, { slug: 'design', content: '# Design\n' }],
    standardDirs: true,
    wireRoot: true,
    initialCommitMessage: 'Initial version',
    defaultStyleJson: '{}',
    renderStyleTyp: () => '// Penwright style — generated\n',
    git: () => null,   // Git is exercised through the app path; not needed here
  });

  check('standard folders exist', fs.existsSync(path.join(dir, 'assets')) && fs.existsSync(path.join(dir, 'sources')));
  check('.penwright skeleton exists', fs.existsSync(path.join(dir, '.penwright', 'ai-snapshots')));
  check('skills are deployed', fs.existsSync(path.join(dir, '.claude', 'skills', 'design', 'SKILL.md')));
  check('the report names them', res.skillsWritten.length === 2);
  check('style.typ was created', fs.existsSync(path.join(dir, 'style.typ')));
  check('the root was wired to apply it', fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8').includes('style.typ'));

  const ignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
  check('.gitignore covers Penwright state', ignore.includes('.penwright/') && ignore.includes('.penwright-*'));
  check('…and the OS noise the MCP version used to omit', ignore.includes('.DS_Store'));

  // Idempotent, and it must not overwrite a customised skill.
  fs.writeFileSync(path.join(dir, '.claude', 'skills', 'design', 'SKILL.md'), 'MY OWN NOTES');
  const again = await scaffoldProject({
    dir, skills: [{ slug: 'typst', content: '# Typst\n' }, { slug: 'design', content: '# Design\n' }],
    standardDirs: true, wireRoot: true, initialCommitMessage: 'x', defaultStyleJson: '{}',
    renderStyleTyp: () => 'REGENERATED', git: () => null,
  });
  check('a customised skill survives a second run', fs.readFileSync(path.join(dir, '.claude', 'skills', 'design', 'SKILL.md'), 'utf-8') === 'MY OWN NOTES');
  check('nothing is reported as newly written', again.skillsWritten.length === 0);
  check('an existing style.typ is not regenerated', !fs.readFileSync(path.join(dir, 'style.typ'), 'utf-8').includes('REGENERATED'));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nA hand-designed project gets nothing forced on it');
{
  const dir = tmp('pw-handmade-');
  const authored = '#let cover(title) = block[#title]\n#let insight(body) = body\n';
  fs.writeFileSync(path.join(dir, 'Angebot.typ'), '#import "style.typ": *\n\n= Angebot\n');
  fs.writeFileSync(path.join(dir, 'style.typ'), authored);

  await scaffoldProject({
    dir, skills: [], wireRoot: true, initialCommitMessage: 'x',
    defaultStyleJson: '{"colors":{}}',
    renderStyleTyp: () => '// GENERATED — would destroy the macros\n',
    git: () => null,
  });

  check('the authored style.typ is untouched', fs.readFileSync(path.join(dir, 'style.typ'), 'utf-8') === authored);
  check(
    'and no style.json is created (it used to disarm the guard)',
    !fs.existsSync(path.join(dir, '.penwright', 'style.json')),
  );

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n.gitignore is extended, never replaced');
{
  const dir = tmp('pw-ignore-');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\nmy-secret-notes/\n');
  const plan = planGitignore(dir);
  check('the plan keeps what was there', !!plan && plan.content.includes('my-secret-notes/'));
  check('and adds what was missing', !!plan && plan.content.includes('.penwright/'));

  fs.writeFileSync(path.join(dir, '.gitignore'), plan!.content);
  check('a second pass is a no-op', planGitignore(dir) === null);

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n"Save Version" does not quietly restructure someone\'s folder');
{
  // ensureProjectInfrastructure is reachable from git:ensureRepo. On a folder
  // the user opened from outside Penwright, saving a version must add the
  // repo and the .penwright skeleton — and nothing else they did not ask for.
  const dir = tmp('pw-saveversion-');
  fs.writeFileSync(path.join(dir, 'Sichtbarkeitskonzept.typ'), '= Konzept\n');

  await scaffoldProject({
    dir, skills: [], standardDirs: false, wireRoot: false,
    initialCommitMessage: 'First version',
    defaultStyleJson: '{}', renderStyleTyp: () => '// generated\n', git: () => null,
  });

  check('no assets/ or sources/ appear', !fs.existsSync(path.join(dir, 'assets')) && !fs.existsSync(path.join(dir, 'sources')));
  check('no .claude/ appears', !fs.existsSync(path.join(dir, '.claude')));
  check('but the .penwright skeleton does', fs.existsSync(path.join(dir, '.penwright', 'backups')));
  check('and .gitignore does', fs.existsSync(path.join(dir, '.gitignore')));
  check(
    'and the root is NOT restyled',
    fs.readFileSync(path.join(dir, 'Sichtbarkeitskonzept.typ'), 'utf-8') === '= Konzept\n',
  );

  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 5. An image never destroys one already there ───────────────────

console.log('\nAn imported image never overwrites a different one');
{
  const dir = tmp('pw-assets-');
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });

  const first = placeAsset(dir, 'photo.png', Buffer.from('AAAA'));
  check('lands in assets/', first.rel === 'assets/photo.png');

  const same = placeAsset(dir, 'photo.png', Buffer.from('AAAA'));
  check('identical content is reused, not duplicated', same.reused && same.rel === 'assets/photo.png');

  const different = placeAsset(dir, 'photo.png', Buffer.from('BBBB'));
  check('a different image gets its own name', different.rel === 'assets/photo-2.png');
  check(
    'and the first one is still intact — this used to be silently destroyed',
    fs.readFileSync(first.abs, 'utf-8') === 'AAAA',
  );

  // The path written into a chapter must be relative to THAT file, or Typst
  // looks for chapters/assets/… and the whole document stops compiling.
  const chapter = path.join(dir, 'chapters', '01.typ');
  check('the path is relative to the file that will contain it', assetPathFrom(chapter, first.abs) === '../assets/photo.png');
  check('and to the root when the root is the target', assetPathFrom(path.join(dir, 'main.typ'), first.abs) === 'assets/photo.png');

  check('a traversing name is refused', safeAssetName('../../etc/passwd') === 'passwd');
  check('an empty name is refused', safeAssetName('..') === null);

  const src = path.join(dir, 'src.png');
  fs.writeFileSync(src, 'CCCC');
  check('placing from a path works too', placeAssetFromPath(dir, src).rel === 'assets/src.png');

  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 6. The back-channel reports and is ignorable ───────────────────

console.log('\nThe agent can say what it is doing, and be ignored');
{
  const dir = tmp('pw-activity-');
  fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });

  writeAgentActivity(dir, 'apply_palette · style.typ', ['style.typ']);
  const live = readAgentActivity(dir);
  check('round-trips', live?.what === 'apply_palette · style.typ' && live.files[0] === 'style.typ');

  // A crashed agent must not leave "rewriting chapter 3" on screen forever.
  const raw = JSON.parse(fs.readFileSync(agentActivityPath(dir), 'utf-8'));
  fs.writeFileSync(agentActivityPath(dir), JSON.stringify({ ...raw, pid: 999999 }));
  check('a dead process is not shown', readAgentActivity(dir) === null);

  fs.writeFileSync(agentActivityPath(dir), JSON.stringify({ ...raw, updatedAt: Date.now() - 10 * 60 * 1000 }));
  check('a stale record clears itself', readAgentActivity(dir) === null);

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
