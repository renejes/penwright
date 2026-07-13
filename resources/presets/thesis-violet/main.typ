#import "style.typ": *
#show: apply-style

#v(1fr)
#align(center)[
  #text(size: 0.85em, weight: "bold", tracking: 0.24em, fill: style-colors.accent)[#upper("Thesis")]
  #v(1.1em)
  #text(size: 30pt, weight: "bold", font: style-fonts.heading, fill: style-colors.text)[Thesis Title]
  #v(0.5em)
  #text(size: 1.15em, fill: style-colors.muted)[A subtitle or research question — replace this.]
  #v(1em)
  #line(length: 28%, stroke: 2pt + style-colors.accent)
  #v(1.4em)
  #text(size: 1.05em)[Author Name]
  #v(0.3em)
  #text(fill: style-colors.muted)[#datetime.today().display("[month repr:long] [year]")]
]
#v(1.5fr)

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
