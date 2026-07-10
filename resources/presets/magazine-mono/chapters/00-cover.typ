#import "../style.typ": *

#page(header: none, footer: none, numbering: none, margin: (left: 3.4cm, right: 3.4cm, top: 3.2cm, bottom: 3cm))[
  #set par(justify: false, first-line-indent: 0pt)

  // ── Masthead ──
  #text(font: style-fonts.heading, size: 46pt, weight: "medium", tracking: 0.06em, fill: style-colors.text)[MAGAZINE]
  #v(0.55em)
  #text(size: 0.92em, tracking: 0.26em, fill: style-colors.muted)[A SAMPLE ISSUE]

  #v(2.4fr)

  // ── Cover story ──
  #text(size: 0.82em, weight: "bold", tracking: 0.24em, fill: style-colors.accent)[THE COVER STORY]
  #v(0.7em)
  #text(font: style-fonts.heading, size: 42pt, weight: "medium", fill: style-colors.text)[
    Lorem ipsum\
    dolor sit amet
  ]
  #v(0.75em)
  #text(font: style-fonts.heading, size: 1.45em, style: "italic", fill: style-colors.muted)[
    Consectetur adipiscing elit,\
    sed do eiusmod tempor incididunt.
  ]

  #v(3fr)

  // ── Foot ──
  #line(length: 100%, stroke: 0.5pt + style-colors.muted)
  #v(0.55em)
  #grid(
    columns: (1fr, auto),
    text(size: 0.85em, fill: style-colors.muted)[Feature · Interview · Essay],
    text(size: 0.85em, tracking: 0.12em, fill: style-colors.accent)[ISSUE 01 · 2026],
  )
]
