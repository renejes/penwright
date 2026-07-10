#import "style.typ": *
#show: apply-style

#include "chapters/00-cover.typ"

#pagebreak()

// ── Contents ──────────────────────────────────────────────────────
#{
  set par(justify: false, first-line-indent: 0pt)
  v(0.4cm)
  text(font: style-fonts.heading, size: 24pt, weight: "semibold", fill: style-colors.text)[Contents]
  v(0.25em)
  text(size: 1.05em, style: "italic", fill: style-colors.muted, font: style-fonts.heading)[A sample issue — replace this placeholder text with your own.]
  v(1.6em)
  outline(title: none, depth: 1, indent: 0pt)
}

#pagebreak()
#include "chapters/01-editorial.typ"

#pagebreak()
#include "chapters/02-feature.typ"

#pagebreak()
#include "chapters/03-interview.typ"

#pagebreak()
#include "chapters/04-essay.typ"

#pagebreak()
#include "chapters/05-department.typ"

#pagebreak()
#include "chapters/06-colophon.typ"
