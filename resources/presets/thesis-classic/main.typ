#import "style.typ": *
#show: apply-style

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
