#import "style.typ": *
#show: apply-style

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
