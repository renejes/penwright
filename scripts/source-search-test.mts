/**
 * The linked bibliography is the shelf, not the citations already in a chapter.
 * A paper that the manuscript never mentions is still searchable, and reading
 * it does not copy the PDF into sources/.
 *
 * Run: npx tsx scripts/source-search-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { queryTerms, searchPaperTexts, readPaperPages, type PaperText } from '../src/shared/sourceSearch.ts';
import { readProjectSource, searchProjectSources } from '../src/main/sourceIndex.ts';
import { writeZoteroLink } from '../src/main/zoteroLink.ts';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

const papers: PaperText[] = [
  {
    citekey: 'bandura1977',
    title: 'Self-efficacy: Toward a unifying theory',
    abstract: 'Mastery experiences are the strongest source of self-efficacy.',
    author: 'Bandura, Albert',
    year: '1977',
    pageMode: 'index',
    pages: [
      { pdfPage: 1, label: '1', text: 'Introduction. Mastery experiences shape how people face an exam.' },
      { pdfPage: 2, label: '2', text: 'A later section about physiological arousal and nothing else.' },
    ],
  },
  {
    citekey: 'other1980',
    title: 'Glaciers',
    abstract: '',
    author: 'Other, A.',
    year: '1980',
    pageMode: 'index',
    pages: [
      { pdfPage: 1, label: '1', text: 'An ice core from a glacier. No mention of exams.' },
    ],
  },
];

check('drops glue words', queryTerms('was steht in den Quellen zu self-efficacy').includes('self-efficacy'));
const hits = searchPaperTexts(papers, 'self-efficacy exam');
check('finds the paper that has the words', hits.some(h => h.citekey === 'bandura1977' && h.where === 'page' && h.page === '1'));
check('snippet is a passage', (hits.find(h => h.citekey === 'bandura1977' && h.where === 'page')?.snippet ?? '').includes('Mastery experiences'));
check('does not require the paper to be cited', hits.every(h => h.citekey !== 'cited-only'));
check('other paper stays out', !hits.some(h => h.citekey === 'other1980'));

const glacier = searchPaperTexts(papers, 'glacier');
check('uncited paper is searchable', glacier.some(h => h.citekey === 'other1980' && h.where === 'page'));

const labeled: PaperText = {
  ...papers[0],
  pageMode: 'labels',
  pages: [
    { pdfPage: 3, label: '1', text: 'front matter' },
    { pdfPage: 14, label: '12', text: 'The claim about mastery is on the printed page.' },
  ],
};
const window = readPaperPages(labeled, '12');
check('printed label wins over file page', window.pages.length === 1 && window.pages[0].pdfPage === 14 && window.pageKind === 'label');

const typst = path.resolve('resources/bin/typst-arm64-darwin');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-sources-'));
const project = path.join(root, 'project');
const dropbox = path.join(root, 'Dropbox');
fs.mkdirSync(path.join(project, 'sources'), { recursive: true });
fs.mkdirSync(dropbox, { recursive: true });
const src = path.join(root, 'paper.typ');
fs.writeFileSync(src, [
  '#set page(paper: "a6")',
  '= Self-efficacy',
  'Mastery experiences shape exam stress in this uncited paper.',
  '#pagebreak()',
  'Nothing about glaciers here.',
].join('\n'));
const pdf = path.join(dropbox, 'bandura1977.pdf');
execFileSync(typst, ['compile', src, pdf], { stdio: 'pipe' });
const bib = `@article{bandura1977,
  author = {Bandura, Albert},
  title = {Self-efficacy},
  year = {1977},
  abstract = {A theory of mastery.},
  file = {:${pdf}:application/pdf}
}
@article{other1980,
  author = {Other, A.},
  title = {Glaciers of the north},
  year = {1980},
  abstract = {Ice cores and glaciers, with no PDF attached.}
}
`;
fs.writeFileSync(path.join(project, 'zotero.bib'), bib);
writeZoteroLink(project, { sourceBibPath: '', pdfMode: 'linked', attachmentDir: dropbox });

const report = await searchProjectSources(project, 'mastery exam');
check('library is the whole bib', report.library === 'zotero.bib' && report.papers === 2, JSON.stringify(report.papers));
check('pdf hit on the dropbox file', report.hits.some(h => h.citekey === 'bandura1977' && h.where === 'page'));
check('abstract-only paper is still a hit for its title', (await searchProjectSources(project, 'glaciers')).hits.some(h => h.citekey === 'other1980'));
check('no copy into sources/', fs.readdirSync(path.join(project, 'sources')).length === 0);

const indexDir = path.join(project, '.penwright', 'source-index');
const indexFiles = fs.readdirSync(indexDir);
check('text index was cached', indexFiles.length === 1);
const stamp = fs.statSync(path.join(indexDir, indexFiles[0])).mtimeMs;
await new Promise(r => setTimeout(r, 30));
await searchProjectSources(project, 'mastery');
check('unchanged PDF is not reindexed', fs.statSync(path.join(indexDir, indexFiles[0])).mtimeMs === stamp);

const read = await readProjectSource(project, 'bandura1977', '1');
check('read returns the passage', read.pdf && read.pages.some(p => p.text.includes('Mastery experiences')));
check('read does not copy', fs.readdirSync(path.join(project, 'sources')).length === 0);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
