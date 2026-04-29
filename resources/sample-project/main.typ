#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em, justify: true)
#set heading(numbering: "1.1")
#set math.equation(numbering: "(1)")
#set figure(numbering: "1")
#show link: it => underline(text(fill: blue.darken(20%), it))

#align(center)[
  #v(3cm)

  #text(size: 22pt, weight: "bold")[Working Scientifically with vswrite]

  #v(0.5em)

  #text(size: 14pt)[A working sample on AI-assisted academic writing]

  #v(2em)

  vswrite Sample Project

  #v(0.3em)

  #datetime.today().display("[month repr:long] [day], [year]")
]

#pagebreak()

// ─── Abstract ─────────────────────────────────────────

#heading(numbering: none, outlined: false)[Abstract]

This document is both a sample and a tutorial. It demonstrates every major
feature of vswrite — cross-references, footnotes, comments, citations,
math, code blocks, figures — while talking about something that matters
for everyone using it: how to do honest, useful academic writing in an
era where AI assistance is increasingly part of the workflow. It is meant
to be opened, read, and edited. Treat it as a starting point for your own
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

#bibliography("references.bib", style: "apa", title: "References")
