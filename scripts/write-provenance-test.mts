/**
 * Write-provenance test.
 *
 * Reproduces the lost-update the 3-second watcher guard used to produce, and
 * proves the content-hash replacement does not.
 *
 * The old rule was "ignore any change within 3 s of any save of mine". It was
 * global (a save to chapter 1 silenced a foreign write to chapter 7) and it
 * discarded rather than deferred, so a write the AI made while the user was
 * typing vanished: no editor update, no snapshot, no recompile — and the next
 * autosave put the stale buffer back over it.
 *
 * Run: npx tsx scripts/write-provenance-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import {
  noteDiskContent,
  noteDeleted,
  isKnownContent,
  wasDeletedByUs,
  writeFileTracked,
  inspectBeforeWrite,
  forgetAll,
  hashContent,
  hasRecord,
  noteDiskContent,
} from '../src/shared/fileWrite.ts';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-prov-'));
const file = path.join(tmp, 'chapter.typ');
const other = path.join(tmp, 'other.typ');

console.log('\nOwn writes are recognised');
{
  writeFileTracked(file, 'A');
  check('right after writing', isKnownContent(file, fs.readFileSync(file, 'utf-8')));

  // The decisive difference to the clock: time does not matter.
  const stamp = Date.now() - 10 * 60 * 1000;
  fs.utimesSync(file, stamp / 1000, stamp / 1000);
  check('still ten minutes later', isKnownContent(file, fs.readFileSync(file, 'utf-8')));

  // And repeated events for one write are fine — the record is not consumed.
  check('twice in a row', isKnownContent(file, fs.readFileSync(file, 'utf-8')));
}

console.log('\nForeign writes are NOT swallowed');
{
  writeFileTracked(file, 'A');
  fs.writeFileSync(file, 'B');   // somebody else, e.g. the MCP server
  check('a foreign change is seen', !isKnownContent(file, fs.readFileSync(file, 'utf-8')));
}
{
  // The core regression: the old guard was global, so ANY recent save of ours
  // silenced a foreign write to a DIFFERENT file.
  writeFileTracked(file, 'user typing');
  fs.writeFileSync(other, 'AI wrote this');
  check(
    'a save to one file does not silence another file',
    !isKnownContent(other, fs.readFileSync(other, 'utf-8')),
  );
}
{
  // Byte-identical content is nothing to pick up — but ONLY while the record
  // still describes the disk. That is the invariant the whole module rests on.
  writeFileTracked(file, 'same');
  fs.writeFileSync(file, 'same');
  check('identical content is already known (nothing to do)', isKnownContent(file, fs.readFileSync(file, 'utf-8')));
}
{
  // The regression the first version had: after adopting a foreign change the
  // record still named OUR last write, so a revert BACK to it was classified as
  // known and swallowed — exactly the failure class this module removes.
  writeFileTracked(file, 'A2');
  fs.writeFileSync(file, 'B');
  noteDiskContent(file, fs.readFileSync(file));      // watcher adopts the change
  fs.writeFileSync(file, 'A2');                      // somebody reverts
  check(
    'a revert to our earlier content is NOT swallowed',
    !isKnownContent(file, fs.readFileSync(file, 'utf-8')),
    'the record must describe the disk, not our last write',
  );
}

console.log('\nBinary content');
{
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const asset = path.join(tmp, 'x.png');
  writeFileTracked(asset, png);
  check('buffers hash the same way', isKnownContent(asset, fs.readFileSync(asset)));
  check('hash is content-based, not reference-based', hashContent(png) === hashContent(Buffer.from('89504e470d0a1a0a', 'hex')));
}

console.log('\nDeletes');
{
  writeFileTracked(file, 'A');
  fs.unlinkSync(file);
  noteDeleted(file);
  check('our own delete is recognised once', wasDeletedByUs(file));
  check('and only once', !wasDeletedByUs(file));
}

console.log('\ninspectBeforeWrite — the save-time collision check');
{
  // Unknown is not foreign. A file we only ever read, or a Save-As target the
  // user picked and confirmed, must not be reported as a collision — that
  // pushed a phantom entry onto the AI-undo stack, and one click on
  // "Undo AI Edit" then threw away the whole session.
  const fresh = path.join(tmp, 'never-tracked.typ');
  fs.writeFileSync(fresh, 'content we never recorded');
  check('a path with no record is not a collision', inspectBeforeWrite(fresh).foreign === false);
  check('and hasRecord says so', hasRecord(fresh) === false);
}
{
  writeFileTracked(file, 'ours');
  check('no conflict when the file still holds our bytes', inspectBeforeWrite(file).foreign === false);

  fs.writeFileSync(file, 'theirs');
  const r = inspectBeforeWrite(file);
  check('conflict when somebody else wrote', r.foreign === true);
  check('and it hands back their content so it can be snapshotted', r.content === 'theirs');

  fs.unlinkSync(file);
  check('a missing file is not a conflict', inspectBeforeWrite(file).foreign === false);
}

console.log('\nProject boundary');
{
  writeFileTracked(other, 'X');
  forgetAll();
  check(
    'provenance does not survive a project close',
    !isKnownContent(other, fs.readFileSync(other, 'utf-8')),
    'a path in the next project must never be mistaken for one we wrote in this one',
  );
}

console.log('\nWatcher wiring (source assertions)');
{
  const fm = fs.readFileSync(path.join(REPO, 'src', 'main', 'fileManager.ts'), 'utf-8');
  check('the 3-second guard is gone', !/lastSaveTimestamp/.test(fm));
  check('the change handler compares content', /isKnownContent\(changedPath, disk\)/.test(fm));
  check('openFile records what it read', /noteDiskContent\(filePath, appState\.currentContent\)/.test(fm));
  check('the record is kept current after adopting a change', /noteDiskContent\(changedPath, disk\)/.test(fm));
  // Behaviour is covered properly in scripts/watch-ignore-test.mts, against
  // the real chokidar. Here we only guard against a relapse into the glob
  // array, which chokidar 4 silently ignores.
  check('ignored is a predicate, not dead globs', /ignored: \(p: string\) => isIgnoredWatchPath\(/.test(fm));
  check('no glob strings left in the watcher config', !/ignored:\s*\[/.test(fm));
  check('a content change no longer rebuilds the file tree', !/if \(isText\) \{\s*\n\s*scheduleFiletreeRefresh/.test(fm));
  check('recompile is not limited to the open file', /affectsCompiledOutput\(changedPath\)\)\s*scheduleRecompile\(\)/.test(fm));
  check('saveFile checks for a foreign change first', /inspectBeforeWrite\(appState\.currentFilePath\)/.test(fm));
  check('watcher depth was raised', /depth:\s*6/.test(fm));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
