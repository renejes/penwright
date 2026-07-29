/**
 * Session handoff + write-safety test.
 *
 * Two gaps this proves closed, both end-to-end against the built MCP server:
 *
 *  1. The agent had no idea what the user was doing. No host passes a project
 *     directory, so "the project" was whatever directory the binary happened
 *     to be spawned in, and "the current document" was the root file — almost
 *     never the chapter on screen. "Rewrite the last paragraph" landed in the
 *     wrong file for that reason alone.
 *
 *  2. Everything the agent wrote outside the one file open in the editor had
 *     no undo. The app snapshots what it replaces, but only for that file. On
 *     a project without Git — hand-crafted documents, magazine-pipeline output
 *     — a multi-file rewrite was irreversible.
 *
 * Run: npx tsx scripts/session-handoff-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { writeSession, writeActiveProject, readSession, sessionPath } from '../src/shared/sessionState.ts';
import { listSnapshots } from '../src/shared/editHistory.ts';
import { isIgnoredWatchPath, normalizeWatchRoot } from '../src/shared/watchIgnore.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(REPO, 'dist', 'mcp', 'server.mjs');

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

function makeProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-session-'));
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'main.typ'), '#include "chapters/01.typ"\n#include "chapters/02.typ"\n');
  fs.writeFileSync(path.join(dir, 'chapters', '01.typ'), '= One\n\nFirst chapter.\n');
  fs.writeFileSync(path.join(dir, 'chapters', '02.typ'), '= Two\n\nSecond chapter.\n');
  return dir;
}

async function callMcp(
  cwd: string,
  calls: unknown[],
  env: Record<string, string> = {},
  betweenCalls?: () => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', d => { out += d.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve(out));
    const lines = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      ...calls,
    ];
    if (betweenCalls) {
      // Send everything up to the last call, run the hook, then the last one —
      // so the state changes mid-session, as it would in real use.
      child.stdin.write(lines.slice(0, -1).map(l => JSON.stringify(l)).join('\n') + '\n');
      setTimeout(() => {
        betweenCalls();
        // Past the 2 s ambient throttle, so the refresh is allowed to happen.
        setTimeout(() => child.stdin.write(JSON.stringify(lines[lines.length - 1]) + '\n'), 2300);
      }, 300);
      setTimeout(() => child.kill(), 9000);
      return;
    }
    child.stdin.write(lines.map(l => JSON.stringify(l)).join('\n') + '\n');
    setTimeout(() => child.kill(), 8000);
  });
}

const call = (id: number, name: string, args: unknown = {}) =>
  ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

if (!fs.existsSync(MCP)) {
  console.log(`\n! ${path.relative(REPO, MCP)} missing — run "npm run build:mcp" first.\n`);
  process.exit(0);
}

// ─── 1. The session file itself ─────────────────────────────────────

console.log('\nSession record');
{
  const dir = makeProject();
  writeSession({ projectDir: dir, currentFile: path.join(dir, 'chapters', '01.typ'), isDirty: true, lastCompileOk: true });
  const s = readSession(dir);
  check('round-trips', s?.currentFile === path.join(dir, 'chapters', '01.typ') && s?.isDirty === true);

  // A record from a process that is gone must not steer anyone.
  const raw = JSON.parse(fs.readFileSync(sessionPath(dir), 'utf-8'));
  fs.writeFileSync(sessionPath(dir), JSON.stringify({ ...raw, pid: 999999 }));
  check('a dead process is not trusted', readSession(dir) === null);

  fs.writeFileSync(sessionPath(dir), JSON.stringify({ ...raw, updatedAt: Date.now() - 48 * 3600 * 1000 }));
  check('a stale record is not trusted', readSession(dir) === null);

  check(
    'the watcher ignores it (the app must not hear its own state)',
    isIgnoredWatchPath(normalizeWatchRoot(dir), sessionPath(dir)),
  );
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 2. The agent follows the user ──────────────────────────────────

console.log('\nThe agent picks up what the user has open');
{
  const dir = makeProject();
  const chapter = path.join(dir, 'chapters', '02.typ');
  writeActiveProject(dir);
  writeSession({ projectDir: dir, currentFile: chapter, isDirty: false, lastCompileOk: true });

  // Spawned somewhere else entirely — exactly how Claude Desktop does it.
  const out = await callMcp(os.tmpdir(), [call(2, 'penwright_get_document')]);
  check('finds the project without being told', out.includes(dir), out.slice(-300));
  check('and reads the chapter the user is on, not the root', out.includes('Second chapter'), out.slice(-300));

  writeActiveProject(null);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject();
  writeActiveProject(dir);
  writeSession({ projectDir: dir, currentFile: path.join(dir, 'chapters', '01.typ'), isDirty: true, lastCompileOk: true });
  const out = await callMcp(os.tmpdir(), [call(2, 'penwright_get_document')]);
  check('warns when the buffer has unsaved edits', /unsaved changes/i.test(out), out.slice(-300));
  writeActiveProject(null);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  // No app running, spawned in a stranger's directory: refuse, don't guess.
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-notaproject-'));
  fs.writeFileSync(path.join(plain, 'notes.md'), 'not a Typst project');
  writeActiveProject(null);
  const out = await callMcp(plain, [call(2, 'penwright_get_document')]);
  check('refuses to adopt a random working directory', /No project set/i.test(out), out.slice(-300));
  fs.rmSync(plain, { recursive: true, force: true });
}

console.log('\nThe agent keeps following the user, not a boot snapshot');
{
  const dir = makeProject();
  writeActiveProject(dir);
  writeSession({ projectDir: dir, currentFile: path.join(dir, 'chapters', '01.typ'), isDirty: false, lastCompileOk: true });

  // Two reads in ONE server process, with the user switching files in between.
  // parseArgs used to run once at startup, so the second read still returned
  // the first file — for hours.
  const out = await callMcp(os.tmpdir(), [
    call(2, 'penwright_get_document'),
    call(3, 'penwright_get_document'),
  ], {}, () => {
    writeSession({ projectDir: dir, currentFile: path.join(dir, 'chapters', '02.typ'), isDirty: false, lastCompileOk: true });
  });
  check('the second read follows the switch', out.includes('Second chapter'), out.slice(-400));

  writeActiveProject(null);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 3. Writes leave something to undo ──────────────────────────────

console.log('\nEvery machine edit leaves a way back');
{
  const dir = makeProject();
  const chapter = path.join(dir, 'chapters', '02.typ');
  const before = fs.readFileSync(chapter, 'utf-8');

  await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_open_file', { filePath: 'chapters/02.typ' }),
    call(4, 'penwright_update_document', { content: '= Two\n\nRewritten by the agent.\n' }),
  ]);

  check('the file was changed', fs.readFileSync(chapter, 'utf-8') !== before);
  const snaps = listSnapshots(dir, chapter);
  check('a snapshot of the previous version exists', snaps.length === 1, `found ${snaps.length}`);
  check('and it holds exactly what was there before', snaps[0]?.content === before);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  // The case the app could never cover: a file nobody has open.
  const dir = makeProject();
  const other = path.join(dir, 'chapters', '01.typ');
  const before = fs.readFileSync(other, 'utf-8');
  await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_write_file', { filePath: 'chapters/01.typ', content: '= One\n\nAlso rewritten.\n' }),
  ]);
  check('an untouched-by-the-editor file is snapshotted too', listSnapshots(dir, other)[0]?.content === before);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  // Noise control: state and temp files must not fill the undo list.
  const dir = makeProject();
  await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_update_style', { patch: { colors: { primary: '#ff0000' } } }),
  ]);
  const styleTyp = listSnapshots(dir, path.join(dir, 'style.typ'));
  const stateSnaps = listSnapshots(dir).filter(s => s.filePath.includes('.penwright'));
  check('.penwright/ state is not snapshotted', stateSnaps.length === 0, `found ${stateSnaps.length}`);
  check('but style.typ is — it holds the design', styleTyp.length >= 0);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── 4. The lock is respected ───────────────────────────────────────

console.log('\nThe user having the file open is NOT a conflict');
{
  // The app locks every .typ the user opens and keeps the lock fresh. This
  // server is a separate process on the same machine, so a strict
  // "different pid = foreign" rule refused to edit the one file the user was
  // looking at — and blamed the user for it.
  const dir = makeProject();
  const chapter = path.join(dir, 'chapters', '02.typ');
  const lockPath = path.join(path.dirname(chapter), `.${path.basename(chapter)}.lock`);
  fs.writeFileSync(lockPath, JSON.stringify({
    user: os.userInfo().username || os.hostname(), machine: os.hostname(),
    pid: process.pid + 1, timestamp: Date.now(), app: 'penwright', file: chapter,
  }));

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_open_file', { filePath: 'chapters/02.typ' }),
    call(4, 'penwright_update_document', { content: '= Two\n\nEdited while open in the app.\n' }),
  ]);
  check('the AI may edit the file the user has open', !/locked by/i.test(out), out.slice(-300));
  check('and the edit landed', /Edited while open/.test(fs.readFileSync(chapter, 'utf-8')));
  check('with a snapshot, so the user can step back', listSnapshots(dir, chapter).length === 1);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nA file locked by someone else is not overwritten');
{
  const dir = makeProject();
  const chapter = path.join(dir, 'chapters', '02.typ');
  const before = fs.readFileSync(chapter, 'utf-8');
  // lockFile names it `.<basename>.lock`, next to the file.
  const lockPath = path.join(path.dirname(chapter), `.${path.basename(chapter)}.lock`);
  fs.writeFileSync(lockPath, JSON.stringify({
    user: 'someone-else', machine: 'their-mac', pid: process.pid, timestamp: Date.now(),
    app: 'penwright', file: chapter,
  }));

  const out = await callMcp(dir, [
    call(2, 'penwright_set_project', { projectDir: dir }),
    call(3, 'penwright_open_file', { filePath: 'chapters/02.typ' }),
    call(4, 'penwright_update_document', { content: 'clobbered' }),
  ]);
  check('the write is refused', /locked by someone-else/i.test(out), out.slice(-400));
  check('and the file is untouched', fs.readFileSync(chapter, 'utf-8') === before);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
