# Handoff: Start Phase A of the Design Editor

> Drop this into a fresh Claude Code chat to pick up where the previous session left off. The reader is a Claude that has no memory of recent work — give it enough context to act, then point it at the task.

---

## What you're working on

vswrite Desktop is a project-first WYSIWYG editor for Typst documents (Electron 41 + Svelte 5 + TipTap, MCP server included). It was originally aimed at academic writing; in Session 19 (2026-05-16) it pivoted to also being a **design tool for arbitrary PDF outputs** — brochures, magazines, CVs, posters, marketing. v1.0 release is paused on this pivot, which delays the launch by ~6 weeks but reframes the product.

Your job in this new chat is to start **Phase A — Style Variables** from [design-editor-plan.md](design-editor-plan.md). This is the foundation layer for the visual design editor: a structured `style.json` schema with bidirectional sync to Typst preamble code, plus a settings-dialog extension that exposes the core knobs (colors, fonts, scale, layout) without requiring the user to write Typst.

---

## Read these documents, in this order

The previous chat ran 20 sessions. Most of it is already shipped. You only need to load the strategic context plus the Phase A spec; everything else you can skim or grep on demand.

1. **[design-editor-plan.md](design-editor-plan.md)** — start here. Phase A is your immediate task; Phases B, C, D are downstream. Read all four phase sections so you understand where Phase A sits in the bigger picture.
2. **[third-party-licensing.md](third-party-licensing.md)** — the bundling infrastructure that ships in v1.0 (Session 20). Tells you which Typst packages are available offline. Phase A doesn't directly use them, but you should know what's there because Phase B (Visual Editor) will lean on them heavily and Phase A's preamble generator should not assume packages are missing.
3. **[../CLAUDE.md](../CLAUDE.md)** — codebase architecture reference. Read top to bottom once. Especially: Process Model, IPC Communication, the Four Persistence Layers, the Action-Discovery split (toolbar vs slash vs menu), and the Cross-Component Triggers via `window` Custom Events.
4. **[next-steps.md](next-steps.md)** — Phase 3.5 has the checklist for Phase A's sub-tasks. Other phases are launch infrastructure (DMG signing, Firebase, Netlify).
5. **[project_status.md](project_status.md)** — sessions 17–20 are the recent context (zoom, MCP wizard, writing-style skill, package bundling). Skim these so you know what just shipped.

**Skip unless relevant to a specific question:**
- `handbuch.md` / `handbook.md` — end-user handbooks, only relevant if the user asks about UX wording
- `mcp-server.md` — MCP server tool reference, only relevant if you're touching the MCP server
- `done/` — archived plans, not active

---

## What was just shipped (Sessions 17–20, 2026-05-15 to 2026-05-17)

So you don't accidentally re-do or assume something doesn't exist:

- **Session 17 (Document Zoom):** per-project editor + PDF zoom (50–200%), CSS `zoom: var(--editor-zoom)` on `.editor` (Chromium reflows correctly, ProseMirror selection stays accurate), pdfjs viewport-scale for PDF, status-bar popover + PDF-header controls, persisted in `.vswrite/preferences.json`. Always-visible scrollbars.
- **Session 18 (MCP Auto-Discover Wizard):** Bun-compiled standalone MCP binary (~64 MB), `mcpSetup.ts` copies it to `~/Library/Application Support/vswrite/mcp-server/` and writes a `vswrite` entry to Claude Desktop's `claude_desktop_config.json` with `VSWRITE_LICENSE_KEY` env. Decoupled from the running app — quitting vswrite doesn't kill the MCP child.
- **Session 19 (Writing-Style Skill):** 4th project skill alongside typst / vswrite / research. Four sections: Anti-AI-Tells, Active Prose, Academic Conventions, **Source Discipline** (anti-hallucination — never invent citations / BibTeX / quotes). Bilingual EN+DE. Exposed as MCP prompt `writing-style`.
- **Session 20 (Typst-Package Bundling — THE MOST RECENT):** 24 packages live under `resources/typst-packages/preview/` (13 user-facing + 11 transitive deps). `scripts/fetch-typst-packages.mjs` pulls from `packages.typst.org`, `scripts/audit-bundled-deps.mjs` classifies licenses, emits `THIRD_PARTY_LICENSES.md` + `bundle-licenses.json`. About-Dialog has an "Open Source Lizenzen" button → `AcknowledgmentsDialog.svelte`. Both the main Typst-compiler and the MCP server pass `--package-path` so the bundled packages resolve offline.

The skill content (`src/shared/skillTemplates.ts`) was updated in Session 20 to include the bundled packages with usage examples. TYPST_SKILL has a full per-package reference; VSWRITE_SKILL has a category summary pointing to the typst skill.

---

## What you'll build (Phase A — Style Variables, ~1 week)

The intent: take the structured "core style knobs" out of the document settings dialog and represent them as JSON, so future phases (visual editor, MCP design-tools) have a typed surface to manipulate.

### Concrete sub-tasks (from [next-steps.md](next-steps.md) Phase 3.5 → "Phase A — Style Variables")

1. **`<project>/.vswrite/style.json` schema** — define the shape, implement read/write helpers in `src/main/persistenceManager.ts` (mirroring the existing `getProjectPreferences` / `saveProjectPreferences` pattern from Session 17).
2. **`src/shared/styleParser.ts`** — JSON ↔ Typst-preamble round-trip. The interesting bit: an existing project's `main.typ` may have hand-rolled `#set` blocks. Round-trip should detect that and either:
   - Parse what it can into the JSON model
   - Surface a warning ("style.typ contains manual overrides, saving will reformat") so the user can opt in / out
   The minimum-viable approach for v1.0 is: new projects start with this structure; old projects can migrate (one-time button or auto-migrate on settings-save).
3. **`SettingsPanel.svelte` extension** — new "Style" section with:
   - Color-Picker (Hex + HSL) for 5 color slots (primary, accent, text, background, muted)
   - Font dropdowns (system fonts) for body / heading / code
   - Numeric inputs for base font-size and leading
   - Paper-size dropdown + margin picker
4. **Live-preview pipeline integration** — debounced recompile (300 ms) so users see their changes in the PDF panel. Reuse the existing `typstCompiler.ts` infrastructure.
5. **Round-trip tests** — JSON → Typst → JSON should be lossless for the canonical-shape case.

### Data-model proposal (start here, refine as needed)

```json
{
  "version": "1",
  "colors": {
    "primary": "#0f172a",
    "accent": "#3b82f6",
    "text": "#1a1a1a",
    "background": "#ffffff",
    "muted": "#6b7280"
  },
  "fonts": {
    "body": "Inter",
    "heading": "Inter",
    "code": "JetBrains Mono"
  },
  "scale": {
    "base": "11pt",
    "leading": "1.5"
  },
  "layout": {
    "paper": "a4",
    "margin": "2.5cm",
    "columns": 1
  },
  "headings": {
    "h1": { "size": "24pt", "weight": "700", "color": "primary", "marginTop": "2em" },
    "h2": { "size": "18pt", "weight": "600", "color": "primary", "marginTop": "1.6em" }
  }
}
```

The generator writes a `style.typ` (or a top-of-`main.typ` block) with `#set page(...)`, `#set text(...)`, `#set par(...)`, `#show heading.where(level: 1): ...` blocks derived from this object. Use the **bundled Typst packages** when they help: `showybox` for callout-style overrides, `cetz` etc. — but core typesetting stays in plain `#set` blocks.

### Out of scope for Phase A

These belong to later phases — don't expand:

- Color palette tool / image-color-extraction (Phase B)
- Font browser with previews (Phase B)
- Per-section style overrides like cover-page-differs (Phase B)
- Special-element styling (blockquote / table / code-block) (Phase B)
- Design MCP tools (Phase C)
- Design skill (Phase D)

If you find yourself wanting to build a visual font-browser or palette tool, stop — that's Phase B. Phase A's UI is a plain dropdown + color picker, nothing fancy. The fancy stuff happens once the data layer is solid.

---

## Critical conventions you must follow

These are landmines that previous sessions hit and documented. Don't re-trip them.

### Persistence

- **Four independent project-local persistence layers.** Don't mix them. Style settings extend the existing `.vswrite/preferences.json` pattern, OR get their own `.vswrite/style.json` — your call, but document the choice. The other three (Git versions, auto-backups, AI-edit-snapshots) are not where style goes.
- Never edit `appState.projectDir` etc. directly — go through `openProject()` / `closeProject()` from `fileManager.ts`.

### Typst compilation

- **Use `buildTypstCompileArgs()` from `typstPath.ts`** for every `typst compile` call. It prepends `--package-path` so bundled packages resolve. Same for the MCP server's `typstCompileArgs()`.
- **Never call `'typst'` directly.** Always `getTypstPath()`.
- The bundled Typst CLI is 0.14.2; `--package-path` is a positional flag *after* `compile`, not before.

### IPC

- Every new IPC channel must be added to `INVOKE_CHANNELS` in `src/main/preload-entry.ts`. Channel groups: `persist:*`, `project:*`, `style:*` (if you create a new group).
- Renderer-side, prefer the existing patterns in `appState.svelte.ts` for state and `messageHandler.ts` for menu-driven actions. Cross-component triggers go through `window` Custom Events (see `vswrite:add-comment` etc. for the pattern).

### Svelte 5

- This codebase uses **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`). Don't mix with Svelte 4 stores.
- Cross-module `$state` works (see `appState.svelte.ts` — `panelState`, `zoomState`).
- After editing `.svelte` files, the dev server auto-HMRs. After editing `.svelte.ts` files, HMR can be flaky — restart the dev server if reactivity stops working.

### Editor zoom (just shipped, don't break)

- CSS `zoom: var(--editor-zoom)` on `.editor` works because Chromium reflows correctly. Don't switch to `transform: scale()` — that breaks ProseMirror's `coordsAtPos()` and the click coordinates are wrong.

### Skills

- Edit `src/shared/skillTemplates.ts` for skill content. The MCP server re-reads `.claude/skills/<name>/SKILL.md` at prompt time, so the deployed copy in user projects is the truth at runtime. `projectManager.ensureClaudeSkills()` uses a per-file guard (writes only when missing) — existing projects don't auto-upgrade their skills. Don't rely on that.
- After modifying a skill, **rebuild the MCP binary**: `node scripts/build-mcp-binary.mjs`. The Bun-compiled binary embeds the skill strings.

### Tests / build

- No test framework configured for the renderer / main process. Verify with `npm run build` (electron-vite) + `npx svelte-check --threshold error`.
- 4 pre-existing svelte-check errors (pdfjs typings + CSS module imports) are noise — ignore them as long as your additions don't add new errors.
- For dev work: `unset ELECTRON_RUN_AS_NODE && npm run dev`. The `unset` prefix is mandatory when running from a VS Code / Cursor terminal (already in the npm scripts, but you may copy-paste commands manually).

### Git workflow

- Worktree branch is `claude/<id>`, tracks `origin/main`. Push directly to main via `git push origin HEAD:main` when ready. Don't force-push, don't amend committed history.
- Recent commit style: imperative present, no Conventional-Commits prefixes, single concise headline + bullet-point body. See the last 5 commits with `git log --oneline -5`.

---

## How to verify you're starting from a clean state

Run these and check the output matches:

```bash
cd "/Users/renejesser/Desktop/Programming - Projekte/vswrite-desktop/.claude/worktrees/modest-driscoll-a7a45f"
git status                            # should be clean (or only your new work)
git log -1 --oneline                  # latest commit: "Bundle 24 Typst packages, audit pipeline, acknowledgments dialog"
node scripts/audit-bundled-deps.mjs   # exits 0 with "24 packages, all licenses bundleable"
unset ELECTRON_RUN_AS_NODE && npm run build  # exits 0 with the renderer chunks written
```

If `audit-bundled-deps` complains about a missing LICENSE or `bundle-licenses.json`, run `node scripts/fetch-typst-packages.mjs` first to repopulate `resources/typst-packages/`.

If you ever need to test the Typst CLI's bundled-package resolution from the command line:

```bash
"./resources/bin/typst-arm64-darwin" compile \
  --package-path "./resources/typst-packages" \
  <some-test.typ> <output.pdf>
```

---

## Strategic context (so you make the right design calls)

vswrite has three distinct audiences served by the same tool. Phase A needs to work for all three without giving any of them a worse experience:

1. **Akademiker** (current core) — writes theses, papers, books. Cares about consistent typography across 100+ pages, reliable Bibliographie, footnotes, cross-references. Phase A's Style settings let them switch from "Modern Clean" to "Classic Academic" without copy-pasting preamble blocks.
2. **Editorial/Marketing** (new with the pivot) — writes brochures, reports, magazines. Cares about visual identity (brand colors, custom fonts, hero spreads, callouts). Phase A is the entry point; Phase B is where they actually live.
3. **AI-driven users via MCP** (cross-cutting) — Claude Desktop drives the document via 43+ MCP tools. Phase C will add design-specific MCP tools (`vswrite_apply_palette`, `vswrite_update_style`, `vswrite_generate_layout`), but those need Phase A's structured JSON shape to talk to.

Concrete consequence for Phase A decisions:
- Color slots use semantic names (`primary`, `accent`, `text`, `background`, `muted`), not arbitrary slots — Phase C's `apply_palette` MCP tool needs known slot names to map a palette intelligently.
- Font choices are System-fonts only in Phase A — Google-Fonts integration is Phase B (legal + license-strategy decision needed first).
- Pre-Submission-Audit and Source-Discipline rules from the `writing-style` skill still apply when the user is in academic mode. Design users won't trigger this, but Phase A shouldn't hide academic settings behind a "design mode" toggle — both worlds use the same Settings panel.

---

## When you're done with Phase A

Verify before declaring done:

- [ ] A fresh project has a `.vswrite/style.json` after first save
- [ ] Changing a color slot in the Settings panel re-compiles the preview within ~300 ms
- [ ] Round-trip: open project → modify style.json by hand → open Settings panel → values match → save → file is identical
- [ ] An existing project (pre-Phase-A) opens without errors — either migrated automatically or with a clear "migrate" prompt
- [ ] `npm run build` is clean (no new svelte-check errors)
- [ ] Existing zoom + comments + cross-references still work (regression check)

Then update `documentation/project_status.md` with a Session 21 entry, mark Phase A's checklist items in `next-steps.md`, and commit + push.

After Phase A is green, **stop and check in with the user**. Phase B is the big chunk (~3–4 weeks) and you'll want product-direction calls on:
- Which color picker library (or build inline)
- Whether to ship Google-Fonts integration in Phase B or defer to v1.1
- Cover-Page-builder UX scope

Good luck.
