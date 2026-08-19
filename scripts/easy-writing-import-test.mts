/**
 * Easy Writing MDX import — the manuscript must survive open → typeset → save.
 *
 * Easy Writing's "Projekt kopieren" is a folder (project.yaml + .mdx + .bib),
 * not a flattened file. Penwright derives Typst for typesetting and must not
 * rewrite the MDX, flatten [@citekey] into author-year prose, drop footnotes,
 * or strip Figure captions.
 *
 * Run: npx tsx scripts/easy-writing-import-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  adoptEasyWritingProject,
  isEasyWritingManuscriptFile,
  isEasyWritingProject,
  parseProjectYaml,
  typesetRelFor,
} from '../src/shared/easyWriting.ts';
import { markdownToTypst } from '../src/shared/markdownImporter.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(REPO, 'scripts', 'fixtures', 'easy-writing-paper');

let failures = 0;
function check(name: string, cond: boolean, detail: unknown = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail !== '' ? `\n      ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  }
}

function copyFixture(): { dir: string; snapshot: Map<string, string> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ew-'));
  const snapshot = new Map<string, string>();
  const walk = (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, ent.name);
      const dest = path.join(to, ent.name);
      if (ent.isDirectory()) walk(src, dest);
      else {
        fs.copyFileSync(src, dest);
        if (/\.(mdx|yaml|bib)$/i.test(ent.name)) {
          snapshot.set(path.relative(dir, dest), fs.readFileSync(dest, 'utf-8'));
        }
      }
    }
  };
  walk(FIXTURE, dir);
  return { dir, snapshot };
}

function assertUnchanged(dir: string, snapshot: Map<string, string>, label: string): void {
  for (const [rel, before] of snapshot) {
    const after = fs.readFileSync(path.join(dir, rel), 'utf-8');
    check(`${label}: ${rel} byte-identical`, after === before, {
      beforeLen: before.length,
      afterLen: after.length,
    });
  }
}

console.log('\nYAML');
{
  const raw = fs.readFileSync(path.join(FIXTURE, 'project.yaml'), 'utf-8');
  const m = parseProjectYaml(raw);
  check('parses schema 1 paper', !!m && m.type === 'paper' && m.schema === 1);
  check('keeps chapter order from yaml', !!m && m.chapters[0] === 'chapters/01-abstract.mdx', m?.chapters);
  check('resolves bibliography path', m?.bibliography === 'references.bib');
  check('reads csl apa', m?.csl === 'apa');
  check('reads lang de', m?.lang === 'de');
}

console.log('\nMarkdown dialect (no project)');
{
  const src = fs.readFileSync(path.join(FIXTURE, 'chapters', '01-abstract.mdx'), 'utf-8');
  const out = markdownToTypst(src);
  check('frontmatter is not emitted', !out.includes('unknown_keep') && !out.trimStart().startsWith('---'), out.slice(0, 80));
  check('heading from # is Typst =', out.includes('= Abstract') || !src.split('\n').some((l) => l.startsWith('# ')), out.slice(0, 120));
  check('citation is @key not author-year', out.includes('@lim2010sleep') && !/\(Lim/.test(out), out);
  check('locator is a Typst supplement', out.includes('@lim2010sleep[p. 12]'), out);
  check('footnote is #footnote[…] with original wording', out.includes('#footnote[Operationalisiert über die Psychomotor Vigilance Task.]'), out);
  check('footnote definition block is gone', !/\[\^1\]:/.test(out), out);
  check('Figure keeps caption', /#figure\(/.test(out) && /Versuchsaufbau/.test(out), out);
  check('Figure is not flattened to a bare image', !/^\s*#image\("\.\.\/assets\/setup\.png"\)\s*$/m.test(out), out);
  check('GFM table becomes #table', out.includes('#table(') && out.includes('Vigilanzabfall'), out);
  check('bold survives', out.includes('*Reaktionszeit*'), out);
}

console.log('\nAdopt: MDX stays the manuscript');
{
  const { dir, snapshot } = copyFixture();
  check('detected as Easy Writing project', isEasyWritingProject(dir));
  const result = adoptEasyWritingProject(dir);
  check('adopted', result.adopted && !!result.rootFile, result);
  check('wrote a typeset chapter', result.typesetFiles.some((f) => f.includes('01-abstract.typ')), result.typesetFiles);
  check('main.typ exists', fs.existsSync(path.join(dir, 'main.typ')));
  check('style.typ exists (design home)', fs.existsSync(path.join(dir, 'style.typ')));
  assertUnchanged(dir, snapshot, 'after adopt');

  const mdxAbs = path.join(dir, 'chapters', '01-abstract.mdx');
  check('mdx is classified as manuscript', isEasyWritingManuscriptFile(dir, mdxAbs));
  check('bib is NOT classified as manuscript (add-citation may write it)', !isEasyWritingManuscriptFile(dir, path.join(dir, 'references.bib')));

  const root = fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8');
  check('root includes chapters in yaml order', root.includes(`#include "${typesetRelFor('chapters/01-abstract.mdx')}"`), root);
  check('root points at references.bib', /#bibliography\("references\.bib"/.test(root), root);
  check('root uses apa', /style:\s*"apa"/.test(root), root);
  check('root sets lang de', /#set text\(lang: "de"\)/.test(root), root);
  check('root wires style.typ', root.includes('#import "style.typ": *') && root.includes('#show: apply-style'), root);

  const typeset = fs.readFileSync(path.join(dir, typesetRelFor('chapters/01-abstract.mdx')), 'utf-8');
  check('typeset citation is still a key', typeset.includes('@lim2010sleep') && !/\(Lim/.test(typeset), typeset);
  check('typeset locator survived', typeset.includes('@lim2010sleep[p. 12]'), typeset);
  check('image path is rewritten for the typeset location', typeset.includes('../../../assets/setup.png'), typeset);

  // Re-adopt must not rewrite MDX, and must not duplicate includes.
  adoptEasyWritingProject(dir);
  assertUnchanged(dir, snapshot, 'after second adopt');
  const root2 = fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8');
  const includeCount = (root2.match(/#include "/g) ?? []).length;
  check('second adopt does not duplicate includes', includeCount === 1, root2);

  // A design prelude in main.typ must survive regeneration (KI styling).
  const withHero = root2.replace(
    '// ─── penwright:mdx-chapters ───',
    '// hero lives here\n#align(center)[*Styled*]\n\n// ─── penwright:mdx-chapters ───',
  );
  fs.writeFileSync(path.join(dir, 'main.typ'), withHero);
  adoptEasyWritingProject(dir);
  const root3 = fs.readFileSync(path.join(dir, 'main.typ'), 'utf-8');
  check('design prelude in main.typ survives re-adopt', root3.includes('#align(center)[*Styled*]'), root3);
  assertUnchanged(dir, snapshot, 'after prelude re-adopt');

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nCompile the derived Typst');
{
  const typst = path.join(REPO, 'resources', 'bin', `typst-${process.arch === 'arm64' ? 'arm64' : 'x64'}-${process.platform === 'darwin' ? 'darwin' : process.platform}`);
  const { dir, snapshot } = copyFixture();
  adoptEasyWritingProject(dir);
  if (!fs.existsSync(typst)) {
    check('bundled typst present (skipped compile)', false, typst);
  } else {
    let compiled = true;
    let err = '';
    try {
      execFileSync(typst, [
        'compile', '--root', dir,
        '--package-path', path.join(REPO, 'resources', 'typst-packages'),
        '--font-path', path.join(REPO, 'resources', 'fonts'),
        '--ignore-system-fonts',
        path.join(dir, 'main.typ'), path.join(dir, 'out.pdf'),
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: unknown) {
      compiled = false;
      const any = e as { stderr?: Buffer };
      err = (any.stderr?.toString() ?? String(e)).slice(0, 500);
    }
    check('derived document compiles', compiled, err);
    check('produced a PDF', compiled && fs.existsSync(path.join(dir, 'out.pdf')));
  }
  assertUnchanged(dir, snapshot, 'after compile');
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nBlog variant (index.mdx, no chapters list)');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ew-blog-'));
  fs.writeFileSync(path.join(dir, 'project.yaml'), 'schema: 1\ntype: blog\ntitle: Hello\nlang: en\n');
  fs.writeFileSync(path.join(dir, 'index.mdx'), 'A claim [@lim2010sleep] and a note.[^a]\n\n[^a]: The note.\n');
  const mdxBefore = fs.readFileSync(path.join(dir, 'index.mdx'), 'utf-8');
  const result = adoptEasyWritingProject(dir);
  check('blog adopted via index.mdx', result.adopted && result.typesetFiles.some((f) => f.endsWith('index.typ')), result.typesetFiles);
  check('blog index.mdx unchanged', fs.readFileSync(path.join(dir, 'index.mdx'), 'utf-8') === mdxBefore);
  const typeset = fs.readFileSync(path.join(dir, typesetRelFor('index.mdx')), 'utf-8');
  check('blog citation and footnote converted', typeset.includes('@lim2010sleep') && typeset.includes('#footnote[The note.]'), typeset);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
