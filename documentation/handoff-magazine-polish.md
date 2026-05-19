# Handoff: Magazine Polish Pack

> Drop this into a fresh Claude Code chat to pick up the magazine-polish work. The reader is a Claude that has no memory of previous sessions — give it enough context to act, then point it at the plan.

---

## What you're working on

vswrite Desktop is a project-first WYSIWYG editor for Typst documents (Electron 41 + Svelte 5 + TipTap, MCP server). The design editor (Phases A–D) shipped in Session 22 (2026-05-17). Themes / palettes / layouts / 6 design elements / 9 MCP design tools / a `design-conventions` skill — all live.

Your job in this new chat is to add **nine more building blocks** so vswrite can produce editorial-magazine-quality output (think Neues Lernen / Haufe, or The Local Project). The exact list, with element IDs, schema additions, file paths, and template Typst, lives in [magazine-polish-plan.md](magazine-polish-plan.md).

The output is ~100 % AI-driven (Claude Desktop via MCP) — the human user told us they don't compose by hand. So the bar is "give the AI enough Lego blocks to compose magazine pages". Each new block is a named element with documented params; the AI assembles them via `vswrite_insert_design_element`.

---

## Read these documents, in this order

1. **[magazine-polish-plan.md](magazine-polish-plan.md)** — your immediate task. Spells out all nine features in implementation order, with per-feature: user-facing call signature, element template, schema changes, conditional sub-blocks for `renderDesignElement`, skill updates, sample-project touches. Implementation reads off this doc line by line.
2. **[../CLAUDE.md](../CLAUDE.md)** — codebase architecture reference. Especially: the **Style** persistence layer (around line 140) which now mentions the design tools + theme presets + element library + DESIGN_SKILL. Read top to bottom once.
3. **[project_status.md](project_status.md)** — Sessions 17–22 are recent context. Session 22 has the multi-commit history that got us to the current state.
4. **[done/design-editor-plan.md](done/design-editor-plan.md)** — strategic context for *why* the design editor exists at all. Skim Phases A–D so you understand the surface you're extending.
5. **[mcp-server.md](mcp-server.md)** — the 52 MCP tools. Especially the **Design (11)** block. No new tools needed for this work, just new entries in the design-element library and layout-preset list.

**Skip unless relevant to a specific question:**
- `handbook.md` / `handbuch.md` — end-user docs, only relevant if you're adjusting wording
- `done/` — archived plans, not active

---

## What was just shipped (Session 22, 2026-05-17)

So you don't re-do or assume something doesn't exist:

- **Design panel** (Sidebar tab "Design"): Colors / Palette presets / Themes / Layout presets / Fonts / Scale / Layout / Headings (H1–H6 collapsible cards) / Elements (Blockquote / Code-Block / Figure / Table) / Custom Typst-Code (CodeMirror)
- **6 theme presets** in `src/shared/themePresets.ts`: classic-academic, modern-tech, editorial-magazine, minimal, marketing-brochure, thesis
- **6 layout presets** in `src/shared/layoutPresets.ts`: a4-portrait-standard, a4-landscape-presentation, magazine-2col, newsletter-3col, a5-booklet, a2-poster
- **6 design elements** in `src/shared/designElements.ts`: banner, sidebar, pull-quote, callout, hero, divider — you'll be adding 9 more
- **8 palette presets** in `src/shared/palettePresets.ts` (color-only)
- **9 MCP design tools**: get_style / update_style / list_styles / apply_style / list_layouts / apply_layout / list_fonts / apply_palette / list_design_elements / insert_design_element / generate_layout
- **`#show: apply-style`** generator pattern (NOT `#include "style.typ"` — that was a Phase-A bug). `style.typ` exports `style-colors` at module level + `apply-style(body)` function. `main.typ` does `#import "style.typ": *` + `#show: apply-style`.
- **`vswrite_compile`** returns `{ success, rootFile, sizeBytes?, errors, warnings }` with file/line and Typst hints — use it after every non-trivial edit
- **DESIGN_SKILL** (5th project skill) — color theory / typography pairing / heading hierarchy / layout patterns / anti-patterns / workflow recipe

---

## Critical conventions

Most of these come from earlier sessions, written up properly in CLAUDE.md. The ones most relevant to your work:

### Design element rendering

- `src/shared/designElements.ts` exports `DESIGN_ELEMENTS: DesignElement[]` and `renderDesignElement(element, params)`.
- Each element has a `template` string with `{name}` placeholders for each param. Conditional sub-blocks (optional fields that produce extra markup when present) live in the `conditionals` map inside `renderDesignElement`'s switch.
- New elements: append to `DESIGN_ELEMENTS`. If you add conditional sub-blocks, extend the `conditionals` map with a matching id.
- Element templates reference `style-colors.*` (already in scope thanks to `#import "style.typ": *`) and SHOULD reference `style-fonts.*` once you've added that export (see plan, cross-cutting changes).

### Generator (`src/shared/styleParser.ts`)

- `generateStyleTypst(style)` emits a module-level `#let style-colors = (…)` followed by `#let apply-style(body) = { … body }`. **Plan item: add `#let style-fonts = (…)` between them**, so design elements can re-theme typography automatically.
- The custom-preamble fenced block sits inside `apply-style`'s body. Don't move it.
- Don't break `ensureStyleInclude` — it's responsible for the `#import "style.typ": *` + `#show: apply-style` two-liner at the top of root files, and migrates legacy `#include "style.typ"` projects.

### Schema (`src/shared/styleTypes.ts`)

- One schema add this round: `StyleFigure.creditSeparator` + `StyleFigure.creditLabel`. Both `pickFreeString`, ~16 char cap.
- Update the sanitizer's `sanitizeFigure(raw, fallback)` accordingly.
- Update the defaults block (`DEFAULT_PROJECT_STYLE.elements.figure`) with sensible values (e.g. ` — `, `Photo: `).
- DesignPanel UI: extend the Figure card under Elements section with the two new fields.

### Layout presets (`src/shared/layoutPresets.ts`)

- New entry: `magazine-editorial`. Note the `pageHeader` is a Typst markup string — references like `style-colors.muted` ARE in scope inside `apply-style`, so they work as expected.

### Skill template (`src/shared/skillTemplates.ts`)

- Five skill string constants (`TYPST_SKILL` / `VSWRITE_SKILL` / `RESEARCH_SKILL` / `WRITING_STYLE_SKILL` / `DESIGN_SKILL`). Uses tilde fences (`~~~`) inside template literals to avoid backtick escapes — keep that.
- The MCP server reads `.claude/skills/<slug>/SKILL.md` at prompt time, not the templates directly. The templates are deployed per-project on project creation via `ensureClaudeSkills` in `src/main/projectManager.ts`. **Existing projects do NOT auto-upgrade their skill files** — only newly-created projects pick up changes. Document this if it matters for testing.
- After modifying a skill, **rebuild the MCP binary** (`node scripts/build-mcp-binary.mjs --all`) — the Bun binary embeds the skill strings.

### Tests / build

- No test framework. Verify with `unset ELECTRON_RUN_AS_NODE && npm run build` + `npx svelte-check --threshold error`.
- 0 pre-existing svelte-check errors (we cleaned them up in Session 22). Don't add new ones.
- Test-compile each new element: write a temp `/tmp/...` typst file that uses the element, compile against bundled fonts/packages:
  ```bash
  ./resources/bin/typst-arm64-darwin compile \
    --package-path ./resources/typst-packages \
    --font-path ./resources/fonts \
    /tmp/test/main.typ /tmp/test/out.pdf
  ```
- For dev work: `unset ELECTRON_RUN_AS_NODE && npm run dev`.

### Git workflow

- Worktree branch is `claude/<id>`, tracks `origin/main`. Push directly: `git push origin HEAD:main`.
- Recent commit style: imperative, no Conventional-Commits prefix, single concise headline + paragraph body explaining the why. See `git log --oneline -10` for examples.
- **One commit per feature.** The plan lists nine — that's nine focused commits + one for MCP-binary-rebuild + one for docs. Don't bundle.

---

## Implementation order

The plan recommends this order — bottom-up so dependencies are in place when needed:

1. Drop Cap (needs `style-fonts` export, which you set up first as part of this commit)
2. Editorial-Divider variants
3. Pull-Quote variants
4. Article-Opener
5. Section-Opener
6. Image-Gallery 2-up / 3-up
7. Photographer-Credit schema extension
8. Magazine-Cover
9. Magazine-Editorial layout preset

After all nine: MCP binary rebuild, MCP_SETUP_VERSION bump (0.6.0 → 0.7.0), then a docs commit (`project_status.md` session entry, `next-steps.md` checkboxes, sample-project chapter 7 extension).

---

## How to verify each commit

1. **Build**: `unset ELECTRON_RUN_AS_NODE && npm run build` exits 0
2. **Type-check**: `npx svelte-check --threshold error` ends "0 ERRORS"
3. **Render**: write `/tmp/feature-test/main.typ` using the new element + compile it via the bundled Typst CLI; eyeball that the PDF was produced and is non-trivial size (>5 KB)
4. **Commit**: focused message, paragraph body explaining the why

If you ever spawn a temp folder under `/tmp/...`, clean it up at the end of the test (`rm -rf /tmp/feature-test`).

---

## When you're done

Verify before declaring done:

- [ ] All 9 element / preset entries exist and compile against the bundled fonts/packages
- [ ] `style-fonts` exported alongside `style-colors` in generated `style.typ`
- [ ] `DesignPanel` still works for all existing functions (open the sample, swap themes, swap layouts, edit a heading card — nothing regresses)
- [ ] `vswrite_list_design_elements` returns 15 entries (up from 6)
- [ ] `vswrite_list_layouts` returns 7 entries (up from 6)
- [ ] `DESIGN_SKILL` + `TYPST_SKILL` + `VSWRITE_SKILL` updated where the plan says
- [ ] `resources/sample-project/chapters/07-design-showcase.typ` extended with showcase examples of each new element
- [ ] `MCP_SETUP_VERSION` bumped + MCP binary rebuilt for both Darwin arches
- [ ] `documentation/project_status.md` has a Session-23 entry summarising the work
- [ ] `documentation/next-steps.md` marks the relevant items as `[x]`
- [ ] Final push to `origin/main`

After that, **stop and check in with the user**. They specifically asked for a plan-driven implementation; the next thing they'll want is to test the new elements in the actual app before any further design work (full-bleed images / marginalia / mosaic grids are explicitly out of scope for this round but on the long list — they'll evaluate after this lands).

Good luck.
