#set text(font: "Helvetica", size: 10.5pt, fill: rgb("#333333"))
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

#bibliography("references.bib", style: "chicago-author-date")
