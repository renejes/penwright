#set text(font: "New Computer Modern", size: 11pt)
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
