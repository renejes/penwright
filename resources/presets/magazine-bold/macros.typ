// Penwright — canonical editorial macro vocabulary for magazine-style presets.
//
// This is the SHARED, load-bearing building-block file. Every magazine/zine
// preset ships a COPY of it in its own folder (presets are copied verbatim, so
// each must be self-contained — `scripts/sync-preset-macros.mjs` keeps the
// copies in lockstep with this source). Each function pulls its colours and
// fonts from `style.typ`, so it re-themes automatically when the palette changes.
//
// IMPORTANT: the macro names + signatures here are recognised by the editor's
// magazine AST nodes (deserializer `parseMagazineMacro` ↔ serializer). Do NOT
// rename or change a signature without updating those in lockstep, or the
// round-trip (Typst ↔ WYSIWYG editor) breaks. Recognised → real nodes:
//   opener→articleHeader · lead→dropCap · pull→pullQuote · frage→question ·
//   notiz→callout · bildtafel→figurePanel · interlude→interlude · randnotiz→marginNote
// `aufmacher`/`doppelseite`/`kicker` stay raw (export reinterprets the heroes).
//
// Depends on two BUNDLED Typst packages (offline-ready): droplet (drop caps),
// drafting (margin notes).

#import "style.typ": style-colors, style-fonts, style-bleed
#import "@preview/droplet:0.3.1": dropcap
#import "@preview/drafting:0.2.2": margin-note

// Small tracked eyebrow line (rubric / category).
#let kicker(body) = text(
  size: 0.82em, weight: "bold", tracking: 0.2em, fill: style-colors.accent,
)[#upper(body)]

// Article opener: kicker, headline (appears in the outline), standfirst, byline.
// The headline uses the global H1 style — same size everywhere.
#let opener(kicker: none, title: "", standfirst: none, byline: none) = {
  v(0.2em)
  if kicker != none {
    text(size: 0.82em, weight: "bold", tracking: 0.2em, fill: style-colors.accent)[#upper(kicker)]
    v(0.7em)
  }
  heading(level: 1, outlined: true, numbering: none)[#title]
  if standfirst != none {
    v(0.5em)
    set par(justify: false, first-line-indent: 0pt, leading: 0.7em)
    text(size: 1.3em, style: "italic", fill: style-colors.muted, font: style-fonts.heading)[#standfirst]
  }
  if byline != none {
    v(0.85em)
    text(size: 0.82em, tracking: 0.06em, fill: style-colors.muted)[#byline]
  }
  v(1.3em)
}

// Quiet pull-quote: large, italic, centred, short accent rule beneath.
#let pull(body, who: none) = {
  v(1.2em)
  set par(justify: false, first-line-indent: 0pt, leading: 0.72em)
  align(center)[
    #text(size: 1.55em, style: "italic", fill: style-colors.text, font: style-fonts.heading)[#body]
    #v(0.7em)
    #line(length: 1.1cm, stroke: 0.6pt + style-colors.accent)
    #if who != none {
      v(0.55em)
      text(size: 0.82em, tracking: 0.08em, fill: style-colors.muted)[#who]
    }
  ]
  v(1.2em)
}

// Interview question — bold, accent colour, no indent. Tighter spacing so
// question–answer pairs stay together.
#let frage(body) = {
  v(0.5em)
  block(below: 0.4em)[
    #set par(first-line-indent: 0pt)
    #text(weight: "bold", fill: style-colors.accent, font: style-fonts.heading)[#body]
  ]
}

// Quiet divider within a text.
#let interlude() = {
  v(1.6em)
  align(center)[#line(length: 1.4cm, stroke: 0.6pt + style-colors.accent)]
  v(1.6em)
}

// Drop cap for the first paragraph of an article.
#let lead(body) = dropcap(
  height: 3, font: style-fonts.heading, fill: style-colors.accent, weight: "medium",
)[#body]

// Quiet info box — thin frame, small accent title, calm content.
#let notiz(title: none, body) = {
  v(0.7em)
  block(inset: (x: 1.1em, y: 1em), stroke: 0.6pt + style-colors.muted.lighten(25%), breakable: false)[
    #set par(justify: false, first-line-indent: 0pt, leading: 0.74em)
    #if title != none {
      text(size: 0.74em, weight: "bold", tracking: 0.1em, fill: style-colors.accent, hyphenate: true)[#upper(title)]
      v(0.55em)
    }
    #set text(size: 0.94em)
    #body
  ]
  v(0.7em)
}

// Photo panel: image left, framed note beside it (a museum-label pattern).
#let bildtafel(path, caption: none, title: none, body) = {
  v(0.8em)
  grid(
    columns: (1.45fr, 1fr), column-gutter: 1.1em, align: top,
    {
      image(path, width: 100%)
      if caption != none {
        v(0.45em)
        text(size: 0.8em, style: "italic", fill: style-colors.muted)[#caption]
      }
    },
    block(inset: (x: 1em, y: 0.9em), stroke: 0.6pt + style-colors.muted.lighten(25%))[
      #set par(justify: false, first-line-indent: 0pt, leading: 0.74em)
      #if title != none {
        text(size: 0.72em, weight: "bold", tracking: 0.1em, fill: style-colors.accent, hyphenate: true)[#upper(title)]
        v(0.5em)
      }
      #set text(size: 0.88em)
      #body
    ],
  )
  v(0.8em)
}

// Margin note in the wide outer margin — quiet, no box.
#let randnotiz(body) = margin-note(stroke: none, side: right)[
  #set par(justify: false, first-line-indent: 0pt, leading: 0.7em)
  #line(length: 0.7cm, stroke: 0.6pt + style-colors.accent)
  #v(0.25em)
  #text(size: 0.78em, fill: style-colors.muted)[#body]
]

// Double-truck: ONE image across two facing pages, over the gutter. Forced to
// start on an even (left) page, split exactly at the fold (both pages render the
// same `cover` image, offset by one page width → seamless), bleeding via
// `style-bleed` to all physical edges (0 on screen, the real bleed in the
// "For print" export). Running heads/footers are hidden. Optional photo credit.
#let doppelseite(path, title: none, credit: none) = {
  pagebreak(weak: true, to: "even")
  page(margin: 0pt, header: none, footer: none, numbering: none)[
    #if title != none { place(hide(heading(level: 1, outlined: true, numbering: none)[#title])) }
    #box(width: 100%, height: 100%, clip: true)[
      #place(left + top, dx: -style-bleed, dy: -style-bleed,
        image(path, width: 200% + 2 * style-bleed, height: 100% + 2 * style-bleed, fit: "cover"))
    ]
  ]
  page(margin: 0pt, header: none, footer: none, numbering: none)[
    #box(width: 100%, height: 100%, clip: true)[
      #place(left + top, dx: -100% - style-bleed, dy: -style-bleed,
        image(path, width: 200% + 2 * style-bleed, height: 100% + 2 * style-bleed, fit: "cover"))
    ]
    #if credit != none {
      place(bottom + right, dx: -(1.5cm + style-bleed), dy: -(1.5cm + style-bleed),
        text(size: 0.78em, tracking: 0.04em, fill: white.transparentize(12%), font: style-fonts.body)[#credit])
    }
  ]
  pagebreak(weak: true)
}

// Opener spread: a wide image across the double page, with a quiet text column
// (the article opener) over its left side. `inhalt` = the opener (kicker, H1,
// standfirst, byline). Forced to start on a left page.
#let aufmacher(path, breite: 44%, credit: none, inhalt) = {
  pagebreak(weak: true, to: "even")
  page(margin: 0pt, header: none, footer: none, numbering: none)[
    #box(width: 100%, height: 100%, clip: true)[
      #place(left + top, dx: -style-bleed, dy: -style-bleed,
        image(path, width: 200% + 2 * style-bleed, height: 100% + 2 * style-bleed, fit: "cover"))
    ]
    #place(left + top, dx: -style-bleed, dy: -style-bleed,
      rect(width: breite + style-bleed, height: 100% + 2 * style-bleed, fill: style-colors.background))
    #place(left + top, block(width: breite, height: 100%,
      inset: (left: 2.6cm, right: 1.1cm, top: 3cm, bottom: 3cm))[
      #set par(justify: false, first-line-indent: 0pt)
      #inhalt
    ])
  ]
  page(margin: 0pt, header: none, footer: none, numbering: none)[
    #box(width: 100%, height: 100%, clip: true)[
      #place(left + top, dx: -100% - style-bleed, dy: -style-bleed,
        image(path, width: 200% + 2 * style-bleed, height: 100% + 2 * style-bleed, fit: "cover"))
    ]
    #if credit != none {
      place(bottom + right, dx: -(1.5cm + style-bleed), dy: -(1.5cm + style-bleed),
        text(size: 0.78em, tracking: 0.04em, fill: white.transparentize(12%), font: style-fonts.body)[#credit])
    }
  ]
  pagebreak(weak: true)
}
