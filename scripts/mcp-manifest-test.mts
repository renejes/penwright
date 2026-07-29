/**
 * What the host actually receives — read off the wire, not off the source.
 *
 * `npm run build:mcp` does not typecheck. A misspelled `annotation:` instead of
 * `annotations:` compiles, bundles, ships, and is invisible until someone
 * wonders why nothing auto-approves. The only honest check is to speak the
 * protocol and look at the reply.
 *
 * Covers: `instructions` present and small enough to prepend to every
 * conversation; every tool carrying a title, a description and a full set of
 * annotations; the read/write classification being right for a sample whose
 * answers are not debatable; and no `outputSchema` anywhere (declaring one
 * obliges every return to carry `structuredContent`).
 *
 * Run: npx tsx scripts/mcp-manifest-test.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(REPO, 'dist', 'mcp', 'server.mjs');

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

if (!fs.existsSync(MCP)) {
  console.log(`\n! ${path.relative(REPO, MCP)} missing — run "npm run build:mcp" first.\n`);
  process.exit(1);
}

interface Annotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}
interface ToolEntry {
  name: string;
  title?: string;
  description?: string;
  annotations?: Annotations;
  inputSchema?: unknown;
  outputSchema?: unknown;
  _meta?: Record<string, unknown>;
}

/** Speaks initialize + tools/list and returns both replies. */
async function handshake(): Promise<{ init: Record<string, unknown>; tools: ToolEntry[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd: REPO,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let settled = false;
    const cap = setTimeout(() => { if (!settled) { settled = true; child.kill(); reject(new Error('timeout')); } }, 30000);

    child.stdout.on('data', d => {
      out += d.toString();
      if (!/"id":2(\D|$)/.test(out) || settled) return;
      settled = true;
      clearTimeout(cap);
      child.kill();
      const replies = out.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const init = replies.find(r => r.id === 1)?.result ?? {};
      const tools = replies.find(r => r.id === 2)?.result?.tools ?? [];
      resolve({ init, tools });
    });
    child.on('error', reject);

    child.stdin.write([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    ].join('\n') + '\n');
  });
}

const { init, tools } = await handshake();

console.log('\nThe server introduces itself');
{
  const instructions = (init as { instructions?: string }).instructions;
  check('instructions are sent at all', typeof instructions === 'string' && instructions.length > 0,
    'the field existed and was documented for a year before anything passed it');
  const bytes = instructions ? Buffer.byteLength(instructions, 'utf-8') : 0;
  check(`instructions stay small (${bytes} B)`, bytes > 0 && bytes < 2048,
    'they are prepended to every conversation — a tool index belongs in the manifest, not here');

  // The things a tool description cannot say, because they are about the
  // server as a whole. If these drop out, the lever is gone.
  for (const must of ['render_page', 'get_style', 'save_version', 'occurrence', 'Export to Web']) {
    check(`…and still mention ${must}`, !!instructions?.includes(must));
  }
}

console.log('\nEvery tool is classified');
{
  check('the manifest is not empty', tools.length > 0);
  console.log(`  · ${tools.length} tools`);

  const noTitle = tools.filter(t => !t.title && !t.annotations?.title);
  check('every tool has a title', noTitle.length === 0, noTitle.map(t => t.name).join(', '));

  const noDesc = tools.filter(t => !t.description || t.description.length < 20);
  check('every tool has a real description', noDesc.length === 0, noDesc.map(t => t.name).join(', '));

  const noAnn = tools.filter(t => typeof t.annotations?.readOnlyHint !== 'boolean');
  check('every tool has annotations', noAnn.length === 0,
    `${noAnn.map(t => t.name).join(', ')} — a misspelled "annotation:" key looks exactly like this`);

  const partial = tools.filter(t => {
    const a = t.annotations ?? {};
    return ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']
      .some(k => typeof (a as Record<string, unknown>)[k] !== 'boolean');
  });
  check('…and a COMPLETE set of them', partial.length === 0, partial.map(t => t.name).join(', '));

  const withOutput = tools.filter(t => t.outputSchema);
  check('no tool declares an outputSchema', withOutput.length === 0,
    `${withOutput.map(t => t.name).join(', ')} — it obliges every return to carry structuredContent`);
}

console.log('\nThe classification is right where it is checkable');
{
  const by = new Map(tools.map(t => [t.name, t]));
  const readOnly = (n: string) => by.get(n)?.annotations?.readOnlyHint;
  const destructive = (n: string) => by.get(n)?.annotations?.destructiveHint;

  // Readers: a host may auto-approve these, so a wrong `true` here is the one
  // mistake in this file with real consequences.
  for (const n of ['penwright_get_document', 'penwright_list_files', 'penwright_get_style',
                   'penwright_list_versions', 'penwright_search_project', 'penwright_render_page',
                   'penwright_compile', 'penwright_merge_document']) {
    check(`${n.replace('penwright_', '')} is read-only`, readOnly(n) === true);
  }

  // Writers.
  for (const n of ['penwright_write_file', 'penwright_apply_palette', 'penwright_add_footnote',
                   'penwright_export_pdf', 'penwright_save_version', 'penwright_split_document']) {
    check(`${n.replace('penwright_', '')} is NOT read-only`, readOnly(n) === false);
  }

  // Destructive: can discard work that is not otherwise recoverable.
  for (const n of ['penwright_restore_version', 'penwright_replace_in_project',
                   'penwright_delete_comment', 'penwright_write_file']) {
    check(`${n.replace('penwright_', '')} is flagged destructive`, destructive(n) === true);
  }

  // A verified-and-rolled-back design change is the opposite of destructive,
  // and saying otherwise would train the user to fear the safest tools here.
  for (const n of ['penwright_apply_palette', 'penwright_apply_layout', 'penwright_apply_style']) {
    check(`${n.replace('penwright_', '')} is NOT destructive (it rolls back)`, destructive(n) === false);
  }

  check('git_push is the only open-world tool',
    tools.filter(t => t.annotations?.openWorldHint).map(t => t.name).join(',') === 'penwright_git_push',
    tools.filter(t => t.annotations?.openWorldHint).map(t => t.name).join(', '));
}

console.log('\nThe few always-loaded tools are the few');
{
  const always = tools.filter(t => t._meta?.['anthropic/alwaysLoad']).map(t => t.name);
  check('there are some', always.length > 0);
  check(`and not many (${always.length})`, always.length <= 6, always.join(', '));
  for (const n of ['penwright_set_project', 'penwright_get_document', 'penwright_compile', 'penwright_get_style']) {
    check(`${n.replace('penwright_', '')} is one of them`, always.includes(n));
  }
}

// ─── The guards that came with the metadata pass ────────────────────

import os from 'node:os';

/**
 * Runs tool calls in a throwaway project and returns the raw stdout.
 *
 * ONE CALL AT A TIME, each awaited before the next is sent. The SDK dispatches
 * concurrently, so writing a whole batch at once means `get_chapters` can run
 * before the `set_project` above it in the list — which is how a batched
 * version of this file produced two convincing "failures" that were nothing
 * but its own ordering. Hosts issue tool calls sequentially; so does this.
 */
async function callMcp(
  cwd: string,
  calls: { id: number }[],
  /** Runs before the call with this id is sent — lets the world change mid-session. */
  before?: { id: number; run: () => Promise<void> | void },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let settled = false;
    let pending = 0;
    let queue = [...calls];

    const finish = () => { if (settled) return; settled = true; clearTimeout(cap); child.kill(); resolve(out); };
    const cap = setTimeout(finish, 60000);

    const sendNext = async () => {
      const next = queue.shift();
      if (!next) { finish(); return; }
      if (before && before.id === next.id) await before.run();
      pending = next.id;
      child.stdin.write(JSON.stringify(next) + '\n');
    };

    child.stdout.on('data', d => {
      out += d.toString();
      if (pending === 0) {
        // Still waiting on `initialize` (id 1).
        if (/"id":1(\D|$)/.test(out)) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          void sendNext();
        }
        return;
      }
      if (new RegExp(`"id":${pending}(\\D|$)`).test(out)) void sendNext();
    });
    child.on('error', reject);
    child.on('close', finish);

    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    }) + '\n');
  });
}
const call = (id: number, name: string, args: unknown = {}) =>
  ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

console.log('\nAn export cannot overwrite the source it was made from');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-exportguard-'));
  const root = path.join(dir, 'main.typ');
  const before = '= Title\n\nThe whole document.\n';
  fs.writeFileSync(root, before);

  // "main.typ" is inside the project, so the sandbox check passed it, Typst
  // wrote a PDF over the document, and the tool reported success.
  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_export_pdf', { outputPath: 'main.typ' }),
  ]);
  check('exporting onto a .typ is refused', out.includes('Refusing to export'), out.slice(-400));
  check('and the source is untouched', fs.readFileSync(root, 'utf-8') === before);

  const bib = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_export_docx', { outputPath: 'refs.bib' }),
  ]);
  check('…the same for a .bib', bib.includes('Refusing to export'), bib.slice(-300));

  const wrong = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_export_docx', { outputPath: 'exports/out.pdf' }),
  ]);
  check('and a .pdf asked of the DOCX exporter', wrong.includes('expected a .docx'), wrong.slice(-300));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nThe low-level git tools stay inside this project');
{
  // A project that is not a repo but sits inside one — the ordinary case for
  // any document folder under a checkout. simpleGit walks UP, so git_commit
  // would have staged and committed the enclosing repository.
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-outerrepo-'));
  const { execFileSync } = await import('node:child_process');
  execFileSync('git', ['init', '-q'], { cwd: outer });
  fs.writeFileSync(path.join(outer, 'someone-elses-work.txt'), 'do not touch');

  const inner = path.join(outer, 'document');
  fs.mkdirSync(inner);
  fs.writeFileSync(path.join(inner, 'main.typ'), '= Title\n');

  const out = await callMcp(inner, [
    call(2, 'penwright_set_project', { projectDir: inner }),
    call(3, 'penwright_git_commit', { message: 'should not happen' }),
  ]);
  check('committing refuses when the repo is not this project', out.includes('not the root of its Git repository') || out.includes('not a Git repository'), out.slice(-400));

  const log = (() => { try { return execFileSync('git', ['log', '--oneline'], { cwd: outer }).toString(); } catch { return ''; } })();
  check('and the enclosing repository has no new commit', log.trim() === '', log);

  const status = await callMcp(inner, [
    call(2, 'penwright_set_project', { projectDir: inner }),
    call(3, 'penwright_git_status', {}),
  ]);
  check('status refuses too, naming the way out', status.includes('penwright_save_version') || status.includes('not the root'), status.slice(-400));

  fs.rmSync(outer, { recursive: true, force: true });
}

console.log('\nCompile leaves nothing behind in the project');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-compiletmp-'));
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Title\n\nBody.\n');
  const typst = ['typst-arm64-darwin', 'typst-x64-darwin']
    .map(n => path.join(REPO, 'resources', 'bin', n)).find(p => fs.existsSync(p));

  if (!typst) {
    console.log('  (bundled Typst not found — skipped)');
  } else {
    await new Promise<void>((resolve) => {
      const child = spawn(process.execPath, [MCP], {
        cwd: dir,
        env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999', TYPST_BIN: typst },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let out = '';
      child.stdout.on('data', d => {
        out += d.toString();
        if (/"id":3(\D|$)/.test(out)) { setTimeout(() => { child.kill(); resolve(); }, 50); }
      });
      setTimeout(() => { child.kill(); resolve(); }, 45000);
      child.stdin.write([
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } }),
        JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        JSON.stringify(call(2, 'penwright_set_project', { projectDir: dir })),
        JSON.stringify(call(3, 'penwright_compile', {})),
      ].join('\n') + '\n');
    });
    const strays = fs.readdirSync(dir).filter(f => f !== 'main.typ');
    check('no verification artefact in the project folder', strays.length === 0, strays.join(', '));
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Block 3: the document-level tools, and the bulk operations ─────

/** The text of one response, rather than a substring of the whole stream. */
function replyText(out: string, id: number): string {
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== id || !msg.result) continue;
      return (msg.result.content ?? [])
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text ?? '').join('\n');
    } catch { /* partial line */ }
  }
  return '';
}

/** A multi-chapter project whose root is NOT called main.typ. */
function chapterProject(): { dir: string; root: string; chapter: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-root-'));
  fs.mkdirSync(path.join(dir, 'chapters'));
  const root = path.join(dir, 'Sichtbarkeitskonzept.typ');
  const chapter = path.join(dir, 'chapters', '01-intro.typ');
  fs.writeFileSync(root, '#set text(lang: "de")\n\n#include "chapters/01-intro.typ"\n');
  fs.writeFileSync(chapter, '= Einleitung\n\nDer erste Absatz.\n');
  return { dir, root, chapter };
}

console.log('\nDocument-level tools act on the document, not on the open chapter');
{
  const { dir, root, chapter } = chapterProject();
  const chapterBefore = fs.readFileSync(chapter, 'utf-8');

  // The user is reading a chapter — which is what state.currentFile means
  // since the session channel landed. Adding a chapter is a change to the
  // DOCUMENT; it used to write the #include into whatever was open.
  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_open_file', { filePath: 'chapters/01-intro.typ' }),
    call(4, 'penwright_add_chapter', { title: 'Methodik' }),
    call(5, 'penwright_get_chapters', {}),
  ]);

  // Specifically the NEW include — `/#include/` alone would have passed on the
  // one that was already there, which is no test at all.
  check('the new #include went into the root', fs.readFileSync(root, 'utf-8').includes('chapters/methodik.typ'), replyText(out, 4));
  check('the open chapter is untouched', fs.readFileSync(chapter, 'utf-8') === chapterBefore);
  check('get_chapters reports the root', replyText(out, 5).includes('Sichtbarkeitskonzept.typ'), replyText(out, 5).slice(0, 300));

  // Settings are document-level too, and get/update must mean the same file.
  const settings = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_open_file', { filePath: 'chapters/01-intro.typ' }),
    call(4, 'penwright_get_settings', {}),
    call(5, 'penwright_update_settings', { settings: { lang: 'en' } }),
  ]);
  check('get_settings reads the root', replyText(settings, 4).includes('Sichtbarkeitskonzept.typ'), replyText(settings, 4));
  check('update_settings writes the root', fs.readFileSync(root, 'utf-8').includes('lang: "en"'), fs.readFileSync(root, 'utf-8').slice(0, 200));
  check('and still not the chapter', !fs.readFileSync(chapter, 'utf-8').includes('lang:'));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nA project with no identifiable root fails loudly');
{
  // No .typ at the top level at all. The old code would have handed back a
  // fabricated <dir>/main.typ — and writing to it creates a file that then
  // WINS root resolution against the project's real root for good.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-noroot-'));
  fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_get_chapters', {}),
  ]);
  check('it says so instead of guessing', /root|No document open|not/i.test(replyText(out, 3)), replyText(out, 3).slice(0, 300));
  check('and no main.typ was fabricated', !fs.existsSync(path.join(dir, 'main.typ')));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nBulk operations are previewable, and the irreversible one asks');
{
  const { dir, root, chapter } = chapterProject();
  const before = fs.readFileSync(chapter, 'utf-8');

  const dry = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_replace_in_project', { query: 'Absatz', replacement: 'Paragraph', dryRun: true }),
  ]);
  const dryText = replyText(dry, 3);
  check('a dry run reports what would change', dryText.includes('"wouldReplace": 1'), dryText.slice(0, 300));
  check('…and writes nothing', fs.readFileSync(chapter, 'utf-8') === before);

  const real = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_replace_in_project', { query: 'Absatz', replacement: 'Paragraph' }),
  ]);
  check('without dryRun it actually replaces', fs.readFileSync(chapter, 'utf-8').includes('Paragraph'), replyText(real, 3).slice(0, 200));

  // restore_version discards uncommitted work with no snapshot to return to —
  // the only tool here that cannot be undone, so the only one that asks.
  const restore = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_restore_version', { sha: 'abc1234' }),
  ]);
  check('restore_version refuses without confirm', replyText(restore, 3).includes('Not restored'), replyText(restore, 3).slice(0, 300));
  check('…and explains how to keep the current state', replyText(restore, 3).includes('penwright_save_version'));
  check('the files are untouched', fs.readFileSync(root, 'utf-8').includes('#include'));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n@-references take a citekey as well as a label');
{
  const { dir, chapter } = chapterProject();
  fs.writeFileSync(path.join(dir, 'references.bib'),
    '@article{chen2021codex,\n  title = {Evaluating Code},\n  author = {Chen, Mark},\n  year = {2021},\n}\n');

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_insert_reference', {
      file: 'chapters/01-intro.typ', afterText: 'Der erste Absatz.', label: 'chen2021codex',
    }),
  ]);
  check('a citekey is accepted', fs.readFileSync(chapter, 'utf-8').includes('@chen2021codex'), replyText(out, 3).slice(0, 300));
  check('…and named as a citation, not a cross-reference', replyText(out, 3).includes('citation'), replyText(out, 3).slice(0, 200));

  const bogus = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_insert_reference', {
      file: 'chapters/01-intro.typ', afterText: 'Der erste Absatz.', label: 'chen2021',
    }),
  ]);
  const bogusText = replyText(bogus, 3);
  check('a near-miss is refused', bogusText.includes('neither a label'), bogusText.slice(0, 300));
  check('…with the citekey it probably meant', bogusText.includes('chen2021codex'), bogusText.slice(0, 300));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nA huge file cannot silently eat the conversation');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-cap-'));
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Title\n');
  fs.writeFileSync(path.join(dir, 'huge.typ'), 'x'.repeat(600_000));

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_read_file', { filePath: 'huge.typ' }),
  ]);
  const text = replyText(out, 3);
  check('the return is capped', text.length < 500_000, `${text.length} chars`);
  check('…and says so, with what to do instead', text.includes('truncated') && text.includes('penwright_search_project'), text.slice(-200));

  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── The parity-audit fixes (session 43) ────────────────────────────

console.log('\nEvery tool sees the project the user actually has open');
{
  // The refresh used to hang off two document helpers, so the ~47 tools that
  // read state.projectDir directly kept whatever the process saw at boot. The
  // sandbox derives from the same value, so a write into a CLOSED project
  // passed its own check.
  const { writeActiveProject } = await import('../src/shared/sessionState.ts');

  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-stale-A-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-stale-B-'));
  for (const d of [a, b]) {
    fs.mkdirSync(path.join(d, '.penwright'), { recursive: true });
    fs.writeFileSync(path.join(d, 'main.typ'), `= ${path.basename(d)}\n\nNutzer everywhere.\n`);
  }

  // A file whose name identifies which project a tool actually looked at.
  fs.writeFileSync(path.join(a, 'ONLY-IN-A.typ'), '= A\n');
  fs.writeFileSync(path.join(b, 'ONLY-IN-B.typ'), '= B\n');

  // ONE process across both calls. A fresh spawn per call re-reads the active
  // project in parseArgs() and would pass whether or not the fix exists — the
  // first version of this check did exactly that and was green against the
  // reverted code. The staleness only exists inside a session, so the switch
  // has to happen inside one.
  writeActiveProject(a);
  const out = await callMcp(
    a,
    [call(2, 'penwright_list_files', {}), call(3, 'penwright_list_files', {})],
    {
      id: 3,
      run: async () => {
        writeActiveProject(b);
        await new Promise(r => setTimeout(r, 2300));   // past the 2 s ambient throttle
      },
    },
  );

  check('a non-document tool finds the active project', replyText(out, 2).includes('ONLY-IN-A'), replyText(out, 2).slice(0, 200));
  check('…and follows the user to the next one, in the SAME session',
    replyText(out, 3).includes('ONLY-IN-B') && !replyText(out, 3).includes('ONLY-IN-A'),
    replyText(out, 3).slice(0, 300));

  writeActiveProject(null);
  for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true });
}

console.log('\nThe design tokens are inside the undo net');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-tokens-'));
  fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'main.typ'), '#import "style.typ": *\n#show: apply-style\n\n= T\n\nBody.\n');

  const typst = ['typst-arm64-darwin', 'typst-x64-darwin']
    .map(n => path.join(REPO, 'resources', 'bin', n)).find(p => fs.existsSync(p));
  if (!typst) {
    console.log('  (bundled Typst not found — skipped)');
  } else {
    await callMcp(dir, [
      call(2, 'penwright_set_project', { projectDir: dir }),
      call(3, 'penwright_apply_palette', { presetId: 'editorial' }),
      call(4, 'penwright_apply_palette', { presetId: 'modern-tech' }),
    ]);
    const snaps = fs.existsSync(path.join(dir, '.penwright', 'ai-snapshots'))
      ? fs.readdirSync(path.join(dir, '.penwright', 'ai-snapshots')).filter(f => f.endsWith('.json'))
      : [];
    const forStyleJson = snaps.filter(f => f.includes('style.json'));
    check('style.json is snapshotted like any other design write', forStyleJson.length > 0,
      `snapshots: ${snaps.join(', ') || 'none'}`);
    check('…and so is style.typ', snaps.some(f => f.includes('style.typ')));
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nChapter tools all mean the same file');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-chapters-'));
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  const root = path.join(dir, 'Konzept.typ');
  const ch = path.join(dir, 'chapters', '01.typ');
  fs.writeFileSync(root, '#include "chapters/01.typ"\n#include "chapters/02.typ"\n');
  fs.writeFileSync(ch, '= Eins\n\nEin Absatz, der "chapters/02.typ" im Fließtext erwähnt.\n');
  fs.writeFileSync(path.join(dir, 'chapters', '02.typ'), '= Zwei\n');

  const chBefore = fs.readFileSync(ch, 'utf-8');
  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_open_file', { filePath: 'chapters/01.typ' }),
    call(4, 'penwright_reorder_chapters', { order: ['chapters/02.typ', 'chapters/01.typ'] }),
  ]);
  const rootAfter = fs.readFileSync(root, 'utf-8');
  check('reorder acts on the root while a chapter is open',
    rootAfter.indexOf('02.typ') < rootAfter.indexOf('01.typ'), rootAfter);
  check('…and does not touch the open chapter', fs.readFileSync(ch, 'utf-8') === chBefore);
  check('…and does not claim a reorder it did not do', !replyText(out, 4).includes('01.typ"\n#include'));

  // The unanchored filter deleted any line merely mentioning the path.
  const rm = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_remove_chapter', { chapterPath: 'chapters/02.typ' }),
  ]);
  check('remove_chapter drops the #include', !fs.readFileSync(root, 'utf-8').includes('#include "chapters/02.typ"'), replyText(rm, 3));
  check('…and leaves prose that merely mentions the path alone',
    fs.readFileSync(ch, 'utf-8').includes('im Fließtext erwähnt'));

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nA document with no chapters says so instead of reporting success');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-nochapters-'));
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Single file\n\nNo includes here.\n');
  const before = fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8');

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_reorder_chapters', { order: ['chapters/a.typ', 'chapters/b.typ'] }),
  ]);
  check('it reports no chapter order to change', replyText(out, 3).includes('no #include'), replyText(out, 3).slice(0, 200));
  check('…and writes nothing', fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8') === before);

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
