#set text(font: "Helvetica", size: 11pt)
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
}

#align(center)[
  #v(4cm)
  #text(size: 12pt)[FernUniversität in Hagen]
  #v(0.3cm)
  #text(size: 11pt)[Fakultät für Kultur- und Sozialwissenschaften]
  #v(0.3cm)
  #text(size: 11pt)[Modul 1A: Einführung in die Erziehungs- und Bildungswissenschaft]
  #v(2cm)
  #text(size: 20pt, weight: "bold")[Erziehungs- und Bildungswissenschaft]
  #v(0.3cm)
  #text(size: 14pt)[Historische Grundlagen, Adressaten und aktuelle Forschungsperspektiven]
  #v(0.3cm)
  #text(size: 12pt)[Eine vergleichende Analyse der Studienbriefe des Kurses 25101]
  #v(3cm)
  #text(size: 11pt)[Hausarbeit im Wintersemester 2025/26]
  #v(1cm)
  #text(size: 11pt)[vorgelegt von]
  #v(0.3cm)
  #text(size: 12pt, weight: "bold")[Max Mustermann]
  #v(0.3cm)
  #text(size: 11pt)[Matrikelnummer: 1234567]
  #v(0.3cm)
  #text(size: 11pt)[Hagen, März 2026]
]

#pagebreak()

#outline(title: "Inhaltsverzeichnis", indent: auto)

#pagebreak()

#include "chapters/01-einleitung.typ"

#include "chapters/02-geschichte.typ"

#include "chapters/03-adressaten.typ"

#include "chapters/04-handlungsfelder.typ"

#include "chapters/05-forschungsperspektiven.typ"

#include "chapters/06-fazit.typ"

#include "chapters/07-theoretische-grundlagen.typ"

#include "chapters/08-methoden-der-forschung.typ"

#include "chapters/09-schulpaedagogik.typ"

#include "chapters/10-sozialpaedagogik.typ"

#include "chapters/11-inklusion.typ"

#include "chapters/12-bildungspolitik.typ"

#include "chapters/13-medienpaedagogik.typ"

#include "chapters/14-internationale-perspektiven.typ"

#bibliography("references.bib", style: "chicago-author-date")
