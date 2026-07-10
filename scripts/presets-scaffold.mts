/**
 * Preset scaffolder — deterministically generates rich, compile-ready preset
 * FOLDERS from curated specs. Each spec supplies a design (a ProjectStyle
 * partial) + a content `kind`; a per-kind generator emits a real project
 * (main.typ + chapters + placeholder assets), all Lorem-filled to overwrite.
 *
 *   npx tsx scripts/presets-scaffold.mts            # (re)generate all specs
 *   npx tsx scripts/presets-scaffold.mts thesis-classic doc-clean   # a subset
 *
 * Design-intensive MAGAZINE presets are hand-authored (see magazine-slow), not
 * scaffolded. After scaffolding, run `node scripts/presets-build.mjs` to compile
 * every preset with the bundled Typst and render thumbnails.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { generateStyleTypst } from '../src/shared/styleParser.ts';
import { sanitizeProjectStyle, type ProjectStyle } from '../src/shared/styleTypes.ts';

const repo = fileURLToPath(new URL('..', import.meta.url));
const presetsDir = path.join(repo, 'resources', 'presets');
const PLACEHOLDER = path.join(presetsDir, '_shared', 'placeholder.typ');
const FONTS = path.join(repo, 'resources', 'fonts');

function typstBin(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const plat = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux';
  const binDir = path.join(repo, 'resources', 'bin');
  for (const c of [`typst-${arch}-${plat}`, `typst-${arch}-${plat}.exe`]) {
    const p = path.join(binDir, c);
    if (fs.existsSync(p)) return p;
  }
  const any = fs.readdirSync(binDir).find((f) => f.startsWith('typst-'));
  return any ? path.join(binDir, any) : 'typst';
}
const TYPST = typstBin();

// ─── Lorem corpus ────────────────────────────────────────────────────────────
const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.',
  'Qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.',
  'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.',
  'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate.',
  'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae itaque earum rerum hic tenetur.',
];
const p = (i: number) => LOREM[i % LOREM.length];
const paras = (from: number, n: number) => Array.from({ length: n }, (_, k) => p(from + k)).join('\n\n');
const TITLES = ['Lorem Ipsum', 'Dolor Sit Amet', 'Consectetur', 'Adipiscing Elit', 'Sed Do Eiusmod', 'Tempor Incididunt', 'Ut Labore', 'Magna Aliqua'];

// ─── Content generators (per kind) ────────────────────────────────────────────
interface Asset { name: string; w: number; h: number; label: string }
interface Gen { files: Record<string, string>; assets?: Asset[]; openFile: string }
type Spec = {
  id: string; type: string; kind?: string; order?: number; thumbnailPage?: number;
  label: { en: string; de: string }; tagline: { en: string; de: string };
  highlights?: { en: string[]; de: string[] };
  openFile?: string;
  /** Generator kinds use a ProjectStyle partial. */
  style?: Partial<ProjectStyle>;
  /** Variant presets inherit their CONTENT (chapters/macros/assets) from another
   *  preset and only restyle it — the theme-aware magazine chapters re-theme. */
  baseFrom?: string;
  styleOverride?: { colors?: Record<string, string>; fonts?: Record<string, string>; layout?: Record<string, unknown> };
  sectionOverrides?: Record<string, { colors?: Record<string, string>; fonts?: Record<string, string>; columns?: number }>;
};

const importHead = '#import "style.typ": *\n#show: apply-style\n';

function genDocument(): Gen {
  const body = `${importHead}
= Untitled Document

${p(0)}

== ${TITLES[1]}

${paras(1, 2)}

== ${TITLES[2]}

${p(3)}

- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
- Sed do eiusmod tempor incididunt

${p(4)}
`;
  return { files: { 'main.typ': body }, openFile: 'main.typ' };
}

function genThesis(): Gen {
  const main = `${importHead}
#align(center)[
  #v(3cm)
  #text(size: 24pt, weight: "bold")[Thesis Title]
  #v(1em)
  Author Name
  #v(0.5em)
  #datetime.today().display("[month repr:long] [year]")
]

#pagebreak()
#outline()
#pagebreak()

#include "chapters/01-introduction.typ"
#include "chapters/02-background.typ"
#include "chapters/03-method.typ"
#include "chapters/04-results.typ"
#include "chapters/05-conclusion.typ"

#pagebreak()
#bibliography("references.bib", title: "References")
`;
  const chap = (title: string, from: number) => `= ${title}\n\n${paras(from, 3)}\n`;
  return {
    files: {
      'main.typ': main,
      'chapters/01-introduction.typ': chap('Introduction', 0),
      'chapters/02-background.typ': chap('Background', 2),
      'chapters/03-method.typ': chap('Method', 4),
      'chapters/04-results.typ': chap('Results', 1),
      'chapters/05-conclusion.typ': chap('Conclusion', 3),
      'references.bib': '// Add your bibliography entries here, e.g.:\n// @article{key2026, title={...}, author={...}, year={2026}}\n',
    },
    openFile: 'chapters/01-introduction.typ',
  };
}

function genPaper(): Gen {
  const body = `${importHead}
#align(center)[
  #text(size: 17pt, weight: "bold")[Paper Title]
  #v(0.6em)
  Author Name #h(1.5em) Second Author
  #v(0.2em)
  #text(style: "italic", size: 0.9em)[Institution · author\\@example.com]
]

#v(1em)

#block(inset: (x: 1.2em), [
  #text(weight: "bold")[Abstract. ] ${p(2)}
])

#v(1em)

= Introduction
${paras(0, 2)}

= Related Work
${p(3)}

= Method
${paras(4, 2)}

= Results
${p(1)}

= Conclusion
${p(6)}

#bibliography("references.bib", title: "References")
`;
  return {
    files: { 'main.typ': body, 'references.bib': '// Add references here.\n' },
    openFile: 'main.typ',
  };
}

function genLetter(): Gen {
  const body = `${importHead}
#align(right)[
  Your Name \\
  Street Address \\
  City, ZIP \\
  #datetime.today().display("[month repr:long] [day], [year]")
]

#v(1.5em)

Recipient Name \\
Company \\
Street Address \\
City, ZIP

#v(1.5em)

*Re: Subject line*

#v(0.5em)

Dear Recipient,

${p(0)}

${p(1)}

${p(5)}

#v(1em)

Sincerely,

#v(1.5em)

Your Name
`;
  return { files: { 'main.typ': body }, openFile: 'main.typ' };
}

function genBook(): Gen {
  const main = `${importHead}
#align(center + horizon)[
  #text(size: 28pt, weight: "bold")[Book Title]
  #v(1em)
  #text(size: 14pt)[Author Name]
]

#pagebreak()
#outline()
#pagebreak()

#include "chapters/01-chapter.typ"
#include "chapters/02-chapter.typ"
#include "chapters/03-chapter.typ"
`;
  const chap = (n: string, from: number) => `= ${n}\n\n${paras(from, 4)}\n`;
  return {
    files: {
      'main.typ': main,
      'chapters/01-chapter.typ': chap('Chapter One', 0),
      'chapters/02-chapter.typ': chap('Chapter Two', 3),
      'chapters/03-chapter.typ': chap('Chapter Three', 5),
    },
    openFile: 'chapters/01-chapter.typ',
  };
}

function genReport(): Gen {
  const body = `${importHead}
// ── Cover ──
#block(breakable: false)[
  #v(4cm)
  #text(size: 0.85em, weight: "bold", tracking: 0.2em, fill: style-colors.accent)[#upper("Report")]
  #v(0.6em)
  #text(size: 32pt, weight: "bold")[Report Title]
  #v(0.4em)
  #text(size: 1.2em, fill: style-colors.muted)[A subtitle for this report — replace with your own.]
  #v(1fr)
  #text(size: 0.9em, fill: style-colors.muted)[Prepared by · Author Name #h(1fr) #datetime.today().display("[month repr:long] [year]")]
]

#pagebreak()

= Executive Summary
${paras(0, 2)}

= Findings
${p(2)}

#figure(
  table(
    columns: 3,
    [*Metric*], [*Q1*], [*Q2*],
    [Lorem], [42], [58],
    [Ipsum], [31], [47],
    [Dolor], [76], [69],
  ),
  caption: [A placeholder data table.],
)

${p(3)}

= Recommendations
${p(5)}

+ Lorem ipsum dolor sit amet
+ Consectetur adipiscing elit
+ Sed do eiusmod tempor incididunt
`;
  return { files: { 'main.typ': body }, openFile: 'main.typ' };
}

function genNewsletter(): Gen {
  const body = `${importHead}
#align(center)[
  #text(size: 34pt, weight: "bold")[THE NEWSLETTER]
  #v(0.2em)
  #text(size: 0.85em, tracking: 0.2em, fill: style-colors.muted)[ISSUE 01 · #datetime.today().display("[month repr:long] [year]")]
]
#line(length: 100%, stroke: 1pt + style-colors.accent)
#v(1em)

#columns(2, gutter: 1.4em)[
  == ${TITLES[0]}
  ${p(0)}

  == ${TITLES[1]}
  ${p(1)}

  #colbreak()

  == ${TITLES[2]}
  ${p(3)}

  == ${TITLES[3]}
  ${p(5)}
]
`;
  return { files: { 'main.typ': body }, openFile: 'main.typ' };
}

function genPortfolio(): Gen {
  const project = (title: string, img: string, from: number) => `
== ${title}

#figure(image("assets/${img}", width: 100%), caption: [A placeholder project image.])

${p(from)}

#grid(columns: 3, column-gutter: 1em,
  [#text(weight: "bold", fill: style-colors.accent)[Role] \\ Design],
  [#text(weight: "bold", fill: style-colors.accent)[Year] \\ 2026],
  [#text(weight: "bold", fill: style-colors.accent)[Client] \\ Lorem Inc.],
)
`;
  const body = `${importHead}
#text(size: 30pt, weight: "bold")[Portfolio]
#v(0.2em)
#text(size: 1.1em, fill: style-colors.muted)[Selected work — replace with your own projects.]
#v(1.5em)
${project('Project One', 'work-1.png', 0)}
#pagebreak()
${project('Project Two', 'work-2.png', 3)}
`;
  return {
    files: { 'main.typ': body },
    assets: [
      { name: 'work-1.png', w: 1600, h: 1000, label: 'Project 1' },
      { name: 'work-2.png', w: 1600, h: 1000, label: 'Project 2' },
    ],
    openFile: 'main.typ',
  };
}

function genCookbook(): Gen {
  const recipe = (title: string, img: string, from: number) => `
= ${title}

#grid(columns: (1fr, 1fr), column-gutter: 1.5em, align: top,
  [
    #figure(image("assets/${img}", width: 100%), caption: [Serves 4 · 30 min])
  ],
  [
    #text(weight: "bold", fill: style-colors.accent)[#upper("Ingredients")]
    #v(0.3em)
    - 200 g lorem ipsum
    - 2 dolor sit amet
    - 1 tbsp consectetur
    - a pinch of adipiscing
  ],
)

#v(0.5em)
#text(weight: "bold", fill: style-colors.accent)[#upper("Method")]
#v(0.3em)
+ ${p(from)}
+ ${p(from + 1)}
+ ${p(from + 2)}
`;
  const body = `${importHead}
#align(center)[
  #text(size: 30pt, weight: "bold")[The Cookbook]
  #v(0.2em)
  #text(size: 1.1em, style: "italic", fill: style-colors.muted)[A sample of recipes — replace with your own.]
]
#pagebreak()
${recipe('Lorem Ipsum Soup', 'dish-1.png', 0)}
#pagebreak()
${recipe('Dolor Sit Amet Salad', 'dish-2.png', 3)}
`;
  return {
    files: { 'main.typ': body },
    assets: [
      { name: 'dish-1.png', w: 1400, h: 1000, label: 'Dish 1' },
      { name: 'dish-2.png', w: 1400, h: 1000, label: 'Dish 2' },
    ],
    openFile: 'main.typ',
  };
}

function genPictureBook(): Gen {
  const spread = (img: string, line: string) =>
    `#align(center, image("assets/${img}", width: 78%))\n#v(0.9em)\n#align(center, text(size: 22pt, fill: style-colors.text)[${line}])\n`;
  const body = `${importHead}
#align(center + horizon)[
  #text(size: 46pt, weight: "bold", fill: style-colors.accent)[The Little Adventure]
  #v(0.6em)
  #text(size: 1.3em, style: "italic", fill: style-colors.muted)[A picture book · by Author Name]
]

#pagebreak()
${spread('scene-1.png', 'Once upon a time, there was a small lorem ipsum.')}
#pagebreak()
${spread('scene-2.png', 'It set off on a big dolor-sit-amet adventure.')}
#pagebreak()
${spread('scene-3.png', 'And everyone lived happily ever after. The end.')}
`;
  return {
    files: { 'main.typ': body },
    assets: [
      { name: 'scene-1.png', w: 1800, h: 1100, label: 'Scene 1' },
      { name: 'scene-2.png', w: 1800, h: 1100, label: 'Scene 2' },
      { name: 'scene-3.png', w: 1800, h: 1100, label: 'Scene 3' },
    ],
    openFile: 'main.typ',
  };
}

const GENERATORS: Record<string, () => Gen> = {
  document: genDocument, thesis: genThesis, paper: genPaper, letter: genLetter,
  book: genBook, report: genReport, newsletter: genNewsletter,
  portfolio: genPortfolio, cookbook: genCookbook, picturebook: genPictureBook,
};

// ─── Curated specs (design variants per type) ─────────────────────────────────
const SPECS: Spec[] = [
  // ── Magazine variants: inherit magazine-slow's per-chapter layouts, restyle. ──
  {
    id: 'magazine-bold', type: 'magazine', order: 20, baseFrom: 'magazine-slow',
    label: { en: 'Bold / Contemporary', de: 'Bold / Zeitgenössisch' },
    tagline: { en: 'High-contrast issue — grotesk display, crimson accent.', de: 'Kontraststarkes Heft — Grotesk-Display, Karmin-Akzent.' },
    highlights: { en: ['6 chapters, each a different layout', 'Inter display + serif body'], de: ['6 Kapitel, je ein Layout', 'Inter-Display + Serifen-Text'] },
    openFile: 'chapters/01-editorial.typ',
    styleOverride: {
      colors: { primary: '#111111', accent: '#e11d48', text: '#141414', background: '#ffffff', muted: '#6b7280' },
      fonts: { body: 'Spectral', heading: 'Inter' },
      layout: { pageHeader: '#text(size: 0.74em, weight: "bold", tracking: 0.14em, fill: style-colors.text)[MAGAZINE] #h(1fr) #text(size: 0.74em, tracking: 0.14em, fill: style-colors.muted)[ISSUE 01 · 2026]' },
    },
    sectionOverrides: {
      feature: { colors: { accent: '#e11d48' }, fonts: { heading: 'Inter' } },
      interview: { colors: { accent: '#2563eb' }, fonts: { heading: 'Inter', body: 'Inter' } },
      essay: { colors: { accent: '#b91c1c' }, fonts: { heading: 'Spectral', body: 'Spectral' } },
      'photo-essay': { colors: { accent: '#111111' }, fonts: { heading: 'Inter' } },
      department: { colors: { accent: '#db2777' }, fonts: { heading: 'Inter', body: 'Inter' } },
    },
  },
  {
    id: 'magazine-mono', type: 'magazine', order: 30, baseFrom: 'magazine-slow',
    label: { en: 'Mono / Minimal', de: 'Mono / Minimal' },
    tagline: { en: 'Swiss-minimal issue — grotesk throughout, quiet greys.', de: 'Swiss-minimales Heft — durchgehend Grotesk, ruhige Grautöne.' },
    highlights: { en: ['6 chapters, each a different layout', 'Inter everywhere, generous whitespace'], de: ['6 Kapitel, je ein Layout', 'Überall Inter, viel Weißraum'] },
    openFile: 'chapters/01-editorial.typ',
    styleOverride: {
      colors: { primary: '#111111', accent: '#525252', text: '#171717', background: '#ffffff', muted: '#a3a3a3' },
      fonts: { body: 'Inter', heading: 'Inter' },
      layout: { pageHeader: '#text(size: 0.74em, tracking: 0.18em, fill: style-colors.muted)[MAGAZINE] #h(1fr) #text(size: 0.74em, tracking: 0.18em, fill: style-colors.muted)[01]' },
    },
    sectionOverrides: {
      feature: { colors: { accent: '#171717' }, fonts: { heading: 'Inter', body: 'Inter' } },
      interview: { colors: { accent: '#404040' }, fonts: { heading: 'Inter', body: 'Inter' } },
      essay: { colors: { accent: '#525252' }, fonts: { heading: 'Inter', body: 'Inter' } },
      'photo-essay': { colors: { accent: '#000000' }, fonts: { heading: 'Inter', body: 'Inter' } },
      department: { colors: { accent: '#737373' }, fonts: { heading: 'Inter', body: 'Inter' } },
    },
  },
  {
    id: 'doc-clean', type: 'document', kind: 'document', order: 20,
    label: { en: 'Clean', de: 'Schlicht' }, tagline: { en: 'Minimal modern document, sans-serif.', de: 'Minimalistisches modernes Dokument, serifenlos.' },
    style: { colors: { primary: '#1f2933', accent: '#2b6cb0', text: '#1f2933', background: '#ffffff', muted: '#7b8794' }, fonts: { body: 'Inter', heading: 'Inter', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.7em', paragraphSpacing: '0.9em', firstLineIndent: '0pt' }, layout: { margin: '3cm' } as any },
  },
  {
    id: 'doc-editorial', type: 'document', kind: 'document', order: 30,
    label: { en: 'Editorial', de: 'Editorial' }, tagline: { en: 'Warm serif document with an accent.', de: 'Warmes Serifen-Dokument mit Akzent.' },
    style: { colors: { primary: '#2d2a26', accent: '#a15c2b', text: '#2d2a26', background: '#fbfaf7', muted: '#8a8078' }, fonts: { body: 'Spectral', heading: 'Spectral', code: 'IBM Plex Mono' }, scale: { base: '12pt', leading: '0.72em', paragraphSpacing: '', firstLineIndent: '1.1em' } },
  },
  {
    id: 'thesis-classic', type: 'thesis', kind: 'thesis', order: 20,
    label: { en: 'Classic', de: 'Klassisch' }, tagline: { en: 'Traditional serif academic thesis, numbered.', de: 'Klassische Serifen-Abschlussarbeit, nummeriert.' },
    highlights: { en: ['Title page, TOC, chapters, bibliography'], de: ['Titelseite, Inhalt, Kapitel, Literatur'] },
    style: { colors: { primary: '#1a2a3a', accent: '#1a4971', text: '#1a1a1a', background: '#ffffff', muted: '#6b7280' }, fonts: { body: 'New Computer Modern', heading: 'New Computer Modern', code: 'DejaVu Sans Mono' }, scale: { base: '11pt', leading: '0.68em', paragraphSpacing: '', firstLineIndent: '1em' }, headings: { numbering: '1.1' } as any },
  },
  {
    id: 'thesis-modern', type: 'thesis', kind: 'thesis', order: 30,
    label: { en: 'Modern', de: 'Modern' }, tagline: { en: 'Sans headings, serif body — a contemporary thesis.', de: 'Serifenlose Überschriften, Serifen-Text — moderne Arbeit.' },
    style: { colors: { primary: '#14342f', accent: '#0e7c66', text: '#1c2321', background: '#ffffff', muted: '#6b7676' }, fonts: { body: 'IBM Plex Serif', heading: 'IBM Plex Sans', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.7em', paragraphSpacing: '', firstLineIndent: '1em' }, headings: { numbering: '1.1' } as any },
  },
  {
    id: 'paper-preprint', type: 'paper', kind: 'paper', order: 20,
    label: { en: 'Preprint', de: 'Preprint' }, tagline: { en: 'Compact academic preprint with abstract.', de: 'Kompakter akademischer Preprint mit Abstract.' },
    style: { colors: { primary: '#1a1a1a', accent: '#7a1f2b', text: '#1a1a1a', background: '#ffffff', muted: '#6b7280' }, fonts: { body: 'New Computer Modern', heading: 'New Computer Modern', code: 'DejaVu Sans Mono' }, scale: { base: '10pt', leading: '0.62em', paragraphSpacing: '', firstLineIndent: '1em' }, headings: { numbering: '1.' } as any },
  },
  {
    id: 'letter-formal', type: 'letter', kind: 'letter', order: 20,
    label: { en: 'Formal', de: 'Formell' }, tagline: { en: 'A classic formal letter.', de: 'Ein klassischer formeller Brief.' },
    style: { colors: { primary: '#1a1a1a', accent: '#333333', text: '#1a1a1a', background: '#ffffff', muted: '#777777' }, fonts: { body: 'IBM Plex Serif', heading: 'IBM Plex Serif', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.7em', paragraphSpacing: '0.9em', firstLineIndent: '0pt' } },
  },
  {
    id: 'letter-modern', type: 'letter', kind: 'letter', order: 30,
    label: { en: 'Modern', de: 'Modern' }, tagline: { en: 'A clean sans-serif letter.', de: 'Ein klarer serifenloser Brief.' },
    style: { colors: { primary: '#1f2933', accent: '#2b6cb0', text: '#1f2933', background: '#ffffff', muted: '#7b8794' }, fonts: { body: 'Inter', heading: 'Inter', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.72em', paragraphSpacing: '0.9em', firstLineIndent: '0pt' } },
  },
  {
    id: 'book-novel', type: 'book', kind: 'book', order: 20,
    label: { en: 'Novel', de: 'Roman' }, tagline: { en: 'Warm A5 novel with chapters.', de: 'Warmer A5-Roman mit Kapiteln.' },
    style: { colors: { primary: '#2b2622', accent: '#8a5a3c', text: '#2b2622', background: '#fdfbf6', muted: '#8a8078' }, fonts: { body: 'Crimson Pro', heading: 'Crimson Pro', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.72em', paragraphSpacing: '', firstLineIndent: '1.1em' }, layout: { paper: 'a5', margin: '2cm' } as any },
  },
  {
    id: 'book-picture', type: 'book', kind: 'picturebook', order: 30, thumbnailPage: 2,
    label: { en: 'Picture Book', de: 'Bilderbuch' }, tagline: { en: 'Landscape picture book — big images, big words.', de: 'Bilderbuch im Querformat — große Bilder, große Worte.' },
    highlights: { en: ['Landscape spreads · image + one line'], de: ['Querformat-Spreads · Bild + eine Zeile'] },
    style: { colors: { primary: '#20504a', accent: '#e07a5f', text: '#2b2622', background: '#fefaf3', muted: '#9a8f80' }, fonts: { body: 'Spectral', heading: 'Spectral', code: 'IBM Plex Mono' }, scale: { base: '13pt', leading: '0.8em', paragraphSpacing: '1em', firstLineIndent: '0pt' }, layout: { paper: 'a4', orientation: 'landscape', margin: '2.2cm' } as any },
  },
  {
    id: 'report-corporate', type: 'report', kind: 'report', order: 20,
    label: { en: 'Corporate', de: 'Corporate' }, tagline: { en: 'Cover, executive summary, findings, table.', de: 'Deckblatt, Management-Summary, Ergebnisse, Tabelle.' },
    highlights: { en: ['Cover page + data table', 'Sans-serif, strong accent'], de: ['Deckblatt + Datentabelle', 'Serifenlos, kräftiger Akzent'] },
    style: { colors: { primary: '#0f2942', accent: '#1f6feb', text: '#1c2733', background: '#ffffff', muted: '#64748b' }, fonts: { body: 'IBM Plex Sans', heading: 'IBM Plex Sans', code: 'IBM Plex Mono' }, scale: { base: '10.5pt', leading: '0.68em', paragraphSpacing: '0.8em', firstLineIndent: '0pt' } },
  },
  {
    id: 'newsletter-brief', type: 'newsletter', kind: 'newsletter', order: 20,
    label: { en: 'Brief', de: 'Brief' }, tagline: { en: 'Two-column newsletter with a masthead.', de: 'Zweispaltiger Newsletter mit Titelkopf.' },
    style: { colors: { primary: '#1a1a1a', accent: '#c2410c', text: '#1a1a1a', background: '#ffffff', muted: '#6b7280' }, fonts: { body: 'IBM Plex Serif', heading: 'IBM Plex Sans', code: 'IBM Plex Mono' }, scale: { base: '10pt', leading: '0.66em', paragraphSpacing: '0.7em', firstLineIndent: '0pt' } },
  },
  {
    id: 'portfolio-grid', type: 'portfolio', kind: 'portfolio', order: 20, thumbnailPage: 2,
    label: { en: 'Grid', de: 'Grid' }, tagline: { en: 'Image-led project pages with metrics.', de: 'Bildgeführte Projektseiten mit Kennzahlen.' },
    style: { colors: { primary: '#18181b', accent: '#7c3aed', text: '#18181b', background: '#ffffff', muted: '#71717a' }, fonts: { body: 'Inter', heading: 'Inter', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.7em', paragraphSpacing: '0.9em', firstLineIndent: '0pt' } },
  },
  {
    id: 'cookbook-recipe', type: 'cookbook', kind: 'cookbook', order: 20, thumbnailPage: 2,
    label: { en: 'Recipe', de: 'Rezept' }, tagline: { en: 'Recipe pages — image, ingredients, steps.', de: 'Rezeptseiten — Bild, Zutaten, Schritte.' },
    style: { colors: { primary: '#3a2417', accent: '#b45309', text: '#3a2417', background: '#fdf9f3', muted: '#9a7b5f' }, fonts: { body: 'Spectral', heading: 'IBM Plex Sans', code: 'IBM Plex Mono' }, scale: { base: '11pt', leading: '0.72em', paragraphSpacing: '0.8em', firstLineIndent: '0pt' } },
  },
];

// ─── Placeholder image render ─────────────────────────────────────────────────
function renderPlaceholder(out: string, w: number, h: number, label: string): void {
  execFileSync(TYPST, [
    'compile', '--font-path', FONTS,
    '--input', `w=${w}`, '--input', `h=${h}`, '--input', `label=${label}`,
    '--format', 'png', '--ppi', '72', PLACEHOLDER, out,
  ], { stdio: 'ignore' });
}

// Copies a base preset's CONTENT (chapters/macros/main/assets) into a variant,
// leaving out the design + library files (the variant writes its own).
const SKIP_ON_INHERIT = new Set(['.penwright', 'style.typ', 'preset.json', 'thumbnail.png']);
function copyContent(src: string, dest: string, top = true): void {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (top && SKIP_ON_INHERIT.has(e.name)) continue;
    if (e.name === '.DS_Store') continue;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyContent(s, d, false); }
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

// ─── Scaffold ─────────────────────────────────────────────────────────────────
const only = process.argv.slice(2);
const specs = only.length ? SPECS.filter((s) => only.includes(s.id)) : SPECS;

for (const spec of specs) {
  const dir = path.join(presetsDir, spec.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, '.penwright'), { recursive: true });

  let openFile = spec.openFile ?? 'main.typ';

  if (spec.baseFrom) {
    // Variant: inherit the base preset's theme-aware content, restyle only.
    const baseDir = path.join(presetsDir, spec.baseFrom);
    const base = JSON.parse(fs.readFileSync(path.join(baseDir, '.penwright', 'style.json'), 'utf-8'));
    if (spec.styleOverride?.colors) base.colors = { ...base.colors, ...spec.styleOverride.colors };
    if (spec.styleOverride?.fonts) base.fonts = { ...base.fonts, ...spec.styleOverride.fonts };
    if (spec.styleOverride?.layout) base.layout = { ...base.layout, ...spec.styleOverride.layout };
    for (const sec of base.sections ?? []) {
      const o = spec.sectionOverrides?.[sec.id];
      if (!o) continue;
      if (o.colors) sec.colors = { ...sec.colors, ...o.colors };
      if (o.fonts) sec.fonts = { ...sec.fonts, ...o.fonts };
      if (o.columns !== undefined) sec.columns = o.columns;
    }
    const style = sanitizeProjectStyle(base);
    fs.writeFileSync(path.join(dir, '.penwright', 'style.json'), JSON.stringify(style, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'style.typ'), generateStyleTypst(style), 'utf-8');
    copyContent(baseDir, dir);
  } else {
    const style = sanitizeProjectStyle(spec.style as ProjectStyle);
    fs.writeFileSync(path.join(dir, '.penwright', 'style.json'), JSON.stringify(style, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'style.typ'), generateStyleTypst(style), 'utf-8');

    const gen = GENERATORS[spec.kind ?? ''];
    if (!gen) { console.log('  ✗', spec.id, '— no generator for kind', spec.kind); continue; }
    const out = gen();
    for (const [rel, content] of Object.entries(out.files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf-8');
    }
    if (out.assets?.length) {
      const assetsDir = path.join(dir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      for (const a of out.assets) renderPlaceholder(path.join(assetsDir, a.name), a.w, a.h, a.label);
    }
    openFile = out.openFile;
  }

  const manifest = {
    id: spec.id, type: spec.type,
    label: spec.label, tagline: spec.tagline,
    ...(spec.highlights ? { highlights: spec.highlights } : {}),
    root: 'main.typ', openFile, order: spec.order ?? 50,
    ...(spec.thumbnailPage ? { thumbnailPage: spec.thumbnailPage } : {}),
  };
  fs.writeFileSync(path.join(dir, 'preset.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('  ✓ scaffolded', spec.id, `(${spec.type}${spec.baseFrom ? ' ← ' + spec.baseFrom : ''})`);
}

console.log(`\nScaffolded ${specs.length} preset(s). Now run: node scripts/presets-build.mjs\n`);
