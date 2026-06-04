// ─── vswrite Sample Project — Working Scientifically with vswrite ──
//
// Style configuration lives in `style.typ` (generated from
// `.penwright/style.json` — see Design panel). The block below adds the
// font-language hint and pulls the style.typ in. Everything else —
// colors, fonts, layout, headings, special elements — comes from the
// Designer surface.
//
// Try this in the app:
//   1. Open the Design panel (sidebar tab "Design").
//   2. Click any other theme in "Themes" — the whole document re-styles.
//   3. Or change just `colors.accent` and watch the accent ripple
//      through pull-quotes, blockquotes, code-block borders.

// `#import "style.typ": *` brings `style-colors` (the palette dict) AND
// `apply-style` (the function that wires up every set/show rule) into
// scope. `#show: apply-style` then applies those rules to the rest of
// the document. Set rules from #include'd files don't propagate to the
// includer — wrapping everything in a function and using #show: function
// is the idiomatic Typst pattern.
#import "style.typ": *
#show: apply-style

#set text(lang: "en")

// Bundled package imports — both packages ship with vswrite under
// `resources/typst-packages/`, so they work offline. They live HERE
// (in main.typ) rather than inside `style.typ`'s custom block because
// `#import` brings bindings into the importer's scope only; chapter
// files we `#include` below have their own scope and must re-import
// the helpers they use (see `chapters/07-design-showcase.typ`).
#import "@preview/wrap-it:0.1.1": wrap-content
#import "@preview/gentle-clues:1.3.1": *

// ─── Title (Hero design element, themed via style-colors) ──────

#v(2em)
#align(center)[
  #text(size: 2.8em, weight: "bold", fill: style-colors.primary)[
    Working Scientifically with vswrite
  ]
  #v(0.4em)
  #text(size: 1.2em, fill: style-colors.muted)[
    A working sample on AI-assisted academic writing
  ]
]
#v(2em)

#align(center)[
  vswrite Sample Project

  #v(0.3em)

  #datetime.today().display("[month repr:long] [day], [year]")
]

#pagebreak()

// ─── Abstract ─────────────────────────────────────────

#heading(numbering: none, outlined: false)[Abstract]

This document is both a sample and a tutorial. It demonstrates every major
feature of vswrite — cross-references, footnotes, comments, citations,
math, code blocks, figures, special-element styling, design-element
insertions — while talking about something that matters for everyone
using it: how to do honest, useful academic writing in an era where AI
assistance is increasingly part of the workflow. It is meant to be
opened, read, and edited. Treat it as a starting point for your own
projects.

#pagebreak()

#outline(title: [Contents])

#pagebreak()

// ─── Body ─────────────────────────────────────────────

#include "chapters/01-introduction.typ"

#pagebreak()

#include "chapters/02-scientific-writing.typ"

#pagebreak()

#include "chapters/03-ai-as-assistant.typ"

#pagebreak()

#include "chapters/04-ai-risks.typ"

#pagebreak()

#include "chapters/05-ai-with-vswrite.typ"

#pagebreak()

#include "chapters/06-conclusion.typ"

#pagebreak()

#include "chapters/07-design-showcase.typ"

#pagebreak()

#bibliography("references.bib", style: "apa", title: "References")
