# Web Export — Feasibility Verdict, Market Read & Revised Implementation Plan

**Status:** Research complete. **Path chosen (2026-06-29):** ship the two bug fixes (§3) first, then build the full **Editorial Web Pack** — **pre-launch** (web export becomes a launch headline; the release shifts to include it). Bugs-first, then keystone + serializer, then launch. **Nothing implemented yet** (awaiting code go-ahead).
**Companion to:** [web-export-plan.md](web-export-plan.md) (the original build brief — kept as-is; this doc verifies, corrects, and re-sequences it).
**Method:** Deep code recon (docxSerializer, deserializer/serializer, styleParser, export plumbing, MCP) + firsthand read of the **real LANGSAM magazine** (`~/Desktop/LANGSAM`, the ground-truth artifact the original plan is written against) + 2026 web research (TipTap static-renderer, CSS support, competitive landscape, market demand) + a 3-way adversarial verification pass.

---

## 0. The three answers, up front

1. **Is it feasible?** → **Yes.** The architectural thesis holds: `docxSerializer.ts` is a ~70 % blueprint, the style tokens map mechanically to CSS for the typographic subset, `@tiptap/static-renderer` is real/server-safe, and CSS in 2026 supports every magazine element with one mandatory fallback (drop caps in Firefox). Several of the original plan's specifics are **wrong or optimistic** and are corrected below — none are blockers, but two would have detonated mid-build (`.mdx` container, dependency pinning).

2. **Is it needed/valuable in 2026?** → **The gap is genuinely unmet, and Penwright is uniquely positioned to fill it** — but only under one specific framing (*"print **and** web from one structured source"*, not *"another way to make a blog"*), and the audience is a **subset of a subset** (the magazine/editorial/creator slice; thesis/paper users get zero web value).

3. **What's the concrete plan?** → **Decouple from launch.** Two correctness bugs this research uncovered (`#columns` silently dropped from DOCX; heading-`<label>` escaping breaking cross-refs) should be **fixed now, in the release sprint** — they're independent of web and hit the proven audience. The **web export itself** is a legitimate **post-launch v1.1 "Editorial Web Pack"**, built on a de-risked phasing (spike → vertical slice → keystone → breadth → polish), realistic at **~6–7 weeks all-in** (not the original's 3–4), gated by a hard *"no half-faithful export ships"* rule and a written kill-criterion. The all-but-unanimous verdict of the strategy + adversarial agents: **ship now, build web after.**

> The *timing* call is **René's** — the research recommends decoupling, but if "print + web" is the headline you want to launch *on*, the plan below works either way; only the sequencing changes.

---

## 1. Feasibility — verified, with corrections to the original plan

### 1.1 What the original plan got right (confirmed against code)
- **`docxSerializer.ts` (2293 lines) is a real blueprint.** The pre-pass `buildExportContext` (cross-ref label map, citation grouping, footnote collection, bibliography — all async, format-agnostic) is **directly portable**. `classifyRawBlock` / `renderRawBlock` / `parseInlineTypst` (the raw-block reinterpreter) is **~60 % reusable** (syntax swap OOXML→HTML). Net: ~70 % of the serializer logic carries over.
- **The export path slots in additively.** `ExportConfig` gains `format:'web'`; `runFilteredExport` ([importExport.ts](../src/main/importExport.ts)) routes to a new `serializeHtml`; a `penwright_export_web` MCP tool mirrors `penwright_export_docx`. The injected `renderTypstSnippet` hook (math/SVG) is reusable as-is. Zero disruption to PDF/DOCX.
- **Style tokens → CSS is mechanical for the typographic subset** (~60 %): `colors/fonts/scale/headings` → CSS custom properties + `h1..h6` rules, mirroring `emitCoreRules` in [styleParser.ts](../src/shared/styleParser.ts).
- **`@tiptap/static-renderer` exists, is server-side, needs no DOM/jsdom**, has the exact `nodeMapping`/`markMapping` override API the plan assumes, and ships **zero runtime deps**. The "`serializeHtml` mirrors `docxSerializer`" approach is sound.

### 1.2 What the original plan got wrong / understated (fix before building)

| # | Plan claim | Reality (verified) | Action |
|---|---|---|---|
| C1 | `@tiptap/static-renderer` is "`^3.0.0` compatible" (§8) | It **peer-pins** `@tiptap/core` **and** `@tiptap/pm` to an exact version (3.27.x exact; 3.20.x caret). Penwright runs **3.20.5**. A naive `npm i` pulls 3.27.1 and **re-pins the whole editor up 7 minors** → breakage. It also declares **react/react-dom as non-optional peers** (unused by the html-string entry) → install warning. | Pin static-renderer to the installed **3.20.x**, bump in lockstep; add react/react-dom as **devDeps**. |
| C2 | `.mdx` body with raw HTML + inline `<style>` "slots straight in" (§4/§11) | **MDX is JSX.** A raw `<style>` block (full of `{ }`) throws Acorn parse errors; HTML comments are illegal; `<` must be escaped; `class`≠`className`. The self-contained-with-own-CSS model **does not compile as `.mdx`.** | Default the container to **pure `.html` injected via Astro `<Fragment set:html>`** (the plan's own fallback). Confirm with the website repo; lock frontmatter names up front. |
| C3 | "Every node/mark implements `renderHTML()`, so semantic HTML comes for free" (§2) | True **only for marks + non-atom content nodes.** The static renderer does **not** auto-render node-views. Penwright has **7 atom nodes** (citation, footnote, image, reference, bibliography, pagebreak, typstRawBlock) **+ 7 proposed design atoms = ~14** that each need a **bespoke `nodeMapping` handler**. (Same surface DOCX already covers — reusable, but *work*, not free.) | Budget ~14 atom handlers in Phase 2. |
| C4 | `styleToCss` is "mechanical, low-risk" (§6.3) | True for the ~60 % typographic subset. **Not** mechanical for: element rules (`table fill: (col,row)=>…`, `.lighten(85%)`, stroke dicts → hand-translate); **~9 print-only `StyleLayout` fields** (paper/margins/pageNumbering/header/footer/bleed/crop/facing/binding → **no CSS analogue**, skip/reinterpret); `fr` units; and the **64 KB free-form `custom.preamble`** → **cannot be executed**, strip with a visible warning. | Realistic **4–6 days**, with an audited print/web split + documented losses. |
| C5 | Drop cap: "Firefox has no `initial-letter` (until v155)" (§6.5) | **Misleading.** Firefox has **no `initial-letter` at any version** (no landed milestone as of 2026). The `::first-letter{float}` fallback is **permanent**, not a "wait for v155." Ship **3 lines**: `-webkit-initial-letter` + `initial-letter` + `@supports not (...)` float fallback. | Treat FF drop-cap fallback as permanent. |
| C6 | Margin notes: "CSS Anchor Positioning is Firefox-less → enhancement only" (§6.5) | **Stale.** Anchor Positioning is **Baseline 2026** (FF 147+). The reason to still prefer the grid-side-column floor is **simplicity**, not a Firefox gap. | Keep grid as the floor (correct outcome, corrected reason). |
| C7 | `@scope` "Baseline since Dec 2025" (§10) | Correct, but it's **"Newly Available"** (FF 146 landed Dec 2025), not "Widely." Pre-FF-146/pre-Safari-17.4 users silently drop `@scope` rules. | **Class-prefixing is the floor; `@scope` the enhancement.** (Plan already says this — just be explicit.) |
| C8 | Math: inline-SVG vs KaTeX vs MathML as equal greenfield choices (§6.7/§10) | Penwright **already** has the Typst→SVG hook; **Typst 0.15 emits MathML natively**. KaTeX adds the dependency the plan otherwise avoids. | **Inline SVG (display) + MathML/aria (inline, a11y). No KaTeX.** |
| C9 | "Round-trips **byte-stable** to Typst" is the bar (§6.1/§11) | **Not achievable and not even true today.** The repo's `roundtrip-test.mts` passes 30/30 but only proves **fixed-point convergence** (s2===s3), *not* byte-identity — **none** of the 7 sample chapters round-trip byte-identically now. | Re-scope the acceptance bar to **PDF-compile-stability** (identical compiled PDF) + **cross-ref-label preservation**, backed by a PDF-hash test. |

### 1.3 The keystone — what the LANGSAM artifact actually shows

The original plan's central insight is **correct**: ~65–75 % of the magazine's visible design lives in hand-written macros that become **opaque `typstRawBlock` atoms** (raw string, no children, no semantics). Reading the real `~/Desktop/LANGSAM` confirms it and **sharpens it**:

**The leaf macros are clean and map 1:1 to ~7 nodes (the tractable part).** From [`macros.typ`](file:///Users/renejesser/Desktop/LANGSAM/macros.typ): `opener` (kicker/title/standfirst/byline — all named string args → `articleHeader`), `lead` (droplet → `dropCap`), `pull` (+`who:` → `pullQuote`), `frage` (→ `question`), `notiz` (→ `callout`), `bildtafel` (→ `figurePanel`), `randnotiz` (→ `marginNote`), `interlude` (→ `<hr>`). Well-structured, parseable, recognizable.

**The genuinely hard part is the ad-hoc inline layout scaffolding written *per chapter* — which the plan under-weights.** In [`03-interview.typ`](file:///Users/renejesser/Desktop/LANGSAM/chapters/03-interview.typ) the asymmetric two-up head is a bespoke `#grid(columns:(1fr,0.78fr))[…]` (a "Zur Person" box + `frage` + prose on the left, portrait + `frage` + prose on the right), followed by a `#columns(2)[…]` for the rest, plus a per-chapter `#set page(margin:…)`. **None of these are macros** — they're raw Typst, so today they land as **two giant opaque blocks**, and they are *exactly* the content DOCX silently drops. `#columns(n)[…]` is recognizable and mappable (its children re-parsed recursively); arbitrary `#grid` 2-up is the hard case (pragmatic web answer: **stacked responsive blocks**, content-complete, not pixel-faithful).

**Print-only constructs confirmed as re-design, not convert.** `aufmacher`/`doppelseite`/the cover use `#place`, fr-spacers, parity `pagebreak`, bleed — no reflow equivalent → **hero image + article header** on web (plan §6.6 is right).

**Why this matters beyond web (the 3× payoff is real):** turning these into nodes also (a) **fixes the `#columns` DOCX data-loss bug**, (b) improves DOCX fidelity, and (c) makes magazine chapters **actually editable as WYSIWYG prose** instead of opaque raw-text blobs. The keystone earns its keep across PDF/DOCX/editor/web at once — but it's a **core-editor refactor** (deserializer + serializer + schema), the highest-regression surface in the app.

**Honest keystone effort: 1.5–2.5 weeks**, not the plan's ~1 week — because of the 7 nodes **plus** the heading-label fix (§3), the marker-comment/`isRawBlock` collision (a leading `//` marker currently forces a block to `typstRawBlock` — the recognizer must run *before* that), and the compile-stability proof (~2–3 days of round-trip testing alone).

---

## 2. Market & strategic fit — the gap is real; the timing isn't

### 2.1 The competitive gap is genuinely unmet (strongest pro-signal)
The 2026 landscape splits into four buckets, **none** of which does *"one structured manuscript → design-faithful print PDF **and** characteristic-magazine responsive web from shared design tokens, no per-target rebuild"*:
- **PDF→HTML** (pdf2htmlEX, Adobe) — pixel-frozen *or* design discarded. Fundamental media mismatch.
- **Print-CSS** (Prince, Paged.js, Vivliostyle) — go HTML→PDF (web is the *authored source*); wrong direction; corroborate Penwright's thesis rather than compete.
- **Publishing/writing platforms** (Ghost, Substack, Beehiiv, Medium, iA Writer, Ulysses, Framer, Webflow) — **flatten to a blog template**; you rebuild drop caps/columns/pull-quotes by hand per article.
- **Book tools** (Vellum, Atticus) — print + ebook only, **no web**.

### 2.2 The two platform risks — both manageable, both must be named
- **Typst's own HTML backend** (the "platform eats this" fear): **LOW risk.** Triple-confirmed across 0.13/0.14/0.15 + docs + issue #5512 — experimental, behind a flag, **semantic-only, no CSS, no timeline**; 0.15 spent its HTML budget on MathML. Crucially, Penwright's value (structuring *opaque user macros* into re-themable nodes) is **upstream of and orthogonal to** whatever Typst emits — Typst shipping CSS would **not** obviate Penwright. *But* the bespoke serializer has a ~12–24 month exclusivity window → write a **kill-criterion**.
- **Quarto/Pandoc** (one source → PDF+HTML+Word): the **closest structural competitor, and the plan never names it.** It's scientific/journal-template-focused, has **no magazine design system**, and needs hand-written LaTeX/HTML templates for any characteristic look. Penwright's edge: **WYSIWYG magazine authoring + typed design tokens + named magazine nodes**. Must be positioned against explicitly or the "almost no tool does this" claim looks naive.

### 2.3 The honest case *against* (why "not now")
- **Audience is a subset of a subset.** Web export serves only the magazine/editorial/creator slice; the **proven buyers (thesis/dissertation/paper) get zero web value** (a thesis is a PDF). The cleanest buyer is **the founder himself** + the narrowest of six templates — a yellow flag.
- **Fidelity is binary.** The value prop *is* "design-faithful." A cheap 1–3 day prototype that skips the keystone ships **"text with holes"**, which **actively damages** the premium/design-quality brand and kills any pricing story. There is no cheap on-ramp.
- **Timing = textbook pre-launch scope-creep.** Penwright is at **v0.9.0 with a release sprint already paused** for this. The keystone is the **highest-blast-radius refactor** (the WYSIWYG↔Typst round-trip every compile depends on), contemplated **before first revenue**, primarily for a founder workflow.
- **Demand is diffuse and outcome-shaped.** Signals are real (digital-garden renaissance, Slow-Media, newsletter-to-web, COPE/"write once publish everywhere") but nobody is asking for "a Typst→web exporter" — they want the *outcome*, available more cheaply via Framer/Ulysses/Astro/Beehiiv for anyone who just wants a nice blog.

### 2.4 The verdict
**Build it — after launch.** Reposition the **existing** print feature as *"print + web from one source"* in launch marketing **now** (costs no engineering, stakes the defensible claim). Ship v1.0 on the proven print/thesis/magazine value. Then build web as an **isolated, post-launch v1.1 "Editorial Web Pack"**, sold as a **Pro/Studio tier** to the agency/creator buyer.

---

## 3. Two correctness bugs to fix **now** (independent of web export)

Both surfaced during this research, both hit the *proven* audience, both are launch-relevant.

- **B1 — `#columns` silently dropped from DOCX.** `columns` is in `SKIP_LEADERS` ([docxSerializer.ts:1492](../src/shared/docxSerializer.ts#L1492)); `classifyRawBlock` returns `{kind:'skip'}` (1683); `renderRawBlock` emits nothing (1890). **Any** `#columns(n)[…]` section is *omitted, not just unstyled* — ~half the LANGSAM interview vanishes. **Fix:** remove `columns` from the regex, route it through the existing `designText`/prose path so text at least survives. **<½ day + one real-doc DOCX test.** Ship in the sprint.
  - **✅ DONE (2026-06-29, branch `fix/prelaunch-export-bugs`).** `#columns` added to the `['block','dropcap','columns']` designText loop; verified on the real LANGSAM interview — the two-column answer prose now appears in the DOCX (was wholesale-dropped before).
  - **⚠️ KNOWN LIMITATION — deferred to the keystone (Phase C), accepted 2026-06-29.** User macros *nested inside* the columns body — `#frage[…]` interview questions, `#lead[…]` drop-caps, etc. — are still **dropped** (DOCX's `handleInlineFunc` discards unknown lowercase macro calls). So the interview currently exports as **answers without questions**; only the surrounding plain prose survives. A one-line `handleInlineFunc` change could rescue them now, but it widens the blast radius to the whole DOCX export, so it was intentionally deferred: the keystone turns `frage`/`lead`/… into real AST nodes and fixes this properly across PDF/DOCX/web at once. **Do not forget to revisit this in Phase C.**
- **B2 — heading `<label>` escaping breaks cross-references.** Verified by code-trace: the heading regex ([deserializer.ts:161](../src/editor/lib/deserializer.ts#L161)) captures `<sec:x>` as heading text; `escapeTypstText` ([serializer.ts:179](../src/editor/lib/serializer.ts#L179)) escapes `<` `>`. So **open + save** of any chapter with a labeled heading (`= Title <sec:x>`) rewrites it to `= Title \<sec:x\>`, **destroying the Typst label and every `@sec:x` reference into it** — corrupting the PDF and the cross-ref graph. Hits the **thesis/paper** audience directly. The Session-35 escaping fix is correct for *literal* `<` in prose but exposed this because labels aren't extracted as structure. **Fix (small, targeted):** in the deserializer, split a trailing ` <label>` off the heading line into a `label` attr (or a `reference`-style marker); in the serializer, re-emit it **unescaped**. Add a labeled-heading fixture to `roundtrip-test.mts`. **~½–1 day.** Reproduce first, then fix; ship in the sprint. *(The keystone would fix this anyway, but it shouldn't wait that long.)*

---

## 4. Revised implementation plan (de-risked phasing)

The original four-phase shape is sound but must be **re-sequenced around a vertical slice** and **decoupled from v1.0**. Order: **Phase 0 → A (spike) → B (slice) → C (keystone) → D (breadth) → E (polish).**

### Phase 0 — Ship-now bug fixes (in the release sprint) · ~1 day
B1 + B2 from §3. Independent of everything below. **Do regardless of whether web export is ever built.**

### Phase A — Plumbing spike + format/dependency lock · ~3–5 days · *the keystone-before-the-keystone*
Resolve the two traps that would otherwise detonate mid-build, with **zero core-editor risk**:
1. **Dependency hygiene** (C1): pin `@tiptap/static-renderer` to the installed **3.20.x**; add react/react-dom devDeps; bump in lockstep forever.
2. **Container format** (C2): switch the default from `.mdx` to **pure self-contained `.html` via Astro `<Fragment set:html>`**; confirm with the website repo; **lock the frontmatter field names** (the only cross-repo contract — §12 of the original).
3. **Deliverable:** `serializeHtml` renders a trivial doc (paragraphs + one mark + one atom) end-to-end through an `export:web` IPC into a self-contained file that opens in a browser **and** loads in the site. Proves the pipe.

**✅ Phase A status (2026-06-29, branch `feat/web-export`).**
- **Dependency locked & verified:** `@tiptap/static-renderer@3.20.5` installed (exact pin); `@tiptap/core`/`@tiptap/pm` **stayed at 3.20.5** (the C1 trap avoided). react/react-dom added as **devDeps** (the non-optional peer) — not imported at runtime by the chosen entry.
- **Entry chosen:** `@tiptap/static-renderer/json/html-string` → `renderJSONContentToString({ nodeMapping, markMapping, unhandledNode, unhandledMark })`. Pure JSON→string, **no schema/extensions, no DOM/jsdom, no react** — the dependency-light fit for `shared/` and the exact docxSerializer mapping pattern. (The `pm/html-string` entry, which needs the editor extensions, was rejected to keep `shared/` clean.)
- **Render PROVEN server-side:** new [htmlSerializer.ts](../src/shared/htmlSerializer.ts) (`serializeHtml(doc, opts)` → self-contained `<article class="pw-article">` + inline scoped `<style>` placeholder). Smoke test [scripts/html-export-test.mts](../scripts/html-export-test.mts) = 14/14: trivial doc (heading-label→`id`, escaping, marks, citation/image atoms) **and** a real sample chapter render with no throw / no leaked macro source. `tsc` + `electron-vite build` + the 37/37 round-trip all stay green.
- **Container DECIDED: pure self-contained `.html`** (not `.mdx`). MDX is JSX → a raw `<style>` block breaks the Acorn parser (C2); the article carries its own scoped CSS, so the site embeds it via Astro `<Fragment set:html>`. Frontmatter contract (`title/date/summary/tags/locale/cover/accent`) to confirm with the website repo before Phase B wires the bundle writer.
- **NOT yet wired (next):** the `export:web` IPC + ExportDialog option + bundle writer (`<slug>/index.html` + `assets/`) — deferred to the start of Phase B so the slice ships UI + tokens + 2 design elements together. The design constructs (drop-cap/columns/callout/…) still emit placeholders until Phase B/C/D.

### Phase B — Smallest end-to-end vertical slice that proves value · ~5–7 days
Exactly **two design elements + the typography tokens**, validated on a **real LANGSAM chapter**:
- **Callout** — "the most faithful part": `color-mix()` tint, **zero fallback**, and `classifyRawBlock` already recognizes gentle-clues callouts **by name** → ships via the raw-block reparser **without any keystone/editor change**.
- **Drop cap** — the iconic magazine signal; structurally recognized via `#dropcap`/droplet; the only hard constraint is the permanent Firefox `::first-letter{float}` fallback (C5).
- **`styleToCss`** for the typographic subset (colors/fonts/scale/headings → CSS vars), ~2–3 days mirroring `emitCoreRules`.
- **Gate:** if this slice isn't *genuinely* design-faithful, **stop** — the rest isn't worth the editor risk. (Honors the "no text-with-holes" rule.)

**✅ Phase B status (2026-06-29, branch `feat/web-export`).** All four sub-parts done, `tsc` + `electron-vite build` + a 52-assertion smoke test ([scripts/html-export-test.mts](../scripts/html-export-test.mts)) + the 37/37 round-trip all green.
- **B.0 — agnostic output model:** `serializeHtml` gained `mode: 'fragment' | 'document'` + `ArticleMeta` (head + Open-Graph tags). "Maximal portabel" chosen (René): emit both, plus a neutral `meta.json`, plus an opt-in data-URI inline mode (§7.2).
- **B.1 — [styleToCss.ts](../src/shared/styleToCss.ts):** tokens → CSS custom props + element rules scoped under `.pw-article` (per-selector prefixing, leak-guarded; `@scope` opt-in). Print→web translations: reading-measure not paper, ratio-scaled headings, leading→line-height; print-only layout fields + `custom.preamble` skipped.
- **B.2 — drop cap + callout:** a small raw-block reparser ([htmlSerializer.ts](../src/shared/htmlSerializer.ts)) recognises `#dropcap`/`#lead` → `.pw-dropcap` and gentle-clues `#info`/`#warning`/… → `.pw-callout` (with a minimal inline-Typst→HTML for the bodies), plus the CSS (initial-letter + the **permanent Firefox `::first-letter` float fallback**; color-mix callout tint). Verified on the shipped `07-design-showcase` (drop cap + 4 callouts, bodies intact).
- **B.3 — [webExport.ts](../src/main/webExport.ts) + `runWebExport` + menu:** an electron-free bundle writer (`index.html` + `fragment.html` + `meta.json` + `assets/`, asset copy/rewrite or data-URI inline) wired through `importExport.ts` → File ▸ **Export to Web (HTML)…** (i18n en/de). **Validated on the real LANGSAM feature chapter:** drop cap, prose, inline `#emph`→`<em>`, footnotes, and the accent token all render; the 5 macro constructs still pending the keystone (opener/pull/bildtafel/interlude) emit non-visible placeholders — the expected slice fidelity.
- **Next (Phase C — the keystone):** turn opener/pull/frage/notiz/bildtafel/randnotiz + `#columns` into real AST nodes so they stop being placeholders. Also still TODO: math via the Typst→SVG hook, the ExportDialog chapter-selection + inline-assets UI (the menu entry exports the whole document for now), and the `@scope` enhancement pass.

### Phase C — The keystone · ~1.5–2.5 weeks · *highest regression risk · post-launch, isolated*
Turn the load-bearing macros (`lead/pull/frage/notiz/bildtafel/randnotiz` + `#columns`) into **named TipTap nodes** (~7 nodes, ~100–250 LOC each; copy the `TypstFootnote`/`TypstReference` pattern). The under-estimated parts:
- **Compile-stable round-trip** (C9): serializer re-emits Typst that compiles to an **identical PDF**; gate behind an **automated test** (parse N real LANGSAM chapters → nodes → serialize → assert identical compiled-PDF hash + preserved labels). Budget ~2–3 days for this proof alone. **Don't merge until green on real docs.**
- **Recognition:** **hybrid** — marker-comment (strategy A) for Penwright-*generated* nodes + name-heuristic (B) as the legacy-content fallback (existing user macros have no markers). The recognizer must run **before** the `isRawBlock` `//` check.
- **UI affordances:** slash commands / `＋`-menu entries (one `getCommands()` entry each → both surfaces).
- Pays off 3× (PDF stable, DOCX stops dropping/losing styling, magazine chapters become real WYSIWYG).

**✅ Phase C status (2026-06-30, branch `feat/web-export`).** Done + verified end-to-end; `tsc` + `electron-vite build` + `esbuild.mcp` clean; **4 test suites green: roundtrip 70/70, html 83/83, docx 15/15, compile-stability 30/30.**
- **9 nodes** in [typstMagazine.ts](../src/editor/lib/typstMagazine.ts), registered in `editor.ts`: `articleHeader` (← opener, **atom**), `interlude` (**atom**), `marginNote` (← randnotiz, **inline atom** — it sits mid-sentence, like footnote), and **6 content nodes** (the codebase's first) — `dropCap`/`question`/`pullQuote` (`inline*`) + `callout`/`figurePanel`/`columns` (`block+`). (No standalone `kicker` node — it's an `opener` field. `aufmacher`/`doppelseite`/cover stay raw → Phase E.)
- **Deserializer** ([deserializer.ts](../src/editor/lib/deserializer.ts)): `parseMagazineMacro` runs at step **7.8, before `isRawBlock`** (marker-tolerant: strips a leading `// penwright:node=…`; dispatch by macro name); `#columns`/`#notiz`/`#bildtafel` bodies are **recursively re-parsed into real child nodes** (`parseBlocks`); `#randnotiz` added as an inline construct; a small Typst-args parser (`parseTypstArgs` / `matchTypstParens`) handles `#bildtafel`'s mixed positional+named+content args.
- **Serializer** ([serializer.ts](../src/editor/lib/serializer.ts)): one re-emit case per node (exact `#macro(…)` call) → **compile-stable** (NOT byte-identical, per C9).
- **HTML** ([htmlSerializer.ts](../src/shared/htmlSerializer.ts) + [styleToCss.ts](../src/shared/styleToCss.ts)): semantic `nodeMapping` for all 9 + scoped `.pw-*` CSS (opener/pull/question/figure-panel/margin-note/interlude + responsive `column-count: var(--pw-cols)`). The 5 ex-placeholder constructs now render real HTML.
- **DOCX** ([docxSerializer.ts](../src/shared/docxSerializer.ts)): `convertNode` cases for all 9 (opener title → Heading 1; callout → shaded box; marginNote → footnote). **`#columns` is now an AST node → never reaches `classifyRawBlock`, so the silent-drop (B1) is fixed structurally** + a `handleInlineFunc` safety net keeps any *remaining* raw-block nested-macro content. `MCP_SETUP_VERSION` 0.14.0 → **0.15.0**.
- **Two pre-existing bugs surfaced by the compile-stability test, fixed:** (1) `#text(weight: "bold")[…]` (no `fill:`) was mis-serialized to a broken `#text(fill: )[…]` — `extractArgAndBracket` now returns null when the key is absent → the block stays raw/verbatim; whole-block multi-arg `#text(…)[…]` styling → raw (preserves size/style/font). (2) Typst forced line breaks (trailing `\`) were collapsed to spaces — now round-trip as `hardBreak` nodes (also fixes editor Shift+Enter, which previously emitted a soft break).
- **Acceptance gate (§6.2) met on the real artifact:** [compile-stability-test.mts](../scripts/compile-stability-test.mts) compiles ORIGINAL vs ROUND-TRIPPED LANGSAM chapters with the same bundled Typst (in-run PNG-pixel comparison — robust vs. the recon's fragile stored-SHA-baseline idea) → **all 6 chapters pixel-identical** + no unknown-label warnings.
- **UI:** 9 slash-command / ＋-menu entries (`getCommands()`, en+de i18n); editor CSS (terracotta accent); click-to-edit popups for the two atoms (`articleHeader`, `marginNote`). Content-node bodies edit inline.
- **✅ Generic `#grid` two-up (decision §7.4 — DONE, René chose to build it):** the interview's ad-hoc `#grid(columns:(1fr,0.78fr))[…]` head (the "Zur Person" box + Q&A + portrait) is now **reinterpreted for export** by [typstGrid.ts](../src/shared/typstGrid.ts) (`parseTypstGrid` — a pure parser that extracts each cell's renderable content: `frage`→question, `block(...)`→titled box, `image`, `text`→caption, bare `[…]`→prose; tolerates the leading `// Kopf:` comment + code-mode `{…}` cells). HTML → a responsive `.pw-grid` (CSS-grid that collapses to one column under 44rem); DOCX → the cells stacked linearly. **Crucially this is EXPORT-ONLY: the grid stays a verbatim `typstRawBlock` in the editor + PDF**, so the compiled page is still pixel-identical (turning it into an editor node would re-emit a normalised form and break compile-stability — the cells are hand-tuned `block`-inset/`#v()` layout). Verified: html-export +7 asserts, docx +4 asserts (interview-head box/questions/answers/image all survive), compile-stability still 30/30.

### Phase D — Breadth on the structured nodes · ~5–7 days
Extend `serializeHtml` + `styleToCss` + magazine CSS to the rest: **columns** (`column-width`, responsive by default, no media query), **pull-quotes** (`float`+`shape-outside`, full-width on mobile), **margin notes** (grid side-column collapsing under ~50rem — grid is the floor, C6), **question/Q&A**, **figure panels**, **section overlays** → scoped CSS (class-prefix floor + `@scope` enhancement, C7). Port the rest of `classifyRawBlock`/`renderRawBlock`/`parseInlineTypst` for leftover raw blocks. Reuse `buildExportContext` (cross-refs/citations/footnotes/bibliography). **Math via the existing Typst→SVG hook + MathML/aria — no KaTeX** (C8).

### Phase E — Polish + real-document hardening · ~5–7 days
Print-only re-design (`aufmacher`/`doppelseite`/cover → hero/article-header, **never** `#place`→CSS). Full LANGSAM sweep — **note the shipped `sample-project` does *not* exercise `lead/pull/frage/…`** (it uses droplet/wrap-it/gentle-clues), so **a LANGSAM export is the only real proof**; expect 20–30 % of this phase to be field fixes. `custom.preamble` strip-with-warning (C4). Per-article theming + frontmatter (`title/date/summary/tags/locale/cover/accent`).

### Effort summary
| | Original plan | Verified |
|---|---|---|
| Bug fixes (Phase 0) | ½ day | **~1 day** (B1 + B2) |
| Pre-keystone (A + B) | — | **~2 weeks** (shippable narrow slice) |
| Keystone (C) | ~1 week | **1.5–2.5 weeks** |
| Web build (D + E) | ~2–2.5 weeks | **~2–2.5 weeks** |
| **All-in (design-faithful v1)** | **3–4 weeks** | **~6–7 weeks** |

---

## 5. Explicitly cut from v1 (and why)
- **The keystone as a launch gate** — decouple; it's the highest-regression refactor, founder-motivated, against diffuse demand.
- **Pixel-exact print constructs** — bleed/crop, gutter-crossing spreads, `#place` double pages, fr-spacer covers: re-*designed*, never converted.
- **`custom.preamble` translation** — arbitrary Typst can't run on the web. Strip + warn.
- **KaTeX dependency** — math via the bundled Typst binary (SVG) / Typst-0.15 MathML.
- **Per-element website components & API/git coupling** — output stays a self-contained bundle; only the **frontmatter** is a cross-repo contract. One-click publish via `simple-git` is a later nicety.
- **`@scope` as the floor, Anchor Positioning, MathML-as-sole-renderer** — all enhancements; grid / class-prefix / inline-SVG are the floors.

## 6. Hard gates (write these down before building)
1. **No half-faithful export ships.** The Phase-B slice either looks genuinely faithful or the feature waits.
2. **Compile-stability, not byte-stability.** Acceptance = identical compiled PDF + preserved cross-ref labels, enforced by an automated test on **real** LANGSAM chapters.
3. **Kill-criterion.** If Typst's HTML backend reaches production magazine fidelity first, **abandon the bespoke serializer and wrap Typst's backend** instead.

## 7. Open decisions for René
1. **Timing:** ~~decouple~~ → **DECIDED 2026-06-29: build pre-launch.** Fixes first (§3), then the full Editorial Web Pack, then launch. The release is intentionally delayed ~6–7 weeks so "print + web" is the launch story. (Research had recommended decoupling for lower risk; René chose pre-launch for the stronger launch narrative.)
2. **Output model — DECIDED 2026-06-29: framework-agnostic & self-contained.** Pure `.html` (MDX rejected — raw `<style>` breaks the JSX/Acorn parser). The export makes **no assumptions about the consumer**; `show-your-work` (Astro) is just one of many. Three layers: (a) self-contained `<article class="pw-article">` + scoped `<style>` (`.pw-article` prefix floor + optional `@scope`) → embeds into any host without CSS collision; (b) two output **modes** — `fragment` (embed into an existing page/CMS) and `document` (standalone-hostable file); (c) **neutral metadata** as a generic `meta.json` (`title/description/date/tags/cover/accent`), *not* one CMS's frontmatter schema, plus the `--pw-*` token theming seam (host may override, needn't). Assets: `<slug>/index.html` + `assets/` (relative) with an opt-in **data-URI inline** mode for a single paste-able file, and a configurable `assetBasePath`. This *removes* the original plan's Astro-frontmatter coupling — the cross-repo "contract" shrinks to "embed the fragment + read generic `meta.json`". `serializeHtml(doc, opts)` carries `{ mode, assets, metadata, scope }`.
3. **Recognition strategy:** ~~hybrid vs. marker-only~~ → **DECIDED 2026-06-30: hybrid** (marker `// penwright:node=…` tolerated, dispatch by name; markers not emitted so the LANGSAM round-trip stays clean).
4. **Scope of the keystone:** ~~7 nodes only, or also generic `#grid`~~ → **DECIDED 2026-06-30: both** (9 magazine nodes **+** the generic `#grid` two-up, reinterpreted for export — see Phase C status). Done + verified.

---

### Source pointers
- Code: [docxSerializer.ts](../src/shared/docxSerializer.ts) (blueprint; `SKIP_LEADERS` :1492), [styleParser.ts](../src/shared/styleParser.ts) (`emitCoreRules` → `styleToCss` source), [styleTypes.ts](../src/shared/styleTypes.ts) (`ProjectStyle`), [deserializer.ts](../src/editor/lib/deserializer.ts) + [serializer.ts](../src/editor/lib/serializer.ts) (keystone + B2), [importExport.ts](../src/main/importExport.ts) (`export:web` branch), `src/mcp/server.ts` (`penwright_export_web`).
- Artifact: `~/Desktop/LANGSAM` — `macros.typ`, `style.typ`, `chapters/` (interview = the hard case).
- Web (2026): Typst HTML status (docs + blog 0.13/0.14/0.15 + issue #5512), `@tiptap/static-renderer` (npm/tiptap docs), MDX/Astro `set:html`, caniuse `initial-letter`/`@scope`/`color-mix`/anchor-positioning, Quarto, Beehiiv/Substack/Ghost, COPE/Slow-Media signals.
