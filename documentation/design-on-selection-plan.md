# Implementation Plan — "Design after writing" (two-level design)

> **Status:** planned, not started. This is the next feature to build.
> **Branch:** start a fresh branch off `main` (e.g. `design-on-selection`).
> **Read this whole doc, then CLAUDE.md, then start at Stage 1.**

---

## 0. The idea (what we're building)

Writing and designing are decoupled in Penwright: you write first, then you say
*how* it should look. Two levels:

- **Level 1 — whole-document design.** You just chat with Claude Desktop:
  *"make this whole document feel like an editorial magazine."* This **already
  works** through the existing MCP design tools (`penwright_get_style`,
  `penwright_apply_style`, `penwright_apply_palette`, `penwright_apply_layout`,
  `penwright_generate_layout`, …). No selection needed. The only work here is
  **framing** (skill + a UI hint) so users know to do it.

- **Level 2 — design a specific spot. ← THIS IS THE NEW WORK.** You select a
  passage, hand it to Claude, and describe the treatment for *that spot*:
  *"make this a pull-quote in the accent colour"*, *"set this region in two
  columns"*, *"pull this sentence out as a margin note"*. The hard part is
  **selection-awareness**: Claude needs to know *what* "this" is.

The flow must be **easy** and the **order must be obvious** to the user.

### Decisions already made (don't re-litigate)
- **Option 1** — the user describes the design **in Claude Desktop**, not in
  Penwright. MCP is pull-only; Penwright can't push a prompt to Claude, so the
  describing surface is Claude. (No embedded LLM / copilot — that breaks the
  one-time-purchase model. A local Penwright-trained model is a possible *future*
  update, explicitly out of scope here.)
- **Pin, not live-sync.** Switching to Claude collapses the editor selection, so
  the user **explicitly pins** the selection at the moment of intent. The pin is
  the mechanism that makes the sequence visible.
- **The Design sidebar tab is the hub.** Everything design-related (manual
  controls + the AI handoff card) lives in one place. The *only* thing in the
  editor is the lightweight pin trigger (the selection originates there).
- **Nothing auto-fires.** The hub card shows the buttons (Copy starter prompt /
  Open Claude); the user clicks them when ready. No auto-copy, no auto-launch.
- **Claude always gets design context** so it decides in harmony with the
  existing look (theme / palette / fonts / layout / already-used elements).

---

## 1. Architecture

One shared idea: **a pinned selection + its design context, written to a file
the MCP server can read.** Three surfaces touch it:

```
  Editor (renderer)            Design tab (renderer)         Claude Desktop (MCP)
  ─────────────────            ─────────────────────         ────────────────────
  right-click selection   →    shows the pin card       ←    penwright_get_selection
  "✨ Design with Claude"       (preview + context +          reads .penwright/selection.json
        │                       Copy prompt / Open Claude)         │
        ▼                              ▲                           ▼
  writes .penwright/selection.json ────┘                    insert_design_element /
  (text + anchor + design snapshot)                         apply_section_style / raw Typst
                                                            at the pinned anchor
                                                                   │
        file-watcher reloads the edited file  ◄────────────────────┘
        → editor updates, pin clears
```

**The pin file — `.penwright/selection.json`** (single source of truth):

```json
{
  "version": 1,
  "pinnedAt": 1717500000000,
  "file": "chapters/02-feature.typ",
  "selectionText": "The quick brown fox jumps over the lazy dog.",
  "anchorText": "The quick brown fox jumps over the lazy dog.",
  "occurrence": 1,
  "nodeType": "paragraph",
  "context": {
    "theme": "editorial-magazine",
    "palette": { "primary": "#211e1a", "accent": "#a8503a", "text": "#1a1a1a", "background": "#f4f1ec", "muted": "#8a8174" },
    "fonts": { "body": "Crimson Pro", "heading": "Spectral", "code": "JetBrains Mono" },
    "layout": { "paper": "a4", "columns": 1, "orientation": "portrait" },
    "sectionStyle": "feature",
    "usedElements": ["pull-quote", "divider-ornament"]
  }
}
```

- `anchorText` (≤200 chars, whitespace-exact) + `occurrence` is what the existing
  anchor-based MCP tools already consume (`insert_design_element`,
  `insert_reference`, etc.) — so Claude can act with zero offset math.
- `context` is the **design snapshot** Penwright captures at pin time, so
  `get_selection` hands Claude the selection **and** the current look in one pull.

---

## 2. Stage 1 — Selection pin (foundation)

**Goal:** right-click a selection → it's pinned to `.penwright/selection.json`,
and the sidebar flips to the Design tab.

### 2.1 Capture the selection (renderer)
- Model on the existing **`addCommentFromSelection()`** in
  [App.svelte](../src/renderer/App.svelte) (~line 406) — it already does exactly
  the selection→anchor capture we need:
  - `const { from, to } = editor.state.selection`
  - `anchorText = state.doc.textBetween(from, to, ' ', ' ').trim()` (fall back to
    the enclosing block if the selection is collapsed; cap at 200 chars)
  - `occurrence` = count of `anchorText` occurrences up to `rangeStart` in
    `tabState.currentContent` (so duplicate text resolves correctly — the comment
    code computes `indexOf`; extend to an occurrence index)
  - `nodeType` = `editor.state.selection.$from.parent.type.name`
  - `file` = `tabState.currentFile` (project-relative)
- New helper `getSelectionContext()` (put it next to `addCommentFromSelection`,
  or factor a shared `captureSelectionAnchor()` both use).

### 2.2 Capture the design snapshot (renderer or main)
- Read the current `ProjectStyle` (already available via `style:get` IPC /
  `getProjectStyle`). Pull theme id, palette, fonts, layout.columns, the current
  chapter's section style (via `getSectionStyleId` on the file), and a cheap
  scan of the doc for already-used design elements (grep the file's
  `typstRawBlock`s for the snippet markers from `designElements.ts`).

### 2.3 Persist the pin (main)
- Add to [persistenceManager.ts](../src/main/persistenceManager.ts), mirroring
  the `stylePath` / `saveProjectStyle` pattern (~line 593–618):
  ```ts
  function selectionPath(projectDir: string) { return path.join(penwrightDir(projectDir), 'selection.json'); }
  export function saveSelectionPin(projectDir: string, pin: unknown): void { … writeFileSync … }
  export function getSelectionPin(projectDir: string): SelectionPin | null { … }
  export function clearSelectionPin(projectDir: string): void { … unlink … }
  ```
  (Note: the in-repo helper is named `penwrightDir`; it already returns
  `<project>/.penwright`.)
- IPC in [ipcHandlers.ts](../src/main/ipcHandlers.ts): `selection:pin`,
  `selection:get`, `selection:clear`. Add all three to the **preload whitelist**
  ([preload-entry.ts](../src/main/preload-entry.ts) `INVOKE_CHANNELS`).
- `.penwright/selection.json` is already git-ignored (it's under `.penwright/`).

### 2.4 The trigger (main + renderer)
- **Native context menu** — extend the existing handler in
  [index.ts](../src/main/index.ts) (~line 112, `webContents.on('context-menu')`).
  When `params.selectionText` is non-empty, push:
  ```ts
  { label: '✨ Design with Claude', click: () => appState.mainWindow?.webContents.send('penwright', { type: 'designSelection' }) },
  { type: 'separator' },
  ```
- **messageHandler** ([messageHandler.ts](../src/renderer/messageHandler.ts)):
  handle `designSelection` → run the capture (2.1+2.2) → `selection:pin` →
  `panelState.sidebarTab = 'design'` (+ `panelState.showSidebar = true`).
- Also fire a window event `penwright:design-selection` (like
  `penwright:add-comment`) so a future toolbar/button can trigger the same path.

**Stage 1 done = right-click pins + Design tab opens; `selection.json` exists.**

---

## 3. Stage 2 — Design-tab hub card

**Goal:** the Design tab shows the pinned selection, the context Claude will see,
and the (optional) handoff buttons.

In [DesignPanel.svelte](../src/renderer/components/DesignPanel.svelte) — add a
card at the **top**, above the existing "Farbpalette" section (~line 378):

- **When a pin exists** (read via `selection:get` on mount + on a
  `penwright:selection-changed` window event the pin routine dispatches):
  - Preview of `selectionText` (truncated) + `file`.
  - "Claude will also see:" → theme · accent colour · fonts · columns ·
    section style (the `context` digest).
  - `[ Copy starter prompt ]` → clipboard. Template:
    > Design the selection I pinned in Penwright — call `penwright_get_selection`
    > to see the text and the current look. Make it: **<describe here>**. Keep it
    > consistent with the existing theme/palette/layout.
  - `[ Open Claude ]` → existing `mcp:openClaude` IPC (`openClaudeDesktop()`).
  - `[ Unpin ]` → `selection:clear`.
- **When no pin** → hint: *"Select text in the editor, then right-click → Design
  with Claude. For overall design, just chat with Claude."* (This is also where
  **Level 1** gets surfaced.)

- **Result feedback:** when the file-watcher reloads the edited file (Claude
  applied a change), show a toast *"Document updated"* and clear the pin.
  *(Optional stretch: flash the changed region. Hard to pinpoint precisely —
  start with the toast + auto-unpin; don't block Stage 2 on the flash.)*

**Stage 2 done = the hub card works end-to-end on the Penwright side.**

---

## 4. Stage 3 — MCP bridge

**Goal:** Claude can read the pin and design with full context.

In [server.ts](../src/mcp/server.ts):
- New tool **`penwright_get_selection`** — reads `.penwright/selection.json` from
  `state.projectDir` (model on how `get_style` reads `.penwright/style.json`,
  ~line 138). Returns the full pin object, or a clear *"No selection pinned — ask
  the user to right-click a passage → Design with Claude, or design the whole
  document instead"* when the file is absent.
  - The returned `context` already covers the design snapshot. (Optional: a
    separate `penwright_get_design_context` if we want whole-doc context without a
    pin — but `get_style` already serves that, so probably skip.)
- **Manifest:** add the tool to [manifest.template.json](../src/mcp/manifest.template.json).
- **Bump `MCP_SETUP_VERSION`** in [mcpSetup.ts](../src/main/mcpSetup.ts) (binary
  changed → wizard re-deploys; currently `0.10.0`).

**Skill — the behaviour that makes it good** — update `DESIGN_SKILL` in
[skillTemplates.ts](../src/shared/skillTemplates.ts) (deployed as the
`design-conventions` MCP prompt). Add a "Designing on request" workflow:
1. **Whole doc** ("design the document …") → `get_style`, then `apply_style` /
   `apply_palette` / `apply_layout` / `generate_layout`. No selection needed.
2. **A specific spot** ("design the selection / this section …") → **always
   `get_selection` first** to learn the pinned text *and* the current look. Then:
   - wrap/insert with `insert_design_element` at `anchorText`+`occurrence`, **or**
   - write localized Typst directly when no element fits — e.g. a two-column
     region `#columns(2)[ … ]`, a margin note (the bundled `drafting` package),
     a full-bleed image, etc.
   - **Harmonise:** use `style-colors.*` / `style-fonts.*` (never raw hex), match
     the document's density/voice, and don't introduce a *third* divider style if
     `usedElements` already shows one.
   - **Per-element semantics:** a Callout/Opener *contains* the text (the
     paragraph becomes the box); a Pull-Quote usually *duplicates* an excerpt
     (highlight in addition to the body). Decide based on the element.
3. After applying, briefly tell the user what changed (they'll see it reload in
   Penwright).

> Skill prompts are read per-project from `<project>/.claude/skills/design/SKILL.md`.
> Existing projects need the stale file deleted to pick up the change; new
> projects get it automatically via `ensureClaudeSkills`.

**Stage 3 done = "select → right-click → tell Claude → it appears" works.**

---

## 5. Level 1 (whole-document) — what's actually needed

Mostly **already works.** To make it discoverable:
- The Design-tab "no pin" hint (4) mentions it.
- The skill (Stage 3, item 1) frames the two levels explicitly.
- Optional: a one-line note in the handbook's Design section once it ships.

No new tools required for Level 1.

---

## 6. Open decisions for the implementer
- **Localized layout (2-column region etc.):** recommend letting Claude write the
  Typst directly (`#columns(2)[…]`) at the anchor rather than pre-baking every
  variant as a design element — it's more flexible and Claude isn't limited to the
  22 snippets. Add convenience elements later only if a pattern is very common.
- **Occurrence vs. fuzzy anchor:** the comment code uses `indexOf` + a range hint.
  Reuse that resilience (exact → from-hint → global) so the anchor still resolves
  if the user edits nearby before switching to Claude.
- **Pin staleness:** if the user edits the pinned text before Claude acts, the
  anchor may drift. Acceptable for v1 (anchor resolution is fuzzy); consider
  invalidating the pin on large edits later.

---

## 7. Files touched (summary)

| Area | File | Change |
|---|---|---|
| Selection capture | `src/renderer/App.svelte` | `getSelectionContext()` (reuse `addCommentFromSelection` pattern) |
| Pin persistence | `src/main/persistenceManager.ts` | `saveSelectionPin` / `getSelectionPin` / `clearSelectionPin` |
| IPC | `src/main/ipcHandlers.ts` + `src/main/preload-entry.ts` | `selection:pin` / `:get` / `:clear` |
| Trigger | `src/main/index.ts` | "✨ Design with Claude" in the native context menu |
| Routing | `src/renderer/messageHandler.ts` | handle `designSelection` → pin + open Design tab |
| Hub UI | `src/renderer/components/DesignPanel.svelte` | pin card (preview / context / Copy prompt / Open Claude / Unpin) |
| MCP tool | `src/mcp/server.ts` + `src/mcp/manifest.template.json` | `penwright_get_selection` |
| MCP version | `src/main/mcpSetup.ts` | bump `MCP_SETUP_VERSION` |
| Skill | `src/shared/skillTemplates.ts` | `DESIGN_SKILL`: "Designing on request" workflow |

## 8. Verification
- `unset ELECTRON_RUN_AS_NODE && npx electron-vite build` + `node esbuild.mcp.mjs`
  green; manifest valid JSON; `tsc --noEmit -p tsconfig.json` clean on changed files.
- Manual: select → right-click → Design with Claude → card shows pin + context →
  in Claude `penwright_get_selection` returns the pin → Claude applies a treatment
  → editor reloads with the change → pin clears.
