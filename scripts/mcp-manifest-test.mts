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

/** Runs tool calls in a throwaway project and returns the raw stdout. */
async function callMcp(cwd: string, calls: { id: number }[]): Promise<string> {
  const lastId = Math.max(...calls.map(c => c.id));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let settled = false;
    const finish = () => { if (settled) return; settled = true; clearTimeout(cap); child.kill(); resolve(out); };
    const cap = setTimeout(finish, 45000);
    child.stdout.on('data', d => {
      out += d.toString();
      if (new RegExp(`"id":${lastId}(\\D|$)`).test(out)) setTimeout(finish, 50);
    });
    child.on('error', reject);
    child.on('close', finish);
    child.stdin.write([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      ...calls.map(c => JSON.stringify(c)),
    ].join('\n') + '\n');
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

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
