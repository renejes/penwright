#import "../style.typ": *

= Colophon

#set par(first-line-indent: 0pt, justify: false)

#text(size: 0.95em, fill: style-colors.muted)[
  *MAGAZINE* — a sample issue built with Penwright. Replace this imprint with
  your own, and overwrite the placeholder text throughout the issue.
]

#v(1em)

#grid(
  columns: (auto, 1fr), row-gutter: 0.6em, column-gutter: 1.4em,
  text(fill: style-colors.accent, weight: "bold")[Publisher], [Lorem Ipsum Press],
  text(fill: style-colors.accent, weight: "bold")[Editor], [A. Writer],
  text(fill: style-colors.accent, weight: "bold")[Design], [Penwright],
  text(fill: style-colors.accent, weight: "bold")[Contact], [hello\@example.com],
)

#v(1.2em)
#line(length: 100%, stroke: 0.5pt + style-colors.muted)
#v(0.5em)
#text(size: 0.8em, fill: style-colors.muted)[© 2026 · All placeholder text is Lorem Ipsum.]
