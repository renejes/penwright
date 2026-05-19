// Each chapter file that references the palette or the bundled
// packages needs its own imports — Typst's `#include` propagates
// show/set rules as side effects but does NOT bring `#let` / `#import`
// bindings from the parent file into the chapter's scope.
#import "../style.typ": style-colors, style-fonts, figure-caption-credit
#import "@preview/wrap-it:0.1.1": wrap-content
#import "@preview/gentle-clues:1.3.1": *
#import "@preview/droplet:0.3.1": dropcap

= Design Showcase <sec:design-showcase>

This final chapter is a single-stop tour of every visual surface vswrite
exposes. It exists so you can see — concretely, on one PDF page after
another — what the Design panel does. Open the panel (sidebar tab
*Design*), swap themes, change a color slot, and the entire chapter
below re-renders to match.

== Heading hierarchy

vswrite gives you six structured heading levels (H1 through H6). The
section title above is H1; this paragraph follows an H2. Below is a
deeper drill-down to show how the levels read at their default sizes
in the Classic Academic theme.

=== Third level
==== Fourth level
===== Fifth level
====== Sixth level

After H4 things get small fast — that is intentional. If you reach for
H5 or H6 in a body document, ask whether the structure really needs to
go that deep. In a thesis, H6 is almost always wrong.

== Body conventions

=== Blockquote

The Blockquote element styles in the Design panel control what
quoted-block content looks like:

#quote(block: true)[
  Hier wird's interessant: ein gut gewählter Blockquote ist im
  akademischen Text ein wertvolles Werkzeug. Aber: maximal zwei pro
  Kapitel, sonst verliert er an Gewicht. Die Designer-Tokens steuern
  Border-Farbe, Border-Breite, Padding und ob der Body kursiv läuft.
]

The bar on the left comes from `elements.blockquote.borderColor` /
`borderWidth`. The italic body is the `italic` toggle. The text color
is the `textColor` slot — change the slot in the Design panel and watch
the rendering follow.

=== Pull-Quote

Pull-Quotes are visually distinct from regular blockquotes — they pull
a single striking sentence out of the running text and elevate it:

#align(center)[
  #text(size: 1.5em, weight: "semibold", fill: style-colors.primary, style: "italic")[
    "The wrong question is what would look cool here; the right one is what will the reader expect, and how do I deliver it crisply."
  ]
  #v(0.4em)
  #line(length: 25%, stroke: 1pt + style-colors.accent)
]

This is what the MCP tool `vswrite_insert_design_element` generates
when called with `elementId: "pull-quote"`. Every reference to
`style-colors.*` means the pull-quote re-themes automatically when
you change the palette.

=== Callouts (via gentle-clues)

Callout boxes are not part of the structured Designer surface — they
ship as the bundled `gentle-clues` package and are loaded in the
`custom.preamble` block of `style.typ`. Five built-in kinds:

#info[
  This is an *info* callout. Default kind. Use for definitions, asides,
  or "by the way" notes.
]

#tip[
  *Tip:* in the Design panel, the Custom Code section at the bottom is
  where package imports like this live. Edits there survive every
  theme / palette / layout swap.
]

#warning[
  *Be careful:* heavy callout use is one of the easiest ways to make a
  document look amateurish. Two callouts per chapter is plenty; five is
  too many.
]

#memo[
  *Memo:* you can mix callouts and Designer elements freely — they live
  on different layers (one is content-driven via #raw("#info[…]"),
  the other is style-driven via the structured schema).
]

== Code & math

=== Inline and block code

Inline #raw("`code`") looks like this: `let x = 42`. Block code uses
fenced code blocks and picks up the `elements.codeBlock` styling
(background fill, padding, corner radius):

```typst
// Hover any @citekey to see the source preview pop up.
The hallucination problem in modern LLMs is well-documented
@bender2021parrots, with later work surveying its many forms
@ji2022hallucination.

#figure(
  image("assets/diagram.svg", width: 80%),
  caption: [A workflow diagram.],
) <fig:workflow>

See @fig:workflow for the pipeline.
```

The code uses `fonts.code` from the Design panel. Try switching to a
theme that uses JetBrains Mono (Modern Tech) — the block above
re-renders in the new font automatically.

=== Math equations

Block-level math is numbered (the numbering pattern lives in
`custom.preamble` — `#set math.equation(numbering: "(1)")`):

$ E = m c^2 $ <eq:einstein>

For inline math, just wrap in dollar signs without spaces: $a^2 + b^2 = c^2$.
The equation @eq:einstein references back to itself via the label set
after the display equation above.

== Figures

=== Centered figure

The classic case: a figure on its own line with a caption below it.
Caption position, font size, color, alignment, and separator are
controlled by the Design panel's `elements.figure` section.

#figure(
  rect(width: 70%, height: 3cm, fill: style-colors.muted.lighten(70%), stroke: 0.5pt + style-colors.muted),
  caption: [A placeholder figure showing how the caption appears under
    the content. In Classic Academic, captions are left-aligned in
    muted text with a `": "` separator.],
) <fig:centered>

=== Text wrapping a figure (via the wrap-it package)

The bundled `wrap-it` package lets text flow around an inline figure.
This is what marketing brochures and editorial layouts use to break
the wall-of-text feel without inserting a full-width figure.

#wrap-content(
  rect(width: 4.5cm, height: 3.5cm, fill: style-colors.accent.lighten(80%), stroke: 0.5pt + style-colors.accent),
  [
    Text wrapping is genuinely useful for short asides — a portrait
    photo next to a biography, a small chart next to its prose
    discussion, a logo next to a paragraph about the brand. Used
    sparingly, it adds rhythm. Used too often — once per paragraph —
    it makes the page look like a website from 2003. Like callouts,
    the rule is: maximum one per page, ideally one per chapter.

    The `wrap-it` package handles the math of flowing text around the
    floated element. You pass it the floated content and the body
    paragraph; it figures out the column geometry. Position can be
    left or right via the `align` parameter (default: left).
  ],
)

=== Table with header and zebra rows

Tables pick up the `elements.table` design tokens: header background,
header text color, optional zebra-row shading, border color, cell
padding.

#figure(
  table(
    columns: 4,
    table.header[*Element*][*Schema location*][*Re-themes?*][*Notes*],
    [Blockquote],   [`elements.blockquote`], [Yes — slot-based], [Border + padding + italic],
    [Code-Block],   [`elements.codeBlock`],  [Background is raw Typst expr], [Padding X/Y + radius],
    [Figure],       [`elements.figure`],     [Caption color is a slot], [Position + alignment],
    [Table],        [`elements.table`],      [Header + border are slots], [Zebra optional],
    [Callout],      [not in schema],         [No — gentle-clues package], [Loaded via custom.preamble],
    [Pull-Quote],   [not in schema],         [Yes — uses `style-colors.*`], [Inserted via MCP tool],
  ),
  caption: [How each visual element maps onto the Designer surface.],
) <tbl:elements>

Toggle the *Zebra rows* checkbox in the Design panel's Table section
to see this table gain alternating row shading.

== Switching themes mid-project

The whole document above renders under the *Classic Academic* theme
right now. To try another:

+ Open the Design panel.
+ Scroll to the *Themes* section.
+ Click any other card.

Your custom-code block (which holds the gentle-clues and wrap-it
imports) is preserved across the swap, so the callouts and the
text-around-figure both keep working. The colors, fonts, scale, and
elements all change together — that is the whole point of theme-as-
data instead of theme-as-Typst-preamble.

== A closing observation

There are two failure modes when adding visual structure to academic
writing. The first is undershooting — a wall of indistinguishable
12-point Times that no reader can scan. The second is overshooting —
seven colors, three fonts, callouts in every section. The Design panel
makes both easy to avoid by giving you semantic slots ("this is the
primary color, here is where it lives in the document") rather than
raw Typst commands.

If you delete this chapter, the rest of the sample reads as a normal
academic essay. Keep it while you are learning vswrite; remove it once
you have your own project conventions down.

== Magazine elements (Round 4)

A second pass on the design library added nine editorial-magazine
building blocks. Each of them is what the MCP tool
`vswrite_insert_design_element` writes — you can compose magazine pages
by chaining them, or copy any block below into your own document.

=== Drop cap

#dropcap(
  height: 3,
  font: style-fonts.heading,
  fill: style-colors.primary,
  weight: "bold",
)[This is what a drop cap looks like — the bundled `droplet` package
extracts the first character and renders it across three body lines.
Use it sparingly: one per long-form opener, never repeated in the same
section.]

=== Editorial divider variants

Plain accent rule:
#v(0.5em)
#align(center)[#line(length: 25%, stroke: 0.5pt + style-colors.muted)]
#v(0.5em)

Asterisks (`divider-asterisks`):
#v(0.5em)
#align(center)[#text(size: 1.4em, fill: style-colors.muted, tracking: 0.4em)[\* \* \*]]
#v(0.5em)

Ornament (`divider-ornament`, default ❦):
#v(0.5em)
#align(center)[#text(size: 1.6em, fill: style-colors.accent)[❦]]
#v(0.5em)

=== Pull-quote variants

`pull-quote-display` — monumental break:

#v(1em)
#align(center)[
  #text(size: 2.2em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[
    "Design is the part that survives the first reader."
  ]
]
#v(1em)

`pull-quote-block` — inline-friendly box with accent bar and attribution:

#v(0.5em)
#block(
  fill: style-colors.muted.lighten(85%),
  stroke: (left: 4pt + style-colors.accent),
  inset: (x: 1.2em, y: 1em),
  radius: 3pt,
)[
  #text(size: 1.15em, style: "italic", fill: style-colors.text)["The wrong question is what would look cool here; the right one is what the reader expects."]
  #v(0.4em)
  #align(right)[#text(size: 0.9em, fill: style-colors.muted)[— Helen Lyon]]
]
#v(0.5em)

=== Article-opener

#text(size: 0.85em, weight: "bold", tracking: 0.12em, fill: style-colors.accent)[ESSAY]
#v(0.4em)
#text(size: 2.2em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[The Quiet Architect]
#v(0.5em)
#text(size: 1.2em, style: "italic", fill: style-colors.text)[Helen Lyon spent four decades reshaping how rural housing
relates to land.]
#v(0.6em)
#text(size: 0.85em, fill: style-colors.muted)[By Sam Cooper, Photography by Maya Reidt]
#v(1em)

Note that the live `article-opener` element wraps the headline in a
real `#heading(level: 1)` so it stays in the outline. The mock above
skips the heading wrap so it doesn't compete with this chapter's own H1.

=== Photographer-credit on a figure

The new `figure-caption-credit(caption, credit)` helper concatenates a
caption with a styled credit using `style.elements.figure.creditSeparator`
+ `creditLabel`. Defaults to `" — "` + `"Photo: "`.

#figure(
  rect(width: 70%, height: 2.5cm, fill: style-colors.muted.lighten(70%), stroke: 0.5pt + style-colors.muted),
  caption: figure-caption-credit(
    "The interior at dusk.",
    "Maya Reidt",
  ),
) <fig:credit-demo>

=== Image gallery (2-up)

Stand-in rects so the showcase has no asset dependency. With real
images, the call is
`vswrite_insert_design_element({ elementId: "gallery-2up", params: { image1, image2, caption1, caption2 } })`.

#grid(
  columns: (1fr, 1fr),
  column-gutter: 1em,
  row-gutter: 0.4em,
  rect(width: 100%, height: 3cm, fill: style-colors.accent.lighten(80%)),
  rect(width: 100%, height: 3cm, fill: style-colors.primary.lighten(80%)),
  text(size: 0.85em, fill: style-colors.muted, "Before — the original house."),
  text(size: 0.85em, fill: style-colors.muted, "After — the rebuild."),
)

=== Section-opener and magazine-cover

Section openers (`section-opener`) and full-page covers
(`magazine-cover`) both insert their own pagebreaks, so they're
deliberately not demonstrated inline here — they would split this
chapter across pages and obscure the rest of the showcase. Try them in
a new project: open the Design panel, run
`vswrite_insert_design_element({ elementId: "section-opener", … })`
from Claude Desktop, and watch a full-page typographic divider appear
at the top of the next page.

=== Magazine layout preset

A seventh layout preset, `magazine-editorial`, swaps to A4 portrait
2-column with a per-page header strip (`SECTION · ISSUE` left, short
accent rule right). Pairs cleanly with the Editorial Magazine theme.
Apply via the Design panel's Layout presets section, or programmatically
with `vswrite_apply_layout({ presetId: "magazine-editorial" })`.
