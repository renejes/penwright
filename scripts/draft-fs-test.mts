/**
 * The agent draft tree reads the project and keeps writes until applyDraft.
 * Verified red: applying before a successful run would touch the file.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyDraft, createDraftFileSystem } from '../src/main/draftFs.ts';

const root = mkdtempSync(join(tmpdir(), 'pw-draft-'));
try {
  mkdirSync(join(root, 'chapters'));
  writeFileSync(join(root, 'chapters', '01.typ'), '= Alt\n');
  const draft = createDraftFileSystem(root);
  const before = await draft.fs.read('/chapters/01.typ');
  assert.equal(before, '= Alt\n');
  await draft.fs.write('/chapters/01.typ', '= Neu\n');
  assert.equal(readFileSync(join(root, 'chapters', '01.typ'), 'utf8'), '= Alt\n');
  assert.equal(await draft.fs.read('/chapters/01.typ'), '= Neu\n');
  const hits = [];
  for await (const hit of draft.fs.grep({ pattern: 'Neu', path: '/chapters' })) hits.push(hit.line);
  assert.deepEqual(hits, ['= Neu']);
  assert.equal(applyDraft(root, draft.changes()), 1);
  assert.equal(readFileSync(join(root, 'chapters', '01.typ'), 'utf8'), '= Neu\n');
  console.log('draft-fs-test: ok');
} finally {
  rmSync(root, { recursive: true, force: true });
}
