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
├── .vswrite/                # Hidden: auto-backups, AI-edit snapshots, per-project preferences
└── .git/                    # Version history
~~~

\`assets/\`, \`sources/\`, \`exports/\`, and \`comments/\` stay visible in the file tree even when empty so it's clear where things go.

## Four Persistence Layers — Don't Confuse Them

| Layer | Trigger | Storage | Purpose |
|---|---|---|---|
| **Versions** (Git) | User-saved milestones | \`.git/\` | Named history points: "Chapter 3 first draft", "Before supervisor feedback". User vocabulary is "version", not "commit". |
| **Auto-backups** | Timer (default 30 s) | \`.vswrite/backups/<timestamp>/\` | Crash protection. Each backup is a flat snapshot of all .typ + .bib files plus a \`.meta.json\`. |
| **AI-edit snapshots** | Each external file change | \`.vswrite/ai-snapshots/\` | Ring buffer used by "Undo AI Edit". |
| **UI preferences** | UI knob changes (debounced) | \`.vswrite/preferences.json\` | Per-project editor + PDF zoom levels. Travels with the project folder. Extend this file rather than electron-store when adding new per-project UI knobs. |

All four live inside the project folder.

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

export const WRITING_STYLE_SKILL = `---
name: writing-style
description: Prose conventions for vswrite — source discipline (anti-hallucination), anti-AI-tells, active prose principles, academic conventions. Load when writing or revising prose in .typ files. Bilingual coverage (English + German) because the tells aren't symmetrical across languages.
---

# Writing Style

Prose checklist that catches "AI sound" before it leaves the document. Two-language coverage because vswrite serves both English- and German-speaking academics, and the tells differ between them.

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

vswrite-specific: prefer the badge form \`@chen2021codex\` over prose-form \`(Chen et al., 2021)\` — Typst handles author/year formatting at compile time depending on the chosen \`#bibliography(style: ...)\`.

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

1. Call \`vswrite_get_citations\` and pick from the returned list.
2. If the needed citekey doesn't exist, choose one of two paths:
   - **You have the actual source** → add it via \`vswrite_add_citation\`, copying the canonical BibTeX from publisher / DOI / arXiv / Zotero. Never type BibTeX from memory.
   - **You don't have the source** → write the claim without citation. Mark it with \`vswrite_add_comment\` ("needs source") and move on.
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

- Run \`vswrite_find_source_for_citation\` to confirm the PDF exists in \`sources/\`. Open it.
- If you don't have the source on disk, **paraphrase with a citation**, don't quote.
- A misquote is worse than no quote — it's a fabrication attributed to a real person who can object.

This applies to German Zitate just as strictly. \`„nach Vossen sei der Effekt zentral"\` muss ein Vossen-Originalzitat sein, kein Plausibel-klingender Paraphrase.

### D5. Verify Page Numbers

Typst supports \`@chen2021codex[p. 42]\`. If you cite a specific page, **you must have looked at that page**. Don't approximate. If you don't have the page, drop the page reference (\`@chen2021codex\` alone) and add a vswrite-comment "find page" so it isn't forgotten.

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

Before \`vswrite_save_version "final draft"\`:

1. \`vswrite_get_citations\` — every BibTeX entry has author, year, title, venue, no \`???\` or \`[fill in]\` placeholders.
2. \`vswrite_search_project({ query: "@" })\` per chapter — eyeball every cite. Each one should resolve to a BibTeX entry. Spot-check by searching the citekey in \`vswrite_get_citations\` output.
3. For high-stakes claims (numerical results, theorems, "X showed Y"): can you open the source and find the supporting passage? If yes ✓. If no — downgrade the claim or remove it.
4. For each PDF in \`sources/\`: \`vswrite_find_source_for_citation\` — does the file correspond to the cited paper? Especially after Zotero re-syncs that may have replaced files.

This audit takes 30 minutes for a chapter and prevents catastrophe. Do it.

---

## Revision Checklist

When a section is drafted, run through this before \`vswrite_save_version\`:

**Integrity (do these first — Section D):**

1. **Every \`@citekey\` resolves** — \`vswrite_get_citations\` confirms each one. Zero invented citekeys.
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

When using \`vswrite_replace_in_project\` for stylistic bulk-edits (e.g. "remove all 'In conclusion' phrases project-wide"), always \`vswrite_save_version\` first.

---

## Don't

- **Never fabricate a citation.** If unsure: no citation, plus a vswrite-comment "needs source". This is non-negotiable in academic work.
- **Never type a BibTeX entry from memory.** Look the source up — DOI, arXiv, publisher, Zotero — and copy the canonical metadata.
- **Never quote from memory.** Open the source or paraphrase. A misquote is fabrication attributed to a real person.
- **Don't apply Section A mechanically to dialogue or fiction.** The rules are for academic / nonfiction prose. A character can say "delve into" without it being an AI tell.
- **Don't strip ALL hedging.** Discussion sections need it. AI sprinkles it everywhere; the fix is precision, not abolition.
- **Don't trade voice for compliance.** If "Furthermore" is genuinely your style, keep it for clutch moments. The rule is "Furthermore-by-default", not "Furthermore-never".
- **Don't over-apply Section A to the user's pre-AI text.** These tells are about LLM patterns; experienced writers sometimes use the same constructions deliberately and with weight.
- **Don't run a stylistic bulk-replace without saving a version first.** Style edits routinely break unintended things (a sentence relying on "however" loses its turn). \`vswrite_save_version → vswrite_replace_in_project → vswrite_compile → re-read\`.
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
