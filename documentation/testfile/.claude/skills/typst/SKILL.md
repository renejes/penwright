---
name: typst
description: Comprehensive Typst language reference for writing correct, idiomatic Typst markup and code
---

# Typst Language Reference

Typst is a modern typesetting system. Use this reference to write correct Typst code.

## Three Modes

- **Markup mode** (default) — text with formatting: `= Heading`, `*bold*`, `_italic_`
- **Code mode** (prefix `#`) — logic and function calls: `#set`, `#let`, `#if`
- **Math mode** (delimit with `$`) — formulas: `$x^2$`

## Data Types

| Type | Example | Description |
|------|---------|-------------|
| content | `[Hello]` | Displayable content |
| str | `"Hello"` | Text string |
| int | `42` | Integer |
| float | `3.14` | Decimal number |
| bool | `true`, `false` | Boolean |
| array | `(1, 2, 3)` | Ordered list |
| dictionary | `(key: "value")` | Key-value pairs |
| none | `none` | Absence of value |
| auto | `auto` | Automatic/default value |
| length | `2cm`, `1em`, `12pt` | Physical length |
| ratio | `50%` | Percentage |
| color | `red`, `rgb("#ff0000")` | Color value |

## Variables and Functions

```typst
#let name = "World"
#let greeting = [Hello, #name!]

// Function definition
#let alert(body) = block(
  fill: yellow.lighten(80%),
  inset: 8pt,
  radius: 4pt,
  body,
)

// Function call
#alert[This is important!]
```

## Control Flow

```typst
// Conditional
#if x > 0 [Positive] else if x == 0 [Zero] else [Negative]

// For loop
#for item in ("a", "b", "c") [Item: #item. ]

// For with index
#for (i, item) in items.enumerate() [#(i + 1). #item ]

// While loop
#let i = 0
#while i < 5 { i += 1; [Step #i. ] }
```

## Set Rules (Apply Defaults)

```typst
// Global defaults (top of file)
#set text(font: "Arial", size: 12pt, lang: "de")
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.65em, spacing: 1.2em)
#set heading(numbering: "1.1")

// Scoped defaults
#[
  #set text(fill: red)
  This text is red.
]
This text is normal again.
```

## Show Rules (Customize Appearance)

```typst
// Style all headings
#show heading: set text(fill: navy)

// Custom heading rendering with numbering
#show heading.where(level: 1): it => {
  v(1em)
  block(fill: blue, inset: 8pt, radius: 4pt,
    text(fill: white, weight: "bold", {
      if it.numbering != none {
        counter(heading).display(it.numbering)
        h(0.5em)
      }
      it.body
    })
  )
}

// Apply function to rest of document
#show: columns.with(2, gutter: 1cm)
```

**Important:** In show rules, `it.body` contains only the text — include `counter(heading).display(it.numbering)` explicitly for numbered headings.

## Page Setup

```typst
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 2.5cm, right: 2.5cm),
  numbering: "1",
  number-align: center,
  header: [Title #h(1fr) #counter(page).display()],
  footer: context [Page #counter(page).display() of #counter(page).final().first()],
)
```

## Text & Formatting

```typst
*bold*    _italic_    \`code\`    ~strikethrough~

#text(fill: red, weight: "bold", size: 14pt)[Styled text]
#underline[underlined]    #highlight[highlighted]
#super[superscript]    #sub[subscript]
#smallcaps[Small Caps]
#link("https://example.com")[Click here]
Some text#footnote[This appears at the bottom.]
```

## Layout Functions

```typst
#v(1em)                    // Vertical space
#h(0.5em)                  // Horizontal space
#h(1fr)                    // Flexible fill
#line(length: 100%)        // Horizontal line
#pagebreak()               // Page break

#align(center)[Centered]
#block(fill: luma(230), inset: 8pt, radius: 4pt)[Styled block]
#box(fill: yellow, inset: 4pt)[inline styled]

#grid(columns: (1fr, 1fr), gutter: 1em, [Left], [Right])
#stack(dir: ltr, spacing: 1em, [A], [B], [C])
#columns(2, gutter: 1cm)[Column content]
#pad(left: 2em)[Indented content]
```

## Tables

```typst
// Simple
#table(columns: 3, [A], [B], [C], [1], [2], [3])

// Advanced
#table(
  columns: (auto, 1fr, 2fr),
  align: (left, center, right),
  stroke: 0.5pt + gray,
  fill: (x, y) => if y == 0 { gray.lighten(80%) },
  inset: 8pt,
  table.header([*Name*], [*Type*], [*Description*]),
  [foo], [int], [A number],
  table.cell(colspan: 2)[Merged], [Cell],
)

// As figure with caption
#figure(
  table(columns: 2, [A], [B], [1], [2]),
  caption: [A simple table],
) <tab-data>
```

## Images & Figures

```typst
#image("assets/photo.png")
#image("photo.jpg", width: 80%)

#figure(
  image("chart.png", width: 100%),
  caption: [Sales data for 2024],
) <fig-sales>

See @fig-sales for details.
```

## Math Mode

```typst
// Inline
The equation $x^2 + y^2 = r^2$ describes a circle.

// Display (with whitespace after opening $)
$ sum_(i=1)^n x_i = integral_0^1 f(x) dif x $

// Common notation
$alpha, beta, gamma, delta$           // Greek letters
$a / b$ or $frac(a, b)$              // Fractions
$sqrt(x)$ or $root(3, x)$            // Roots
$arrow(x)$ or $bold(x)$              // Vectors
$mat(1, 0; 0, 1)$                    // Matrix
$cases(x &"if" x > 0, -x &"else")$  // Cases
```

## References & Labels

```typst
= Introduction <intro>
See @intro for the introduction.

// Labels go right after the element: <label-name>
// References use @ prefix: @label-name
```

## Bibliography

```typst
#bibliography("references.bib")
#bibliography("references.bib", style: "apa")

@einstein1905                  // Parenthetical citation
@einstein1905[p. 42]           // With page number
As shown by @einstein1905, ... // Narrative citation
```

## State & Counters

```typst
#counter(page).display()           // Current page number
#counter(heading).display()        // Current heading number
#counter(heading).update(0)        // Reset (e.g., for appendix)

// Custom counter
#let prob = counter("problem")
#prob.step()
Problem #context prob.display()
```

## Imports

```typst
#import "utils.typ": helper, format-date
#import "@preview/tablex:0.0.8": tablex    // Typst Universe package
```

## Multi-File Projects

```typst
// main.typ — root file with preamble
#set text(font: "Arial", size: 12pt)
#set page(paper: "a4")
#include "chapters/01-intro.typ"
#include "chapters/02-methods.typ"
#bibliography("references.bib")
```

**Important:** Always compile the root file, not individual chapters. Chapters lack the preamble and may have broken relative paths.

## Common Patterns

```typst
// Table of contents
#outline(title: "Contents", indent: auto, depth: 3)

// Title page without numbering
#set page(numbering: none)
// ...title content...
#pagebreak()
#set page(numbering: "1")
#counter(page).update(1)

// Appendix with letter numbering
#counter(heading).update(0)
#set heading(numbering: "A.1")
```

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `unexpected closing bracket` | Extra `]` or `)` | Check bracket balance |
| `expected content, found X` | Wrong type in content context | Wrap in `[...]` |
| `unknown variable: X` | Typo or missing `#let`/`#import` | Check spelling |
| `file not found` | Wrong relative path | Path is relative to current file |
| `content is not allowed here` | Content in code context | Use code block `{}` |
| `unexpected end of file` | Unclosed bracket | Check `[`, `{`, `(` balance |

## Best Practices

1. Put all `#set` and `#show` rules at the top of the root file
2. Use `#let` for reusable components — don't repeat complex markup
3. Add `<label>` to headings, figures, tables you want to reference
4. Use `#figure()` for captioned, numbered content
5. Keep images in `assets/` subfolder
6. One file per chapter for large documents
7. Always use Unicode characters directly (ä, ö, ü, ß) — Typst supports full Unicode
