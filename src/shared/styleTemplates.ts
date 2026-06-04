/**
 * Style Templates for Penwright.
 * Each style is a Typst preamble (set + show rules) that can be applied
 * to any document to change its visual appearance.
 */

export interface StyleTemplate {
  id: string;
  label: string;
  description: string;
  /** The Typst preamble code (set + show rules) */
  preamble: string;
}

export const styleTemplates: StyleTemplate[] = [
  {
    id: 'classic',
    label: 'Classic Academic',
    description: 'Traditional serif font, numbered headings, clean layout',
    preamble: `#set text(font: "New Computer Modern", size: 11pt)
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.65em, spacing: 1.2em)
#set heading(numbering: "1.1")`,
  },
  {
    id: 'modern',
    label: 'Modern Clean',
    description: 'Sans-serif, blue accents, colored headings with underlines',
    preamble: `#set text(font: "Helvetica", size: 11pt)
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm), numbering: "1")
#set par(justify: true, leading: 0.7em, spacing: 1.2em)
#set heading(numbering: "1.1")

#show heading.where(level: 1): it => {
  v(0.8em)
  text(size: 20pt, fill: rgb("#1a5276"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.3em)
  line(length: 100%, stroke: 1.5pt + rgb("#2980b9"))
  v(0.5em)
}

#show heading.where(level: 2): it => {
  v(0.5em)
  text(size: 14pt, fill: rgb("#2c3e50"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.2em)
}

#show heading.where(level: 3): it => {
  v(0.3em)
  text(size: 12pt, fill: rgb("#34495e"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.1em)
}`,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Ultra-clean, generous whitespace, thin typography',
    preamble: `#set text(font: "Helvetica", size: 10.5pt, fill: rgb("#333333"))
#set page(paper: "a4", margin: (top: 3cm, bottom: 3cm, left: 3.5cm, right: 3.5cm), numbering: "1")
#set par(justify: false, leading: 0.8em, spacing: 1.4em)
#set heading(numbering: "1.1")

#show heading.where(level: 1): it => {
  v(2em)
  text(size: 22pt, weight: "light", tracking: 0.05em)[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#{upper(it.body)}]
  v(1em)
}

#show heading.where(level: 2): it => {
  v(1em)
  text(size: 13pt, weight: "regular", fill: rgb("#666666"), tracking: 0.03em)[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#{upper(it.body)}]
  v(0.5em)
}

#show heading.where(level: 3): it => {
  v(0.5em)
  text(size: 11pt, weight: "bold", fill: rgb("#888888"))[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.3em)
}`,
  },
  {
    id: 'vibrant',
    label: 'Vibrant',
    description: 'Colorful headings, accent bars, modern feel',
    preamble: `#set text(font: "Helvetica", size: 11pt)
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.65em, spacing: 1.2em)
#set heading(numbering: "1.")

#show heading.where(level: 1): it => {
  v(1em)
  block(
    width: 100%,
    inset: (left: 12pt, top: 8pt, bottom: 8pt),
    fill: rgb("#2c3e50"),
    radius: (top: 4pt, bottom: 4pt),
    text(size: 18pt, fill: white, weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body],
  )
  v(0.5em)
}

#show heading.where(level: 2): it => {
  v(0.6em)
  box(
    inset: (left: 8pt),
    stroke: (left: 3pt + rgb("#e74c3c")),
    text(size: 14pt, fill: rgb("#2c3e50"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body],
  )
  v(0.3em)
}

#show heading.where(level: 3): it => {
  v(0.4em)
  text(size: 12pt, fill: rgb("#e74c3c"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.2em)
}`,
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'Warm tones, serif headings, ornamental dividers',
    preamble: `#set text(font: "New Computer Modern", size: 11pt)
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 3cm), numbering: "1")
#set par(justify: true, leading: 0.7em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "I.a.")

#show heading.where(level: 1): it => {
  v(1.5em)
  align(center)[
    #text(size: 18pt, weight: "bold", fill: rgb("#5d4037"))[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
    #v(0.3em)
    #line(length: 30%, stroke: 0.8pt + rgb("#8d6e63"))
  ]
  v(0.8em)
}

#show heading.where(level: 2): it => {
  v(0.8em)
  text(size: 13pt, fill: rgb("#5d4037"), weight: "bold", style: "italic")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.3em)
}

#show heading.where(level: 3): it => {
  v(0.5em)
  text(size: 11.5pt, fill: rgb("#795548"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.2em)
}`,
  },
  {
    id: 'professional',
    label: 'Professional Report',
    description: 'Corporate style, dark header bar, structured layout',
    preamble: `#set text(font: "Helvetica", size: 10.5pt)
#set page(paper: "a4", margin: (top: 2cm, bottom: 2cm, left: 2.5cm, right: 2cm), numbering: "1")
#set par(justify: true, leading: 0.65em, spacing: 1.1em)
#set heading(numbering: "1.1")

#show heading.where(level: 1): it => {
  v(0.8em)
  block(
    width: 100%,
    below: 0.8em,
    stroke: (bottom: 2pt + rgb("#1a1a1a")),
    inset: (bottom: 6pt),
    text(size: 16pt, weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body],
  )
}

#show heading.where(level: 2): it => {
  v(0.5em)
  text(size: 13pt, weight: "bold", fill: rgb("#333333"))[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.2em)
}

#show heading.where(level: 3): it => {
  v(0.3em)
  text(size: 11pt, weight: "bold", fill: rgb("#555555"))[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  v(0.1em)
}`,
  },
  {
    id: 'artsy',
    label: 'Artsy',
    description: 'Colorful newspaper-inspired layout with bold headlines and accent blocks',
    preamble: `#set text(font: "Georgia", size: 10.5pt, fill: rgb("#1a1a1a"))
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm), numbering: "1")
#set par(justify: true, leading: 0.6em, spacing: 1.1em)
#set heading(numbering: "1.1")

#show heading.where(level: 1): it => {
  v(1.2em)
  block(width: 100%)[
    #line(length: 100%, stroke: 3pt + rgb("#e63946"))
    #v(0.4em)
    #text(size: 28pt, weight: "black", fill: rgb("#1d3557"), tracking: -0.02em)[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#{upper(it.body)}]
    #v(0.3em)
    #line(length: 100%, stroke: 1pt + rgb("#1d3557"))
  ]
  v(0.8em)
}

#show heading.where(level: 2): it => {
  v(0.8em)
  block(width: 100%, inset: (left: 10pt, top: 6pt, bottom: 6pt), fill: rgb("#457b9d"), radius: 2pt)[
    #text(size: 14pt, fill: white, weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " "}}#it.body]
  ]
  v(0.5em)
}

#show heading.where(level: 3): it => {
  v(0.5em)
  text(size: 12pt, fill: rgb("#e63946"), weight: "bold")[#{if it.numbering != none {counter(heading).display(it.numbering) + " · "}}#it.body]
  v(0.2em)
}`,
  },
];
