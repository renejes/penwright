/**
 * Citation page text and PDF lookup.
 *
 * A linked library opens the PDF from the bib `file` field (a path outside
 * the project) and does not create anything under sources/. A project with
 * no link still resolves only sources/.
 *
 * Run: npx tsx scripts/citation-pdf-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  bibFilePdfPaths,
  formatCitationPage,
  locateCitationPdf,
  pageFieldFromSupplement,
} from '../src/shared/citationPdf.ts';
import { locateIpadCitationPdf } from '../src/shared/zoteroPdfMatch.ts';
import { findSourceForCitation, openCitationPdf } from '../src/main/citationSources.ts';
import { writeZoteroLink } from '../src/main/zoteroLink.ts';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

check('page 12', formatCitationPage('12') === 'S. 12');
check('page range', formatCitationPage('12-14') === 'S. 12–14');
check('page range en dash', formatCitationPage('12–14') === 'S. 12–14');
check('strips f.', formatCitationPage('12 f.') === 'S. 12');
check('strips ff.', formatCitationPage('12 ff.') === 'S. 12');
check('already S.', formatCitationPage('S. 12') === 'S. 12');
check('empty page', formatCitationPage('  ') === null);
check('rejects prose', formatCitationPage('siehe oben') === null);
check('field shows the number', pageFieldFromSupplement('S. 12') === '12');

const parsed = bibFilePdfPaths(': /Users/me/Dropbox/Zotero-PDFs/bandura1977.pdf:application/pdf');
check('bib file field', parsed.length === 1 && parsed[0].endsWith('bandura1977.pdf'), parsed.join('|'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-cite-'));
const project = path.join(root, 'project');
const dropbox = path.join(root, 'Dropbox', 'Zotero-PDFs');
fs.mkdirSync(path.join(project, 'sources'), { recursive: true });
fs.mkdirSync(dropbox, { recursive: true });
const outside = path.join(dropbox, 'bandura1977.pdf');
fs.writeFileSync(outside, '%PDF-1.4\n');
const bib = `@article{bandura1977,
  author = {Bandura, Albert},
  title = {Self-efficacy},
  year = {1977},
  file = {:${outside}:application/pdf}
}
`;
fs.writeFileSync(path.join(project, 'zotero.bib'), bib);
writeZoteroLink(project, { sourceBibPath: path.join(root, 'lib.bib'), pdfMode: 'linked', attachmentDir: dropbox });

const hit = await findSourceForCitation(project, 'bandura1977');
check('linked hit is the dropbox file', hit.path === outside, hit.path ?? 'null');
check('linked hit is outside the project', hit.linked && !hit.inProject);
check('sources stays empty', fs.readdirSync(path.join(project, 'sources')).length === 0);

const opened = await openCitationPdf(project, 'bandura1977');
check('open does not copy', opened === outside && fs.readdirSync(path.join(project, 'sources')).length === 0);

const plain = path.join(root, 'plain');
fs.mkdirSync(path.join(plain, 'sources'), { recursive: true });
fs.writeFileSync(path.join(plain, 'sources', 'bandura1977.pdf'), '%PDF-1.4\n');
const plainHit = await findSourceForCitation(plain, 'bandura1977');
check('no link uses sources/', plainHit.path === path.join(plain, 'sources', 'bandura1977.pdf') && !plainHit.linked);

const folderOnly = path.join(root, 'folder-only');
fs.mkdirSync(path.join(folderOnly, 'sources'), { recursive: true });
fs.writeFileSync(path.join(folderOnly, 'zotero.bib'), '@article{mueller2016, author = {Mueller, A.}, year = {2016}, title = {X}}\n');
const named = path.join(dropbox, 'mueller2016.pdf');
fs.writeFileSync(named, '%PDF-1.4\n');
writeZoteroLink(folderOnly, { sourceBibPath: '', pdfMode: 'linked', attachmentDir: dropbox });
const folderHit = await findSourceForCitation(folderOnly, 'mueller2016');
check('attachment folder by citekey', folderHit.path === named, folderHit.path ?? 'null');
check('folder hit did not copy', fs.readdirSync(path.join(folderOnly, 'sources')).length === 0);

let apiCalled = false;
const viaApi = await locateCitationPdf({
  citekey: 'solo2020',
  projectDir: folderOnly,
  linked: true,
  attachmentDir: null,
  bibText: '@article{solo2020, title = {Y}, year = {2020}}\n',
  io: {
    exists: (p) => p === outside,
    listPdfNames: () => [],
  },
  queryZotero: async () => { apiCalled = true; return outside; },
});
check('api used when file field is absent', apiCalled && viaApi?.path === outside && viaApi.via === 'zotero');

apiCalled = false;
await locateCitationPdf({
  citekey: 'bandura1977',
  projectDir: project,
  linked: true,
  attachmentDir: null,
  bibText: bib.replace(outside, path.join(dropbox, 'missing.pdf')),
  io: {
    exists: () => false,
    listPdfNames: () => [],
  },
  queryZotero: async () => { apiCalled = true; return outside; },
});
check('api skipped when a file field is present', !apiCalled);

writeZoteroLink(project, { sourceBibPath: '', pdfMode: 'copy', attachmentDir: dropbox });
const copied = await openCitationPdf(project, 'bandura1977');
const dest = path.join(project, 'sources', 'bandura1977.pdf');
check('copy mode writes one file on open', copied === dest && fs.existsSync(dest));

const ipadBib = `@article{bandura1977,
  title = {Self-efficacy},
  year = {1977},
  file = {:/Users/me/Dropbox/Zotero-PDFs/bandura1977.pdf:application/pdf}
}
`;
const ipadHit = locateIpadCitationPdf('bandura1977', ipadBib, ['notes/bandura1977.pdf', 'other.pdf'], ['sources/bandura1977.pdf']);
check('ipad uses the file name, not the Mac path', ipadHit?.where === 'attachment' && ipadHit.rel === 'notes/bandura1977.pdf');
const ipadKey = locateIpadCitationPdf('mueller2016', '@article{mueller2016, title={X}, year={2016}}', ['mueller2016_scan.pdf'], []);
check('ipad citekey match in the folder', ipadKey?.where === 'attachment' && ipadKey.rel === 'mueller2016_scan.pdf');
const ipadSources = locateIpadCitationPdf('bandura1977', null, [], ['sources/bandura1977.pdf']);
check('ipad falls back to sources', ipadSources?.where === 'sources' && ipadSources.rel === 'sources/bandura1977.pdf');
check('ipad does not invent a path', locateIpadCitationPdf('missing1999', ipadBib, ['other.pdf'], []) === null);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
