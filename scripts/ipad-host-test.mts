/**
 * iPad writing host: the file on disk is the serializer's string, and a second
 * open does not rewrite it. Also the refusals (dot paths, Easy Writing
 * derivation) and the Mac adapter still winning when the iPad flag is absent.
 *
 * Run: npx tsx scripts/ipad-host-test.mts
 */

import assert from 'node:assert/strict';
import { serializeTypst } from '../src/editor/lib/serializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { adapterKind } from '../src/shared/hostKind.ts';
import { bytesToBase64, IpadProject, type HostMessage } from '../src/ipad/session.ts';
import type { DirItem, ProjectFs } from '../src/ipad/projectFs.ts';
import {
  bibReadOrder,
  bytesForDisk,
  chooseInitialTyp,
  entryKind,
  joinRel,
  relativeBetween,
  saveRefusal,
} from '../src/ipad/writingSurface.ts';
import { collectVersions, sourceOfVersion, suggestVersionName, swapped, versionFileRel } from '../src/shared/chapterVersions.ts';
import { snapshotFileName } from '../src/shared/editHistory.ts';
import { aiSnapshotDiskName } from '../src/ipad/recovery.ts';

const chapter = 'chapters/roman.typ';
const source = `= Kapitel

Ein Satz mit @einstein1905.
`;

const bib = `@book{einstein1905,
  author = {Einstein, Albert},
  title = {Zur Elektrodynamik bewegter Körper},
  year = {1905}
}
`;

function memoryFs(initial: Record<string, string>): ProjectFs & { text: Map<string, string> } {
  const text = new Map(Object.entries(initial));
  const bin = new Map<string, Uint8Array>();
  const dirs = new Set<string>(['']);
  for (const key of text.keys()) {
    const parts = key.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  function ensureDir(path: string) {
    if (!path) return;
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  return {
    text,
    async readText(path) {
      const value = text.get(path);
      if (value === undefined) throw new Error(`missing ${path}`);
      return value;
    },
    async writeText(path, contents) {
      ensureDir(path.split('/').slice(0, -1).join('/'));
      text.set(path, contents);
    },
    async writeBytes(path, data) {
      ensureDir(path.split('/').slice(0, -1).join('/'));
      bin.set(path, new Uint8Array(data));
      text.set(path, 'binary');
    },
    async readBytes(path) {
      const value = bin.get(path);
      if (!value) throw new Error(`missing ${path}`);
      return value;
    },
    async readDir(path) {
      const prefix = path ? `${path}/` : '';
      const names = new Set<string>();
      const items: DirItem[] = [];
      for (const dir of dirs) {
        if (dir === path) continue;
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (rest.includes('/')) continue;
        names.add(rest);
        items.push({ name: rest, path: dir, isDir: true });
      }
      for (const file of text.keys()) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        if (!rest || rest.includes('/') || names.has(rest)) continue;
        items.push({ name: rest, path: file, isDir: false });
      }
      return items;
    },
    async mkdir(path) {
      ensureDir(path);
    },
    async exists(path) {
      return text.has(path) || bin.has(path) || dirs.has(path);
    },
    async remove(path) {
      text.delete(path);
      bin.delete(path);
    },
    async removeDir(path) {
      const prefix = `${path}/`;
      for (const key of [...text.keys()]) {
        if (key === path || key.startsWith(prefix)) text.delete(key);
      }
      for (const key of [...bin.keys()]) {
        if (key === path || key.startsWith(prefix)) bin.delete(key);
      }
      for (const dir of [...dirs]) {
        if (dir === path || dir.startsWith(prefix)) dirs.delete(dir);
      }
    },
  };
}

const messages: HostMessage[] = [];
const fs = memoryFs({
  [chapter]: source,
  'references.bib': bib,
  '.penwright/typeset/roman.typ': 'derived',
  'main.typ': '= Root\n',
});
const project = new IpadProject(fs, (msg) => messages.push(msg));

assert.equal(adapterKind({ ipad: false, electron: true, vscode: false }), 'electron');
assert.equal(adapterKind({ ipad: true, electron: true, vscode: true }), 'ios');
assert.equal(saveRefusal('chapters/roman.typ'), null);
assert.equal(saveRefusal('.penwright/typeset/roman.typ'), 'typeset');
assert.equal(saveRefusal('.penwright/lock'), 'dotpath');
assert.equal(chooseInitialTyp(['chapters/roman.typ', 'main.typ', '.penwright/typeset/x.typ']), 'main.typ');
assert.equal(chooseInitialTyp(['style.typ', 'chapters/01.typ']), 'chapters/01.typ');
assert.equal(entryKind('chapters'), 'probe');
assert.equal(entryKind('style.typ'), 'file');
assert.equal(entryKind('.git'), 'skip');
assert.equal(entryKind('versions'), 'skip');
assert.deepEqual(bibReadOrder(['notes.bib', 'zotero.bib', 'references.bib']), ['references.bib', 'zotero.bib', 'notes.bib']);
assert.equal(relativeBetween(chapter, 'assets/bild.png'), '../assets/bild.png');
assert.equal(joinRel('chapters', '../assets/bild.png'), 'assets/bild.png');
assert.equal(joinRel('chapters', '../../etc/passwd'), null);

const once = serializeTypst(deserializeTypst(source) as never);
const twice = serializeTypst(deserializeTypst(once) as never);
assert.equal(twice, once, 'Mac reopen must not rewrite the saved chapter');
assert.equal(bytesForDisk(once), once);

await project.activate('Roman');
assert.equal(project.currentRel, 'main.typ');

await project.openRel(chapter);
assert.equal(project.currentContent, source, 'open returns the file bytes, not a reserialize');

const citations = messages.filter((m) => m.type === 'citationData').pop();
const entries = citations?.entries as Array<{ citekey: string }>;
assert.ok(entries?.some((e) => e.citekey === 'einstein1905'));

await project.edit(once);
assert.equal(fs.text.get(chapter), once, 'disk holds the serializer output');
assert.equal(serializeTypst(deserializeTypst(fs.text.get(chapter)!) as never), once);

await project.edit(once);
assert.equal(fs.text.get(chapter), once);

await assert.rejects(() => project.writeTextFile('.penwright/typeset/roman.typ', 'nope'));
assert.equal(fs.text.get('.penwright/typeset/roman.typ'), 'derived');

const tree = await project.listTree();
const flat = JSON.stringify(tree.entries);
assert.equal(flat.includes('typeset'), false);
assert.equal(flat.includes('roman.typ'), true);

const placed = await project.placeImage('foto.png', new Uint8Array([1, 2, 3]));
assert.equal(placed, '../assets/foto.png');
assert.ok(fs.text.has('assets/foto.png'));

const suggested = suggestVersionName(chapter, [], new Date(2026, 9, 10));
assert.equal(suggested, 'roman_V1_2026_10_10');
assert.equal(suggestVersionName(chapter, [`${suggested}.typ`], new Date(2026, 9, 10)), 'roman_V2_2026_10_10');
assert.equal(await project.suggestVersion(chapter), suggestVersionName(chapter, []));

const beforeChapter = fs.text.get(chapter);
const created = await project.createVersion(chapter, suggested, source);
assert.equal(created.ok, true);
const versionRel = versionFileRel(chapter, suggested);
assert.equal(created.path, versionRel);
assert.equal(fs.text.get(versionRel!), source);
assert.equal(fs.text.get(chapter), beforeChapter, 'saving a version leaves the chapter untouched');

const groups = await project.listVersions();
assert.equal(groups.length, 1);
assert.equal(groups[0].source, chapter);
assert.equal(groups[0].versions[0].name, suggested);
assert.equal(sourceOfVersion(versionRel!), chapter);

const again = await project.createVersion(chapter, suggested, 'other');
assert.equal(again.ok, false);
assert.equal(again.error, 'exists');

project.currentRel = chapter;
project.currentContent = source;
const swappedOnce = await project.swapVersion(versionRel!, 'live-now', 'version-then');
assert.equal(swappedOnce.ok, true);
assert.equal(fs.text.get(chapter), 'version-then');
assert.equal(fs.text.get(versionRel!), 'live-now');
assert.equal(project.currentContent, 'version-then');
assert.deepEqual(swapped('live-now', 'version-then'), { live: 'version-then', version: 'live-now' });

const renamed = await project.renameVersion(versionRel!, 'Entwurf');
assert.equal(renamed.ok, true);
assert.equal(fs.text.has(versionRel!), false);
assert.equal(fs.text.get(renamed.path!), 'live-now');

const removed = await project.deleteVersion(renamed.path!);
assert.equal(removed.ok, true);
assert.equal(fs.text.has(renamed.path!), false);
assert.equal((await project.listVersions()).length, 0);

const treeAfter = JSON.stringify((await project.listTree()).entries);
assert.equal(treeAfter.includes('versions'), false);

const pdfBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
assert.equal(bytesToBase64(pdfBytes), Buffer.from(pdfBytes).toString('base64'));
await fs.writeBytes('sources/paper.pdf', pdfBytes);
const before = project.currentRel;
const opened = await project.openRel('sources/paper.pdf');
assert.equal(opened, 'pdfviewer');
assert.equal(project.currentRel, before, 'a PDF tab does not replace the open chapter');
assert.equal(messages.at(-1)?.type, 'openPdfFile');
assert.equal(messages.at(-1)?.path, 'sources/paper.pdf');
assert.equal(await project.readBinaryFile('sources/paper.pdf'), Buffer.from(pdfBytes).toString('base64'));
assert.equal(await project.openRel('sources/notes.docx'), 'mac-only');

const dotted = await collectVersions(async (rel) => {
  if (rel === 'versions') return [{ name: 'main.typ', path: 'versions/main.typ', isDir: false }];
  if (rel === 'versions/main.typ') return [{ name: 'Entwurf.typ', path: 'versions/main.typ/Entwurf.typ', isDir: false }];
  return [];
});
assert.equal(dotted[0]?.source, 'main.typ');
assert.equal(dotted[0]?.versions[0]?.name, 'Entwurf');

await fs.writeText('chapters/eins.typ', '= Eins <sec:eins>\n');
const labels = await project.listLabels();
assert.equal(labels.labels.some((l) => l.label === 'sec:eins' && l.type === 'heading'), true);

assert.equal(aiSnapshotDiskName(1000, chapter), snapshotFileName(1000, `/Users/x/Roman/${chapter}`));
const backup = await project.createProjectBackup(1);
assert.ok(backup);
const stamp = backup!.timestamp;
assert.equal(fs.text.get(`.penwright/backups/${stamp}/main.typ`), '= Root\n');
assert.equal(fs.text.get(`.penwright/backups/${stamp}/${chapter}`), project.currentContent);
assert.equal(fs.text.get(`.penwright/backups/${stamp}/references.bib`), bib);
assert.equal(fs.text.get(`.penwright/backups/${stamp}/chapters/eins.typ`), '= Eins <sec:eins>\n');
assert.equal([...fs.text.keys()].some((key) => key.includes('/backups/') && key.includes('typeset')), false);
assert.equal([...fs.text.keys()].some((key) => key.includes('/backups/') && key.includes('assets/')), false);
assert.equal((await project.projectBackups()).length, 1);

const backedChapter = fs.text.get(`.penwright/backups/${stamp}/${chapter}`);
fs.text.set(chapter, 'changed');
project.currentContent = 'changed';
const restored = await project.restoreBackup(stamp);
assert.equal(restored.ok, true);
assert.equal(fs.text.get(chapter), backedChapter);
assert.equal(project.currentContent, backedChapter);

const second = await project.createProjectBackup(1);
assert.ok(second);
assert.equal((await project.projectBackups()).length, 1);
assert.equal(fs.text.has(`.penwright/backups/${stamp}/.meta.json`), false);

const older = `.penwright/ai-snapshots/${snapshotFileName(1000, chapter)}`;
await fs.writeText(older, JSON.stringify({
  filePath: `/Users/x/Roman/${chapter}`,
  content: 'Kapitel vorher',
  timestamp: 1000,
}));
await fs.writeText('.penwright/ai-snapshots/2000_roman.typ.json', JSON.stringify({
  filePath: `/Users/x/Roman/${chapter}`,
  content: 'neueste Fassung',
  timestamp: 2000,
}));
assert.equal((await project.aiSnapshots())[0].timestamp, 2000);
const undone = await project.undoAiSnapshot();
assert.equal(undone.undone, true);
assert.equal(fs.text.get(chapter), 'neueste Fassung');
assert.equal(project.currentContent, 'neueste Fassung');
assert.equal(fs.text.has('.penwright/ai-snapshots/2000_roman.typ.json'), false);
assert.equal(fs.text.has(older), true);
await project.publishAiLimit(12);
assert.equal(fs.text.get('.penwright/ai-snapshots/.limit'), '12');
await fs.writeText('.penwright/ai-snapshots/3000_gone.typ.json', JSON.stringify({
  filePath: '/Users/x/Roman/chapters/gone.typ',
  content: 'wieder da',
  timestamp: 3000,
}));
const broughtBack = await project.undoAiSnapshot();
assert.equal(broughtBack.undone, true);
assert.equal(fs.text.get('chapters/gone.typ'), 'wieder da');
assert.equal(fs.text.has(older), true);

console.log('ipad-host-test: ok');
