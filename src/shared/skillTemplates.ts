/**
 * Skill Templates — content of `.claude/skills/<name>/SKILL.md` files
 * deployed into every new vswrite project.
 *
 * Each template covers the same conventions for two audiences:
 *   1. Agents with direct filesystem access (Claude Code in the integrated
 *      terminal, VS Code Claude, Cowork with folder permission)
 *   2. Agents using the vswrite MCP server (Claude Desktop, Codex Desktop)
 *
 * Markdown uses tilde fences (~~~) instead of backticks so the templates
 * embed cleanly in TypeScript template literals without escape noise.
 */

export const TYPST_SKILL = `---
name: typst
description: Typst language reference — syntax, math, layout, cross-references, footnotes, bibliography. Load when authoring or editing .typ files.
---

# Typst Language Reference

Typst is a modern typesetting system. This skill covers the syntax and constructs you need to author and edit \`.typ\` files in a vswrite project.

## Document Structure

A Typst document starts with optional **#set / #show / #let** rules (the preamble), followed by the body. In multi-chapter projects (vswrite default), the preamble lives in \`main.typ\` and chapters are pulled in via \`#include\`.

~~~typst
// main.typ
#set text(font: "Libertinus Serif", size: 11pt, lang: "de")
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")

#include "chapters/01-introduction.typ"
#include "chapters/02-method.typ"

#bibliography("references.bib", style: "apa")
~~~

Chapter files contain only body content — no preamble. Applying a style template to a chapter file is blocked because it would silently inject preamble into the wrong place.

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

**Label-prefix conventions** (vswrite uses these to disambiguate references from citations):

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

## Source Comments — \`//\` ≠ vswrite annotations

\`// single-line\` and \`/* block */\` are stripped at compile time.

These are **not** vswrite comments. vswrite annotations live as separate Markdown files in \`comments/\` and are managed via the comments-panel or the \`vswrite_add_comment\` MCP tool — they never touch the \`.typ\` source. See the \`vswrite\` skill for details.

## Common Pitfalls

- \`#set math.equation(numbering: "(1)")\` is required before any \`@eq:…\` reference.
- Block constructs like \`#figure(...)\` need their own paragraph (blank lines around) — pasting them mid-sentence breaks layout.
- Heading-number renumbering when chapters are reordered is automatic because Typst processes the merged document.
- Citekeys are bare slugs (no colon); label names use the prefix conventions above. Mixing them up confuses both Typst and vswrite's badge classifier.
- Image paths in \`#include\`d chapter files: use \`../assets/foo.png\`, not \`assets/foo.png\` — Typst resolves paths from the file containing the \`#image\` call, not the root.
`;

export const VSWRITE_SKILL = `---
name: vswrite
description: vswrite project conventions — folder structure, persistence layers, comments, cross-references, mode toggles. Load when working in a vswrite project.
---

# vswrite — Project Conventions

vswrite is a WYSIWYG editor for Typst documents. Projects are folder-based and self-contained: every project carries its own version history, auto-backups, and Claude Code skills inside the folder. Copy or move the project — the full state moves with it.

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
├── comments/                # vswrite annotations — never compiled
│   └── 2026-04-29-1432-a3f.md
├── exports/                 # PDF / DOCX outputs (auto-created on first export)
├── .claude/skills/          # These skills, deployed per project
├── .vswrite/                # Hidden: auto-backups + AI-edit snapshots
└── .git/                    # Version history
~~~

\`assets/\`, \`sources/\`, \`exports/\`, and \`comments/\` stay visible in the file tree even when empty so it's clear where things go.

## Three Persistence Layers — Don't Confuse Them

| Layer | Trigger | Storage | Purpose |
|---|---|---|---|
| **Versions** (Git) | User-saved milestones | \`.git/\` | Named history points: "Chapter 3 first draft", "Before supervisor feedback". User vocabulary is "version", not "commit". |
| **Auto-backups** | Timer (default 30 s) | \`.vswrite/backups/<timestamp>/\` | Crash protection. Each backup is a flat snapshot of all .typ + .bib files plus a \`.meta.json\`. |
| **AI-edit snapshots** | Each external file change | \`.vswrite/ai-snapshots/\` | Ring buffer used by "Undo AI Edit". |

All three live inside the project folder.

## sources/ — Citation PDF Naming

For the in-app **citation hover-card** to find the PDF for \`@chen2021codex\`, name the file so the basename starts with the citekey:

- ✅ \`sources/chen2021codex.pdf\` (exact match — preferred)
- ✅ \`sources/chen2021codex_supplement.pdf\` (suffix variant)
- ✅ \`sources/chen2021codex-arxiv.pdf\`
- ❌ \`sources/Chen et al. - Evaluating LLMs.pdf\` (no citekey prefix)

The MCP tool \`vswrite_find_source_for_citation\` uses the same matching logic.

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

- **anchor** is the verbatim text the comment is attached to. vswrite re-locates it on file load using \`indexOf\` when offsets drift.
- Comments are **never compiled** into PDF / DOCX — the source stays clean.
- Visible in the file tree, cloud-sync-friendly (Dropbox / iCloud), git-diffable, editable from any text editor.
- Anchors that span paragraphs get marked \`orphaned: true\` automatically.

When creating comments programmatically, **prefer \`vswrite_add_comment\`** over hand-writing the Markdown — the tool generates the id, computes range offsets, fills frontmatter correctly.

## Cross-References vs. Citations — Disambiguation

Typst uses the same \`@…\` syntax for both. vswrite tells them apart by the name:

- Has a colon (\`@fig:scaling\`) → **cross-reference**
- Starts with a known prefix (\`fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst\` and full forms) → **cross-reference**
- Otherwise (\`@chen2021codex\`) → **citation**

This is why citation keys are conventionally bare slugs (no colon).

In the editor:
- \`@chen2021codex\` renders as a **blue badge**
- \`@fig:scaling\` renders as an **orange ↳ pill**

## Mode Toggles (UI-only — never change the source)

| Mode | Effect | Trigger |
|---|---|---|
| **Reading Mode** | Serif font, generous leading, justified, narrow column. Editing stays active. | \`Cmd+Alt+R\` / 𝓡 toolbar / View menu |
| **Focus Mode** | Hides sidebar + preview, dims surrounding paragraphs. | ◎ toolbar |
| **Typewriter Mode** | Active line stays vertically centered. | ‥ toolbar |

These are display-only — toggling them never modifies \`.typ\` files.

## Style Templates

Seven predefined preambles + custom imports. Apply only to the **root file** (\`main.typ\`). Applying to a chapter is blocked at the IPC level — would silently inject preamble code into the chapter and break the build.

Available IDs: \`classic\`, \`modern\`, \`minimal\`, \`vibrant\`, \`elegant\`, \`professional\`, \`artsy\`. From MCP: \`vswrite_list_styles\` / \`vswrite_apply_style\`.

## Working with vswrite — Two Paths

### Direct filesystem access

If you have read/write access to the project folder (Terminal Claude, VS Code Claude, Cowork with folder permission), edit \`.typ\` and \`.bib\` files directly. The vswrite editor watches the filesystem and updates within seconds.

**Watcher quirks:**
- \`.vswrite/\` is excluded — backup writes don't trigger refresh loops.
- vswrite saves are tagged with a 3-second self-write guard; your external writes always go through.
- Don't edit \`.vswrite/\` or \`.git/\` directly. Both are managed state.

### MCP tools (Claude Desktop, Codex Desktop, …)

When connected via the vswrite MCP server, you have **43 dedicated tools** instead of raw filesystem access. They enforce project boundaries (every path validated against the project root, symlink-aware), generate ids and YAML, validate cross-reference labels, etc.

**Prefer the dedicated tool over raw \`vswrite_write_file\`** when one exists:

| Task | Tool |
|---|---|
| Add chapter | \`vswrite_add_chapter\` (creates file + adds \`#include\`) |
| Reorder chapters | \`vswrite_reorder_chapters\` |
| Add citation | \`vswrite_add_citation\` (validates BibTeX, ensures \`#bibliography\`) |
| Add comment | \`vswrite_add_comment\` (generates id, anchors, YAML) |
| Insert cross-ref | \`vswrite_insert_reference\` (validates label exists) |
| Insert footnote | \`vswrite_add_footnote\` (bracket-balance check) |
| Insert image | \`vswrite_add_image\` (asset dedup + figure builder) |
| Bulk rename | \`vswrite_save_version\` → \`vswrite_replace_in_project\` |
| Apply style | \`vswrite_apply_style\` (root-file guard) |
| Verify build | \`vswrite_compile\` (errors with file/line) |
| Export | \`vswrite_export_pdf\` / \`vswrite_export_docx\` |

See the \`research-workflow\` skill for end-to-end recipes.

## Constraints to Remember

- **Edit \`.typ\` files, never the rendered output.** Source comments (\`//\`) are compile-only; vswrite annotations are separate files.
- **Style templates only apply to the root file.** Don't paste preamble code into a chapter.
- **Image paths are relative to the file containing \`#image\`.** Drop new images into \`assets/\` and reference as \`assets/foo.png\`.
- **Citekeys go in \`.bib\` files; labels go in \`.typ\` files.** Keep the colon convention (\`@chen2021codex\` vs \`@fig:arch\`).
- **Save a version before bulk replacements.** \`vswrite_save_version\` → \`vswrite_replace_in_project\` → \`vswrite_compile\`. Restore on regression.
- **Never commit \`.vswrite/\`.** It's already in \`.gitignore\` for a reason — it's machine state, not project content.
`;

export const RESEARCH_SKILL = `---
name: research
description: Research workflow for vswrite — find sources, create BibTeX, write notes, link sources to citations, run consistency checks. Load when researching a topic for a Typst document.
---

# Research Workflow for vswrite

End-to-end research → integration loop for academic / non-fiction work in vswrite. Assumes the conventions in the \`vswrite\` skill and the syntax in the \`typst\` skill.

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

2. **Source PDF** in \`sources/\`, named so the basename starts with the citekey. \`sources/chen2021codex.pdf\` is preferred; \`chen2021codex_supplement.pdf\` etc. work as fallback. Naming matters: vswrite's hover-card and \`vswrite_find_source_for_citation\` match on this prefix.

3. **Notes** as Markdown in a scratch location (or directly as \`.typ\` in \`chapters/\` once it's a real chapter).

### MCP-tool path

~~~
vswrite_add_citation({
  bibtex: "@article{chen2021codex, author={Chen and Tworek}, title={…}, year={2021}, …}"
})

vswrite_get_citations()
  → [{ citekey: "chen2021codex", … }, …]

vswrite_find_source_for_citation({ citekey: "chen2021codex" })
  → { found: true, relPath: "sources/chen2021codex.pdf" }   // or { found: false } → user needs to drop the PDF
~~~

### Filesystem path

Append a BibTeX block to \`references.bib\`. Drop the PDF into \`sources/\` with the right name. No special tool needed.

## Phase 3 — Synthesize

When notes are inline Markdown that should become a chapter:

~~~
vswrite_import_markdown({
  markdown: "# Verwandte Arbeiten\\n\\n## Chen et al. (2021)\\n…",
  destPath: "chapters/06-related.typ"
})
~~~

Handles headings, formatting, lists, links, code, blockquotes. Complex Markdown (custom HTML, footnote-style references) needs manual cleanup.

After import, add a \`#include "chapters/06-related.typ"\` to \`main.typ\` (via \`vswrite_add_chapter\` or by editing).

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
vswrite_list_labels({ type: "figure" })
  → [{ label: "fig:arch", caption: "Architecture", relPath: "chapters/03-method.typ", line: 12 }, …]

vswrite_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "as shown in",
  label: "fig:arch"
})
~~~

\`vswrite_list_labels\` is the safety net — it tells you which labels actually exist before you reference them.

### Backlinks — "Where else is this cited?"

Classic consistency-check question:

~~~
// Every place a source is cited
vswrite_search_project({ query: "@chen2021codex", wholeWord: true })

// Every place a heading text is mentioned
vswrite_search_project({ query: "Method" })
~~~

Whole-word matching uses lookarounds (not \`\\b\`), so it works even when the query starts with \`@\`.

### Renaming a citekey across chapters

~~~
vswrite_save_version({ message: "Vor Citekey-Umbenennung" })

vswrite_replace_in_project({
  query: "smith2023",
  replacement: "smith2024",
  wholeWord: true
})

vswrite_compile()
~~~

If the compile fails: \`vswrite_restore_version({ sha: "<sha-from-save>" })\` rolls back.

### Leave a comment for the supervisor

~~~
vswrite_add_comment({
  file: "chapters/01-introduction.typ",
  anchor: "five reference works",
  body: "Vorschlag: Müller (2024) ergänzen — neuer Survey deckt drei dieser Werke neu ab.",
  author: "Claude (research)"
})
~~~

Comments are never compiled into PDF / DOCX. The supervisor sees them in the vswrite editor, can resolve / delete them, can edit the \`.md\` from any text editor.

### Add a figure with caption + label in one shot

~~~
vswrite_add_image({
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

1. \`vswrite_compile()\` — must return \`success: true\`.
2. \`vswrite_list_labels()\` — every figure / table / equation that's referenced should have its label.
3. \`vswrite_search_project({ query: "@" })\` — eyeball the hits to make sure no broken cross-refs slipped in.
4. \`vswrite_get_citations()\` — every \`@citekey\` used in the text should map to a BibTeX entry.
5. \`vswrite_export_docx({ outputPath: "exports/v1-feedback.docx" })\` for the supervisor.

## Don't

- **Don't invent citekeys or label names.** Always check via \`vswrite_get_citations\` / \`vswrite_list_labels\` first. Inserting \`@nonexistent\` either breaks the build or silently renders as "?".
- **Don't put research notes in \`assets/\` or \`sources/\`.** \`assets/\` is for images referenced by \`#image\`; \`sources/\` is for citation PDFs only. Notes go in \`chapters/\` (when integrated) or a scratch \`.md\` file outside the project.
- **Don't bypass \`vswrite_save_version\` before bulk operations.** A 4-file replace that breaks the compile is much easier to fix when there's a named version to restore from.
- **Don't manually create \`comments/<id>.md\`.** Use \`vswrite_add_comment\` — it gets the id, frontmatter, and offset math right.
`;
