/**
 * Skill Templates — content of `.claude/skills/<name>/SKILL.md` files
 * deployed into every new Penwright project.
 *
 * Each template covers the same conventions for two audiences:
 *   1. Agents with direct filesystem access (Claude Code in the integrated
 *      terminal, VS Code Claude, Cowork with folder permission)
 *   2. Agents using the Penwright MCP server (Claude Desktop, Codex Desktop)
 *
 * Markdown uses tilde fences (~~~) instead of backticks so the templates
 * embed cleanly in TypeScript template literals without escape noise.
 */

export const TYPST_SKILL = `---
name: typst
description: Typst language reference — syntax, math, layout, cross-references, footnotes, bibliography. Load when authoring or editing .typ files.
---

# Typst Language Reference

Typst is a modern typesetting system. This skill covers the syntax and constructs you need to author and edit \`.typ\` files in a Penwright project.

## Document Structure

A Typst document starts with optional **#set / #show / #let** rules (the preamble), followed by the body. In multi-chapter projects (Penwright default), the preamble lives in \`main.typ\` and chapters are pulled in via \`#include\`.

### Penwright projects: \`style.typ\` + \`apply-style\` instead of inline \`#set\`

Penwright generates a \`style.typ\` file from the project's \`.penwright/style.json\` (the Design panel's source of truth). \`main.typ\` pulls it in with this two-line preamble:

~~~typst
// main.typ
#import "style.typ": *
#show: apply-style

#set text(lang: "de")    // only language stays here

#include "chapters/01-introduction.typ"
#include "chapters/02-method.typ"

#bibliography("references.bib", style: "apa")
~~~

\`apply-style\` is a generated function that contains every \`#set page\` / \`#set text\` / \`#show heading.where(...)\` rule the schema produces. \`#import "style.typ": *\` brings \`style-colors\` (the palette dict) into scope.

**Critical gotcha:** \`#include "style.typ"\` was an earlier (broken) pattern. In Typst, \`#set\` rules inside an \`#include\`d file apply only to content within that file's own evaluation — they do NOT propagate to the includer's scope. \`#show: apply-style\` is the correct way.

### Other (non-Penwright-managed) projects

A plain Typst project without Penwright's Design panel uses the classic inline preamble:

~~~typst
#set text(font: "Libertinus Serif", size: 11pt, lang: "de")
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")

= My document
…
~~~

When editing such a project from the MCP server, decide on intent: if the user wants the Design panel to manage their styling going forward, call \`penwright_apply_style\` or \`penwright_update_style\` and let it generate \`style.typ\` for them. If they don't want the structured surface, leave their inline preamble alone.

### Chapter files

Chapter files contain only body content — no preamble. \`apply-style\`'s set/show rules propagate into included chapters automatically. If a chapter needs to reference \`style-colors\` directly (e.g. for a custom Pull-Quote block), add a per-chapter import header: \`#import "../style.typ": style-colors\`.

**Start each chapter with its title** — either a native heading \`= Title\` or a \`title:\` argument of an opener macro (e.g. \`#opener(title: "…")\`, which still emits a real \`heading\` and therefore a PDF bookmark). Penwright's live preview reads that title to jump to the chapter's page when the user switches files, so a chapter without any title (a bare cover/image page) simply won't be a jump target.

## Markup

| Construct | Syntax |
|---|---|
| Heading L1-L6 | \`=\`, \`==\`, \`===\`, \`====\`, \`=====\`, \`======\` |
| Bold | \`*bold*\` |
| Italic | \`_italic_\` |
| Inline code | \\\`code\\\` (single backticks) |
| Link | \`#link("https://…")[text]\` |
| Bullet list | \`- item\` |
| Numbered list | \`+ item\` |
| Blockquote | \`#quote[text]\` |
| Page break | \`#pagebreak()\` |

Headings, lists, and paragraphs are separated by blank lines.

## Math

Inline: \`$x^2 + y^2 = z^2$\` (single dollars, no surrounding whitespace).

Display: \`$ E = m c^2 $\` (dollars with whitespace).

Greek letters use names: \`alpha\`, \`beta\`, \`sum_(i=1)^n\`. Functions: \`sqrt(x)\`, \`frac(a,b)\`, \`vec(1, 2, 3)\`.

**Equation labels require numbering enabled** in the preamble:

~~~typst
#set math.equation(numbering: "(1)")

$ "Attention"(Q, K, V) = "softmax"(Q K^T / sqrt(d_k)) V $ <eq:attention>
~~~

Without \`#set math.equation(numbering: …)\`, every \`@eq:…\` reference rejects at compile time.

## Figures, Tables, Images

~~~typst
#image("assets/plot.png", width: 80%, alt: "Description")

#figure(
  image("assets/diagram.png", width: 70%),
  caption: [Architecture overview],
) <fig:arch>

#figure(
  table(
    columns: 3,
    [Header A], [Header B], [Header C],
    [a1], [b1], [c1],
  ),
  caption: [Comparison of methods],
) <tbl:methods>
~~~

Image paths are resolved relative to the file containing the \`#image\` call. In a chapter file (e.g. \`chapters/03-method.typ\`), reference assets as \`../assets/foo.png\`. From \`main.typ\` at the project root, use \`assets/foo.png\` directly.

## Cross-References

Typst auto-numbers figures, tables, equations, and headings at compile time. Mark a target with \`<label>\` and reference it with \`@label\`:

~~~typst
= Method <sec:method>

As shown in @fig:arch, the architecture …

See @sec:method for details, particularly @eq:attention.
~~~

**Label-prefix conventions** (Penwright uses these to disambiguate references from citations):

- \`fig:\` — figures
- \`tbl:\` / \`tab:\` — tables
- \`eq:\` / \`eqn:\` — equations
- \`sec:\` — sections / headings
- \`chap:\` — chapters
- \`app:\` — appendices

Names without a colon (\`@chen2021codex\`) are bibliography citations, not cross-references.

## Footnotes

\`#footnote[Body text]\` — Typst auto-numbers and positions at the page bottom. The body can contain inline syntax (italic, citations, math). Brackets must be balanced; escape literal brackets as \`\\[\` and \`\\]\`.

~~~typst
The selection criterion#footnote[See _Smith (2023)_ for an alternative criterion.] yielded …
~~~

## Bibliography

Project-wide BibTeX file (e.g. \`references.bib\`):

~~~bibtex
@article{chen2021codex,
  author  = {Chen and Tworek},
  title   = {Evaluating Large Language Models Trained on Code},
  year    = {2021},
  journal = {arXiv:2107.03374},
}
~~~

In the document:

~~~typst
This finding aligns with @chen2021codex.

#bibliography("references.bib", style: "apa")
~~~

Available styles: \`apa\`, \`chicago-author-date\`, \`ieee\`, \`mla\`, ~80 others — see Typst's CSL list.

## Source Comments — \`//\` ≠ Penwright annotations

\`// single-line\` and \`/* block */\` are stripped at compile time.

These are **not** Penwright comments. Penwright annotations live as separate Markdown files in \`comments/\` and are managed via the comments-panel or the \`penwright_add_comment\` MCP tool — they never touch the \`.typ\` source. See the \`Penwright\` skill for details.

## Common Pitfalls

- \`#set math.equation(numbering: "(1)")\` is required before any \`@eq:…\` reference.
- Block constructs like \`#figure(...)\` need their own paragraph (blank lines around) — pasting them mid-sentence breaks layout.
- Heading-number renumbering when chapters are reordered is automatic because Typst processes the merged document.
- Citekeys are bare slugs (no colon); label names use the prefix conventions above. Mixing them up confuses both Typst and Penwright's badge classifier.
- Image paths in \`#include\`d chapter files: use \`../assets/foo.png\`, not \`assets/foo.png\` — Typst resolves paths from the file containing the \`#image\` call, not the root.

## Bundled Packages — Available Offline in Every Penwright Project

Penwright ships with a curated set of Typst packages pre-installed in the app bundle. They work **offline** without first-compile downloads. Use them freely when the feature matches; reach for raw Typst only when no bundled package fits.

### Layout & Page Flow

**\`wrap-it\`** — text wraps around inline figures, useful for editorial layouts.

~~~typst
#import "@preview/wrap-it:0.1.1": wrap-content

#wrap-content(
  image("assets/photo.jpg", width: 4cm),
  [Lorem ipsum dolor sit amet... (long body that flows around the image)],
  align: right,
)
~~~

**\`meander\`** — advanced page-layout engine: multi-column reflow, text-threading around obstacles, complex paragraph shapes. For when \`wrap-it\` is too simple.

**\`drafting\`** — margin notes with auto-collision-avoidance. Editorial review or textbook annotations.

~~~typst
#import "@preview/drafting:0.2.2": margin-note

The transformer architecture #margin-note[Vaswani et al., 2017] eliminated recurrence...
~~~

### Graphics, Diagrams, Charts

**\`cetz\`** v0.5.2 — vector graphics, TikZ-of-Typst. Lines, shapes, paths, coordinates, transformations.

~~~typst
#import "@preview/cetz:0.5.2"

#cetz.canvas({
  import cetz.draw: *
  circle((0, 0), radius: 1, fill: blue.lighten(70%))
  line((-1, 0), (1, 0), stroke: red)
})
~~~

> \`fletcher\` (below) pulls in an older \`@preview/cetz:0.3.4\` transitively. Both versions are bundled. Don't switch fletcher to \`cetz:0.5.x\` manually, it isn't compatible yet.

**\`fletcher\`** — node-and-edge diagrams (flowcharts, state machines, commutative diagrams). Built on cetz.

~~~typst
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge

#diagram(
  node((0, 0), [Start], shape: circle),
  edge((0, 0), (1, 0), "->", [trigger]),
  node((1, 0), [Done], shape: rect),
)
~~~

**\`lilaq\`** — scientific data visualization: line plots, scatter, bar charts, boxplots, contour. matplotlib-for-Typst.

~~~typst
#import "@preview/lilaq:0.6.0" as lq

#lq.diagram(
  lq.plot((1, 2, 3, 4), (1, 4, 9, 16)),
  xlabel: [x], ylabel: [x squared],
)
~~~

### Editorial & Decoration

**\`droplet\`** — drop caps for editorial / magazine layouts.

~~~typst
#import "@preview/droplet:0.3.1": dropcap

#dropcap(height: 2)[
  Once upon a time, in a kingdom far away...
]
~~~

**\`codly\`** + **\`codly-languages\`** — code blocks with line numbers, language icons, annotations. The companion package supplies per-language colors and icons; both are bundled.

~~~typst
#import "@preview/codly:1.3.0": codly-init, codly
#import "@preview/codly-languages:0.1.7": codly-languages

#show: codly-init
#codly(languages: codly-languages)

\\\`\\\`\\\`rust
fn main() {
    println!("Hello, world!");
}
\\\`\\\`\\\`
~~~

**\`showybox\`** — colorful customizable boxes with titles, footers, borders, shadows. Marketing / docs callouts.

~~~typst
#import "@preview/showybox:2.0.4": showybox

#showybox(
  title: "Pro Tip",
  frame: (border-color: blue, title-color: blue.lighten(40%), body-color: blue.lighten(95%)),
)[
  Use \`showybox\` for emphasized tips and warnings.
]
~~~

**\`gentle-clues\`** — pre-styled Material-Design admonitions (Info / Tip / Warning / Important / Question). Less configuration than showybox.

~~~typst
#import "@preview/gentle-clues:1.3.1": *

#info[The model achieves 87 % accuracy on the holdout set.]
#warning[Training on this dataset requires at least 16 GB of GPU memory.]
~~~

### Academic Helpers

**\`glossarium\`** — glossary and acronym management with cross-referencing, pluralization, backreferences.

**\`subpar\`** — sub-figures with shared main caption.

~~~typst
#import "@preview/subpar:0.2.2"

#subpar.grid(
  figure(image("plot-a.png"), caption: [Loss]),
  figure(image("plot-b.png"), caption: [Accuracy]),
  columns: (1fr, 1fr),
  caption: [Training metrics],
  label: <fig:metrics>,
)
~~~

**\`lovelace\`** — algorithm pseudocode with line numbering and customizable keywords.

~~~typst
#import "@preview/lovelace:0.3.1": pseudocode-list

#pseudocode-list[
  + *input*: array $A$
  + *for* $i$ *from* 1 *to* $n$ *do*
    + swap if out of order
  + *return* $A$
]
~~~

## When to use a bundled package vs. fall back

- **Reach for the bundled package first** when its feature matches the need. Costs zero, keeps the document offline-compileable, avoids version drift.
- **Lazy-fetch is fine for the long tail** — packages not in this list can still be \`#import\`ed via \`@preview/<name>:<version>\`. Typst auto-downloads on first compile (requires internet). The doc won't compile offline until the cache is warm.
- **Use the exact bundled version numbers** — Penwright ships specific pinned versions (listed above). \`@preview/cetz:0.5.0\` would not match the bundled \`0.5.2\` and would trigger a lazy-fetch.
- **Use \`@preview/codly-languages:0.1.7\`** alongside \`codly\` for the language-icon feature.
`;

export const PENWRIGHT_SKILL = `---
name: penwright
description: Penwright project conventions — folder structure, persistence layers, comments, cross-references, mode toggles. Load when working in a Penwright project.
---

# Penwright — Project Conventions

Penwright is a WYSIWYG editor for Typst documents. Projects are folder-based and self-contained: every project carries its own version history, auto-backups, and Claude Code skills inside the folder. Copy or move the project — the full state moves with it.

## Project Structure

~~~
my-thesis/
├── main.typ                 # Root: preamble + #includes
├── chapters/                # One file per chapter
│   ├── 01-introduction.typ
│   └── 02-method.typ
├── references.bib           # BibTeX bibliography
├── assets/                  # Images, diagrams (referenced by #image)
├── sources/                 # Citation PDFs (one per citekey)
├── comments/                # Penwright annotations — never compiled
│   └── 2026-04-29-1432-a3f.md
├── exports/                 # PDF / DOCX outputs (auto-created on first export)
├── .claude/skills/          # These skills, deployed per project
├── .penwright/                # Hidden: auto-backups, AI-edit snapshots, per-project preferences
└── .git/                    # Version history
~~~

\`assets/\`, \`sources/\`, \`exports/\`, and \`comments/\` stay visible in the file tree even when empty so it's clear where things go.

## Four Persistence Layers — Don't Confuse Them

| Layer | Trigger | Storage | Purpose |
|---|---|---|---|
| **Versions** (Git) | User-saved milestones | \`.git/\` | Named history points: "Chapter 3 first draft", "Before supervisor feedback". User vocabulary is "version", not "commit". |
| **Auto-backups** | Timer (default 30 s) | \`.penwright/backups/<timestamp>/\` | Crash protection. Each backup is a flat snapshot of all .typ + .bib files plus a \`.meta.json\`. |
| **AI-edit snapshots** | Each external file change | \`.penwright/ai-snapshots/\` | Ring buffer used by "Undo AI Edit". |
| **UI preferences** | UI knob changes (debounced) | \`.penwright/preferences.json\` | Per-project editor + PDF zoom levels. Travels with the project folder. Extend this file rather than electron-store when adding new per-project UI knobs. |

All four live inside the project folder.

## sources/ — Citation PDF Naming

For the in-app **citation hover-card** to find the PDF for \`@chen2021codex\`, name the file so the basename starts with the citekey:

- ✅ \`sources/chen2021codex.pdf\` (exact match — preferred)
- ✅ \`sources/chen2021codex_supplement.pdf\` (suffix variant)
- ✅ \`sources/chen2021codex-arxiv.pdf\`
- ❌ \`sources/Chen et al. - Evaluating LLMs.pdf\` (no citekey prefix)

The MCP tool \`penwright_find_source_for_citation\` uses the same matching logic.

## comments/ — Annotation Storage

Each comment is a separate \`.md\` file with YAML frontmatter:

~~~yaml
---
id: "2026-04-29-1432-a3f"
file: "chapters/03-method.typ"
anchor: "five reference works"
rangeStart: 42
rangeEnd: 58
author: "René"
date: "2026-04-29T14:32:00.000Z"
resolved: false
---

Quelle ergänzen — vielleicht den Müller-Artikel?
~~~

- **anchor** is the verbatim text the comment is attached to. Penwright re-locates it on file load using \`indexOf\` when offsets drift.
- Comments are **never compiled** into PDF / DOCX — the source stays clean.
- Visible in the file tree, cloud-sync-friendly (Dropbox / iCloud), git-diffable, editable from any text editor.
- Anchors that span paragraphs get marked \`orphaned: true\` automatically.

When creating comments programmatically, **prefer \`penwright_add_comment\`** over hand-writing the Markdown — the tool generates the id, computes range offsets, fills frontmatter correctly.

## Cross-References vs. Citations — Disambiguation

Typst uses the same \`@…\` syntax for both. Penwright tells them apart by the name:

- Has a colon (\`@fig:scaling\`) → **cross-reference**
- Starts with a known prefix (\`fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst\` and full forms) → **cross-reference**
- Otherwise (\`@chen2021codex\`) → **citation**

This is why citation keys are conventionally bare slugs (no colon).

In the editor:
- \`@chen2021codex\` renders as a **blue badge**
- \`@fig:scaling\` renders as an **orange ↳ pill**

## Design surface — \`style.json\` + \`style.typ\` + \`apply-style\`

Penwright projects keep all visual design tokens in a single typed file: \`<project>/.penwright/style.json\`. The Penwright app regenerates \`<project>/style.typ\` from that JSON whenever the user (or an MCP tool) writes to it, then ensures the root \`.typ\` file has:

~~~typst
#import "style.typ": *
#show: apply-style
~~~

at the top. \`apply-style\` is a generated function that wraps the whole document with every \`#set\` / \`#show\` rule the schema defines. The \`#import\` brings \`style-colors\` (a dict with the five palette slots) into scope so body content can reference colours directly — handy for hand-rolled blocks like Hero / Pull-Quote.

**Why this pattern, not \`#include "style.typ"\`**: in Typst, \`#set\` rules inside an \`#include\`d file apply only to content within that file's own evaluation — they do NOT propagate to the includer's scope. \`#show: apply-style\` is the idiomatic way to apply a rule set to the rest of the document.

**Chapter files that reference \`style-colors\` directly** need their own import header:

~~~typst
#import "../style.typ": style-colors
~~~

Set / show rules from \`apply-style\` propagate into included chapters automatically; only direct identifier references need re-importing.

### What lives in \`style.json\`

The schema (full shape in \`src/shared/styleTypes.ts\`) covers seven branches:

- \`colors\` — five semantic slots (\`primary\`, \`accent\`, \`text\`, \`background\`, \`muted\`)
- \`fonts\` — \`body\`, \`heading\`, \`code\`
- \`scale\` — \`base\`, \`leading\`, \`paragraphSpacing\`, \`firstLineIndent\`
- \`layout\` — \`paper\`, \`orientation\`, \`margin\`, \`columns\`, \`pageNumbering\`, \`pageHeader\`, \`pageFooter\`, \`pageFill\`
- \`headings\` — h1–h6 each with \`size\` / \`weight\` / \`color\` (slot name) / \`marginTop\`, plus a single \`numbering\` pattern
- \`elements\` — \`blockquote\` / \`codeBlock\` / \`figure\` / \`table\` per-element design tokens
- \`custom.preamble\` — free-form Typst escape hatch, inserted at the bottom of \`apply-style\` between fence-marker comments. Use this for things the schema doesn't expose (custom \`#show heading.where(level: 1)\` rules with line decorations, \`#set math.equation(numbering: …)\`, helper \`#let\` bindings, etc.).

### Theme presets (replaces the seven retired style-templates)

Six full \`ProjectStyle\` snapshots ship in \`src/shared/themePresets.ts\`:

| ID | Look |
|---|---|
| \`classic-academic\` | Crimson Pro body, IBM Plex Sans headings, navy primary, 1.1 numbering |
| \`modern-tech\` | Inter throughout, electric-blue accent, no first-line indent |
| \`editorial-magazine\` | Spectral body on warm cream, terracotta accent, large display H1 |
| \`minimal\` | Inter only, monochrome, generous margins, light heading weights |
| \`marketing-brochure\` | Bold IBM Plex Sans, navy + orange, two-column layout |
| \`thesis\` | Crimson Pro everywhere, full hierarchical numbering, binding-friendly |

Apply via MCP: \`penwright_apply_style({ styleId: "modern-tech" })\` or in-app from the visual Look designer (the user opens \`style.typ\`) → *Themes*. Applying a theme overwrites every branch of \`style.json\` **except \`custom.preamble\`** — the user's escape-hatch code survives.

### Six layout presets (geometry only)

Layout presets only swap \`layout.*\` (and optionally \`scale.base\`) — typography stays intact. Use after a theme to switch geometry: theme \`editorial-magazine\` + layout \`magazine-2col\`. IDs: \`a4-portrait-standard\`, \`a4-landscape-presentation\`, \`magazine-2col\`, \`newsletter-3col\`, \`a5-booklet\`, \`a2-poster\`. From MCP: \`penwright_list_layouts\` / \`penwright_apply_layout\`.

### When NOT to write Typst preamble by hand

If the user has a populated \`style.json\`, **don't** hand-edit \`#set\` / \`#show\` blocks in their root \`.typ\` file. Those edits will be silently overridden by the next \`apply-style\` call (which re-emits everything from the JSON). Either:

- Patch \`style.json\` via \`penwright_update_style\` (deep-merge), or
- Append the rule to \`style.custom.preamble\` (escape hatch) so it ends up inside \`apply-style\` and survives regeneration.

## Working with Penwright — Two Paths

### Direct filesystem access

If you have read/write access to the project folder (Terminal Claude, VS Code Claude, Cowork with folder permission), edit \`.typ\` and \`.bib\` files directly. The Penwright editor watches the filesystem and updates within seconds.

**Watcher quirks:**
- \`.penwright/\` is excluded — backup writes don't trigger refresh loops.
- Penwright saves are tagged with a 3-second self-write guard; your external writes always go through.
- Don't edit \`.penwright/\` or \`.git/\` directly. Both are managed state.

### MCP tools (Claude Desktop, Codex Desktop, …)

When connected via the Penwright MCP server, you have **52 dedicated tools** instead of raw filesystem access. They enforce project boundaries (every path validated against the project root, symlink-aware), generate ids and YAML, validate cross-reference labels, regenerate \`style.typ\` from \`style.json\`, etc.

**Prefer the dedicated tool over raw \`penwright_write_file\`** when one exists:

| Task | Tool |
|---|---|
| Add chapter | \`penwright_add_chapter\` (creates file + adds \`#include\`) |
| Reorder chapters | \`penwright_reorder_chapters\` |
| Add citation | \`penwright_add_citation\` (validates BibTeX, ensures \`#bibliography\`) |
| Add comment | \`penwright_add_comment\` (generates id, anchors, YAML) |
| Insert cross-ref | \`penwright_insert_reference\` (validates label exists) |
| Insert footnote | \`penwright_add_footnote\` (bracket-balance check) |
| Insert image | \`penwright_add_image\` (asset dedup + figure builder) |
| Bulk rename | \`penwright_save_version\` → \`penwright_replace_in_project\` |
| **Read style** | \`penwright_get_style\` (full JSON) |
| **Patch style** | \`penwright_update_style({ patch })\` (deep-merge, sanitised) |
| **Apply theme** | \`penwright_apply_style({ styleId })\` (preserves \`custom.preamble\`) |
| **Apply layout** | \`penwright_apply_layout({ layoutId })\` (geometry only) |
| **Apply palette** | \`penwright_apply_palette({ presetId or slot hex })\` |
| **List bundled fonts** | \`penwright_list_fonts\` (7 OFL families always available) |
| **Insert design element** | \`penwright_insert_design_element\` (Banner / Sidebar / Pull-Quote / Callout / Hero / Divider, anchor-based) |
| **Generate layout** | \`penwright_generate_layout({ intent })\` (one-shot theme + layout + optional hero) |
| Verify build | \`penwright_compile\` (errors with **file + line + hints**) |
| Export | \`penwright_export_pdf\` / \`penwright_export_docx\` |

### Edit → Compile → Fix loop

After any non-trivial edit, **call \`penwright_compile\` and inspect the result**. The tool returns one shape regardless of outcome:

~~~json
{
  "success": true,
  "rootFile": "/abs/path/to/main.typ",
  "sizeBytes": 23456,
  "errors": [],
  "warnings": [
    { "message": "variable fonts are not currently supported (hint: try installing a static version of \\"inter\\")",
      "file": "/abs/path/to/style.typ",
      "line": 12 }
  ]
}
~~~

or, on failure:

~~~json
{
  "success": false,
  "rootFile": "/abs/path/to/main.typ",
  "errors": [
    { "message": "cannot reference equation without numbering (hint: enable equation numbering with #set math.equation(numbering: \\"1.\\"))",
      "file": "/abs/path/to/chapters/03-foo.typ",
      "line": 60 }
  ],
  "warnings": []
}
~~~

**Errors** stop the build — fix them. Use \`file\` + \`line\` to scope your fix; the appended \`hint:\` is Typst's own suggested remediation, follow it before improvising. Don't guess — open the file at the reported line, fix the immediate cause, and re-compile.

**Warnings** are advisory — Typst built the PDF anyway, but flagged something the user should know. Common cases worth acting on:

- *"variable fonts are not currently supported"* — swap the variable font for a static weight.
- *"unknown font family"* — a font referenced in \`style.typ\` isn't available; check spelling or pick from \`penwright_list_fonts\`.
- *"cannot reference equation/heading without numbering"* — turn on numbering (\`#set math.equation(numbering: …)\` or \`#set heading(numbering: "1.")\`).
- *Deprecated function* — a Typst stdlib call is sunsetting; consult the linked migration.

If a warning is intentional (you've decided the trade-off is worth it), leave it. If you don't recognise it, surface it to the user along with your guess rather than silently ignoring it.

Two-line edits + a recompile is faster and safer than scanning the whole project. The compile is fast (sub-second for most documents) and the structured output means you never need to parse stderr by hand.

See the \`research-workflow\` skill for end-to-end recipes.

## Compound Workflow Recipes

The recipes below replace common "guess your way through 8 tool calls" sequences. Follow the ordering — earlier steps create state that later ones depend on. Each recipe ends with a \`penwright_compile\` for verification.

### Recipe 1 — Magazine from scratch (cover + 3 articles)

User asks for "build me a magazine layout" or similar. Compose, don't improvise:

1. \`penwright_apply_style({ styleId: "editorial-magazine" })\` — sets fonts (Spectral body + Inter heading), warm earth-tone palette, magazine-friendly scale
2. \`penwright_apply_layout({ layoutId: "magazine-editorial" })\` — A4 portrait, 2 columns, header strip, \`{chapter}\` running head
3. \`penwright_insert_design_element({ elementId: "magazine-cover", afterText: "", params: { issue: "ISSUE 1", title: "<MASTHEAD>", headline: "<COVER LINE>", date: "<MONTH YEAR>" } })\` — inserted at top of \`main.typ\`
4. For each article: \`penwright_add_chapter({ name: "<slug>" })\` then \`penwright_insert_design_element({ elementId: "article-opener", file: "chapters/<slug>.typ", afterText: "", params: { kicker: "INTERVIEW", headline: "...", standfirst: "...", byline: "..." } })\`
5. Optional drop-cap on the opening paragraph: \`penwright_insert_design_element({ elementId: "drop-cap", file: "chapters/<slug>.typ", afterText: "<article-opener-headline>", params: { body: "<opening paragraph>" } })\`
6. \`penwright_compile\` — fix any \`unknown font\` warnings by swapping to a \`penwright_list_fonts\` family

Total: ~7-10 tool calls for a publishable magazine skeleton. Without the recipe an agent typically takes 20+ calls and gets lost in style.json deep-merges.

### Recipe 2 — Brochure refactor (existing project → marketing-brochure look)

User asks "make this look like a brochure":

1. \`penwright_get_style\` — read what's there so you don't blow away the user's \`custom.preamble\`
2. \`penwright_apply_style({ styleId: "marketing-brochure" })\` — IBM Plex Sans, vibrant primary, single-column with bigger margins
3. \`penwright_insert_design_element({ elementId: "hero", afterText: "", params: { title: "<doc title>", subtitle: "<one-sentence pitch>" } })\` at top of \`main.typ\`
4. For visual rhythm: identify the 2-3 most striking sentences in the body via \`penwright_search_project\` for key phrases the user mentioned, replace each with \`penwright_insert_design_element({ elementId: "pull-quote-display", afterText: "<surrounding text>", params: { text: "<the sentence>" } })\`
5. If the user mentioned numbers ("we have 50k customers", etc.): \`penwright_insert_design_element({ elementId: "stats-box", ... })\` mid-document
6. \`penwright_compile\` — verify

### Recipe 3 — Bibliography buildup (paper from scratch with citations)

User pastes a list of references they want cited:

1. \`penwright_ensure_bibliography\` — creates \`references.bib\` and \`#bibliography\` directive if missing
2. For each entry the user provided: \`penwright_add_citation({ entry: "<full BibTeX block>" })\` — Penwright parses + validates + appends
3. After all citations are in: \`penwright_get_citations\` — verify the citekeys Penwright assigned
4. For each citekey the user wants in a specific spot: \`penwright_search_project\` to find the anchor text, then NO insert tool needed — citations are typed inline as \`@citekey\` (use \`penwright_update_document\` to splice; cross-references via labels DO need \`penwright_insert_reference\` but raw \`@\` citations are plain text)
5. For each source the user has a PDF for: \`penwright_find_source_for_citation({ citekey })\` to confirm the user dropped the file in \`sources/\` correctly
6. \`penwright_compile\` — Typst will resolve all \`@citekey\` references against \`references.bib\`

**Critical gotcha:** never invent BibTeX entries. If the user gives you "Smith 2024 about machine learning" without a real source, ask for a DOI/URL or refuse — the \`writing-style\` skill goes hard on this.

### Recipe 4 — Chapter reorganization

User wants to swap chapter order or split / merge:

1. \`penwright_get_chapters\` — see current \`#include\` structure
2. \`penwright_save_version({ message: "before reorg" })\` — destructive ops need a rollback point
3. For pure reorder: \`penwright_reorder_chapters({ newOrder: ["chapters/03-foo.typ", "chapters/01-bar.typ", ...] })\` — just rewrites \`main.typ\`
4. For split (one long chapter → multiple): \`penwright_split_document\` splits at \`= heading\` boundaries
5. For merge (gather into one file): \`penwright_merge_document\` returns the merged content as string; then \`penwright_write_file\` to a new file + \`penwright_reorder_chapters\` to swap the includes
6. \`penwright_compile\` — verify

### Recipe 5 — Pre-submission audit (the loop that catches embarrassing things)

Before declaring done on an academic paper or thesis:

1. \`penwright_compile\` — must be \`success: true\` with zero \`errors[]\`
2. Scan \`warnings[]\` — every warning should be either resolved or explicitly accepted by the user (don't silently ship a "unknown font family" warning)
3. \`penwright_list_labels\` — every label needs a use somewhere; use \`penwright_search_project\` on the label name to verify
4. \`penwright_get_citations\` — every BibTeX entry should be cited at least once; cross-check with \`penwright_search_project\` on each citekey
5. For each citekey the paper relies on heavily: \`penwright_find_source_for_citation\` to make sure the PDF is in \`sources/\` (so reviewers can verify quotations)
6. Read the \`writing-style\` skill prompt — run the Anti-AI-Tells checklist over the introduction and conclusion (highest-density places for em-dash inflation and Dreierlisten-Reflex)
7. \`penwright_save_version({ message: "v1.0 submission" })\` — landmark version
8. \`penwright_export_pdf({ outputPath: "exports/submission.pdf" })\` — the deliverable

## Bundled Typst Packages (Offline, Always Available)

Penwright ships **13 Typst packages plus their transitive dependencies** pre-installed in the .app, so projects compile offline without first-run downloads. The high-value ones:

| Category | Packages |
|---|---|
| Layout / page-flow | \`wrap-it\`, \`meander\`, \`drafting\` |
| Graphics & diagrams | \`cetz\`, \`fletcher\`, \`lilaq\` |
| Editorial decoration | \`droplet\`, \`codly\` (+ \`codly-languages\`), \`showybox\`, \`gentle-clues\` |
| Academic helpers | \`glossarium\`, \`subpar\`, \`lovelace\` |

See the **typst** skill for usage examples (each package with a copy-paste snippet) and pinned version numbers. When designing layouts, **reach for the bundled package first** — using e.g. \`showybox\` for a callout is shorter, more consistent, and offline-safe compared to hand-rolling a rectangular box with cetz.

Packages outside this list still work via \`#import "@preview/<name>:<version>"\` but require a one-time lazy-fetch from the Typst Universe CDN (so the user needs internet for the first compile that touches them).

## Constraints to Remember

- **Edit \`.typ\` files, never the rendered output.** Source comments (\`//\`) are compile-only; Penwright annotations are separate files.
- **Style templates only apply to the root file.** Don't paste preamble code into a chapter.
- **Image paths are relative to the file containing \`#image\`.** Drop new images into \`assets/\` and reference as \`assets/foo.png\`.
- **Citekeys go in \`.bib\` files; labels go in \`.typ\` files.** Keep the colon convention (\`@chen2021codex\` vs \`@fig:arch\`).
- **Save a version before bulk replacements.** \`penwright_save_version\` → \`penwright_replace_in_project\` → \`penwright_compile\`. Restore on regression.
- **Never commit \`.penwright/\`.** It's already in \`.gitignore\` for a reason — it's machine state, not project content.
`;

export const WRITING_STYLE_SKILL = `---
name: writing-style
description: Prose conventions for Penwright — source discipline (anti-hallucination), anti-AI-tells, active prose principles, academic conventions. Load when writing or revising prose in .typ files. Bilingual coverage (English + German) because the tells aren't symmetrical across languages.
---

# Writing Style

Prose checklist that catches "AI sound" before it leaves the document. Two-language coverage because Penwright serves both English- and German-speaking academics, and the tells differ between them.

## Mental Model

Good writing earns each sentence. AI-default sentences feel pre-fabricated because they smooth over specifics with vague hedges, force rhetorical symmetry where the topic doesn't have it, and cluster certain "intelligent-sounding" words instead of using plain ones.

The fix isn't "write differently than the AI". It's **revise** what the AI (or you on a tired day) wrote. Use this skill as a pass over the draft, not a constraint while drafting.

---

## Section A — Anti-AI-Tells

### A1. Em-Dash Inflation

Em-dashes (\`—\`) are tools, not punctuation defaults. AI overuses them as a "looks-thoughtful" pause where a period, comma, or colon would do the same job — exactly like this sentence, where the dash adds nothing.

| Reflexive | Better |
|---|---|
| The method works well — it's robust to noise. | The method works well. It tolerates 10× background noise without degradation. |
| Three approaches stand out — supervised, self-supervised, and reinforcement-based. | Three approaches stand out: supervised, self-supervised, and reinforcement-based. |
| Die Methode funktioniert gut — sie ist robust gegen Rauschen. | Die Methode funktioniert gut. Sie toleriert 10× Hintergrundrauschen ohne messbaren Qualitaetsverlust. |

**Rule of thumb:** more than one em-dash per page = used as comma substitute. Tighten.

Equivalent in German: Gedankenstrich (\`–\`). Same problem, same fix.

### A2. "Not Just X, but Y" / "Nicht nur X, sondern Y"

The strongest single AI marker in current LLM output. The construction promises a stronger second claim but rarely delivers.

| Reflexive | Better |
|---|---|
| The transformer isn't just a model — it's a paradigm shift. | The transformer paradigm replaced recurrent architectures in three years. |
| It's not merely about performance; it's about scalability. | Performance was acceptable. The constraint was scalability. |
| Es ist nicht nur ein Werkzeug, sondern eine Methode. | Das Werkzeug erzwingt eine bestimmte Methode. |
| Nicht blosser Datensatz, sondern Goldstandard. | Der Datensatz dient seit 2018 als Goldstandard. |

When you catch yourself starting a sentence with "not just" or "nicht nur", stop. Cut the first clause. Lead with what you actually mean.

### A3. The Three-Item-List Reflex

Listing three things "feels right" because of classical rhetoric, but AI defaults to triplets even when two or four items would be more accurate. Pad and prune happen in opposite directions.

| Reflexive | Better |
|---|---|
| The method is fast, accurate, and scalable. | The method is 3× faster than baseline at comparable accuracy. (Drop "scalable" if you can't substantiate it.) |
| Wir haben drei Ansaetze verfolgt: A, B und C. (when really only A and B were systematic) | Wir verfolgten zwei systematische Ansaetze (A, B); C entstand als Nebenprodukt. |
| The results were robust, comprehensive, and statistically significant. | The effect held across all three subgroups with p < 0.01. |

**Rule of thumb:** count how many real items you have. If you padded to three, prune. If you have four and dropped one to "make it cleaner", restore it.

### A4. Vague Hedging

"Various", "several", "potentially", "might", "could" stack up in AI writing as cushioning. Each occurrence is fine; the cumulative effect is mush. Same with German "moeglicherweise", "tendenziell", "verschiedenartig".

| Reflexive | Better |
|---|---|
| Various studies have shown that this could potentially affect outcomes. | Chen et al. (2021) and Mueller (2023) report a 12 % effect size. |
| Several factors might be at play here. | Two factors: training-data size (Chen 2021) and learning rate schedule (Mueller 2023). |
| Es zeigt sich, dass diese Methode moeglicherweise robuster sein koennte. | Die Methode bleibt unter Rauschen σ ≤ 0.3 stabil; darueber bricht sie ab. |

**Pattern to spot:** if you can delete a sentence without changing the meaning, the sentence was hedging. Delete it.

### A5. AI Buzzwords

These words aren't bad in isolation. They flag AI-origin **in concentration**.

English: \`delve into\`, \`leverage\`, \`robust\`, \`tapestry\`, \`navigate\`, \`intricate\`, \`multifaceted\`, \`landscape of\`, \`realm of\`, \`journey\`, \`elucidate\`, \`seamlessly\`, \`harness\`, \`underscore\`, \`paramount\`.

German: \`vielfaeltig\` (gehaeuft), \`mannigfaltig\`, \`Landschaft\` (z.B. "die Forschungslandschaft"), \`Reise\`, \`wertvolle Einsichten gewinnen\`, \`nahtlos\`, \`facettenreich\`, \`grundlegend\`, \`untermauern\`.

Replace with the plain word: \`use\` instead of \`leverage\`, \`explore\` instead of \`delve into\`, \`complex\` instead of \`intricate\`, \`benutzen\` instead of \`nutzbar machen\`.

### A6. Closing-Statement Reflex

Endings that announce themselves as endings. The reader knows what a conclusion paragraph looks like — saying it twice is filler.

| Reflexive | Better |
|---|---|
| In conclusion, our results show… | Our results show… |
| It is important to note that… | (skip — what follows already implies importance) |
| Ultimately, the key takeaway is… | (start with the takeaway) |
| Es ist wichtig zu beachten, dass… | (skip "es ist wichtig zu beachten") |
| Abschliessend laesst sich sagen, dass… | (start the abschliessende Aussage directly) |

### A7. "Furthermore" / "Moreover" / "Des Weiteren" as Default Connectors

These mark "I wrote two sentences in a row without thinking about how they connect." A period plus new sentence usually works. If you need a connector, "And", "Also", "But", "Auch", "Aber" carry their weight.

When "Furthermore" IS right: when you're adding a parallel point to an enumerated argument and the parallelism matters. Maybe twice in a chapter.

### A8. Symmetric Parallelism

AI loves "Method A allows X. Method B allows Y. Method C allows Z." The symmetry sounds organized but flattens the actual structure — probably one of the three is more important.

Break the parallelism deliberately:

> Method A allows X. Methods B and C extend this — B by Y, C by Z (less validated).

Or:

> Method A is the standard. B and C are recent alternatives; B has stronger empirical support, C is more elegant theoretically.

### A9. Throat-Clearing Openers

Sentences that warm up before saying anything. AI does this; tired humans also do this.

| Reflexive | Better |
|---|---|
| In recent years, there has been a growing interest in… | Interest in X grew sharply after the 2021 Codex release. |
| It is well-established that… | (Just state the claim.) |
| In den letzten Jahren ist das Interesse an X stark gewachsen. | Mit dem Erscheinen von Codex (2021) hat X starke Aufmerksamkeit bekommen. |

---

## Section B — Active Prose Principles

### B1. Concrete > Abstract

Replace generic claims with numbers, names, examples, sources.

❌ Many recent papers explore this.
✅ Three papers in NeurIPS 2024 (Chen, Mueller, Patel) explore this.

❌ Verschiedene Studien zeigen einen Effekt.
✅ Zwei Studien (Schmidt 2022, Yamamoto 2024) berichten je einen 8 %-Effekt.

### B2. Active Voice as Default

Default to active. Switch to passive only when the patient genuinely matters more than the agent (typically Methods sections — "Samples were heated to 80 °C" is fine because who heated them doesn't matter).

❌ Mistakes were made during the experiment.
✅ We changed the calibration on day three and didn't document it.

In German, passive is more idiomatic in academic prose, but the \`wir\`-form is now acceptable in modern publications and almost always clearer. Same for \`ich\` in monographs.

### B3. Vary Sentence Rhythm

Three sentences of similar length in a row signal AI. Vary: short. Long with subordinate clauses. Short.

| Reflexive | Better |
|---|---|
| The method is robust. It handles noise well. It scales to large datasets. | The method handles noise. We tested it on inputs with σ up to 0.4 — degradation below 2 %. Scaling looks linear so far. |

### B4. Trust the Reader

Don't tell the reader you've shown them something. Use a real cross-reference (\`@sec:method\`) instead of prose meta-talk like "As I mentioned above…" / "Wie bereits oben erwaehnt…".

### B5. Keep Your Voice

If you write academic but slightly informal, keep that. The AI sands off the edges that make your text yours. After AI revision, **re-read** and put back the quirks: contractions, your favorite transition word, a small detail you'd normally include, a sentence fragment for emphasis.

A skill that produces uniformly "good" prose strips authorship. That's a worse outcome than imperfect prose with a voice.

---

## Section C — Academic Conventions

### C1. Tense Map

| Section | English | German |
|---|---|---|
| Abstract | Mixed: past for results, present for conclusions | Gemischt |
| Introduction | Present (current state of knowledge) | Praesens |
| Method | Past for what you did; present for general truths | Vergangenheit fuer Eigenleistung |
| Results | Past throughout | Vergangenheit |
| Discussion | Present for interpretation, past for your specific results | Praesens fuer Interpretation |

### C2. Hedging — Where It's OK

Hedging belongs in **Discussion** ("This suggests…", "A possible explanation…") and **Limitations**, NOT in Methods or Results. AI hedges everywhere; humans hedge where uncertainty actually lives.

❌ (Results) The model possibly achieved an accuracy of approximately 87 %.
✅ (Results) The model achieved 87.2 % accuracy (95 % CI 85.1–89.3).

❌ (Methode) Es wurde moeglicherweise eine Form der Vorverarbeitung verwendet.
✅ (Methode) Wir normalisierten alle Inputs auf zero-mean / unit-variance.

### C3. Citation Integration

Read your sentence WITHOUT the citation. If it makes a coherent claim, the citation is well-integrated.

❌ Chen et al. (2021) state that codex models work. (citation is the subject)
✅ Codex-style models close the gap on standard benchmarks @chen2021codex. (claim first, citation supports)

Penwright-specific: prefer the badge form \`@chen2021codex\` over prose-form \`(Chen et al., 2021)\` — Typst handles author/year formatting at compile time depending on the chosen \`#bibliography(style: ...)\`.

### C4. Lists Used Right

Bullet lists work when items are genuinely parallel and discrete. Prose works when items have hierarchy or weight differences.

❌ The advantages are:
- Fast
- Accurate
- Scalable

✅ The method is fast (3× baseline) and accurate (87 %). Scaling looks linear, though we haven't tested beyond 10× input size.

### C5. German vs. English Tendencies

Academic German tends toward long sentences with multiple subordinate clauses. Academic English tends toward shorter sentences and more bullet points. **Don't English-ify German prose** by breaking every sentence — readers expect the German rhythm. **Don't German-ify English prose** with five-line sentences full of subclauses — readers will glaze over.

AI defaults to a mid-Atlantic flat style for both. Pull back toward the native register of the language you're writing in.

---

## Section D — Source Discipline (Anti-Hallucination)

**This is the highest-leverage section of the skill.** Style tells (Section A) damage perception; fabricated citations damage **integrity**. A reader forgives "delve into"; a reader does not forgive an invented source — and in academic work, invented sources are career-affecting. If you follow only one section of this skill, follow D.

The catch: fabricated citations look exactly like real ones. They're invisible without verification. Always work in verification mode.

### D1. Never Invent Citations

The hardest discipline: when you (or the AI) "knows" a fact and reaches for a plausible-sounding citekey, **stop**. If the citekey isn't already in the project's BibTeX, it doesn't exist for this document.

**Workflow before adding any \`@citekey\`:**

1. Call \`penwright_get_citations\` and pick from the returned list.
2. If the needed citekey doesn't exist, choose one of two paths:
   - **You have the actual source** → add it via \`penwright_add_citation\`, copying the canonical BibTeX from publisher / DOI / arXiv / Zotero. Never type BibTeX from memory.
   - **You don't have the source** → write the claim without citation. Mark it with \`penwright_add_comment\` ("needs source") and move on.
3. **Never** improvise a citekey like \`smith2023deep\` because it sounds plausible. LLMs do this constantly. The construct \`<surname><year><firstkeyword>\` is so regular that fabricated keys look real — until someone tries to find the paper.

### D2. Never Invent Author Names, Years, or Venues

If you're typing a BibTeX entry from memory, you're hallucinating. Look the source up — publisher page, DOI lookup, arXiv listing, Google Scholar. Copy the canonical metadata. AI is especially prone to:

- Plausible-but-wrong years (transformer paper: actually 2017, AI often "remembers" 2018)
- Plausible-but-wrong author ordering or missing co-authors
- Made-up venues ("ACM Conference on X" when it was actually "NeurIPS Workshop on Y")
- DOIs that look right but resolve to something else (or to nothing)

In German academic work the same patterns repeat with Verlagsangaben and Jahreszahlen. A wrong Jahresangabe in einer deutschen Dissertation faellt der Pruefungskommission auf.

### D3. Match the Source's Confidence

AI inflates verbs as it summarizes: "the authors suggest X" silently becomes "the authors demonstrated X" and then "X is well-established". Each step changes the empirical claim — and at the last step you can't cite the original anymore because it didn't say that.

| Source says | Your text should say |
|---|---|
| "we propose…" | "X proposed…" / "X schlug … vor" |
| "we hypothesize…" | "X hypothesized…" / "X vermutete…" |
| "we observe…" | "X observed…" / "X beobachtete…" |
| "we show…" / "we demonstrate…" | "X showed…" / "X zeigte…" |
| "is well-established…" | (only if THE SOURCE says so — not because the topic feels mature) |

Rule: never use a stronger verb than the source did. \`hypothesized\` → \`proved\` is fabrication, not summary.

### D4. Quote Discipline

Direct quotes must be **verbatim** from a source you have open. Rules:

- Run \`penwright_find_source_for_citation\` to confirm the PDF exists in \`sources/\`. Open it.
- If you don't have the source on disk, **paraphrase with a citation**, don't quote.
- A misquote is worse than no quote — it's a fabrication attributed to a real person who can object.

This applies to German Zitate just as strictly. \`„nach Vossen sei der Effekt zentral"\` muss ein Vossen-Originalzitat sein, kein Plausibel-klingender Paraphrase.

### D5. Verify Page Numbers

Typst supports \`@chen2021codex[p. 42]\`. If you cite a specific page, **you must have looked at that page**. Don't approximate. If you don't have the page, drop the page reference (\`@chen2021codex\` alone) and add a Penwright comment "find page" so it isn't forgotten.

The same goes for line numbers in code citations or specific clause references in legal documents.

### D6. Multi-Source Claims Need Multiple Sources

"Many studies have shown…" / "Verschiedene Arbeiten zeigen…" requires you to be able to name at least three real ones. "Several authors argue…" requires at least two distinct authors.

❌ Many studies have shown this effect.
✅ Three studies report this effect (Chen 2021, Mueller 2022, Yamamoto 2024).

❌ Verschiedene Arbeiten belegen X.
✅ Schmidt (2022) und Yamamoto (2024) belegen X mit jeweils 8 %-Effekt.

If you can't enumerate, the claim is weaker than you wrote it. Two options: find more sources, or downgrade the claim ("Chen (2021) reports this effect" — singular, honest).

### D7. Citation Laundering

If you got fact X from a survey paper, cite the survey AND (ideally) the primary source. Don't pass off survey-paper claims as if you read the primary.

❌ Transformers eliminated recurrence @vaswani2017. (cited from a survey, never opened the primary)
✅ Vaswani et al. introduced transformers without recurrence @vaswani2017; for a review of the broader trend see @lin2021survey.

Or, if the survey is your actual source: cite only the survey and let the reader follow it back to the primaries. Honest is better than impressive.

### D8. Pre-Submission Source Audit

Before \`penwright_save_version "final draft"\`:

1. \`penwright_get_citations\` — every BibTeX entry has author, year, title, venue, no \`???\` or \`[fill in]\` placeholders.
2. \`penwright_search_project({ query: "@" })\` per chapter — eyeball every cite. Each one should resolve to a BibTeX entry. Spot-check by searching the citekey in \`penwright_get_citations\` output.
3. For high-stakes claims (numerical results, theorems, "X showed Y"): can you open the source and find the supporting passage? If yes ✓. If no — downgrade the claim or remove it.
4. For each PDF in \`sources/\`: \`penwright_find_source_for_citation\` — does the file correspond to the cited paper? Especially after Zotero re-syncs that may have replaced files.

This audit takes 30 minutes for a chapter and prevents catastrophe. Do it.

---

## Revision Checklist

When a section is drafted, run through this before \`penwright_save_version\`:

**Integrity (do these first — Section D):**

1. **Every \`@citekey\` resolves** — \`penwright_get_citations\` confirms each one. Zero invented citekeys.
2. **Every citation verb matches the source's confidence** — no inflation from "suggests" to "demonstrates".
3. **Every direct quote is verbatim** from a source you have open in \`sources/\`. Otherwise: paraphrase or remove.
4. **Page numbers are real** — if you cited \`@key[p. 42]\`, you looked at page 42.
5. **Multi-source claims** ("many studies show…") name at least three or get downgraded.

**Style (Section A + B):**

6. **Em-dash count** — more than two on this page? Reduce.
7. **"Not just / not merely / nicht nur"** — any? Rewrite.
8. **Any list of three** — real or padded?
9. **Vague hedges in Methods/Results** — sharpen to numbers or remove.
10. **Buzzwords from A5** — swap to plain alternatives.
11. **Sentence rhythm** — three consecutive sentences of similar length? Vary one.
12. **Citation integration test** — drop each citation, does the sentence still claim something coherent?
13. **Re-read aloud.** If your voice cracks at a sentence, the rhythm is broken.

When using \`penwright_replace_in_project\` for stylistic bulk-edits (e.g. "remove all 'In conclusion' phrases project-wide"), always \`penwright_save_version\` first.

---

## Don't

- **Never fabricate a citation.** If unsure: no citation, plus a Penwright comment "needs source". This is non-negotiable in academic work.
- **Never type a BibTeX entry from memory.** Look the source up — DOI, arXiv, publisher, Zotero — and copy the canonical metadata.
- **Never quote from memory.** Open the source or paraphrase. A misquote is fabrication attributed to a real person.
- **Don't apply Section A mechanically to dialogue or fiction.** The rules are for academic / nonfiction prose. A character can say "delve into" without it being an AI tell.
- **Don't strip ALL hedging.** Discussion sections need it. AI sprinkles it everywhere; the fix is precision, not abolition.
- **Don't trade voice for compliance.** If "Furthermore" is genuinely your style, keep it for clutch moments. The rule is "Furthermore-by-default", not "Furthermore-never".
- **Don't over-apply Section A to the user's pre-AI text.** These tells are about LLM patterns; experienced writers sometimes use the same constructions deliberately and with weight.
- **Don't run a stylistic bulk-replace without saving a version first.** Style edits routinely break unintended things (a sentence relying on "however" loses its turn). \`penwright_save_version → penwright_replace_in_project → penwright_compile → re-read\`.
`;

export const RESEARCH_SKILL = `---
name: research
description: Research workflow for Penwright — find sources, create BibTeX, write notes, link sources to citations, run consistency checks. Load when researching a topic for a Typst document.
---

# Research Workflow for Penwright

End-to-end research → integration loop for academic / non-fiction work in Penwright. Assumes the conventions in the \`Penwright\` skill and the syntax in the \`typst\` skill.

## Four Phases

1. **Discover** — search for sources (web, scholar, library, Zotero)
2. **Capture** — save BibTeX + the source PDF
3. **Synthesize** — write notes; decide what goes into the document
4. **Integrate** — cite, cross-reference, run consistency checks

The \`.typ\` file is the source of truth. Notes can be Markdown but should land in \`chapters/\` as \`.typ\` once you're integrating them.

## Phase 1 — Discover

Use whatever search the surrounding tools provide. Quality criteria:

- **Primary > secondary** — prefer the original paper to a summary.
- **Recent (within 5 years)** for fast-moving fields, **classic** for foundational claims.
- **Peer-reviewed > preprint > blog post.**

Note venue + year for every source you keep — without them the BibTeX entry is incomplete.

## Phase 2 — Capture

For each source you'll cite:

1. **BibTeX entry** in \`references.bib\`. Citekey is a slug (no colon — colons are reserved for label prefixes). Convention: \`<lastauthor><year><firstword>\` → \`chen2021codex\`.

2. **Source PDF** in \`sources/\`, named so the basename starts with the citekey. \`sources/chen2021codex.pdf\` is preferred; \`chen2021codex_supplement.pdf\` etc. work as fallback. Naming matters: Penwright's hover-card and \`penwright_find_source_for_citation\` match on this prefix.

3. **Notes** as Markdown in a scratch location (or directly as \`.typ\` in \`chapters/\` once it's a real chapter).

### MCP-tool path

~~~
penwright_add_citation({
  bibtex: "@article{chen2021codex, author={Chen and Tworek}, title={…}, year={2021}, …}"
})

penwright_get_citations()
  → [{ citekey: "chen2021codex", … }, …]

penwright_find_source_for_citation({ citekey: "chen2021codex" })
  → { found: true, relPath: "sources/chen2021codex.pdf" }   // or { found: false } → user needs to drop the PDF
~~~

### Filesystem path

Append a BibTeX block to \`references.bib\`. Drop the PDF into \`sources/\` with the right name. No special tool needed.

## Phase 3 — Synthesize

When notes are inline Markdown that should become a chapter:

~~~
penwright_import_markdown({
  markdown: "# Verwandte Arbeiten\\n\\n## Chen et al. (2021)\\n…",
  destPath: "chapters/06-related.typ"
})
~~~

Handles headings, formatting, lists, links, code, blockquotes. Complex Markdown (custom HTML, footnote-style references) needs manual cleanup.

After import, add a \`#include "chapters/06-related.typ"\` to \`main.typ\` (via \`penwright_add_chapter\` or by editing).

## Phase 4 — Integrate

### Cite a source inline

~~~typst
This finding aligns with @chen2021codex.
~~~

The \`@citekey\` becomes a citation badge in the editor and resolves to "(Chen et al., 2021)" in the PDF (depending on bibliography style).

### Reference a figure / section

Mark the target with a label, then reference it:

~~~typst
= Method <sec:method>

#figure(image("assets/arch.png"), caption: [Architecture]) <fig:arch>

In @sec:method we describe the architecture (@fig:arch).
~~~

Via MCP:

~~~
penwright_list_labels({ type: "figure" })
  → [{ label: "fig:arch", caption: "Architecture", relPath: "chapters/03-method.typ", line: 12 }, …]

penwright_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "as shown in",
  label: "fig:arch"
})
~~~

\`penwright_list_labels\` is the safety net — it tells you which labels actually exist before you reference them.

### Backlinks — "Where else is this cited?"

Classic consistency-check question:

~~~
// Every place a source is cited
penwright_search_project({ query: "@chen2021codex", wholeWord: true })

// Every place a heading text is mentioned
penwright_search_project({ query: "Method" })
~~~

Whole-word matching uses lookarounds (not \`\\b\`), so it works even when the query starts with \`@\`.

### Renaming a citekey across chapters

~~~
penwright_save_version({ message: "Vor Citekey-Umbenennung" })

penwright_replace_in_project({
  query: "smith2023",
  replacement: "smith2024",
  wholeWord: true
})

penwright_compile()
~~~

If the compile fails: \`penwright_restore_version({ sha: "<sha-from-save>" })\` rolls back.

### Leave a comment for the supervisor

~~~
penwright_add_comment({
  file: "chapters/01-introduction.typ",
  anchor: "five reference works",
  body: "Vorschlag: Müller (2024) ergänzen — neuer Survey deckt drei dieser Werke neu ab.",
  author: "Claude (research)"
})
~~~

Comments are never compiled into PDF / DOCX. The supervisor sees them in the Penwright editor, can resolve / delete them, can edit the \`.md\` from any text editor.

### Add a figure with caption + label in one shot

~~~
penwright_add_image({
  srcPath: "/Users/.../scaling-plot.png",
  caption: "Parameter scaling of encoder vs. decoder",
  label: "fig:scaling",
  width: "80%",
  alt: "Plot showing parameter scaling",
  file: "chapters/04-results.typ",
  afterText: "We investigate scaling."
})
~~~

This copies the asset into \`assets/\` (with content-hash dedup), builds the \`#figure(image(…), caption: […]) <fig:scaling>\` snippet, and inserts it after the anchor — one MCP call instead of three.

## Quality Checks Before Submission

1. \`penwright_compile()\` — must return \`success: true\`.
2. \`penwright_list_labels()\` — every figure / table / equation that's referenced should have its label.
3. \`penwright_search_project({ query: "@" })\` — eyeball the hits to make sure no broken cross-refs slipped in.
4. \`penwright_get_citations()\` — every \`@citekey\` used in the text should map to a BibTeX entry.
5. \`penwright_export_docx({ outputPath: "exports/v1-feedback.docx" })\` for the supervisor.

## Don't

- **Don't invent citekeys or label names.** Always check via \`penwright_get_citations\` / \`penwright_list_labels\` first. Inserting \`@nonexistent\` either breaks the build or silently renders as "?".
- **Don't put research notes in \`assets/\` or \`sources/\`.** \`assets/\` is for images referenced by \`#image\`; \`sources/\` is for citation PDFs only. Notes go in \`chapters/\` (when integrated) or a scratch \`.md\` file outside the project.
- **Don't bypass \`penwright_save_version\` before bulk operations.** A 4-file replace that breaks the compile is much easier to fix when there's a named version to restore from.
- **Don't manually create \`comments/<id>.md\`.** Use \`penwright_add_comment\` — it gets the id, frontmatter, and offset math right.
`;

export const DESIGN_SKILL = `---
name: design
description: Visual design conventions for Penwright — palette / typography pairing, layout patterns, modern aesthetics 2026, accessibility & contrast, anti-patterns. Load when picking themes, applying palettes, composing layouts, or making "this should look like X" decisions.
---

# Design

A working reference for visual decisions in a Penwright project. Focused on the structured surface Penwright exposes (\`style.json\` colors / fonts / scale / layout / headings / elements) and the design-element library. Not a comprehensive design treatise — short rules with reasoning, so an agent can decide without searching elsewhere.

## Mental Model

Penwright's design surface is built around **semantic slots** and **presets that fill them**. Five color slots (\`primary\`, \`accent\`, \`text\`, \`background\`, \`muted\`), three font slots (\`body\`, \`heading\`, \`code\`), six heading levels, four block elements (Blockquote / Code-Block / Figure / Table). Apply a theme, then tune slots — don't hand-pick every value from scratch.

Always ask: **what is this document for?** "Brochure" / "Thesis" / "Magazine" / "Tech docs" / "Essay" map to different decisions. The wrong question is "what would look cool here" — the right one is "what will the reader expect of this kind of document, and how do I deliver it crisply?"

## Designing on Request (two levels)

Penwright decouples writing from design: the user writes first, then asks *how* it should look. A design request is one of two levels — figure out which **before** touching anything.

### Level 1 — the whole document

Phrases like "make the whole document feel like a magazine", "give this an academic look", "redesign this". No selection involved.

1. \`penwright_get_style\` — see what's there (and don't clobber \`custom.preamble\`).
2. Apply at the document level: \`penwright_apply_style\` / \`penwright_apply_palette\` / \`penwright_apply_layout\`, or \`penwright_generate_layout({ intent })\` for a one-shot theme+layout.
3. \`penwright_compile\` to verify, then tell the user what changed.

### Level 2 — a specific spot (the pinned selection)

Phrases like "design **this**", "make the selection a pull-quote", "set **this region** in two columns", "pull **this sentence** out as a margin note". The user marked the passage in Penwright (right-click → "Insert into Chat"), so:

1. **Always call \`penwright_get_selection\` first.** It returns the pinned \`anchorText\` + \`occurrence\` (the exact spot, no offset math) **and** a \`context\` snapshot of the current look (theme / palette / fonts / layout / sectionStyle / usedElements). If it says nothing is pinned, the user may still have described the change in the chat — treat that as a Level-1 request, or ask them to mark the passage.
2. **Act on the spot**, two ways:
   - A library element fits → \`penwright_insert_design_element({ elementId, afterText: <anchorText>, occurrence, params })\`.
   - Nothing fits → write **localized Typst** directly at the anchor. You're not limited to the snippet library. Examples:
     - two-column region → \`#columns(2)[ … ]\`
     - margin note → the bundled \`drafting\` package's \`#margin-note[…]\` (needs a wide outer margin)
     - full-bleed image, a one-off accent box, a custom rule, etc.
3. **Harmonise with the \`context\`:**
   - Reference \`style-colors.*\` / \`style-fonts.*\`, **never raw hex** — so the spot re-themes with the document.
   - Match the document's density and voice; don't introduce a *third* variant of something the \`usedElements\` digest already shows (e.g. a second divider style).
   - Respect the \`sectionStyle\` if the chapter has one.
4. **Per-element semantics — does the treatment *contain* or *duplicate* the text?**
   - A Callout / Banner / Article-Opener / Section-Opener **contains** the pinned text — the paragraph *becomes* the box. Don't leave the original prose behind as well.
   - A Pull-Quote usually **duplicates** an excerpt — it highlights a striking sentence *in addition to* the body, which stays put.
   - Decide per element; getting this wrong either drops the text or doubles it.
5. After applying, \`penwright_compile\` and briefly tell the user what changed — they'll see it reload in Penwright (the pin auto-clears).

## Color Theory — Five Slots, One Job Each

| Slot | Job |
|---|---|
| **primary** | Dominant brand color. Used for top-level headings and the main visual identity. Should pass WCAG AA contrast (4.5:1) against \`background\`. |
| **accent** | Secondary color — links, emphasis, callout bars, divider lines. One accent, never two. Should pass 3:1 contrast against \`background\` (large/decorative use). |
| **text** | Body type. Near-black on light backgrounds, near-white on dark. Must pass 4.5:1 contrast against \`background\`. |
| **background** | Page fill. White for academic / formal, warm cream (\`#fbf7f1\`) for editorial, very-light gray (\`#fafafa\`) for minimal. |
| **muted** | Captions, secondary metadata, table borders, divider lines. Mid-gray with enough contrast to read but enough recession to not compete with body text. |

### Combination rules

- **Max two strong colors per document.** Primary + accent. Everything else is text / background / muted.
- **Tonal palettes beat rainbow palettes.** Picking a single hue and varying its lightness (primary + accent both in the navy family with different lightness) reads as "considered". Picking unrelated hues (navy + lime + magenta) reads as "trying".
- **The background determines everything.** A light background needs dark text, period. Dark backgrounds for headings only (banner blocks) — never for body. Cream backgrounds invite serif body fonts; bright-white invites sans.
- **Accent appears 3–5 times per page max.** It loses meaning if it's everywhere.

### When to use which preset

- **Modern Tech** (slate + electric blue): API docs, internal specs, anything Inter-friendly. Reads as "competent and current".
- **Editorial** (cream + terracotta): long-form articles, newsletters, essays where the reader sits for >10 minutes. Warm and inviting.
- **Earth Tones** (olive + rust): humanities, sustainability themes, anything that wants to feel grounded.
- **High Contrast** (pure black + cobalt): accessibility-first, dense reference docs, anything where readability under poor light matters.
- **Minimal Mono**: when the words have to carry everything. Essays, manifestos, poems.
- **Sunset Warm** (aubergine + coral): marketing-adjacent, lifestyle content, anything that needs to feel alive.
- **Ocean Classic** (navy + teal): corporate, conservative, professional services.
- **Forest Deep** (deep green + amber): outdoor / heritage / craft-oriented content.

## Typography Pairing

### Rules of thumb

- **Two fonts maximum** for body + heading. A third for code-monospace is fine because it's contextually separate.
- **Match the contrast level to the use case.** Strong contrast (serif body + sans heading) suits long-form. Same-family contrast (Inter body + Inter heading, weight does the work) suits modern and minimal. Same-font everywhere (Crimson Pro thesis) suits formal academic — old-school, classical, intentionally monotone.
- **Don't pair two similar fonts.** Two sans-serifs that look 80 % the same look like a mistake. Either pair contrasting (serif + sans) or commit to a single family with weight variation.
- **Mono for code only.** Don't use JetBrains Mono for body text "to look technical". It's exhausting to read past a paragraph.

### Bundled-font cheat sheet

| Font | Category | Best for |
|---|---|---|
| **Inter** | Sans (humanist) | Modern / Tech / Marketing / Minimal. Default choice when in doubt. |
| **IBM Plex Sans** | Sans (corporate) | Brochures, reports, branded docs. Slightly more character than Inter. |
| **IBM Plex Serif** | Serif (slab) | Body type for modern editorial. Pairs cleanly with IBM Plex Sans. |
| **IBM Plex Mono** | Mono | Code blocks. Distinctive without being noisy. |
| **JetBrains Mono** | Mono | Code-heavy documents (specs, dev docs). Strong ligatures. |
| **Crimson Pro** | Serif (old-style) | Academic body. Theses, journal submissions. Elegant for long reading. |
| **Spectral** | Serif (transitional) | Editorial body. Magazines, newsletters, mid-length pieces. |

### Combinations that work

- Inter body + Inter heading (weight contrast does the work) — Modern Tech default.
- Crimson Pro body + IBM Plex Sans heading — Classic Academic. Serif body in heading gives a "newspaper" feel.
- Spectral body + Inter display heading — Editorial Magazine. Big display heads carry the visual identity.
- Crimson Pro everywhere — Thesis. Formal, monotone, classical.

### Combinations to avoid

- Two sans-serifs (Inter + IBM Plex Sans together). Confuses without contrast.
- Display font in body. Display faces are designed for large sizes — at 11 pt they get fragile or unreadable.
- Italic / cursive scripts as body. Always bad for reading.

## Heading Hierarchy

Headings exist to **make scanning possible**. If the reader can't scan and find the section they need, the hierarchy failed.

### Sizing rule

Each level should be clearly smaller than the previous one — at least 20 % size reduction is the comfortable minimum. The defaults follow this:

- H1: 24 pt — page-section anchor
- H2: 18 pt (-25 %) — main subsections
- H3: 14 pt (-22 %) — sub-subsections
- H4: 12 pt — body-near, used sparingly
- H5: 11 pt — same size as body but bold
- H6: 10 pt — barely-headings, almost never used in academic writing

### When to break the typography hierarchy

- **Marketing brochures**: H1 can go up to 32–48 pt. The visual hierarchy is the message.
- **Theses & books**: tighter sizes (H1 22 pt, H2 16 pt) because page real estate matters.
- **Slide handouts (landscape)**: bigger H1 (28–32 pt) because they're meant to be scanned from a meter away.

### Numbering rules

- **\`1.1\`** for academic / thesis / formal reports. Readers expect it; cross-references depend on it.
- **\`1.\`** for shorter papers, articles where the structure is shallow.
- **No numbering** for marketing / editorial / essays. Reads as "this isn't a manual".
- **Roman** (\`I.\`, \`II.\`) for prefaces, forewords, parts of a book — not regular body chapters.

## Layout Patterns

| Pattern | When |
|---|---|
| **Single column A4 portrait, 2.5 cm margin** | Default. Articles, essays, reports, theses. Whenever a wall of text is acceptable. |
| **A4 landscape** | Slide handouts, wide figure spreads, code-listing-heavy docs (room for line continuation). |
| **2-column A4** | Newsletters, multi-article magazine spreads, brochure interior. Narrow columns invite shorter sentences. |
| **3-column A4** | Newspaper-style newsletters, dense reports. Body type drops to 9.5 pt. Use bold pull-quotes to break monotony. |
| **A5 booklet** | Pocket guides, programme booklets. Smaller paper → bigger relative body type → tighter margins. |
| **A2 poster** | Conference posters. 14 pt body, 4 cm margins, vertical reading flow. |

### Layout don'ts

- **Don't centre body text** for anything longer than 2 lines. Centered body is unreadable past a few words.
- **Don't fully justify** narrow columns (3-col newsletters). The river-of-spaces problem is severe. Use left-aligned (ragged-right) instead.
- **Don't shrink margins below 1.5 cm** for body documents. Eye-tracking can't recover when lines exceed ~75 characters comfortably.

### Running heads (per-chapter)

Penwright's page header / footer fields in the Design panel (Layout section) accept two placeholders that resolve **per page** at compile time:

- \`{chapter}\` — the body of the most recent H1 (chapter / top-level heading) visible on or before the current page.
- \`{section}\` — same, but for H2.

Both can be mixed with raw Typst markup. Examples a user / agent can drop straight into the header field:

| Header value | Renders as |
|---|---|
| \`{chapter}\` | Plain chapter name, left-aligned |
| \`{chapter}  ·  ISSUE 1\` | Chapter name, separator, issue label |
| \`{chapter} #h(1fr) {section}\` | Chapter left, section right, space between |
| \`#text(tracking: 0.1em, fill: style-colors.muted)[{chapter}] #h(1fr) #counter(page).display()\` | Styled chapter name on the left, page number on the right |

If a page has no H1 on it or above it (e.g. cover page before chapter 1), the placeholder renders as empty content. Pages mid-chapter that continue past a chapter heading still show the chapter name — the query takes the last heading on or before the current page, not just headings literally placed on the current page.

The \`magazine-editorial\` layout preset uses \`{chapter}  ·  ISSUE 1\` by default, so applying that preset immediately gives a working running head.

## Elements (Special Blocks)

### Blockquote

- Use sparingly — one or two per article max.
- 3 pt accent-color left border is the safe default.
- Italic is fine for short quotes (1–2 lines). For longer quotes, drop italic and use a slightly larger size or muted text color.

### Code-Block

- Background should be **slightly different from page background**, not strongly contrasting. \`luma(245)\` on white page works almost everywhere.
- Padding > 0.6 em. Tight code blocks feel cramped.
- Border radius is a style signal: 0 pt = formal/technical, 4 pt = modern, 8 pt = playful/marketing.

### Figure

- Caption position: **below** for figures, **above** for tables. Convention readers expect.
- Caption color: muted slot, never primary. Captions are secondary — they shouldn't compete with the figure.
- Separator: \`": "\` is universal. \`" — "\` reads as editorial. Avoid colon-only (\`":"\`) — looks broken.
- Alignment: left for documents, center for posters / brochures.

### Table

- **Header always darker than body.** Use \`primary\` background + \`background\` text for strong tables, or \`muted\` background + dark text for subtle.
- **Zebra rows** help with wide tables (>5 columns) but distract on narrow ones. Default off.
- **6–8 pt cell padding** is the comfortable range. Less feels cramped, more wastes space.

## Per-chapter section styles (magazine rubrics)

Real magazines don't use one look for the whole issue — each rubric (Feature,
Interview, Essay, Department) has its own accent, type and column treatment.
Penwright supports this with **section styles**: a named overlay applied to a
single chapter via a scoped \`#show\`, while page geometry and running heads stay
document-level. The override actually re-themes that chapter (it emits literal
colours, not the global palette reference).

Workflow via MCP:

~~~
penwright_list_section_styles()                       // presets + defined + assignments
penwright_apply_section_style({ file: "chapters/03-feature.typ", styleId: "feature" })
  // auto-defines the 'feature' preset if needed, injects the opt-in, then:
penwright_compile()
~~~

Five built-in presets: **feature** (big display headline, accent, 1 col),
**interview** (2 cols, sans, teal), **essay** (serif, generous leading, 1 col),
**photo-essay** (minimal, large Inter headline), **department** (3 dense cols).
Tune or invent rubrics with \`penwright_define_section_style({ id, fromPreset?,
accent?, columns?, h1Size?, ... })\` — start from a preset and override.

What an overlay can change: accent / primary colour, body+heading fonts, base
size, leading, column count, per-level heading treatment. What it can't (stays
document-level): paper, margins, running heads, page numbering — use the global
layout for those.

Anti-patterns specific to rubrics:
- **A different accent for every chapter.** Pick 2–4 rubrics for the whole issue
  and reuse them; coherence comes from repetition, not variety.
- **Changing columns mid-flow without a fresh page.** A column change starts a
  new page (by design) — assign a rubric to a chapter that opens on its own page,
  not a mid-chapter section.
- **Rubric + a conflicting global theme.** The rubric layers on the global look;
  keep the base theme neutral so rubric accents read clearly.

## Modern Looks (2026)

What "current" means right now:

- **High contrast, low decoration.** Strong primary color, generous whitespace, minimal borders / shadows.
- **Tight letter-spacing on display headings** (\`tracking: -0.02em\`). Reads as confident, designed.
- **Sans-serif body for tech, serif body for editorial**. The split is sharper than it was five years ago.
- **Single accent color, used everywhere consistently.** No more "every link in a different color".
- **Generous H1 sizes** (24–32 pt for body documents, larger for marketing). Owning vertical space is in.
- **Muted gray captions and metadata.** Don't compete with body text.
- **OKLCH color-thinking** when picking custom palettes — even spacing in perceptual color space gives more harmonious palettes than equal RGB / HSL steps.

## Anti-Patterns

- **Word-default look** (Times New Roman + 1.5 line height + ragged left margin): looks like a 1995 college paper. If targeting modern audiences, anything is better.
- **More than three fonts in one document.** Always a mistake. If you're tempted, use weight + size variation within one family instead.
- **Sub-pixel letter-spacing** on body text (\`tracking: 0.01em\`). Imperceptible improvement, looks fiddly.
- **Background-color text** that doesn't pass WCAG AA. Light-gray text on white is the most common offender (\`#999\` on \`#fff\` = 2.85:1, fails AA).
- **Centered body paragraphs.** Already mentioned. Don't.
- **Decorative dividers between every section.** Use whitespace instead; reserve dividers for soft breaks within a section.
- **Heading that says "Introduction" for a 3-paragraph piece.** If the piece is short enough that the reader will see the start anyway, the heading is redundant.
- **More than one drop cap per section.** Drop caps are a signature, not a pattern. One at the opener; never repeated in the same article or chapter.
- **Article-Opener AND a separate H1+lead paragraph in the same article.** The opener element renders its own large headline (already wrapped in a level-1 heading so it stays in the outline). Pick one or the other.
- **Multiple section-openers without page-breaks between them.** Section-Opener already inserts pagebreaks on both sides — chaining two back-to-back gives you two empty pages and defeats the visual reset.

## Workflow — Composing a Design Decision

When a user asks "make this look like a brochure" (or similar):

1. Run \`penwright_generate_layout({ intent: "brochure" })\`. Gets a sensible theme + layout starting point applied in one shot.
2. Inspect the result: \`penwright_get_style()\`. Decide what to adjust.
3. Apply targeted refinements: \`penwright_update_style({ colors: { primary: "#0c2340" } })\` for the brand color, or \`penwright_apply_palette({ presetId: "ocean-classic" })\` to swap the whole palette.
4. Optional: drop in design elements at top of the document — \`penwright_insert_design_element({ elementId: "hero", afterText: "", params: { title: "Q3 Report", subtitle: "Operations Review" } })\`.
5. Verify: \`penwright_compile()\`. If it warns, fix; if it errors, restore via \`penwright_list_versions\` + \`penwright_restore_version\`.

Don't reach for \`penwright_update_style\` with a giant patch. Make one change, recompile, iterate. The PDF preview is your feedback loop.

## Concrete Design Recipes

### Editorial article opener (3 calls)

A long-form article needs a kicker + headline + standfirst + byline at the top. Use the composite element, don't hand-roll three \`#text(...)\` blocks:

\`\`\`
penwright_apply_palette({ presetId: "editorial" })
penwright_insert_design_element({
  elementId: "article-opener",
  afterText: "= <article-title>",
  params: {
    kicker: "INTERVIEW",
    headline: "The Last Architect of Tasmania",
    standfirst: "Helen Lyon spent four decades reshaping how rural housing relates to land.",
    byline: "By Sam Cooper, Photography by Maya Reidt"
  }
})
penwright_compile
\`\`\`

The element wraps the headline in a level-1 heading so it still appears in the TOC. **Don't pair with a separate \`= Title\` heading** — pick one.

### Photo-led story spread

Architecture / lifestyle articles where the photos are the point:

\`\`\`
penwright_insert_design_element({ elementId: "image-overlay", params: { image: "assets/hero.jpg", title: "...", subtitle: "..." } })
... body paragraphs ...
penwright_insert_design_element({ elementId: "gallery-asymmetric", params: { imageMain: "assets/big.jpg", imageTop: "assets/detail-1.jpg", imageBottom: "assets/detail-2.jpg", captionMain: "..." } })
... body paragraphs ...
penwright_insert_design_element({ elementId: "photo-caption-wrap", params: { image: "assets/portrait.jpg", caption: "<long-form bio paragraph>", credit: "Maya Reidt" } })
\`\`\`

Three different image-density patterns. Don't repeat the same one three times.

### "By the numbers" sidebar mid-article

The user mentions concrete numbers that deserve emphasis ("we serve 1.8M households", "87% satisfaction"):

\`\`\`
penwright_insert_design_element({
  elementId: "stats-box",
  afterText: "<paragraph that introduces the numbers>",
  params: {
    header: "BY THE NUMBERS",
    number1: "1.8M", label1: "Households reached",
    number2: "87%", label2: "Satisfaction rate",
    number3: "12", label3: "New programmes since 2020"
  }
})
\`\`\`

Optional fourth row via \`number4\` + \`label4\`. The box auto-themes via accent + primary slots.

### Per-chapter running heads

User wants the page header to show the current chapter title instead of a static label:

\`\`\`
penwright_update_style({
  layout: {
    pageHeader: "#text(size: 0.85em, tracking: 0.1em, fill: style-colors.muted)[{chapter}  ·  ISSUE 1] #h(1fr) #line(length: 1.5cm, stroke: 0.5pt + style-colors.accent)"
  }
})
\`\`\`

Placeholders \`{chapter}\` and \`{section}\` get substituted with the current H1 / H2 visible on the page. The \`magazine-editorial\` layout preset already does this by default.

### Theme + layout combo for a specific brief

| Brief from user | Recipe |
|---|---|
| "Academic thesis" | \`apply_style({ styleId: "thesis" })\` + \`apply_layout({ layoutId: "a4-portrait-standard" })\` — Crimson Pro body, conservative margins |
| "Editorial magazine like Local Project" | \`apply_style({ styleId: "editorial-magazine" })\` + \`apply_layout({ layoutId: "magazine-editorial" })\` + a \`magazine-cover\` element |
| "Conference poster" | \`apply_style({ styleId: "modern-tech" })\` + \`apply_layout({ layoutId: "a2-poster" })\` — 14 pt body, 4 cm margins |
| "Programme booklet" | \`apply_style({ styleId: "minimal" })\` + \`apply_layout({ layoutId: "a5-booklet" })\` |
| "Marketing brochure" | \`generate_layout({ intent: "brochure" })\` — one shot, then refine |

Don't combine contradictory presets. "Thesis theme" + "A2 poster layout" is technically possible but the typography won't survive the geometry change.

## Don't

- **Don't redesign without reason.** "What does this document need to do?" comes before "how should it look?".
- **Don't ignore the user's existing custom-code block.** It's in \`style.custom.preamble\` — applying a theme preserves it; applying an inline \`update_style\` patch preserves it. Read \`penwright_get_style\` first to know what's there.
- **Don't hard-code colors in the design-element library.** Elements should always reference \`style-colors.<slot>\` so they re-theme automatically when the palette changes.
- **Don't use design elements as headings.** A Banner element is for visual emphasis, not for hierarchy. Headings should stay headings — that's what the H1–H6 surface is for.
- **Don't apply contradictory presets in sequence.** "Marketing Brochure theme" + "A2 Poster layout" works if intentional; "Thesis theme" + "Brochure layout" usually doesn't. The presets are starting points, not building blocks.

## Print & spreads (magazines / brochures going to a printer)

- **Set up the print project once.** Apply the **"Magazin (Druck) · A4 + 5 mm Beschnitt"** layout preset (or set \`layout.bleed\`/\`cropMarks\`/\`facingPages\`/\`binding\` via \`penwright_update_style\`). Bleed + crop marks only show in the **print export** ("Für den Druck" / \`penwright_export_print\`) — the editing preview stays clean. \`facingPages\` (inner/outer margins + binding gutter) IS shown live, because a bound heft genuinely looks different.
- **Spread images (\`spread-image\`, "double truck").** Use for a single photo running across two facing pages over the fold. It emits two pages and forces an even/left start (may insert a blank page), so place it where a spread belongs, not mid-flow. **Keep faces, text and key subjects away from the centre** — a few mm vanish into the binding (gutter creep). Needs a wide, high-res image (≈ 2× a page) and a project whose \`style.typ\` exports \`style-bleed\` (re-save the design once on old projects).
- **CMYK is a print-shop step, not in-app.** Penwright delivers a print-ready **RGB** PDF with bleed + crop marks; the drawn crop marks ARE the trim definition. Tell the user their printer (or Acrobat/Ghostscript) converts to CMYK/PDF-X — don't promise colour-accurate offset output from the app alone.
`;
