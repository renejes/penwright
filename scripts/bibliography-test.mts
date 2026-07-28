/**
 * Bibliography placement test.
 *
 * The two processes disagreed about where a bibliography lives, and both
 * answers were wrong in their own way:
 *
 *   The app put references.bib next to the OPEN file and wrote the
 *   #bibliography call into that same file. With a chapter open that yields
 *   chapters/references.bib — internally consistent, invisible to everything
 *   else, including the agent.
 *
 *   The MCP server put the file at the project root but wrote the call into
 *   whatever file was current. Typst resolves such a path relative to the file
 *   containing the call, so from a chapter it did not resolve and the whole
 *   document stopped compiling.
 *
 * The compile check at the end is the part that matters: it is the failure a
 * user would actually hit.
 *
 * Run: npx tsx scripts/bibliography-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { findBibFiles, planBibliography, BIB_HEADER } from '../src/shared/bibDiscovery.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(REPO, 'dist', 'mcp', 'server.mjs');

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

/** Project with a non-canonical root and a nested bib, like the real ones. */
function makeProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-bib-'));
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Doc\n\n#include "chapters/01.typ"\n');
  fs.writeFileSync(path.join(dir, 'chapters', '01.typ'), '= One\n\nText @smith2020.\n');
  return dir;
}

console.log('\nFinding .bib files');
{
  const dir = makeProject();
  fs.mkdirSync(path.join(dir, 'bib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'bib', 'sources.bib'), '@book{a, title={A}}\n');
  fs.writeFileSync(path.join(dir, 'chapters', 'local.bib'), '@book{b, title={B}}\n');
  fs.writeFileSync(path.join(dir, 'references.bib'), '@book{c, title={C}}\n');

  const found = findBibFiles(dir, path.join(dir, 'chapters', '01.typ')).map(f => path.relative(dir, f));
  check('finds the one at the project root', found.includes('references.bib'), found.join(', '));
  check('finds one next to the open chapter', found.includes(path.join('chapters', 'local.bib')), found.join(', '));
  check('finds one in a nested folder', found.includes(path.join('bib', 'sources.bib')), found.join(', '));
  check('root-level one comes first (nearest wins)', found[0] === 'references.bib', found.join(', '));
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject();
  fs.mkdirSync(path.join(dir, '.penwright', 'backups', 'ts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.penwright', 'backups', 'ts', 'stale.bib'), '@book{old}\n');
  const found = findBibFiles(dir, null);
  check('ignores .penwright/ (a backup is not a bibliography)', found.length === 0, found.join(', '));
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nPlacement');
{
  const dir = makeProject();
  const chapter = path.join(dir, 'chapters', '01.typ');
  const plan = planBibliography({ projectDir: dir, currentFile: chapter });

  check('the .bib goes next to the root, not next to the open chapter',
    plan.bibFile === path.join(dir, 'references.bib'), plan.bibFile);
  check('the #bibliography call goes IN the root',
    plan.callSite === path.join(dir, 'main.typ'), String(plan.callSite));
  check('the path inside the call is relative to the root', plan.callPath === 'references.bib', plan.callPath);
  check('and it is marked as not yet referenced', plan.alreadyReferenced === false);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, 'main.typ'), '= Doc\n\n#bibliography("references.bib")\n');
  check('an existing call is detected, so nothing is added twice',
    planBibliography({ projectDir: dir, currentFile: null }).alreadyReferenced === true);
  fs.rmSync(dir, { recursive: true, force: true });
}
{
  const dir = makeProject();
  fs.mkdirSync(path.join(dir, 'bib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'bib', 'sources.bib'), '@book{a}\n');
  const plan = planBibliography({ projectDir: dir, currentFile: null });
  check('an existing .bib is reused instead of creating a second one',
    plan.bibFile === path.join(dir, 'bib', 'sources.bib') && plan.create === false, plan.bibFile);
  check('and the call path points at it correctly', plan.callPath === 'bib/sources.bib', plan.callPath);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── The failure a user would actually hit ──────────────────────────

console.log('\nEnd-to-end: the document still compiles');
const typst = path.join(REPO, 'resources', 'bin', `typst-${process.arch === 'arm64' ? 'arm64' : 'x64'}-darwin`);
if (!fs.existsSync(MCP) || !fs.existsSync(typst)) {
  console.log('  ! built MCP server or bundled typst missing — skipped');
} else {
  const dir = makeProject();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], {
      cwd: dir,
      env: { ...process.env, PENWRIGHT_TRIAL_UNTIL: '99999999999999' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.on('error', reject);
    child.on('close', () => resolve());
    const calls = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'penwright_set_project', arguments: { projectDir: dir } } },
      // The decisive step: the agent is working IN a chapter.
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'penwright_open_file', arguments: { filePath: 'chapters/01.typ' } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'penwright_add_citation', arguments: { bibtex: '@book{smith2020, title={A Book}, author={Smith}, year={2020}}' } } },
    ];
    child.stdin.write(calls.map(c => JSON.stringify(c)).join('\n') + '\n');
    setTimeout(() => child.kill(), 8000);
  });

  const rootSrc = fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8');
  const chapterSrc = fs.readFileSync(path.join(dir, 'chapters', '01.typ'), 'utf-8');
  check('the .bib landed at the project root', fs.existsSync(path.join(dir, 'references.bib')));
  check('the #bibliography call is in the root', /#bibliography\("references\.bib"\)/.test(rootSrc), rootSrc);
  check('and NOT in the chapter the agent had open', !/#bibliography/.test(chapterSrc), chapterSrc);

  let compiled = true, err = '';
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
  check('the document compiles', compiled, err);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
