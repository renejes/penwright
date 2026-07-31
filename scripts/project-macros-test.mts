/**
 * The project's own building blocks: catalogue, per-file visibility, and the
 * inserted call.
 *
 * Run: npx tsx scripts/project-macros-test.mts
 *
 * The last section is the one that matters. A catalogue that lists a macro the
 * user cannot actually insert is worse than no catalogue, so every generated
 * call is COMPILED with the bundled Typst — against fixtures here, and against
 * every real corpus project when one is configured. A signature read wrongly
 * shows up as `unknown variable` or `unexpected argument`, not as a diff.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  listProjectMacros,
  buildMacroIndex,
  visibleIn,
  buildMacroCall,
  type ProjectMacro,
} from '../src/main/projectMacros.ts';
import { extraCorpusRoots } from './corpusConfig.mts';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function typstBin(): string | null {
  const dir = path.join(REPO, 'resources', 'bin');
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find(f => f.startsWith('typst-'));
  return hit ? path.join(dir, hit) : null;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-macros-'));
const write = (rel: string, body: string): string => {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

// ─── A fixture project that mirrors what the corpus actually contains ───────
write('macros.typ', `
// Leistungsbaustein, Preis optional
#let modul(nr, titel, body, preis: none) = block(inset: 8pt)[
  #strong(titel) #nr #body #preis
]

// ── Hinweiskasten ────────────────────────────────────────────
#let note(body, title: "Zur Einordnung") = block(inset: 6pt)[#strong(title) #body]

// Ein ruhiger Kasten für Randbemerkungen. Er hat außerdem eine zweite, deutlich
// längere Erklärung, die in keine Menüzeile der Welt passen würde.
#let hinweis(body) = block(inset: 6pt)[#body]

#let stat(value, label) = box[#strong(value) #label]

#let divider() = line(length: 100%)

// Nicht einfügbar: wird per #show angewandt
#let apply-style(body) = body

#let _intern(body) = body
`);

write('style.typ', `
#import "macros.typ": *
#let farbe = rgb("#333")
#let claim(body) = emph(body)
`);

write('main.typ', `
#import "style.typ": *
#include "chapters/01.typ"
`);

write('chapters/01.typ', `
Ein Kapitel ohne Import.
`);

write('chapters/02.typ', `
#import "../style.typ": *
Ein Kapitel mit Import.
`);

write('chapters/03.typ', `
#import "../style.typ": modul
Nur ein Name importiert.
`);

console.log('\n── Catalogue ──');
{
  const { macros } = listProjectMacros(tmp);
  const names = macros.map(m => m.name);
  check('a #let with a parameter list is a building block', names.includes('modul'), names);
  check('a plain value binding is not', !names.includes('farbe'), names);
  check('an underscore name is private', !names.includes('_intern'), names);
  check('a #show entry point is not insertable', !names.includes('apply-style'), names);

  const modul = macros.find(m => m.name === 'modul')!;
  check('positional parameters are read', modul.params.filter(p => p.defaultValue === null).map(p => p.name).join(',') === 'nr,titel,body', modul.params);
  check('a named default is kept verbatim', modul.params.find(p => p.name === 'preis')?.defaultValue === 'none', modul.params);
  check('the comment above becomes the label', modul.label === 'Leistungsbaustein, Preis optional', modul.label);
  check('the definition is located', modul.relPath === 'macros.typ' && modul.line > 0, [modul.relPath, modul.line]);

  const note = macros.find(m => m.name === 'note')!;
  // Read off the corpus: `#note(body, title: …)` is called `#note(title: …)[…]`.
  check('the body is the parameter NAMED body, not the last one', note.bodyParam === 'body', note);
  // The corpus writes its descriptions INSIDE the rule — `// ── Titelseite ──`
  // is the only name `#cover` has — so the rule is stripped and the text kept.
  check('a decorative rule is stripped, its text kept', note.label === 'Hinweiskasten', note.label);

  const hinweis = macros.find(m => m.name === 'hinweis')!;
  check('a wrapped comment is joined across lines', hinweis.label.startsWith('Ein ruhiger Kasten'), hinweis.label);
  check('the label stops at the first sentence', hinweis.label === 'Ein ruhiger Kasten für Randbemerkungen.', hinweis.label);

  const stat = macros.find(m => m.name === 'stat')!;
  check('two plain positionals mean no body', stat.bodyParam === null, stat);
}

// ─── A comment in a signature is not a parameter ────────────────────────────
//
// `projectMacros.ts` used to carry its OWN paren reader and comma splitter,
// neither of which knew about comments — so a `#let` with a comment between two
// parameters reported the ones after it as missing, and every call the
// catalogue offered was short an argument. Both scanners are gone; the shared
// mode-aware ones do the work.
console.log('\n── Comments in a #let signature ──');
{
  write('commented.typ', `
#let modulk(
  nr,          // die laufende Nummer
  titel,       /* der Titel */
  body,
) = block(body)

#let bildk(pfad /* der Pfad */, alt) = image(pfad, alt: alt)
`);
  const macros = listProjectMacros(tmp).macros;
  const modul = macros.find(m => m.name === 'modulk');
  check('a line comment between parameters loses none of them',
    modul?.params.map(p => p.name).join(',') === 'nr,titel,body', modul?.params);
  const bild = macros.find(m => m.name === 'bildk');
  check('a block comment inside a signature loses none either',
    bild?.params.map(p => p.name).join(',') === 'pfad,alt', bild?.params);
  check('…and the generated call carries every argument',
    buildMacroCall(modul!) === '#modulk("nr", "titel")[\n  Inhalt\n]', buildMacroCall(modul!));
}

// ─── The walk stays inside the project ──────────────────────────────────────
//
// CLAUDE.md requires `isPathWithin` of every file-touching path. Without it a
// symlinked `.typ` had its `#let`s — and its leading comment, verbatim — listed
// in the user's insert menu and returned by the MCP tool.
console.log('\n── The walk stays inside the project ──');
{
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.typ'), '// KUNDE: Vertraulich\n#let geheim(kunde) = kunde\n');
  let linked = false;
  try { fs.symlinkSync(path.join(outside, 'secret.typ'), path.join(tmp, 'link.typ')); linked = true; } catch { /* no symlink support */ }
  if (linked) {
    const names = listProjectMacros(tmp).macros.map(m => m.name);
    check('a symlink pointing outside the project is not read', !names.includes('geheim'), names);
    fs.rmSync(path.join(tmp, 'link.typ'), { force: true });
  } else {
    check('a symlink pointing outside the project is not read', false, 'symlink() failed — cannot verify');
  }
  // And a targetFile outside the project answers with nothing, not with everything.
  check('a targetFile outside the project returns no macros',
    listProjectMacros(tmp, path.join(outside, 'secret.typ')).macros.length === 0,
    listProjectMacros(tmp, path.join(outside, 'secret.typ')).macros.length);
  fs.rmSync(outside, { recursive: true, force: true });
}

console.log('\n── Visibility is per file ──');
{
  const index = buildMacroIndex(tmp);
  const namesIn = (rel: string) => visibleIn(index, path.join(tmp, rel)).map(m => m.name).sort();

  // Proven against the compiler: a root `#import` does NOT reach an `#include`d
  // chapter. Offering the whole project there would offer only macros that fail.
  check('a chapter without an import sees nothing', namesIn('chapters/01.typ').length === 0, namesIn('chapters/01.typ'));
  check('the root sees what it imports', namesIn('main.typ').includes('modul'), namesIn('main.typ'));
  check('star imports re-export transitively', namesIn('chapters/02.typ').includes('modul'), namesIn('chapters/02.typ'));
  check('and the intermediate module\'s own macros too', namesIn('chapters/02.typ').includes('claim'), namesIn('chapters/02.typ'));
  check('a named import narrows to that name', namesIn('chapters/03.typ').join(',') === 'modul', namesIn('chapters/03.typ'));
  check('a narrowed import still reaches through', namesIn('chapters/03.typ').includes('modul'), namesIn('chapters/03.typ'));
  check('the defining file sees its own', namesIn('macros.typ').includes('modul'), namesIn('macros.typ'));
}

console.log('\n── The inserted call ──');
{
  const { macros } = listProjectMacros(tmp);
  const by = (n: string) => macros.find(m => m.name === n)!;
  check('positionals become placeholders, body becomes a trailing block',
    buildMacroCall(by('modul')) === '#modul("nr", "titel")[\n  Inhalt\n]', buildMacroCall(by('modul')));
  check('named parameters are omitted — they have defaults',
    !buildMacroCall(by('modul')).includes('preis'), buildMacroCall(by('modul')));
  check('a named parameter is emitted when asked for',
    buildMacroCall(by('note'), { title: '"Achtung"' }).startsWith('#note(title: "Achtung")['), buildMacroCall(by('note'), { title: '"Achtung"' }));
  check('no body means no trailing block',
    buildMacroCall(by('stat')) === '#stat("value", "label")', buildMacroCall(by('stat')));
  check('no parameters at all still calls',
    buildMacroCall(by('divider')) === '#divider()', buildMacroCall(by('divider')));
}

// ─── The proof: every generated call compiles ───────────────────────────────
console.log('\n── Every generated call compiles ──');
{
  const bin = typstBin();
  if (!bin) {
    console.log('  ✗ no bundled Typst — this suite exists to compile, so that is a failure');
    fail++;
  } else {
    // A path parameter names a FILE — `#aufmacher(path, …)` hands it straight to
    // `image()`, so a word placeholder is a compile error, not a placeholder.
    // The probe supplies a real image so the rest of the signature is still
    // proven; the app answers the same problem with a file picker.
    // Generated, not borrowed from the repo: the sample project happens to ship
    // only an SVG, and a probe that silently finds no image proves nothing.
    const PROBE_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const compileIn = (projectDir: string, importLine: string, macros: ProjectMacro[]): void => {
      if (!macros.length) return;
      fs.writeFileSync(path.join(projectDir, 'pw-probe.png'), PROBE_PNG);
      const body = macros.map(m => {
        const values: Record<string, string> = {};
        for (const p of m.params) if (p.isPath && p.defaultValue === null) values[p.name] = '"pw-probe.png"';
        return buildMacroCall(m, values);
      }).join('\n\n');
      const probe = path.join(projectDir, '.pw-macro-probe.typ');
      fs.writeFileSync(probe, `${importLine}\n\n${body}\n`);
      const out = path.join(os.tmpdir(), `pw-probe-${Date.now()}.pdf`);
      try {
        execFileSync(bin, ['compile', '--package-path', path.join(REPO, 'resources', 'typst-packages'), probe, out], {
          stdio: 'pipe', timeout: 60_000,
        });
        check(`${path.basename(projectDir)}: all ${macros.length} generated calls compile`, true);
      } catch (err: any) {
        const msg = String(err.stderr ?? err.message ?? err).split('\n').slice(0, 4).join(' | ');
        check(`${path.basename(projectDir)}: all ${macros.length} generated calls compile`, false, msg);
      } finally {
        fs.rmSync(probe, { force: true });
        fs.rmSync(path.join(projectDir, "pw-probe.png"), { force: true });
        fs.rmSync(out, { force: true });
      }
    };

    // Imports derived from where the macros actually live, like the corpus
    // branch below — a fixed `#import "style.typ"` silently skipped any fixture
    // file style.typ does not itself import.
    const fixtureMacros = listProjectMacros(tmp).macros;
    compileIn(
      tmp,
      [...new Set(fixtureMacros.map(m => m.relPath))].map(r => `#import "${r}": *`).join('\n'),
      fixtureMacros,
    );

    // …and against the real thing, where the signatures were not written by us.
    // Every project is COPIED to temp first: these are the user's live client
    // documents, and a test that writes a probe file into them is a test that
    // eventually leaves one behind.
    const { roots, missing } = extraCorpusRoots([]);
    for (const m of missing) console.log(`  ⚠ configured corpus root is missing: ${m}`);
    const projects: string[] = [];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      if (fs.readdirSync(root).some(f => f.endsWith('.typ'))) projects.push(root);
      else {
        for (const e of fs.readdirSync(root, { withFileTypes: true })) {
          if (e.isDirectory() && !e.name.startsWith('.')) projects.push(path.join(root, e.name));
        }
      }
    }
    if (!projects.length) console.log('  · no corpus projects configured — fixture coverage only');

    for (const proj of projects) {
      // Every file that defines macros, not a guessed `style.typ`: LANGSAM keeps
      // its eleven building blocks in `macros.typ` and only three helpers in
      // `style.typ`, so guessing covered one macro out of fourteen.
      const macros = listProjectMacros(proj).macros
        // Zero-argument helpers that only resolve inside a running head.
        .filter(m => !/^(chapter-name|section-name|chap-num)$/.test(m.name));
      if (!macros.length) continue;
      const sources = [...new Set(macros.map(m => m.relPath))];

      const copy = path.join(tmp, 'corpus', path.basename(proj));
      fs.cpSync(proj, copy, {
        recursive: true,
        filter: src => !/(^|[\\/])(\.git|\.penwright|node_modules)([\\/]|$)/.test(src),
      });
      compileIn(copy, sources.map(s => `#import "${s}": *`).join('\n'), macros);
    }
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n──────────\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
