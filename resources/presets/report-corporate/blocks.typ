// Penwright — reusable, theme-aware design blocks for scaffolded presets.
//
// Like the magazine macros, but general-purpose: covers, bands, stat rows,
// callouts, pull-quotes, step lists, card grids, tags. Every block pulls its
// colours/fonts from style.typ, so it re-themes with the palette. Deliberately
// PALETTE-SAFE — tints use transparentize (readable on light AND dark
// backgrounds), text uses the adaptive text colour, accents sit on the page
// background where the palette guarantees contrast. No reversed text on solid
// fills (which would break on light-accent palettes).
//
// A copy is placed in each scaffolded preset by presets-scaffold.mts; generators
// `#import "blocks.typ": *`.

#import "style.typ": style-colors, style-fonts

#let _tint(c, amount) = c.transparentize(amount)

// Strong section/cover header: kicker, big title, subtitle, accent rule.
#let herohead(title, kicker: none, subtitle: none, size: 2.4em) = block(below: 1.1em, breakable: false)[
  #if kicker != none {
    text(size: 0.8em, weight: "bold", tracking: 0.18em, fill: style-colors.accent)[#upper(kicker)]
    v(0.55em)
  }
  #text(size: size, weight: "bold", fill: style-colors.text, font: style-fonts.heading)[#title]
  #if subtitle != none {
    v(0.4em)
    text(size: 1.12em, fill: style-colors.muted)[#subtitle]
  }
  #v(0.55em)
  #line(length: 100%, stroke: 2pt + style-colors.accent)
]

// A tinted full-width panel (accent wash).
#let band(body) = block(
  width: 100%, fill: _tint(style-colors.accent, 90%),
  inset: (x: 1.2em, y: 1.1em), radius: 8pt, above: 1.1em, below: 1.1em,
)[#body]

// A tinted callout with an optional accent title.
#let callout(body, title: none) = block(
  width: 100%, fill: _tint(style-colors.accent, 90%),
  inset: (x: 1.1em, y: 0.9em), radius: 8pt, above: 1em, below: 1em, breakable: false,
)[
  #if title != none { text(weight: "bold", fill: style-colors.accent)[#title]; v(0.35em) }
  #body
]

// A big centred pull-quote with a short accent rule.
#let pullquote(body) = block(width: 100%, above: 1.3em, below: 1.3em)[
  #align(center)[
    #text(size: 1.5em, style: "italic", fill: style-colors.accent, font: style-fonts.heading)[#body]
    #v(0.5em)
    #line(length: 1.2cm, stroke: 1.5pt + style-colors.accent)
  ]
]

// A row of big statistics — items is an array of (value, label) pairs.
#let statrow(items) = block(above: 1em, below: 1em)[
  #grid(
    columns: (1fr,) * items.len(), column-gutter: 1.2em, align: left,
    ..items.map(it => box[
      #text(size: 2.1em, weight: "bold", fill: style-colors.accent)[#it.at(0)]
      #linebreak()
      #text(size: 0.82em, fill: style-colors.muted)[#it.at(1)]
    ])
  )
]

// A numbered step list with outlined accent circles — items is an array of content.
#let steps(items) = block(above: 0.9em, below: 0.9em)[
  #for (i, it) in items.enumerate() {
    grid(
      columns: (1.7em, 1fr), column-gutter: 0.7em, align: (center + horizon, left + horizon),
      circle(radius: 0.72em, stroke: 1.5pt + style-colors.accent, inset: 0pt,
        align(center + horizon, text(size: 0.85em, weight: "bold", fill: style-colors.accent)[#(i + 1)])),
      it,
    )
    v(0.55em)
  }
]

// A grid of outlined cards — cards is an array of content.
#let cardgrid(cards, cols: 2) = grid(
  columns: (1fr,) * cols, gutter: 1em,
  ..cards.map(c => block(width: 100%, height: 100%,
    stroke: 1pt + _tint(style-colors.muted, 55%), radius: 8pt, inset: 1em)[#c])
)

// A small pill/tag.
#let tag(label) = box(
  fill: _tint(style-colors.accent, 85%), inset: (x: 0.6em, y: 0.28em), radius: 20pt,
  text(size: 0.78em, weight: "medium", fill: style-colors.accent)[#label],
)

// An inset side note with an accent left border.
#let sidenote(body) = block(
  width: 100%, inset: (left: 0.9em, top: 0.2em, bottom: 0.2em),
  stroke: (left: 3pt + style-colors.accent), above: 0.9em, below: 0.9em,
)[#text(size: 0.9em, fill: style-colors.muted)[#body]]

// A quiet ornamental divider.
#let fancydivider() = align(center, block(above: 1.4em, below: 1.4em,
  text(size: 1.1em, fill: style-colors.accent, tracking: 0.5em)[\* \* \*]))
