# Web Export Plan — HTML Serializer ("Penwright kann Web und Druck")

**Status:** Proposal / build spec. Nothing implemented yet.
**Author context:** Written for René as the working brief to build an HTML/web
export in Penwright, so that a document authored once can ship as **print PDF**
*and* as a **design-faithful, responsive web article**.
**Companion:** the consuming website lives in a separate, decoupled repo
(`show-your-work`, Astro 5 + Tailwind v4). Handoff stays copy-paste, no API/git
coupling — same boundary as today.

---

## 1. Goal & non-goals

**Goal.** A new export path `serializeHtml(doc, style, opts)` that turns a
Penwright document (TipTap/ProseMirror AST + `style.json` tokens) into a
**self-contained, semantic, responsive HTML article**: clean markup
(`<article>/<h1>/<p>/<figure>/…`), the magazine design elements preserved as
real CSS (drop cap stays a drop cap, the interview stays two columns and
collapses to one on mobile), and a scoped `<style>` block generated from the
project's design tokens. Output should stand on its own (open it in any browser
and it looks right) **and** drop cleanly into the website.

**Explicitly in scope (this is the differentiator):** preserving the
*characteristic* magazine design — drop caps, multi-column text, pull-quotes,
margin notes, callouts, accent headings — not just the plain text. This is
what almost no Typst/PDF tool does, and Penwright can because the structure is
still in the document, not baked into pixels.

**Non-goals.**
- **Pixel-exact reproduction.** Print-only constructs (full-bleed spreads
  across the gutter, bleed/crop, `#place`-positioned double pages, fr-spacer
  covers) have **no responsive web equivalent**. They are *re-designed* for web
  (hero / article header), not converted. See §6.6.
- **Going through Typst's own HTML backend** (experimental, semantic-only, no
  CSS as of 0.15) or **PDF→HTML** (either pixel-frozen and non-responsive, or
  reflowed with the design thrown away). Both were evaluated and rejected; the
  AST is the right source, not the rendered PDF.

---

## 2. Why this is feasible here (the core insight)

The asset is the **intermediate representation**. Penwright already holds the
document as a TipTap/ProseMirror AST and already serializes that AST to a second
target (`docxSerializer.ts`, ~2300 lines). HTML is *easier* than DOCX, because
HTML is ProseMirror's **native** output: every custom node/mark already
implements `renderHTML()`, and the design tokens already live as structured
JSON (`ProjectStyle` in `src/shared/styleTypes.ts`) that maps mechanically to
CSS variables.

So three things already exist and are reused:
1. **`docxSerializer.ts` is a near 1:1 blueprint** for the traversal, the
   pre-pass (cross-refs, citations, footnotes), and — critically — the raw-block
   reinterpretation logic (`classifyRawBlock` @ docxSerializer.ts:1563).
2. **`styleParser.ts` / `emitCoreRules`** already maps every token to Typst
   `#set`/`#show` rules — the exact same mapping, retargeted to CSS, is the
   token→CSS generator.
3. **Every node/mark has `renderHTML()`** already (marks in `typstMarks.ts`,
   tables via `@tiptap/extension-table`, etc.), so a static renderer yields
   valid semantic HTML out of the box.

---

## 3. The hard prerequisite — read this before estimating anything

> **A serializer is only as design-faithful as the AST is structured. Today the
> AST is not structured for the things that matter.**

Verified against a real document (the LANGSAM issue): **~65–75 % of the visible
design lives in hand-written `#let` macros** (`lead`, `pull`, `frage`, `notiz`,
`bildtafel`, `randnotiz`, `aufmacher`, `doppelseite`) plus two packages
(`droplet` for drop caps, `drafting` for margin notes). In the editor these all
become **opaque `typstRawBlock` atoms** (`src/editor/lib/typstRawBlock.ts:11`):
the raw Typst string is stored verbatim in a `content` attribute with **no
child nodes and no semantics**. A static HTML renderer would emit only
`<div data-typst-raw>#lead[…]</div>`.

The DOCX serializer's reparser (`classifyRawBlock`) *partly* rescues this — but
it recognizes **Typst built-ins and `gentle-clues` conventions only, not
user-defined macro names**. None of `lead/pull/frage/…` are in its tables, so
they fall through to `kind: 'prose'`: the text survives, the drop cap / column /
accent-question character is lost. Worse, `#columns` is in `SKIP_LEADERS`
(docxSerializer.ts:1492), so two-column content is **silently dropped**, not
just unstyled (see §6.8 — this is a real bug in today's DOCX export too).

**Conclusion:** the expensive, valuable work is **upstream of the serializer** —
turn the design macros into real, named AST nodes. That single step pays off
**three times** (PDF stays as-is, DOCX export stops dropping content, HTML
export becomes design-faithful). Everything below assumes this is done.

---

## 4. Output format decision

Penwright emits, **per article**, a self-contained bundle:

```
<slug>/
  index.mdx          # YAML frontmatter (metadata) + HTML body + scoped <style>
  assets/…           # images referenced by the body (relative paths)
```

- **Body = semantic HTML** with a stable class vocabulary (§7), wrapped in a
  single `<article class="pw-article" data-article="<slug>">`.
- **Styling = one scoped `<style>` block** at the top of the body. All rules are
  scoped under `.pw-article` (or `@scope (.pw-article)` where supported, plain
  prefixing as the universal fallback) so it never collides with a host site's
  CSS. It contains (a) the token → CSS-variable block and (b) the magazine
  element CSS with `@supports` fallbacks (§6.5).
- **Frontmatter** carries metadata: `title`, `date`, `summary`, `tags`,
  `locale`, optional `subtitle`, `cover`. (This maps onto the website's content
  schema; keep the field names aligned — coordinate once, then it's mechanical.)
- **`.mdx` (not `.md` or bare `.html`)** because it slots straight into the
  website's existing content-collection system while still allowing raw HTML +
  `<style>` in the body. No per-element website components are needed — that is
  the whole point of self-contained output. (If we later prefer pure `.html`,
  only the website's loader changes, not Penwright.)

**Design ownership.** With self-contained output the article *carries its own
design* (the right model for a magazine: each issue can have its own accent /
section themes, which `ProjectStyle.sections[]` already expresses). The website
provides the chrome (nav, footer, index pages) and *may* pass its own tokens in
to harmonize the look — both work because everything is CSS custom properties.

---

## 5. Module overview

```
src/shared/htmlSerializer.ts      # NEW — serializeHtml(doc, style, opts); mirrors docxSerializer.ts
src/shared/styleToCss.ts          # NEW — ProjectStyle → CSS custom props + element rules (mirror of styleParser.ts)
src/editor/lib/nodes/…            # NEW design nodes (dropCap, columns, pullQuote, marginNote, question, callout, figurePanel)
src/editor/lib/deserializer.ts    # EXTEND — recognize the macros and emit the new nodes instead of typstRawBlock
src/editor/lib/serializer.ts      # EXTEND — round-trip the new nodes back to the same #macro calls
src/shared/docxSerializer.ts      # FIX — remove `columns` from SKIP_LEADERS; ideally render the new nodes too
src/main/…  +  src/mcp/server.ts  # NEW — "Export to Web" command (UI + MCP tool + main-process writer)
```

Everything in `src/shared/` stays dependency-free (Node/Electron-agnostic), like
`docxSerializer.ts` — the Typst binary is injected via a hook (§6.7), not imported.

---

## 6. Implementation detail

### 6.1 Design blocks as real AST nodes  ← the keystone

Model the load-bearing magazine elements as **named TipTap nodes** with explicit
attributes, instead of opaque raw blocks. Minimum set (derived from the real
LANGSAM macros):

| New node | Replaces macro | Key attrs | Children |
|---|---|---|---|
| `dropCap` | `lead()` (droplet) | `lines` (e.g. 3), `color` slot | inline content (the paragraph) |
| `columns` | `#columns(n)[…]` | `count`, `gap` | block content |
| `pullQuote` | `pull()` | `attribution`, `align` | inline content |
| `marginNote` | `randnotiz()` (drafting) | `side` | inline content |
| `question` | `frage()` | — | inline content (Q&A pattern) |
| `callout` | `notiz()` | `title`, `tone`/accent | block content |
| `figurePanel` | `bildtafel()` | `ratio`, `note` | image + note |

Each node:
- implements `renderHTML()` → the §7 markup (so the static renderer handles it
  for free),
- is recognized by the **deserializer** so `#lead[…]`, `#columns(2)[…]`, etc.
  parse **into the node**, not into `typstRawBlock`,
- round-trips via the **serializer** back to the exact same `#macro` call (Typst
  output and PDF must stay byte-stable).

**Recognition strategy (pick one, prefer A):**
- **A — marker comments (robust).** When Penwright generates/owns these
  constructs, emit a marker it controls, e.g.
  `// penwright:node=dropcap` immediately before the macro call, and key the
  deserializer off the marker. Survives macro renames; no name-guessing.
- **B — name heuristic (fragile).** Extend the deserializer/`classifyRawBlock`
  tables with the concrete macro names (`lead→dropcap`, `pull→pullquote`,
  `frage→question`, `columns→columns`, `randnotiz→marginnote`,
  `notiz→callout`, `bildtafel→figurePanel`). Breaks on every rename / new macro
  and needs constant upkeep. Acceptable as a stopgap, not as the foundation.

> This is also a genuine **product upgrade independent of web**: a WYSIWYG
> magazine editor *should* offer these as first-class blocks in the UI (slash
> commands / toolbar), not require the user to hand-write macros. Once they are
> nodes, they carry to **PDF, DOCX and HTML** at once.

### 6.2 `serializeHtml(doc, style, opts)`

Mirror `docxSerializer.ts` structurally:
- **Core renderer:** `@tiptap/static-renderer` (`renderToHTMLString`) — TipTap
  3's recommended path, **server-safe, no jsdom**, with per-node/`per-mark`
  override maps. This is the exact analogue of the `convertNode` switch in DOCX,
  except cases return HTML strings instead of `new Paragraph()`. (Fallback if
  needed: ProseMirror `DOMSerializer.fromSchema(schema).serializeFragment(…)`,
  which needs a DOM env / `linkedom`.)
- **Marks map 1:1:** bold→`<strong>`, italic→`<em>`, underline→`<u>`,
  strike→`<s>`, code→`<code>`, super/sub→`<sup>/<sub>`, smallcaps→`<span
  style="font-variant:small-caps">`, textColor→`<span style="color:…">`,
  highlight→`<mark>`, link→`<a>`. Tables, lists, images, headings, footnotes:
  reuse the existing `renderHTML()` / extension output.
- **Reuse the DOCX pre-pass** (`buildExportContext`): cross-ref label map,
  citation grouping, footnote collection, bibliography rendering — directly
  portable.

### 6.3 Token → CSS generator (`styleToCss.ts`)

The mechanical, low-risk part. Mirror `emitCoreRules` in `styleParser.ts`, swap
the target syntax:
- `colors.*` → `:root`/scope custom props (`--pw-primary`, `--pw-accent`, …).
- `fonts.*` → `font-family` vars.
- `scale.base/leading` → `font-size`/`line-height`.
- `layout.margin/paper` → a measure/`max-width` on `.pw-article` (web uses a
  reading measure, not a paper size — translate, don't copy).
- `headings.h1..h6 {size,weight,color,marginTop}` → `h1..h6` rules.
- `elements.blockquote/codeBlock/figure/table` → element rules (HTML can be
  **more** faithful than DOCX here: border-radius, accent rules under headings,
  `color-mix()` tints — none of which survive DOCX).
- `sections[]` → per-section theme overrides via `@scope`/scoped selectors.

Translate Typst units: `pt→pt`/`rem`, `em→` line-height/`em`, `cm/fr→` web
equivalents; color slots stay hex.

### 6.4 Raw-block reparser → HTML

For raw blocks that remain (math, ad-hoc `#figure`, leftover layout), **port**
`classifyRawBlock` / `renderRawBlock` / `parseInlineTypst` from
`docxSerializer.ts` to emit HTML instead of OOXML. This is the heaviest reused
logic (~70 % of the DOCX effort) and it already exists. HTML can handle several
cases *better* than DOCX (callouts → styled `<aside>`; math → MathML/inline SVG
instead of rasterized PNG).

### 6.5 Magazine element CSS (with fallbacks)

Generated once into the scoped `<style>`. Verified browser support (2026):

| Element | CSS | Note |
|---|---|---|
| Drop cap | `initial-letter: <lines> 1` on `::first-letter`/`<span>` **+** `::first-letter{float:left;…}` fallback under `@supports not (initial-letter:2)` | **Firefox has no `initial-letter` (until v155)**, WebKit is prefixed — always ship the float fallback. |
| Columns | `column-width: <measure>; column-gap; column-rule` (text) **or** `display:grid` (aligned Q&A) | `column-width` is **responsive by default** (collapses to 1 col on mobile, no media query). Use Grid only for aligned speaker columns. |
| Pull-quote | `aside`/`blockquote.pull` with `column-span:all` (in multicol) or `float`+`shape-outside` | On mobile force full-width (`@media`). Mark duplicated quotes `aria-hidden`. |
| Margin note | grid side-column; collapse to inline `<details>`/indented block under ~50rem | CSS Anchor Positioning is cleaner but Firefox-less → progressive enhancement only. |
| Callout / accent block | token box: `border-inline-start`, `--pw-accent`, `color-mix()` tint | Trivially responsive; the most faithful part. |

### 6.6 Print-only constructs → re-design, not convert

`aufmacher()` / `doppelseite()` / cover (`#place`, `#box(clip)`, bleed,
parity `pagebreak`, fr-spacers) have **no reflow equivalent**. Map them
deliberately:
- double-page spread → **full-bleed hero image** + overlaid title,
- cover → **article header** (kicker / headline / standfirst / byline),
- gutter-crossing image → single full-width responsive image.

Implement as an export-time transform on those nodes (or dedicated `heroSpread`
/ `articleHeader` nodes). Do **not** try to translate `#place` offsets to CSS.

### 6.7 Pre-pass: math / SVG / refs

Reuse the injected `renderTypstSnippet` hook (docxSerializer.ts:114) — but for
web prefer **inline SVG / MathML / KaTeX** over rasterized PNG (sharper,
selectable, smaller). The hook is supplied by the main process / MCP server with
the bundled Typst binary, exactly as DOCX does; `shared/` stays dependency-free.

### 6.8 Bug fix (do this regardless): `#columns` is silently dropped

`SKIP_LEADERS` (docxSerializer.ts:1492) matches `^#…|columns|…`, so
`classifyRawBlock` returns `{kind:'skip'}` and the **entire two-column section
of the interview (~half the article) is dropped from today's DOCX export.**
Remove `columns` from `SKIP_LEADERS` and route it through the new `columns`
node (or at least render its inner content). This is a data-loss bug in the
shipping product, independent of web export.

### 6.9 Export command / UI / MCP / main process

- **UI:** "Export → Web (HTML)" in `ExportDialog.svelte`, chapter selection
  reused from the existing filtered-export flow.
- **MCP:** a `penwright_export_web` tool (sibling of `penwright_export_pdf`).
- **Main process:** write the `<slug>/index.mdx` + `assets/` bundle (reuse
  `runFilteredExport` plumbing in `importExport.ts`), inject `renderTypstSnippet`.

---

## 7. The markup vocabulary (Penwright-internal)

Stable classes Penwright emits, **styled by the scoped `<style>` it ships
with**. These are **internal to Penwright — the host website never styles
them.** Each exported article is a self-contained design world (Modell A): the
site treats the body as a black box and just embeds it. They are documented
here only so the serializer and its CSS generator stay in agreement. The
**only** cross-repo contract is the frontmatter (see §12).

| Concept | HTML |
|---|---|
| Article root | `<article class="pw-article" data-article="<slug>">` |
| Header | `<header class="pw-header">` (kicker/headline/standfirst/byline) |
| Drop-cap paragraph | `<p class="pw-dropcap">` (or leading `<span class="pw-initial">`) |
| Columns | `<div class="pw-columns" data-cols="2">` |
| Pull-quote | `<aside class="pw-pullquote"><p>…</p><cite>…</cite></aside>` |
| Margin note | `<aside class="pw-marginnote">` |
| Interview question | `<p class="pw-question">` (answers = following `<p>`) |
| Callout | `<aside class="pw-callout" data-tone="…">` |
| Figure panel | `<figure class="pw-figurepanel">` |
| Interlude / break | `<hr class="pw-interlude">` |
| Hero spread (re-designed) | `<figure class="pw-hero">` |

Tokens exposed as CSS variables on `.pw-article`: `--pw-primary`,
`--pw-accent`, `--pw-text`, `--pw-bg`, `--pw-muted`, `--pw-font-body`,
`--pw-font-heading`, `--pw-measure`, `--pw-leading`.

---

## 8. Dependencies to add

- `@tiptap/static-renderer` (TipTap 3) — **not yet installed**. Core renderer.
- *(optional)* `linkedom` — only if you fall back to `DOMSerializer` in Node.
- *(optional)* `katex` — if math should be CSS/HTML instead of rasterized SVG.

Already present and reused: `@tiptap/core` 3, `@tiptap/pm` 3, the table
extensions, the bundled Typst binary, `simple-git` (for a future one-click
publish — out of scope here; handoff stays copy-paste).

---

## 9. Phased plan & effort

> Effort assumes a competent dev with `docxSerializer.ts` as reference.

- **Phase 0 — Bug fix (½ day):** remove `columns` from `SKIP_LEADERS`. Stops
  data loss in DOCX today. Ship independently.
- **Phase 1 — Structuring (~1 week):** the keystone (§6.1). Design nodes +
  deserializer recognition (marker-comment strategy) + serializer round-trip +
  UI affordances. Verify PDF output is byte-stable and DOCX stops dropping
  content. *Without this, no export is design-faithful.*
- **Phase 2 — HTML serializer (~1–1.5 weeks):** `serializeHtml` +
  `styleToCss` + raw-block reparser port + magazine element CSS with fallbacks
  + per-article theming. Reaches ~90 % design fidelity for everything that is
  structured.
- **Phase 3 — Polish (~1 week):** print-construct re-design (hero/header),
  math/SVG via inline SVG/KaTeX, bibliography/citations, full pass over all
  LANGSAM chapters, edge cases (Firefox drop-cap fallback, `break-inside`,
  margin-note collapse).

**Total: ~3–4 weeks** for a design-faithful "web and print" v1. A 1–3 day
**prototype** (Phase 2 core only, no structuring) is possible but will render
LANGSAM as plain text with holes — useful to see the plumbing, not the result.

---

## 10. Open design decisions (for René)

1. **Recognition strategy** — marker comments (A, recommended) vs. macro-name
   heuristic (B). A is more work now, stable forever.
2. **Math rendering** — inline SVG (no dep, sharp) vs. KaTeX (smaller, needs
   dep) vs. MathML (native, a11y, weaker styling).
3. **Per-article vs. site-wide theming** — should an exported article carry its
   own accent/section themes (magazine feel, per issue), or inherit the
   website's tokens for one consistent look? Both are technically supported;
   it's an editorial choice. (Likely: carry own theme, let the site override.)
4. **Scoping mechanism** — `@scope` (clean, Baseline since Dec 2025) vs. class
   prefixing (universal). Ship prefixing as the floor, `@scope` as enhancement.

---

## 11. Acceptance criteria (test on real LANGSAM chapters)

A chapter is "design-faithful on web" when, exported and opened in a browser:
- the drop cap renders as a sunk initial in the accent color (float fallback in
  Firefox), reflowing with the text;
- the interview renders two columns on desktop and **one** on mobile, **with no
  content dropped**;
- pull-quotes, margin notes, callouts, accent questions are visually
  recognizable and responsive;
- headings/typography/colors match the project tokens;
- no raw `#macro` text leaks into the body;
- print PDF output is unchanged (byte-stable) for the same source.

---

## 12. Boundary with the website (`show-your-work`)

- **Penwright owns:** structured authoring, the markup vocabulary (§7), the
  scoped element CSS + token variables, self-contained `.mdx` bundles. Output is
  valid and good-looking on its own.
- **The website owns:** chrome (nav/footer/index/magazine overview) as a calm,
  consistent *stage*; routing the bundle into a content collection; a
  consistent **preview** treatment for article cards (using frontmatter
  title/cover/`accent`). It does **not** restyle the article body — each
  article is a self-contained design world from Penwright. **No per-element
  components.**
- **Handoff:** copy the `<slug>/` bundle into the site's content dir, commit,
  push, Netlify builds. (One-click publish via Penwright's `simple-git` is a
  later nicety, not required.)

The one — and only — thing to coordinate across both repos up front: **the
frontmatter field names** (`title`/`date`/`summary`/`tags`/`locale`/`cover`,
plus an optional **`accent`** color the site picks up for the preview card).
The §7 markup and its CSS stay *inside* Penwright's self-contained output. Lock
the frontmatter, and the two sides build fully independently.
