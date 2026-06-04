/**
 * Templates for the "New Project" command.
 */

export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  files: Record<string, string>;
}

export const templates: ProjectTemplate[] = [
  {
    id: 'document',
    label: 'Document',
    description: 'Simple document with basic setup',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)
#set par(leading: 0.65em, spacing: 1.2em)

= My Document

Start writing here...
`,
    },
  },
  {
    id: 'thesis',
    label: 'Thesis',
    description: 'Academic thesis with chapters and bibliography',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "1.1")

#align(center)[
  #text(size: 24pt, weight: "bold")[Thesis Title]

  #v(1em)

  Author Name

  #v(0.5em)

  #datetime.today().display("[month repr:long] [day], [year]")
]

#pagebreak()

#outline()

#pagebreak()

#include "chapters/01-introduction.typ"
`,
      'chapters/01-introduction.typ': `= Introduction

Start writing your introduction here...
`,
      'bibliography.bib': `// Add your bibliography entries here
`,
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Academic paper with abstract and references',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 10pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "1.")

#align(center)[
  #text(size: 16pt, weight: "bold")[Paper Title]

  #v(0.5em)

  Author Name

  _Institution_
]

#v(1em)

*Abstract.* Write your abstract here...

#v(1em)

= Introduction

Start writing here...

= Related Work

= Method

= Results

= Conclusion
`,
      'bibliography.bib': `// Add your bibliography entries here
`,
    },
  },
  {
    id: 'letter',
    label: 'Letter',
    description: 'Formal letter',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)

#align(right)[
  #datetime.today().display("[month repr:long] [day], [year]")
]

#v(2em)

Recipient Name \\
Street Address \\
City, ZIP

#v(2em)

*Subject: Your Subject*

#v(1em)

Dear Recipient,

Start writing here...

#v(2em)

Sincerely,

Your Name
`,
    },
  },
  {
    id: 'book',
    label: 'Book',
    description: 'Book with chapters, table of contents',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a5", margin: 2cm)
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "1.")

#align(center + horizon)[
  #text(size: 28pt, weight: "bold")[Book Title]

  #v(1em)

  #text(size: 16pt)[Author Name]
]

#pagebreak()

#outline()

#pagebreak()

#include "chapters/01-chapter.typ"
`,
      'chapters/01-chapter.typ': `= Chapter One

Start writing here...
`,
    },
  },
  {
    id: 'magazine',
    label: 'Magazine',
    description: 'Editorial magazine with cover, editorial, TOC, and article chapters',
    files: {
      // Designed for the Slow-Media workflow in ai-magazine-designer:
      // the cover-designer skill rewrites chapters/00-cover.typ; the
      // typst-architekt skill appends article chapters after the marker.
      'main.typ': `// Magazine template — Slow Media editorial layout.
// Out-of-the-box compile uses plain #set rules. For the Design Editor,
// run penwright_update_style or penwright_generate_layout("magazine") to
// generate .penwright/style.json + style.typ.

#set document(title: "Magazine Issue", author: "Editor")
#set page(paper: "a4", margin: (x: 2cm, y: 2.2cm))
#set text(font: "New Computer Modern", size: 10pt, lang: "de")
#set par(leading: 0.75em, spacing: 1.2em, first-line-indent: 0pt, justify: true)
#set heading(numbering: none)

// ─── Cover ────────────────────────────────────────────────────────
#include "chapters/00-cover.typ"
#pagebreak()

// ─── Editorial ────────────────────────────────────────────────────
#include "chapters/01-editorial.typ"
#pagebreak()

// ─── Table of Contents ────────────────────────────────────────────
#include "chapters/02-toc.typ"
#pagebreak()

// ─── Articles ─────────────────────────────────────────────────────
// The typst-architekt skill appends #include lines below for each
// article from ai-magazine-designer's articles/ folder.
`,
      'chapters/_cover-macro.typ': `// Magazine cover macro — definition only. The cover-designer skill
// rewrites chapters/00-cover.typ (the macro CALL) with each issue's
// real values. The macro itself stays stable across issues.

#let magazine-cover(
  title: "Untitled",
  subtitle: none,
  date: "",
  theme: none,
  accent: rgb("#b8845f"),
) = [
  #set page(margin: 0pt)
  #pad(x: 3cm, top: 5cm, bottom: 2.5cm)[
    #v(2cm)
    #text(size: 56pt, weight: "bold", tracking: -1.5pt)[#title]
    #if subtitle != none [
      #v(0.6em)
      #text(size: 20pt, fill: rgb("#444444"))[#subtitle]
    ]
    #v(1fr)
    #line(length: 4cm, stroke: 2pt + accent)
    #v(0.4em)
    #text(size: 10pt, tracking: 2pt)[#upper(date)]
    #if theme != none [
      #linebreak()
      #text(size: 10pt, fill: rgb("#666666"))[#theme]
    ]
  ]
]
`,
      'chapters/00-cover.typ': `// Cover invocation — rewritten by the cover-designer skill per issue.
// Do not edit the macro definition here; that lives in _cover-macro.typ.

#import "_cover-macro.typ": magazine-cover

#magazine-cover(
  title: "Magazin",
  subtitle: "Erstausgabe",
  date: "2026-05",
  theme: "Slow Media",
)
`,
      'chapters/01-editorial.typ': `= Editorial

*Liebe Leserinnen und Leser,*

Hier steht das Vorwort dieser Ausgabe. Der Chefredakteur-Skill aus
ai-magazine-designer befüllt diesen Slot, sobald die Council-Phase
abgeschlossen ist.

#v(1em)

— Der Herausgeber
`,
      'chapters/02-toc.typ': `= Inhalt

#outline(title: none, depth: 2)
`,
    },
  },
];
