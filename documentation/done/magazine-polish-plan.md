# Magazine Polish Plan — Editorial-grade Magazin-Output

> **Status:** Geplant, nicht implementiert. Eintragsdatum: 2026-05-17.
>
> **Strategischer Kontext:** Der Design-Editor (Phasen A–D) ist komplett, aber für High-End-Editorial-Magazin-Output fehlen noch ein paar gezielte Bausteine. Zwei konkrete Referenz-Magazine helfen die Lücke zu schließen:
>   - [Neues Lernen (Haufe)](https://www.haufe.de/personal/neues-lernen/) — modernes deutsches Business-Editorial, sans-only, generös, Kategorie-Label-getrieben
>   - The Local Project Magazine — Architektur/Design, photo-led, serif-body + sans-display, ruhige Earth Tones, refined captions mit Photographer-Credits
>
> **Audience:** Output kommt zu ~100 % von einer KI (Claude Desktop via MCP). Plan ist optimiert für maschinelle Komposition: jedes Feature ist ein eindeutig benannter Building-Block mit klaren Params; die KI kombiniert sie, der Mensch tut es nicht.

---

## Was geliefert wird (9 Bausteine, ~2–3 Tage Arbeit)

| # | Baustein | Element-ID(s) / Schema-Add | Layer |
|---|----------|----------------------------|-------|
| 1 | **Drop Cap** | `drop-cap` Element (wrappt `#droplet`) | designElements.ts |
| 2 | **Article-Opener** | `article-opener` Element (kicker / headline / standfirst / byline) | designElements.ts |
| 3 | **Section-Opener** | `section-opener` Element (ganzseitiger typografischer Moment) | designElements.ts |
| 4 | **Image-Gallery 2-up / 3-up** | `gallery-2up`, `gallery-3up` Elemente | designElements.ts |
| 5 | **Caption mit Photographer-Credit** | Schema-Feld + Generator-Helper | styleTypes + styleParser + designElements |
| 6 | **Pull-Quote-Varianten** | `pull-quote-display`, `pull-quote-block` (zusätzlich zum bestehenden `pull-quote`) | designElements.ts |
| 7 | **Editorial-Divider-Varianten** | `divider-asterisks`, `divider-ornament` (zusätzlich zum bestehenden `divider`) | designElements.ts |
| 8 | **Cover-Page-Builder** | `magazine-cover` Element (Issue / Date / Title / Photo) | designElements.ts |
| 9 | **Magazin-Layout-Preset** | `magazine-editorial` LayoutPreset mit Header-Strip | layoutPresets.ts |

**Out of scope** (separate Iteration, größerer Aufwand):
- Full-Bleed-Images mit Per-Section-Page-Margin-Overrides (~1 Woche Schema-Arbeit)
- Marginalia / Side-Notes mit drafting-Package
- Mosaik-Grids (3+ Bilder asymmetrisch)
- Initialen-Heading-Differenzierung (erste Seite eines Kapitels vs. Folgeseiten)

---

## Empfohlene Implementierungsreihenfolge

Reihenfolge ist nach **Building-Block-Tiefe** organisiert — bauen wir die Basics zuerst, dann Dinge die darauf aufbauen, dann komposite Elemente.

1. **Drop Cap** (1) — kleinste, isoliert
2. **Editorial-Divider-Varianten** (7) — auch isoliert, schnell
3. **Pull-Quote-Varianten** (6) — Variation auf existierendem Element
4. **Article-Opener** (2) — komposit aus Heading + Body-Tokens
5. **Section-Opener** (3) — komposit, baut auf Hero auf
6. **Image-Gallery** (4) — neuer Element-Typ mit mehreren Image-Params
7. **Photographer-Credit-Schema** (5) — kleinste Schema-Erweiterung
8. **Magazine-Cover** (8) — größtes komposit-Element
9. **Magazin-Layout-Preset** (9) — finaler Touch, nutzt vorherige Elemente

Nach jedem Punkt: `npm run build`, `npx svelte-check --threshold error`, ein Test-Compile gegen das Sample-Projekt, dann commit. **Keine 9-in-einem-Commit-Bomben** — pro Punkt ein eigener, reverbarer Commit.

---

## Per-Feature-Spezifikationen

### 1. Drop Cap

**User-facing:** KI ruft `vswrite_insert_design_element({ elementId: "drop-cap", afterText: "...", params: { letter: "T", body: "his is the opening paragraph after the drop cap." } })`.

**Files to touch:**
- `src/shared/designElements.ts` — neuer Eintrag in `DESIGN_ELEMENTS`

**Element-Definition:**
```ts
{
  id: 'drop-cap',
  name: 'Drop Cap',
  description: 'Large decorative initial letter wrapping the first lines of a paragraph. Use sparingly — one per long-form opener, never multiple in the same section.',
  params: [
    { name: 'letter', description: 'The single character that becomes the drop cap. Usually the first letter of the paragraph.', required: true, defaultValue: 'T' },
    { name: 'body', description: 'The rest of the paragraph (without the leading letter). Plain text or Typst markup.', required: true, defaultValue: '' },
    { name: 'height', description: 'How many lines tall the cap is. 3 is the editorial default.', required: false, defaultValue: '3' },
  ],
  template: `
#import "@preview/droplet:0.3.1": dropcap

#dropcap(
  height: {height},
  font: "{heading-font}",
  fill: style-colors.primary,
)[*{letter}*{body}]
`.trim(),
}
```

**Tricky bit:** The template needs the heading-font slot. Solution: emit `style-fonts.heading` via the same #let-import pattern as `style-colors`. Currently style.typ only exports `style-colors`. Add `style-fonts` as a sibling export.

**Generator change:** In `src/shared/styleParser.ts` at the palette section, after emitting `style-colors`, also emit:
```typst
#let style-fonts = (
  body:    "<body-font>",
  heading: "<heading-font>",
  code:    "<code-font>",
)
```

The `{heading-font}` placeholder in the drop-cap template becomes `style-fonts.heading` at render time:
```ts
template: `... font: style-fonts.heading, ...`
```

(Cleaner than templating the font name — re-themes automatically.)

**MCP impact:** None — already exposed via `vswrite_insert_design_element`.

**Skill updates:**
- `DESIGN_SKILL` > "Anti-Patterns": add "More than one drop cap per section" (it's already noted in Modern Looks but make it explicit).
- `TYPST_SKILL` > Bundled Packages > Editorial section: add code example for `droplet` (currently it's just listed).

**Sample-project showcase:** in `chapters/07-design-showcase.typ`, replace the opening sentence of one section with a drop-cap variant — comment it out / leave commented form for users to copy.

---

### 2. Article-Opener

**User-facing:** `vswrite_insert_design_element({ elementId: "article-opener", afterText: "", params: { kicker: "INTERVIEW", headline: "The Last Architect of Tasmania", standfirst: "Helen Lyon spent four decades reshaping how rural housing relates to land.", byline: "By Sam Cooper, Photography by Maya Reidt" } })`.

**Files to touch:**
- `src/shared/designElements.ts`

**Element-Definition:**
```ts
{
  id: 'article-opener',
  name: 'Article Opener',
  description: 'The masthead block at the top of an article: small uppercase kicker (category/section label), large display headline, lead paragraph (standfirst), byline. Drop in at the very top of an article to give it the magazine-magazine feel.',
  params: [
    { name: 'kicker', description: 'Small uppercase category label above the headline. E.g. "PROFILE", "INTERVIEW", "ESSAY", "REPORT". Empty = no kicker.', required: false, defaultValue: '' },
    { name: 'headline', description: 'The article title. Renders large in the heading font / primary color.', required: true, defaultValue: 'Article Title' },
    { name: 'standfirst', description: 'The lead paragraph — usually 1–3 sentences. Renders in italics at ~1.3em.', required: false, defaultValue: '' },
    { name: 'byline', description: 'Author + photographer credit. E.g. "By Sam Cooper, Photography by Maya Reidt". Empty = no byline.', required: false, defaultValue: '' },
  ],
  template: `
{kicker-block}
#text(size: 2.4em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[
  {headline}
]
{standfirst-block}
{byline-block}
#v(1em)
`.trim(),
}
```

**Conditional sub-blocks** (in `renderDesignElement`'s switch):
- `kicker-block`: `#text(size: 0.85em, weight: "bold", tracking: 0.12em, fill: style-colors.accent)[{kicker}] \\ \\ ` (uppercase + tracking)
- `standfirst-block`: `#v(0.5em) #text(size: 1.25em, style: "italic", fill: style-colors.text)[{standfirst}]`
- `byline-block`: `#v(0.6em) #text(size: 0.85em, fill: style-colors.muted)[{byline}]`

**Skill updates:**
- `DESIGN_SKILL` > Mental Model: note that an Article-Opener replaces the H1 + first paragraph for editorial-style articles. **Don't use both** — pick one.

---

### 3. Section-Opener

**User-facing:** `vswrite_insert_design_element({ elementId: "section-opener", afterText: "", params: { title: "PART TWO", subtitle: "After the Storm" } })`.

**Element-Definition:**
```ts
{
  id: 'section-opener',
  name: 'Section Opener',
  description: 'Full-page typographic moment between articles or major sections. Inserts a pagebreak before, centers a small uppercase title plus a large subtitle, then a pagebreak after. The result is a single-page section divider you would see in a magazine between feature articles.',
  params: [
    { name: 'title', description: 'Small uppercase label at the top of the page. E.g. "PART TWO", "CHAPTER III", "FEATURE".', required: false, defaultValue: 'PART TWO' },
    { name: 'subtitle', description: 'Large display text — the actual title of the section. Usually 2–5 words.', required: true, defaultValue: 'After the Storm' },
  ],
  template: `
#pagebreak()

#v(1fr)
#align(center)[
  #text(size: 0.85em, weight: "bold", tracking: 0.12em, fill: style-colors.muted)[{title}]
  #v(0.6em)
  #text(size: 3.5em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{subtitle}]
  #v(0.8em)
  #line(length: 12%, stroke: 1pt + style-colors.accent)
]
#v(1fr)

#pagebreak()
`.trim(),
}
```

`#v(1fr)` before and after the content vertically centers it on the page.

---

### 4. Image-Gallery 2-up / 3-up

**Approach:** Two separate elements rather than one with a `layout` param — easier for the AI to discover and pick the right one.

**Element-Definitionen:**
```ts
{
  id: 'gallery-2up',
  name: 'Image Gallery (2-up)',
  description: 'Two images side-by-side at equal width, with optional captions below each. Use for paired photographs (before/after, two perspectives, …). Both images must already exist in `assets/`.',
  params: [
    { name: 'image1', description: 'Relative path to first image (e.g. "assets/photo-1.jpg").', required: true, defaultValue: 'assets/photo-1.jpg' },
    { name: 'image2', description: 'Relative path to second image.', required: true, defaultValue: 'assets/photo-2.jpg' },
    { name: 'caption1', description: 'Optional caption beneath the first image. Empty = no caption.', required: false, defaultValue: '' },
    { name: 'caption2', description: 'Optional caption beneath the second image. Empty = no caption.', required: false, defaultValue: '' },
  ],
  template: `
#grid(
  columns: (1fr, 1fr),
  column-gutter: 1em,
  row-gutter: 0.4em,
  image("{image1}", width: 100%),
  image("{image2}", width: 100%),
  {caption1-cell},
  {caption2-cell},
)
`.trim(),
},
{
  id: 'gallery-3up',
  name: 'Image Gallery (3-up)',
  description: 'Three images side-by-side at equal width. Use for triptychs or short series. All three images must exist in `assets/`.',
  params: [/* image1, image2, image3, caption1, caption2, caption3 */],
  template: `
#grid(
  columns: (1fr, 1fr, 1fr),
  column-gutter: 0.8em,
  row-gutter: 0.4em,
  image("{image1}", width: 100%),
  image("{image2}", width: 100%),
  image("{image3}", width: 100%),
  {caption1-cell}, {caption2-cell}, {caption3-cell},
)
`.trim(),
},
```

**Conditional sub-blocks** for each caption-cell: empty captions become `[]` (empty Typst block), non-empty become `text(size: 0.85em, fill: style-colors.muted, "<caption>")`.

---

### 5. Caption mit Photographer-Credit (Schema-Erweiterung)

**Approach:** Erweitere `StyleFigure` um `creditSeparator: string` und `creditWeight: 'regular' | 'bold' | 'italic'`. Captions, die einen Credit haben, werden so geschrieben:
```typst
#figure(image("..."), caption: [Main caption text. #emph[— Photo: Maya Reidt]]) <fig:foo>
```

Das `#emph[]` wird vom Generator über eine neue `figure-with-credit(body, credit)` Helper-Funktion im `apply-style` Body bereitgestellt:

```typst
let figure-caption-credit(caption, credit) = [
  #caption #h(0.4em) #text(style: "italic", fill: style-colors.muted)[ — Photo: #credit]
]
```

Dann kann die KI das so nutzen:
```typst
#figure(image("..."), caption: figure-caption-credit("The interior at dusk.", "Maya Reidt"))
```

**Schema-Changes** in `src/shared/styleTypes.ts`:
```ts
export interface StyleFigure {
  // ... existing fields
  /** Separator string between the caption and the photographer credit. e.g. " — " or " · ". */
  creditSeparator: string;
  /** Prefix label for the credit. e.g. "Photo: ", "By ", "Image: ". Empty = no label. */
  creditLabel: string;
}
```

Defaults: `creditSeparator: " — "`, `creditLabel: "Photo: "`.

**Generator changes** in `src/shared/styleParser.ts`: in the apply-style body, emit a helper `let` after the figure show rules:
```ts
bpush(`  let figure-caption-credit(caption, credit) = caption + h(0.4em) + text(style: "italic", fill: style-colors.muted)[${separatorEscaped}${labelEscaped}#credit]`);
```

**DesignPanel UI:** Add two fields to the Figure card under Elements section: "Credit separator" (text input), "Credit label" (text input).

---

### 6. Pull-Quote-Varianten

**Approach:** Behalte den bestehenden `pull-quote`. Füge zwei Varianten hinzu:

```ts
{
  id: 'pull-quote-display',
  name: 'Display Pull-Quote',
  description: 'Very large quote — no border, no italic. Used as a visual break in long-form articles, often a single striking sentence pulled from earlier in the body. Bigger than `pull-quote`, no decorative line.',
  params: [
    { name: 'text', description: 'The quoted text (no surrounding quotation marks needed).', required: true, defaultValue: 'A striking sentence.' },
  ],
  template: `
#v(1.5em)
#align(center)[
  #text(size: 2.2em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[
    "{text}"
  ]
]
#v(1.5em)
`.trim(),
},
{
  id: 'pull-quote-block',
  name: 'Block Pull-Quote',
  description: 'Boxed pull-quote with subtle background fill and accent-colored bar. Used when you need the quote to feel "set apart" rather than monumentally large.',
  params: [
    { name: 'text', description: 'The quoted text.', required: true, defaultValue: 'A striking sentence.' },
    { name: 'attribution', description: 'Optional attribution.', required: false, defaultValue: '' },
  ],
  template: `
#v(1em)
#block(
  fill: style-colors.muted.lighten(85%),
  stroke: (left: 4pt + style-colors.accent),
  inset: (x: 1.2em, y: 1em),
  radius: 3pt,
)[
  #text(size: 1.15em, style: "italic", fill: style-colors.text)["{text}"]
  {attribution-block}
]
#v(1em)
`.trim(),
},
```

---

### 7. Editorial-Divider-Varianten

```ts
{
  id: 'divider-asterisks',
  name: 'Divider (Asterisks)',
  description: 'Centered three-asterisk ornament. Use for soft section breaks within long-form articles where a thin rule would be too utilitarian. The classic editorial choice.',
  params: [],
  template: `
#v(1.5em)
#align(center)[
  #text(size: 1.4em, fill: style-colors.muted, tracking: 0.4em)[\\* \\* \\*]
]
#v(1.5em)
`.trim(),
},
{
  id: 'divider-ornament',
  name: 'Divider (Ornament)',
  description: 'Centered single-character typographic ornament (❦ by default). Use sparingly — at most once per article — as a visual signature for major scene transitions.',
  params: [
    { name: 'glyph', description: 'The ornament character. Default ❦. Other options: ※, ✦, ☙, ⁂.', required: false, defaultValue: '❦' },
  ],
  template: `
#v(1.5em)
#align(center)[
  #text(size: 1.6em, fill: style-colors.accent)[{glyph}]
]
#v(1.5em)
`.trim(),
},
```

---

### 8. Magazine-Cover

**Approach:** Komposit-Element für die Coverseite eines Magazins. Issue-Label oben, Headline mittig, Date unten. Optional Foto-Slot.

```ts
{
  id: 'magazine-cover',
  name: 'Magazine Cover',
  description: 'Full-page magazine cover block. Issue label at the top, large headline mid-page, date / volume at the bottom. Optional background image. Drop this at the very top of main.typ before any chapter includes.',
  params: [
    { name: 'issue', description: 'Issue identifier — e.g. "ISSUE 42", "VOL. III · 2026", "AUTUMN 2026".', required: true, defaultValue: 'ISSUE 1' },
    { name: 'title', description: 'Magazine masthead title — e.g. "NEUES LERNEN", "THE LOCAL PROJECT".', required: true, defaultValue: 'MAGAZINE' },
    { name: 'headline', description: 'Cover-line — the main story-pull. 2–8 words.', required: true, defaultValue: 'The Quiet Architect' },
    { name: 'subhead', description: 'Smaller cover-line beneath the headline.', required: false, defaultValue: '' },
    { name: 'date', description: 'Cover date — e.g. "November 2026".', required: false, defaultValue: 'November 2026' },
    { name: 'image', description: 'Optional path to a cover image. If provided, renders behind the type at 100% width. Empty = no background image.', required: false, defaultValue: '' },
  ],
  template: `
#page(margin: 0pt)[
  {image-bg}
  #pad(x: 2cm, y: 2cm)[
    #text(size: 4em, weight: "bold", tracking: 0.05em, fill: style-colors.primary, font: style-fonts.heading)[{title}]
    #v(0.4em)
    #text(size: 0.9em, weight: "bold", tracking: 0.15em, fill: style-colors.muted)[{issue}]

    #v(1fr)

    #text(size: 3em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{headline}]
    {subhead-block}

    #v(1fr)

    #text(size: 0.9em, fill: style-colors.muted)[{date}]
  ]
]
#pagebreak(weak: true)
`.trim(),
}
```

**Tricky bit:** `#page(margin: 0pt)` overrides the page margin **for that one page**. This is the closest thing to "per-section page overrides" we can do without schema work — Typst's `#page()` function takes effect just for that single page, then returns to normal margins. 

If the `image` param is non-empty, `image-bg` becomes a `place(top + left, image("{image}", width: 100%, height: 100%))` block (positioned absolutely behind the text).

This is the **one feature that touches the full-bleed concept** without needing schema work. Won't replace a real per-section system but does solve the cover-page case.

---

### 9. Magazin-Layout-Preset

**Approach:** Neuer Eintrag in `LAYOUT_PRESETS` mit angepasstem header / footer markup.

```ts
{
  id: 'magazine-editorial',
  name: 'Magazine Editorial',
  description: 'A4 portrait, 2 columns, with an editorial header strip that shows the section/issue label across every page. Pairs well with the Editorial Magazine theme and the Magazine Cover design element.',
  bestFor: 'Editorial magazines, long-form features, design publications',
  layout: {
    paper: 'a4',
    orientation: 'portrait',
    margin: '2.2cm',
    columns: 2,
    pageNumbering: '1',
    pageHeader: '#text(size: 0.85em, tracking: 0.1em, fill: style-colors.muted)[NEUES LERNEN  ·  ISSUE 1] #h(1fr) #line(length: 1.5cm, stroke: 0.5pt + style-colors.accent)',
    pageFooter: '',
    pageFill: '',
  },
  baseSize: '10.5pt',
},
```

The `pageHeader` is a styled markup string — references `style-colors.muted`, `style-colors.accent`. Works because the layout preset is applied INSIDE `apply-style` (which has style-colors in scope).

---

## Cross-cutting changes

### Generator: expose `style-fonts` alongside `style-colors`

Currently `style.typ` exports just `#let style-colors = (...)`. Drop-cap, article-opener, section-opener, magazine-cover, pull-quote-display all need to reference `style-fonts.heading`. Add a sibling export.

**`src/shared/styleParser.ts`** — after the `style-colors` block:

```ts
push('#let style-fonts = (');
push(`  body:    ${fontLiteral(style.fonts.body)},`);
push(`  heading: ${fontLiteral(style.fonts.heading)},`);
push(`  code:    ${fontLiteral(style.fonts.code)},`);
push(')');
push();
```

### `renderDesignElement` — keep flat string params, but extend conditional sub-blocks

The 9 new elements all fit within the existing `Record<string, string>` params API. No engine change needed — only new entries in `DESIGN_ELEMENTS` and matching conditional-sub-block cases in the `conditionals` map inside `renderDesignElement`.

If something needs richer param types in the future (arrays for variable-length galleries), that's a separate refactor — out of scope for this plan.

### Skill updates summary

- **`DESIGN_SKILL`** (`src/shared/skillTemplates.ts`):
  - Anti-Patterns: "More than one drop cap per section" (explicit), "Article-Opener AND H1+first-paragraph in the same article" (don't double up), "Multiple section-openers without page-breaks between" (defeats their purpose)
  - New section "Magazine Composition Recipes" — walk through Neues-Lernen-style and Local-Project-style: which elements to chain in what order
- **`TYPST_SKILL`**:
  - Bundled Packages > Editorial section: add a small `droplet` code example so the AI knows the import + call signature
- **`VSWRITE_SKILL`**:
  - MCP tool table: no new entries (the design elements are all data-driven via existing `vswrite_insert_design_element`). Maybe add a note: "9 new magazine elements added in Round 4 — call `vswrite_list_design_elements` to see the current list."

### Sample-project showcase

In `resources/sample-project/chapters/07-design-showcase.typ`, extend (don't replace) the existing showcase to include each new element in a labeled subsection. Plus: add a commented-out "magazine-mode" block at the top showing how to switch the sample into a magazine layout with one MCP-tool sequence.

### MCP server impact

**None.** All new functionality flows through the existing `vswrite_list_design_elements` / `vswrite_insert_design_element` / `vswrite_list_layouts` / `vswrite_apply_layout` tools. The tool list returned by `vswrite_list_design_elements` will simply grow from 6 to 15 entries automatically. No new tool definitions.

### MCP binary rebuild

After all 9 features land, **rebuild the Bun-compiled binary** so the additions ship to Pro users:

```bash
node scripts/build-mcp-binary.mjs --all
```

Bump `MCP_SETUP_VERSION` in `src/main/mcpSetup.ts` (currently 0.6.0 → 0.7.0) so the setup wizard re-prompts existing users.

---

## Verification per commit

For each of the 9 features:
1. `unset ELECTRON_RUN_AS_NODE && npm run build` — must exit 0
2. `npx svelte-check --threshold error` — must exit at 0 errors
3. Test-compile against the sample project — write a temp main.typ that uses the new element, compile, inspect PDF
4. Commit with a focused message; one feature per commit

At the end of all 9:
- One final commit for `MCP_SETUP_VERSION` bump + binary rebuild
- One final commit for documentation updates (project_status.md, next-steps.md, handbook entries, skill updates)

---

## Done criteria

- All 9 element / preset entries exist and compile
- `style-fonts` exported alongside `style-colors`
- DesignPanel still works for all existing functions (regression-test the sample)
- `vswrite_list_design_elements` returns 15 entries (up from 6)
- `vswrite_list_layouts` returns 7 layouts (up from 6)
- `DESIGN_SKILL` + `TYPST_SKILL` + `VSWRITE_SKILL` updated
- Sample project's chapter 7 references each new element in a commented or live form
- MCP binary rebuilt for both Darwin arches with the new design elements
- Final commit pushed to `origin/main`

---

## Open questions (resolve during implementation)

1. **Drop cap font fallback** — if `style-fonts.heading` is a serif, drop caps look weird. Maybe drop cap should have its own font override. Trade-off: more knobs vs. cleaner output. Default to `style-fonts.heading`, document the trade-off, let advanced users override via element param.

2. **Magazine-cover background image positioning** — `#place` is one approach but it doesn't respect aspect ratio cropping. Alternative: a single `#page(margin: 0pt, fill: ...)` with image-as-fill. Test both, pick the one that gives the cleaner cover.

3. **Section-Opener `#pagebreak()` semantics** — Typst's pagebreak has `weak: true | false | "to: odd"`. For magazines, `to: "odd"` (always start sections on right-hand pages) is the editorial standard. Should the element default to `to: "odd"` or just plain `weak: true`?

4. **Gallery image sizing** — `width: 100%` makes each image stretch to its column. For galleries that should NOT stretch (e.g. portrait orientations in a landscape gallery), an optional `fit: "contain"|"cover"` parameter might help. Defer to v2 if needed.

5. **Article-opener vs. native H1** — the article-opener element renders its own large heading text, but it's NOT a Typst `#heading()`. That means it doesn't appear in the outline / TOC. Decide: should the element wrap the headline in `#heading(level: 1, outlined: true, numbering: none)[...]` so it shows up in the TOC? Probably yes for usability. Test.
