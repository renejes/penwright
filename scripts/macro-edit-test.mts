/**
 * Editing a macro instance: reading the call apart, and splicing one argument
 * back in without disturbing a single other byte.
 *
 * Run: npx tsx scripts/macro-edit-test.mts
 *
 * Three layers, in increasing order of how much they would have caught:
 *
 *  1. Shapes. The seven argument shapes that actually occur, measured over 506
 *     real call sites before the parser was written — 170 of them have no
 *     parentheses at all, which is the shape a signature-first parser forgets.
 *  2. IDENTITY over the real corpus. Every argument of every real call is
 *     spliced with ITS OWN value and must come back byte-identical. This is the
 *     one that proves the ranges; an off-by-one that no fixture would show up
 *     in fails here immediately.
 *  3. COMPILE. A spliced call is written back into a copy of the real project
 *     and compiled with the bundled Typst. Ranges can be self-consistent and
 *     still produce something Typst rejects.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseMacroCall,
  macroFormFields,
  readMacroField,
  writeMacroField,
  spliceRange,
  setNamedArg,
  setPositionalArg,
  setBody,
  encodeArgValue,
  escapeTypstContent,
  escapeTypstString,
  unescapeTypstString,
} from '../src/shared/macroCall.ts';
import { buildMacroIndex, visibleIn, listProjectMacros } from '../src/main/projectMacros.ts';

const listProjectMacrosFor = (dir: string) => listProjectMacros(dir).macros;
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
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

// ─── 1. The shapes that actually occur ──────────────────────────────────────
console.log('\n── Shapes measured over 506 real call sites ──');
{
  // 170 of 506: no parentheses at all. The most common shape there is.
  const bare = parseMacroCall('#lead[Wir haben verlernt, nichts zu tun.]')!;
  check('bare #name[body] parses', bare?.name === 'lead' && bare.args.length === 0, bare);
  check('…and its body range is the text inside the brackets',
    bare && '#lead[Wir haben verlernt, nichts zu tun.]'.slice(bare.bodyStart!, bare.bodyEnd!) === 'Wir haben verlernt, nichts zu tun.', bare);

  // 72: arguments then a trailing body.
  const src = '#modul("2.1", "Fachartikel")[\n  Rund fünf Minuten.\n]';
  const p = parseMacroCall(src)!;
  check('#name(args)[body] parses', p?.name === 'modul' && p.args.length === 2, p);
  check('positional values are located', src.slice(p.args[0].start, p.args[0].end) === '"2.1"', p.args[0]);
  check('a string argument exposes its text without the quotes',
    src.slice(p.args[0].innerStart, p.args[0].innerEnd) === '2.1', p.args[0]);

  const named = parseMacroCall('#note(title: "Was hier nicht drin ist")[Text]')!;
  check('a named argument is named', named?.args[0]?.name === 'title', named?.args);

  // 41: a content block AS an argument value.
  const cap = '#bildtafel("a.png", caption: [Eine Stunde am Fenster])[Body]';
  const pc = parseMacroCall(cap)!;
  const capArg = pc.args.find(a => a.name === 'caption')!;
  check('a content-block argument is kind "content"', capArg?.kind === 'content', capArg);
  check('…and its inner range excludes the brackets',
    cap.slice(capArg.innerStart, capArg.innerEnd) === 'Eine Stunde am Fenster', capArg);

  // 88 multi-line + 38 trailing comma, together, as they occur.
  const multi = '#cover(\n  title: "Angebot",\n  subtitle: "Für FMM",\n)';
  const pm = parseMacroCall(multi)!;
  check('a multi-line list with a trailing comma parses to 2 args', pm?.args.length === 2, pm?.args);
  check('…and the trailing comma is not an empty third argument',
    pm?.args.every(a => a.raw.trim() !== ''), pm?.args);

  // 17: an array of content blocks.
  const arr = '#step("Das Fundament legen", ([Die Homepage], [Ein Blog]))';
  const pa = parseMacroCall(arr)!;
  check('an array argument stays ONE argument', pa?.args.length === 2, pa?.args);
  check('…and is kept verbatim as an expression', pa?.args[1]?.raw === '([Die Homepage], [Ein Blog])', pa?.args[1]);

  // 26: a string containing delimiters. The comma inside must not split.
  const str = '#stat("4:2 (netto)", "Ergebnis, gerundet")';
  const ps = parseMacroCall(str)!;
  check('a comma inside a string does not split the argument list', ps?.args.length === 2, ps?.args);
  check('…and brackets inside a string are left alone', ps?.args[0]?.raw === '"4:2 (netto)"', ps?.args[0]);

  // ── A COMMENT IS NOT PART OF THE VALUE ─────────────────────────────────
  // The argument range used to start at the comment, so the form field for `nr`
  // read `// Nummer und Titel "2.1"` — and replacing it wrote the comment away
  // and produced `error: expected comma`. The comment belongs in the gap
  // BETWEEN arguments, where a splice never reaches it.
  const leadComment = '#modul(\n  // Nummer und Titel\n  "2.1",\n  "Fachartikel",\n)';
  const plc = parseMacroCall(leadComment)!;
  check('a leading comment is not part of the argument', plc?.args[0]?.raw === '"2.1"', plc?.args[0]?.raw);
  check('…and the field shows only the value', readMacroField(leadComment, 'pos:0') === '2.1', readMacroField(leadComment, 'pos:0'));
  const edited = writeMacroField(leadComment, 'pos:0', 'string', 'Teil A')!;
  check('…and editing it leaves the comment in place',
    edited.includes('// Nummer und Titel') && edited.includes('"Teil A"'), edited);
  check('…and the result still parses', parseMacroCall(edited) !== null, edited);

  const trailComment = '#note(\n  title: "a",  // TODO Untertitel\n)[T]';
  const ptc = parseMacroCall(trailComment)!;
  check('a trailing comment is not part of the argument either', ptc?.args[0]?.raw === '"a"', ptc?.args[0]?.raw);

  // A path parameter is ALWAYS a string, whatever its default looks like. A
  // `bild: none` default made the field an `expr`, so the file picker wrote the
  // path unquoted and the document died with `unknown variable: assets`.
  {
    const macro = {
      name: 'hero', label: '', filePath: '', relPath: '', line: 1, bodyParam: 'body',
      params: [
        { name: 'body', defaultValue: null, isPath: false },
        { name: 'bild', defaultValue: 'none', isPath: true },
      ],
    };
    const field = macroFormFields(macro as never, '#hero[Ein Absatz.]').find(f => f.paramName === 'bild')!;
    check('a path parameter is a string field even when its default is `none`', field.kind === 'string', field);
    const out = writeMacroField('#hero[Ein Absatz.]', field.key, field.kind, 'assets/feature.png');
    check('…so the picked path is quoted', out === '#hero(bild: "assets/feature.png")[Ein Absatz.]', out);
  }

  // A comment inside the argument list must survive an edit untouched.
  const withComment = '#modul(\n  "2.1",  // die Nummer\n  "Titel",\n)';
  const pcm = parseMacroCall(withComment)!;
  check('a // comment inside the list does not become an argument', pcm?.args.length === 2, pcm?.args);

  // ── A BODY IS MARKUP ───────────────────────────────────────────────────
  // The same asymmetry the block splitter tracks, and the same bug when it is
  // ignored: counting `(` inside a `[…]` body made the parser declare an
  // ordinary German sentence unparseable, so the form locked itself out of the
  // block it had just written. Found by running the form over the real corpus,
  // not by thinking about it. All four of these compile in Typst 0.15.1.
  for (const [name, src] of [
    ['a paren in the body', '#note[Ein neuer Wert (mit Klammer]'],
    ['a brace in the body', '#note[Ein } Zeichen]'],
    ['a quote mark in the body', '#note[Er sagte "ja" dazu]'],
    ['a paren in a content ARGUMENT', '#bildtafel("p.png", caption: [Kosten (ca. 30%])'],
    ['nested content in the body', '#note[Eine Stunde #emph[scheinbar] nichts]'],
  ] as [string, string][]) {
    check(`${name}: still parses`, parseMacroCall(src) !== null, src);
  }
  const commaInMarkup = '#bildtafel("p.png", caption: [Kosten (ca. 30%), gerundet])';
  const pcma = parseMacroCall(commaInMarkup)!;
  check('a comma inside a content argument does not split the list', pcma?.args.length === 2, pcma?.args);

  // ── `//` IS a comment in markup, but a URL is not ──────────────────────
  // Measured one scheme at a time against 0.15.1, because getting it backwards
  // corrupts in both directions. `#g[A // B]` fails to compile — the comment ate
  // the closing `]` — so `//` really is a comment here. But `http://` and
  // `https://` are exempt (Typst's auto-link detection), and ONLY those:
  // `ftp://`, `mailto://` and a bare `://` are comments again. A client chapter
  // is full of bare URLs, and without the exemption one of them swallows the
  // rest of the argument list.
  const urlBody = '#note[Siehe https://example.com/a fuer Details]';
  const pu = parseMacroCall(urlBody);
  check('a bare https:// URL in a body is not a comment', pu !== null, urlBody);
  check('…and the whole URL stays inside the body',
    pu !== null && urlBody.slice(pu.bodyStart!, pu.bodyEnd!) === 'Siehe https://example.com/a fuer Details',
    pu && urlBody.slice(pu.bodyStart!, pu.bodyEnd!));

  const urlArg = '#bildtafel("p.png", caption: [Quelle: http://x.co/a], title: "T")';
  const pua = parseMacroCall(urlArg);
  check('a URL in a content argument does not eat the arguments after it',
    pua !== null && pua.args.length === 3, pua?.args.length);

  // …and a real comment still ends the line, in markup as in code.
  const realComment = '#note[\n  Text\n  // ein Kommentar mit ] darin\n  Mehr\n]';
  check('a real // comment in a body is still a comment', parseMacroCall(realComment) !== null, realComment);

  // An ODD quote inside a content argument is legal Typst — in markup `"` is a
  // quotation mark, not a string delimiter. A single-mode scanner reads it as an
  // unterminated string and loses every argument after it.
  const oddQuote = '#note([sagte "hallo], title: "T")';
  const poq = parseMacroCall(oddQuote);
  check('an odd quote in a content argument does not eat the rest of the list',
    poq !== null && poq.args.length === 2, poq?.args.length);
}

// ─── 2. What the parser must REFUSE ─────────────────────────────────────────
//
// A form on a block the parser only half understands is worse than no form: it
// will eventually splice into the wrong span. The deserializer has paid for
// this class of mistake twice, so the bail-out is deliberately eager.
console.log('\n── Refusals: show the raw textarea instead ──');
{
  const refuses: [string, string][] = [
    ['prose before the call', 'Ein Satz. #note[Text]'],
    ['prose after the call', '#note[Text] und dann weiter'],
    ['two calls in one block', '#kicker[a]\n#kicker[b]'],
    ['an unclosed argument list', '#modul("2.1", "Titel"'],
    ['an unclosed body', '#note[Text'],
    ['a method chain', '#datetime.today().display()'],
    ['a bare value reference', '#farbe'],
    ['not a call at all', '#let x = 5'],
    ['mismatched delimiters', '#note(title: "x"][Text]'],
    // A trailing body binds ONLY when byte-adjacent — compiler-verified, and
    // stricter than it looks: `#g(k:1) [b]`, `#g(k:1)\n[b]` and even
    // `#g()/* c */[b]` all fail with "missing argument". So a gap means the
    // `[…]` is a SEPARATE block, and 19 corpus sites rely on that: the LANGSAM
    // interview writes `#frage[question]` and the answer as its own block.
    // Declining is what stops the answer being swallowed into the question.
    ['a space before the body', '#note(title: "x") [Text]'],
    ['a newline before the body', '#note(title: "x")\n[Text]'],
    ['a comment before the body', '#note(title: "x")/* c */[Text]'],
    ['a question with its answer as a second block', '#frage[Die Frage?]\n\n[Die Antwort.]'],
    // An escaped hash is not a call. One client chapter has four in a row
    // (`\#Landschaftsbau \#Mallorca …`) inside a live macro body.
    ['an escaped hash', '\\#Landschaftsbau ist ein Hashtag'],
  ];
  for (const [name, src] of refuses) {
    check(`refuses: ${name}`, parseMacroCall(src) === null, parseMacroCall(src));
  }
}

// ─── 3. Escaping ────────────────────────────────────────────────────────────
console.log('\n── Escaping what a form field may contain ──');
{
  check('a quote in a string argument is escaped', escapeTypstString('Er sagte "ja"') === 'Er sagte \\"ja\\"', escapeTypstString('Er sagte "ja"'));
  check('a backslash in a string argument is escaped', escapeTypstString('a\\b') === 'a\\\\b', escapeTypstString('a\\b'));

  // Only UNBALANCED brackets are escaped. Escaping every `[` would destroy the
  // nested markup real captions contain; escaping none would let one `]` end
  // the argument early and take the rest of the call with it.
  check('an unbalanced ] is escaped', escapeTypstContent('Preis netto]') === 'Preis netto\\]', escapeTypstContent('Preis netto]'));
  check('an unbalanced [ is escaped', escapeTypstContent('Preis [netto') === 'Preis \\[netto', escapeTypstContent('Preis [netto'));
  check('balanced brackets pass through — that is nested markup',
    escapeTypstContent('Eine Stunde #emph[scheinbar] nichts') === 'Eine Stunde #emph[scheinbar] nichts',
    escapeTypstContent('Eine Stunde #emph[scheinbar] nichts'));
  check('an already-escaped bracket is not double-escaped',
    escapeTypstContent('Preis \\] netto') === 'Preis \\] netto', escapeTypstContent('Preis \\] netto'));

  // READ AND WRITE MUST BE INVERSES, or the field is a shredder. `readMacroField`
  // used to hand the form the raw slice of a `"…"` argument — the ESCAPED source
  // — and `writeMacroField` escaped it again on the way back, so every
  // open-and-edit cycle doubled every backslash: one round `\\"`, two `\\\\"`,
  // three unreadable. Found by an adversarial review of this session's diff.
  check('a quoted string is unescaped on the way OUT',
    escapeTypstString(unescapeTypstString('Er sagte \\"ja\\"')) === 'Er sagte \\"ja\\"',
    unescapeTypstString('Er sagte \\"ja\\"'));
  {
    const start = '#note(title: "Er sagte \\"ja\\" und \\\\ auch")[T]';
    let c = start;
    for (let i = 0; i < 3; i++) c = writeMacroField(c, 'named:title', 'string', readMacroField(c, 'named:title'))!;
    check('three open-and-edit cycles change nothing', c === start, { got: c });
  }
  {
    // The content path needs no inverse — `escapeTypstContent` only touches an
    // UNBALANCED bracket and skips one that is already escaped — but prove it.
    const start = '#note(title: "T")[Ein \\[Wert\\] hier]';
    let c = start;
    for (let i = 0; i < 3; i++) c = writeMacroField(c, 'body', 'content', readMacroField(c, 'body'))!;
    check('a body with escaped brackets is stable too', c === start, { got: c });
  }

  check('encodeArgValue wraps a string', encodeArgValue('string', 'Angebot') === '"Angebot"');
  check('encodeArgValue wraps content', encodeArgValue('content', 'Angebot') === '[Angebot]');
  check('encodeArgValue leaves an expression alone', encodeArgValue('expr', '44%') === '44%');
}

// ─── 4. Setting arguments ───────────────────────────────────────────────────
console.log('\n── Adding, replacing and removing an argument ──');
{
  const withArgs = '#note(title: "Alt")[Text]';
  const p1 = parseMacroCall(withArgs)!;
  check('replacing a named argument touches only its value',
    setNamedArg(withArgs, p1, 'title', '"Neu"') === '#note(title: "Neu")[Text]',
    setNamedArg(withArgs, p1, 'title', '"Neu"'));
  check('removing a named argument removes its separator too',
    setNamedArg('#note(title: "Alt", kind: "a")[T]', parseMacroCall('#note(title: "Alt", kind: "a")[T]')!, 'title', null) === '#note(kind: "a")[T]',
    setNamedArg('#note(title: "Alt", kind: "a")[T]', parseMacroCall('#note(title: "Alt", kind: "a")[T]')!, 'title', null));
  check('removing the LAST named argument leaves an empty list, not a stray comma',
    setNamedArg(withArgs, p1, 'title', null) === '#note()[Text]',
    setNamedArg(withArgs, p1, 'title', null));

  // The 170-call shape: no argument list exists yet, so one must be created.
  const bare = '#lead[Ein Absatz.]';
  const pb = parseMacroCall(bare)!;
  check('adding an argument to a paren-less call creates the list',
    setNamedArg(bare, pb, 'size', '12pt') === '#lead(size: 12pt)[Ein Absatz.]',
    setNamedArg(bare, pb, 'size', '12pt'));

  const two = '#note(title: "A")[T]';
  check('adding a second argument reuses the list',
    setNamedArg(two, parseMacroCall(two)!, 'kind', '"warn"') === '#note(title: "A", kind: "warn")[T]',
    setNamedArg(two, parseMacroCall(two)!, 'kind', '"warn"'));

  const trailing = '#cover(\n  title: "A",\n)';
  check('adding after a trailing comma keeps the comma AND the line break',
    setNamedArg(trailing, parseMacroCall(trailing)!, 'sub', '"B"') === '#cover(\n  title: "A", sub: "B",\n)',
    setNamedArg(trailing, parseMacroCall(trailing)!, 'sub', '"B"'));

  const pos = '#modul("2.1", "Titel")[T]';
  check('a positional argument is set by index',
    setPositionalArg(pos, parseMacroCall(pos)!, 1, '"Neuer Titel"') === '#modul("2.1", "Neuer Titel")[T]',
    setPositionalArg(pos, parseMacroCall(pos)!, 1, '"Neuer Titel"'));

  const body = '#note(title: "A")[Alter Text]';
  check('the body is replaced without touching the arguments',
    setBody(body, parseMacroCall(body)!, 'Neuer Text') === '#note(title: "A")[Neuer Text]',
    setBody(body, parseMacroCall(body)!, 'Neuer Text'));

  // The whole reason for byte ranges: nothing else may be regenerated.
  const live = '#modul("2.1", "Titel", stand: datetime.today())[\n  // ein Kommentar\n  Text.\n]';
  const pl = parseMacroCall(live)!;
  const edited = setPositionalArg(live, pl, 1, '"Anderer Titel"')!;
  check('a live value in a sibling argument is NOT re-evaluated', edited.includes('datetime.today()'), edited);
  check('a comment inside the body survives an argument edit', edited.includes('// ein Kommentar'), edited);
  check('the author\'s line breaks survive', edited.includes('\n  Text.\n'), edited);
}

// ─── 5. IDENTITY over the real corpus ───────────────────────────────────────
//
// Every argument of every real call spliced with its OWN value. Byte-identical,
// or a range is off by one somewhere no fixture would ever show.
console.log('\n── Identity over every real call site ──');
{
  function walk(d: string, o: string[] = []): string[] {
    let e: fs.Dirent[] = [];
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return o; }
    for (const x of e) {
      if (x.name.startsWith('.')) continue;
      const p = path.join(d, x.name);
      if (x.isDirectory()) walk(p, o); else if (x.name.endsWith('.typ')) o.push(p);
    }
    return o;
  }
  function projectsIn(root: string): string[] {
    if (fs.readdirSync(root).some(f => f.endsWith('.typ'))) return [root];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => path.join(root, e.name));
  }

  const { roots, missing } = extraCorpusRoots([]);
  for (const m of missing) console.log(`  ⚠ configured corpus root is missing: ${m}`);
  const searchRoots = [...roots, path.join(REPO, 'resources', 'sample-project'), path.join(REPO, 'resources', 'presets')]
    .filter(r => fs.existsSync(r));

  let instances = 0, argCount = 0, bodyCount = 0, drift = 0, refusedCount = 0;
  const driftExamples: string[] = [];

  for (const root of searchRoots) {
    for (const proj of projectsIn(root)) {
      let index;
      try { index = buildMacroIndex(proj); } catch { continue; }
      for (const f of walk(proj)) {
        const visible = new Set(visibleIn(index, f).map(m => m.name));
        if (!visible.size) continue;
        let doc;
        try { doc = deserializeTypst(fs.readFileSync(f, 'utf-8')) as { content?: unknown[] }; } catch { continue; }
        const scan = (nodes: unknown[]): void => {
          for (const nd of (nodes ?? []) as { type?: string; attrs?: { content?: string }; content?: unknown[] }[]) {
            if (nd.type === 'typstRawBlock') {
              const c = String(nd.attrs?.content ?? '');
              const nm = c.trimStart().match(/^#([\p{L}_][\p{L}\p{N}_-]*)\s*[([]/u);
              if (nm && visible.has(nm[1])) {
                const p = parseMacroCall(c);
                if (!p) { refusedCount++; }
                else {
                  instances++;
                  for (const a of p.args) {
                    argCount++;
                    if (spliceRange(c, a.start, a.end, a.raw) !== c) {
                      drift++;
                      if (driftExamples.length < 5) driftExamples.push(`${nm[1]}(${a.name ?? 'pos'}) in ${path.basename(f)}`);
                    }
                    if (spliceRange(c, a.innerStart, a.innerEnd, c.slice(a.innerStart, a.innerEnd)) !== c) {
                      drift++;
                      if (driftExamples.length < 5) driftExamples.push(`${nm[1]} inner ${a.name ?? 'pos'} in ${path.basename(f)}`);
                    }
                  }
                  if (p.bodyStart !== null && p.bodyEnd !== null) {
                    bodyCount++;
                    if (spliceRange(c, p.bodyStart, p.bodyEnd, c.slice(p.bodyStart, p.bodyEnd)) !== c) {
                      drift++;
                      if (driftExamples.length < 5) driftExamples.push(`${nm[1]} body in ${path.basename(f)}`);
                    }
                  }
                }
              }
            }
            if (nd.content) scan(nd.content);
          }
        };
        scan(doc.content ?? []);
      }
    }
  }

  console.log(`  · ${instances} instances · ${argCount} arguments · ${bodyCount} bodies · ${refusedCount} refused`);
  // A suite that silently found nothing is a suite that passes for the wrong
  // reason — this repo has been bitten by exactly that.
  check('the corpus actually yielded macro instances to check', instances >= 20, instances);
  check('every argument splices back byte-identically', drift === 0, driftExamples);
}

// ─── 6. Splice, then COMPILE ────────────────────────────────────────────────
console.log('\n── A spliced call still compiles ──');
{
  const bin = typstBin();
  if (!bin) {
    console.log('  ✗ no bundled Typst — this section exists to compile, so that is a failure');
    fail++;
  } else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-edit-'));
    fs.writeFileSync(path.join(tmp, 'macros.typ'), `
#let modul(nr, titel, body, preis: none) = block(inset: 8pt)[#strong(titel) #nr #body #preis]
#let note(body, title: "Zur Einordnung") = block(inset: 6pt)[#strong(title) #body]
#let lead(body) = text(size: 13pt)[#body]
#let bildtafel(path, body, caption: none) = block[#figure(image(path), caption: caption) #body]
`);
    const PROBE = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(path.join(tmp, 'p.png'), PROBE);

    // Each case: an original call, and the edit a form would make.
    const cases: [string, string, (src: string) => string | null][] = [
      ['replace a positional', '#modul("2.1", "Titel")[Text]',
        s => setPositionalArg(s, parseMacroCall(s)!, 1, encodeArgValue('string', 'Neuer Titel'))],
      ['replace a named', '#note(title: "Alt")[Text]',
        s => setNamedArg(s, parseMacroCall(s)!, 'title', encodeArgValue('string', 'Neu'))],
      ['add a named to a paren-less call', '#lead[Ein Absatz.]',
        s => s === '#lead[Ein Absatz.]' ? s : s],
      ['remove a named, falling back to the default', '#note(title: "Alt")[Text]',
        s => setNamedArg(s, parseMacroCall(s)!, 'title', null)],
      ['replace a content-block argument', '#bildtafel("p.png", caption: [Alt])[Text]',
        s => setNamedArg(s, parseMacroCall(s)!, 'caption', encodeArgValue('content', 'Eine neue Bildunterschrift'))],
      ['a body containing an unbalanced ]', '#note(title: "A")[Alt]',
        s => setBody(s, parseMacroCall(s)!, 'Der Preis [netto ist gemeint')],
      ['a string argument containing a quote', '#note(title: "A")[T]',
        s => setNamedArg(s, parseMacroCall(s)!, 'title', encodeArgValue('string', 'Er sagte "ja"'))],
      ['a content argument containing markup', '#bildtafel("p.png", caption: [Alt])[T]',
        s => setNamedArg(s, parseMacroCall(s)!, 'caption', encodeArgValue('content', 'Eine Stunde #emph[scheinbar] nichts'))],
    ];

    const body = cases.map(([, src, edit]) => {
      const out = edit(src);
      return out ?? src;
    }).join('\n\n');

    const probe = path.join(tmp, 'probe.typ');
    fs.writeFileSync(probe, `#import "macros.typ": *\n\n${body}\n`);
    const out = path.join(tmp, 'probe.pdf');
    try {
      execFileSync(bin, ['compile', '--package-path', path.join(REPO, 'resources', 'typst-packages'), probe, out], {
        stdio: 'pipe', timeout: 60_000,
      });
      check(`all ${cases.length} spliced calls compile`, true);
    } catch (err) {
      const msg = String((err as { stderr?: Buffer }).stderr ?? (err as Error).message).split('\n').slice(0, 6).join(' | ');
      check(`all ${cases.length} spliced calls compile`, false, msg);
    }

    // Each case individually, so a failure names itself.
    for (const [name, src, edit] of cases) {
      const edited = edit(src);
      if (edited === null) { check(`${name}: edit produced a result`, false); continue; }
      const one = path.join(tmp, 'one.typ');
      fs.writeFileSync(one, `#import "macros.typ": *\n\n${edited}\n`);
      try {
        execFileSync(bin, ['compile', '--package-path', path.join(REPO, 'resources', 'typst-packages'), one, path.join(tmp, 'one.pdf')], {
          stdio: 'pipe', timeout: 60_000,
        });
        check(`${name}: compiles`, true);
      } catch (err) {
        const msg = String((err as { stderr?: Buffer }).stderr ?? (err as Error).message).split('\n').slice(0, 3).join(' | ');
        check(`${name}: compiles`, false, msg);
      }
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ─── 7. The FORM, driven over every real instance ───────────────────────────
//
// The exact functions the node view calls, run against every macro instance in
// the corpus: build the fields, write a value into each, read it back. Write X
// then read X is the invariant that catches an encode/decode mismatch — an
// escape applied on the way in and not undone on the way out looks fine in a
// fixture and corrupts the third caption a user touches.
console.log('\n── The form, over every real instance ──');
{
  function walk(d: string, o: string[] = []): string[] {
    let e: fs.Dirent[] = [];
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return o; }
    for (const x of e) {
      if (x.name.startsWith('.')) continue;
      const p = path.join(d, x.name);
      if (x.isDirectory()) walk(p, o); else if (x.name.endsWith('.typ')) o.push(p);
    }
    return o;
  }
  function projectsIn(root: string): string[] {
    if (fs.readdirSync(root).some(f => f.endsWith('.typ'))) return [root];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => path.join(root, e.name));
  }

  const searchRoots = [
    ...extraCorpusRoots([]).roots,
    path.join(REPO, 'resources', 'sample-project'),
    path.join(REPO, 'resources', 'presets'),
  ].filter(r => fs.existsSync(r));

  const NEW_TEXT = 'Ein neuer Wert (mit Klammer';   // the shape that broke Stufe 0
  let edits = 0, mismatches = 0, unparseable = 0, fieldsSeen = 0;
  const problems: string[] = [];

  for (const root of searchRoots) {
    for (const proj of projectsIn(root)) {
      let index;
      try { index = buildMacroIndex(proj); } catch { continue; }
      const catalogue = new Map(listProjectMacrosFor(proj).map(m => [m.name, m]));
      for (const f of walk(proj)) {
        const visible = new Set(visibleIn(index, f).map(m => m.name));
        if (!visible.size) continue;
        let doc;
        try { doc = deserializeTypst(fs.readFileSync(f, 'utf-8')) as { content?: unknown[] }; } catch { continue; }
        const scan = (nodes: unknown[]): void => {
          for (const nd of (nodes ?? []) as { type?: string; attrs?: { content?: string }; content?: unknown[] }[]) {
            if (nd.type === 'typstRawBlock') {
              const c = String(nd.attrs?.content ?? '');
              const parsed = parseMacroCall(c);
              const macro = parsed ? catalogue.get(parsed.name) : undefined;
              if (parsed && macro && visible.has(parsed.name)) {
                for (const field of macroFormFields(macro, c)) {
                  fieldsSeen++;
                  // A path field names a file; changing it to prose is a
                  // deliberate non-edit here (the app offers a picker instead).
                  if (field.isPath) continue;
                  // An expression field is code, written back verbatim — a
                  // prose value in it is the user's problem, not the form's.
                  if (field.kind === 'expr') continue;
                  const next = writeMacroField(c, field.key, field.kind, NEW_TEXT);
                  if (next === null) { problems.push(`${parsed.name}.${field.key}: refused`); continue; }
                  edits++;
                  if (!parseMacroCall(next)) {
                    unparseable++;
                    if (problems.length < 6) problems.push(`${parsed.name}.${field.key}: no longer parses`);
                    continue;
                  }
                  const back = readMacroField(next, field.key);
                  if (back !== NEW_TEXT) {
                    mismatches++;
                    if (problems.length < 6) problems.push(`${parsed.name}.${field.key}: wrote ${JSON.stringify(NEW_TEXT)} read ${JSON.stringify(back)}`);
                  }
                }
              }
            }
            if (nd.content) scan(nd.content);
          }
        };
        scan(doc.content ?? []);
      }
    }
  }

  console.log(`  · ${fieldsSeen} fields across the corpus · ${edits} edits applied`);
  // The floor exists to stop this loop passing by finding NOTHING — the
  // green-by-absence trap CLAUDE.md names. It has to be calibrated against what
  // the SHIPPED `resources/` alone yields (39 edits, 33 instances), not against
  // this machine: a gate that goes red on a clean clone just because
  // `penwright.corpus.json` is absent is a gate that gets ignored.
  check('the corpus actually yielded fields to edit', edits >= 25, edits);
  check('an edited call still parses — the form never locks itself out', unparseable === 0, problems);
  check('what the form writes is what the form reads back', mismatches === 0, problems);
}

console.log(`\n──────────\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
