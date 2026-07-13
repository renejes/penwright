# Pre-Launch Code-Audit — Penwright

> **Umsetzungsstand (2026-07-13, gleiche Session):**
> - ✅ **Welle 1 (H1–H8): alle 8 High-Findings behoben** — inkl. adversarialem Review der Fixes (3 Linsen × Verifier), dessen 10 eigene Findings (u.a. Replace-All-Korruption bei selbst-überlappenden Begriffen, `/*` über Text-Run-Grenzen, Cmd+Shift+B↔Blockquote-Kollision → Sidebar jetzt **Cmd+Alt+B**, bodyless-`#link`-Härtung) ebenfalls behoben.
> - ✅ **Welle 2 (Medium #9–#20): alle 12 behoben** (#14 war Teil von H7). Print-Export nutzt für Projekte ohne `style.json` jetzt ein Geometrie-**Overlay** statt Design-Ersetzung (neues electron-freies Modul `src/main/printOverlay.ts`; Margin als Dict — Typst faltet uniforme Dicts zu Skalaren, was `drafting`s `page.margin.keys()` bricht; Margin-Extraktion nimmt das **letzte** `set page(margin:)`).
> - Verifikation: `roundtrip` 76/76 · `compile-stability` 30/30 (LANGSAM pixel-identisch) · `html-export` 230/230 · `docx-magazine` 19/19 · `web-export-proof` sauber · Print-Overlay end-to-end auf LANGSAM (220×307mm, Schnittmarken, Satzspiegel erhalten) · `tsc` + `electron-vite build` sauber. `MCP_SETUP_VERSION` → 0.18.0.
> - ✅ **Sektion 3 (Low #21–#40): alle 20 behoben** (gleiche Session, eigener Commit). Nennenswerte Entscheidungen: Callout-`kind` steuert jetzt die Akzentfarbe (info/note theme-basiert, tip grün, warning amber — keine Glyphen wegen Font-Risiko); nicht darstellbare `#align`-Chunks und Tabellen mit Trailing-Params fallen auf den verbatim Raw-Block-Pfad zurück statt zu korrumpieren; Sidebar-Panels via Preload-Disposer; `documentBaseUri` Typ-Feld auf `uri` angeglichen (beide Sender emittierten das schon).
> - ✅ **Sektion 4 (Dead Code #41–#63): alle 23 umgesetzt** (eigener Commit; jeder Eintrag vor dem Löschen per repo-weitem grep re-verifiziert). 7 npm-Pakete entfernt (node-pty, @xterm/xterm, @xterm/addon-fit, dompurify, @types/dompurify, concurrently, electron-builder-notarize), 4 Orphan-Dateien gelöscht (sourceImporter.ts, esbuild.main/preload.mjs, patch-electron.mjs), tote Exports/Felder in 12 Dateien, tote IPC-Oberfläche (persist:getZoteroBibPath, git:stage/unstage/stageAll/commit/init, 8 unerreichbare Switch-Cases + 7 Message-Typen). Nach dem H5-Refactor zusätzlich tot gewordene DOCX-Imports (splitHeadingLabel, renderEqNumber, collectCitekeysInOrder, NUMERIC_BIB_STYLES) mit entfernt. Bewusst behalten: saveZoteroBibPath (write-only, künftiger Watcher-Resume), marked + @melloware/coloris (aktiv genutzt), react/react-dom (tiptap static-renderer).
> - ⏳ Offen: Sektionen **5 (Duplikation)**, **6 (Plausible)**. Bekannte akzeptierte Limitation aus dem Review: die neue PM-basierte Suche findet keinen Text mehr in Node-**Attrs** (Opener-Titel, Captions, Raw-Block-Bodies) — Attr-Treffer wären nicht ersetzbar; als Follow-up notiert.

**Datum:** 2026-07-13  
**Umfang:** vollständige statische Analyse von `src/` (~53.400 Zeilen: Main-Prozess, MCP-Server, Editor, Shared, Renderer) plus Build-Scripts und Config.  
**Methodik:** 21 partitionierte Finder-Agents + 3 repo-weite Querschnitts-Checks (Dead Code/Deps, schädliche Duplikation, IPC-Kanal-Konsistenz). **Jeder** Finder-Befund wurde anschließend von einem unabhängigen, adversarialen Verifier-Agent per Code-Read + `grep` über das ganze Repo gegengeprüft — nur `CONFIRMED`/`PLAUSIBLE` sind hier aufgeführt. Bewusste Design-Entscheidungen aus `CLAUDE.md` (die intentionalen `vswrite`-Holdouts, export-only-Transforms wie typstGrid/typstHero, Print-Export außerhalb von safe-apply, single-source `getCommands`, injizierte Renderer, der Legacy-`dist/mcp/server.mjs`-Pfad) wurden als „kein Bug" ausgefiltert.

> Dies ist ein **Analyse-Report** — es wurde kein Code geändert. Die Fix-Vorschläge sind Empfehlungen zur Triage.

## Zusammenfassung

- **92 Befunde** insgesamt · **79 CONFIRMED**, 13 PLAUSIBLE, **0 REJECTED** durch die Verifikation.
- Nach Dedup: **71 eindeutige** bestätigte Befunde.
- Verteilung (bestätigt): **8 High** (echte Bugs, vor Release fixen) · **12 Medium** · **20 Low-Bugs** · **23 Dead Code / ungenutzte Deps** · **8 Duplikation (Drift-Risiko)**.

### Top-Prioritäten vor dem Launch

| # | Datei | Kurzbeschreibung |
|---|---|---|
| H1 | `src/mcp/server.ts` | penwright_generate_layout inserts the Hero before the style import → broken compile |
| H2 | `src/editor/lib/deserializer.ts` | splitInlineConstructs duplicates preceding text (and leaks raw macro source) when an inline #text/#link/#func fails to fully parse |
| H3 | `src/editor/lib/serializer.ts` | Plain-text `//` and `/*` are not escaped and get silently dropped as Typst comments |
| H4 | `src/editor/components/SearchReplace.svelte` | Find & Replace rebuilds the document from live nodeview DOM, destroying every custom Typst node |
| H5 | `src/shared/docxSerializer.ts` | DOCX numbering/raster pre-pass is a flat walk but the render pass (and the HTML pre-pass) recurse into magazine containers — nested figures/tables/math desync |
| H6 | `src/shared/markdownImporter.ts` | Markdown import turns every bold span into italic (and drops bold+italic entirely) |
| H7 | `src/renderer/App.svelte` | Cmd+B is double-bound: toggles the sidebar AND applies Bold on every press |
| H8 | `src/main/fileManager.ts` | Switching files loses the last <1s of unsaved edits (no flush-save before open) |

**Kurz-Trend:** Die schwersten Probleme clustern im **Serializer/Deserializer-Round-Trip** (stiller Content-Verlust: `//`-Kommentare, Bold→Italic-Import, nested Listen, Inline-`#text`/`#link`), in **Datenverlust beim Datei-/Tab-Wechsel** (Autosave-Debounce wird nicht geflusht) und in **Find & Replace**, das das ganze Dokument aus dem Nodeview-DOM neu aufbaut und dabei alle Custom-Nodes zerstört.

---

## 1 · High — vor Release beheben

Echte Korrektheits-Bugs mit Nutzer-sichtbarem Schaden (Content-Verlust, kaputte Exports/Compiles). Alle mit konkretem Repro verifiziert.

#### 1. penwright_generate_layout inserts the Hero before the style import → broken compile

- **Ort:** `src/mcp/server.ts:1270`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** When `addHero && title`, generate_layout searches the root file for the legacy literal `#include "style.typ"` to place the Hero after it. But `writeProjectStyleAndRegenerate` was called moments earlier (line 1255) and runs `ensureStyleInclude`, which always emits/migrates the root to the modern `#import "style.typ": *` + `#show: apply-style` form and never leaves a `#include "style.typ"` line. So `content.indexOf('#include "style.typ"')` returns -1, `insertAt` becomes 0, and the Hero snippet is written at the very top of the file — before the style import. The Hero snippet references `style-colors.primary` / `style-fonts.*` (designElements.ts line 72), which are undefined until `#import "style.typ": *` runs, so Typst fails with 'unknown variable: style-colors'. The tool still reports success and heroInserted:true.
- **Nachweis:** styleParser.ts ensureStyleInclude (lines 569-578) migrates `#include "style.typ"`→`#import "style.typ": *\n#show: apply-style` and otherwise inserts the import pair; STYLE_INCLUDE_LINE_LEGACY is only kept for migration. designElements.ts line 72 shows the hero body uses `style-colors.primary`. Thus after generate_layout regenerates style, the searched literal is absent → idx===-1 → insertAt=0 → hero inserted above the import → compile error.
- **Fix-Vorschlag:** Search for the modern anchor `#show: apply-style` (STYLE_APPLY_LINE) and insert after that line, falling back to after `#import "style.typ"`. Reuse the styleParser constants instead of the hard-coded legacy `#include` string.

#### 2. splitInlineConstructs duplicates preceding text (and leaks raw macro source) when an inline #text/#link/#func fails to fully parse

- **Ort:** `src/editor/lib/deserializer.ts:1034`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** In splitInlineConstructs the SIMPLE_INLINE (line 1016), ARG_INLINE (line 1034) and #link (line 1051) branches push the preceding text run `text.slice(textStart, i)` as a segment IMMEDIATELY when the prefix matches, BEFORE confirming the construct actually extracts. If extraction then fails, `matched` stays false and `textStart` is never advanced, so the same span is re-emitted at loop end (line 1142) — duplicating the leading text and dumping the raw macro source as literal text. The two failure paths are common, valid Typst, not malformed input: (a) ARG_INLINE `#text(...)` whose args have NO `fill:` key (e.g. `#text(weight: "bold")[x]`, `#text(size: 12pt)[x]`) — extractArgAndBracket returns null when the key is absent; (b) `#link("url")` with no trailing `[body]` (the standard bare-URL link). The paragraph path is shielded by isRawBlock, but every OTHER parseInline caller is not: heading text, list items, table cells, magazine node bodies (dropCap/question/pullQuote via parseInline in parseMagazineMacro, columns/callout/figurePanel via parseBlocks), and align chunks. Magazine content (#frage/#lead/#pull) is a headline feature and routinely contains inline #text(weight:...)/bare #link(...).
- **Nachweis:** Runtime replica of the three branches: input `Was #text(weight: "bold")[wichtig] ist?` → segments [{text:'Was '},{text:'Was #text(weight: "bold")[wichtig] ist?'}] (leading 'Was ' duplicated + raw macro shown literally); input `see #link("https://x.com") here` → [{text:'see '},{text:'see #link("https://x.com") here'}]. Control `a #text(fill: red)[x] b` parses correctly. So e.g. `#frage[Was #text(weight: "bold")[wichtig] ist?]` yields a question node whose content duplicates 'Was ' and renders the #text code as plain text.
- **Fix-Vorschlag:** Only push the preceding text run AFTER the construct is confirmed to parse (mirror the #raw and @label branches, which push inside their success `if`). I.e. move the `if (i > textStart) segments.push(...)` for SIMPLE_INLINE/ARG_INLINE/#link into the same `if (bracketContent)`/`if (result)`/`if (bc)` success block that also advances textStart.

#### 3. Plain-text `//` and `/*` are not escaped and get silently dropped as Typst comments

- **Ort:** `src/editor/lib/serializer.ts:248`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** `escapeTypstText` escapes ``\`*_#@$<>~[]`` but NOT the comment sequences `//` and `/*`. In Typst markup, `//` starts a line comment and `/* */` a block comment — everything after them on the line is silently discarded from the compiled PDF with no error. Any prose containing a URL ("https://example.com"), "and/or" written as "a//b", or a literal `/*` therefore loses content on compile. `escapeLeadingBlockMarker` only escapes a leading `/ ` (slash + space) at the start of a paragraph; mid-line `//` and `/*` are never protected.
- **Nachweis:** Verified with the bundled Typst (resources/bin/typst-arm64-darwin): `Alpha // #nope_undefined` compiles with exit 0 (the `#nope_undefined` after `//` is treated as a comment and dropped), whereas the control `Alpha #nope_undefined` errors with `unknown variable: nope_undefined`. Thus text after `//` is silently removed from the PDF. The regex at serializer.ts:248 `/[\\`*_#@$<>~[\]]/g` contains no `/`.
- **Fix-Vorschlag:** Escape `/` when it is followed by another `/` or `*` (e.g. replace `//`→`\/\/`, `/*`→`\/*`) in escapeTypstText, and add the inverse unescape in the deserializer's inline scan so round-trip stays lossless.

#### 4. Find & Replace rebuilds the document from live nodeview DOM, destroying every custom Typst node

- **Ort:** `src/editor/components/SearchReplace.svelte:132`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** replaceOne() (line 132) and replaceAll() (line 147) commit the edit with `editor.commands.setContent(editor.view.dom.innerHTML)`. `editor.view.dom.innerHTML` is the *nodeview* DOM, not the `renderHTML` output. Every custom node renders its nodeview as a plain element WITHOUT the `data-*` attributes its parseHTML rule requires: typstRawBlock's nodeview is `<div class="typst-raw-block">` with a <textarea> (parseHTML wants `div[data-typst-raw]` + `data-content`), citation is `<span class="typst-citation">` (wants `span[data-citation]`), footnote/reference/image/bibliography/table/magazine nodes likewise. When setContent re-parses the innerHTML none of these rules match, so on ANY single replace the whole document loses all math blocks, code blocks, `#outline()`, citations, footnotes, cross-references, images, tables and magazine nodes — replaced by their stripped inner text (footnote content vanishes entirely since it lives only in the attr, not the DOM).
- **Nachweis:** typstRawBlock.ts:27 parseHTML requires `div[data-typst-raw]`+`data-content`, but addNodeView (line 55) builds `document.createElement('div')` with only class `typst-raw-block` and a textarea — no data attrs. Same pattern in typstCitation.ts:48 (span, no data-citation), typstFootnote.ts:87, typstReference.ts:64. So `setContent(view.dom.innerHTML)` cannot round-trip any of them. Reachable via Cmd+H (ShortcutCheatsheet lists 'Find & Replace' Cmd+H) → Replace / Replace all on a doc containing any citation/footnote/math/table.
- **Fix-Vorschlag:** Do not reconstruct the doc from innerHTML. Perform replacements through ProseMirror transactions on the document model (map DOM matches to PM positions and dispatch tr.replaceWith / insertText), or gate Find&Replace to documents with no custom nodes. Never call setContent(view.dom.innerHTML).

#### 5. DOCX numbering/raster pre-pass is a flat walk but the render pass (and the HTML pre-pass) recurse into magazine containers — nested figures/tables/math desync

- **Ort:** `src/shared/docxSerializer.ts:1542`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** buildExportContext (the DOCX pre-pass, lines 1542-1591) iterates only doc.content top-level nodes: `for (const node of doc.content ?? [])` with NO recursion into node.content. But the render pass convertNode recurses into the bodies of the magazine container nodes callout/figurePanel/columns (calls to convertNode(child,...) at lines 1084, 1103, 1123), and the deserializer re-parses #columns/#notiz/#bildtafel bodies into NESTED typstRawBlocks (figures, tables, display-math). Consequences for any nested content: (a) a nested #figure/#table with a <label> never gets counted, so its labelMap entry is missing -> renderRawBlock reads `target = desc.label ? activeCtx?.labelMap.get(desc.label) : undefined` (line 1708) -> num='' (caption shows 'Figure' / 'Table' with no number) AND any @fig:/@tbl: cross-reference to it fails to resolve (renderReference falls to the bare-label fallback at line 2064); (b) nested display-math is never added to renderQueue (line 1573 only fires on the shallow walk), so activeCtx.rendered lacks its mathSnippet -> renderRawBlock math (line 1686) gets undefined and falls back to plain italic TeX instead of the rasterised image. This is exactly the depth-first invariant documented for buildExportModel in exportContext.ts (lines 566-611, which DOES recurse via `visit`) — the DOCX serializer duplicated that numbering logic in buildExportContext instead of reusing buildExportModel, and the two copies drifted (deep vs shallow).
- **Nachweis:** sed of lines 1542-1591 shows no `visit`/recursion; grep confirms convertNode(child) recursion at docxSerializer.ts:1084,1103,1123; exportContext.ts buildExportModel recurses (`for (const c of node.content ?? []) visit(c)` at line 609). Repro: a magazine chapter with a #figure(image(...), caption:[x]) <fig:y> inside a #columns[...] block, exported to DOCX, yields a caption 'Abbildung : x' (no number) and an unresolved @fig:y elsewhere; a $...$ display-math block inside #columns exports as raw TeX text rather than the rendered equation image.
- **Fix-Vorschlag:** Make the DOCX pre-pass recurse (add a `visit(node)` that walks node.content), or better, replace buildExportContext's hand-rolled numbering loop with a call to the shared buildExportModel(doc, typstContent) so the DOCX and HTML exports cannot drift again — then build the rendered-raster map from model.mathBlocks plus a recursive figure/image scan.

#### 6. Markdown import turns every bold span into italic (and drops bold+italic entirely)

- **Ort:** `src/shared/markdownImporter.ts:150`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** In convertInline(), markdown bold is first normalized to Typst bold (`**x**`/`__x__` -> `*x*` at lines 142-143), but the subsequent single-asterisk italic rule at line 150 (`/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g` -> `_$1_`) then matches that already-produced `*x*` and rewrites it to `_x_` (italic). The regex cannot distinguish a `*x*` that came from markdown `**bold**` from an originally single-asterisk italic, so ALL bold becomes italic. The bold+italic forms (`***x***`/`___x___` -> `*_x_*` at lines 138-139) get collapsed to `__x__`, which in Typst is an empty emphasis pair and loses all formatting. This corrupts the shipped Markdown import feature (File > Import Markdown and MCP penwright_import_markdown), affecting headings, list items and paragraphs alike since convertInline runs on every line.
- **Nachweis:** Ran the exact convertInline logic in node: '**bold**' -> '_bold_'; '*italic*' -> '_italic_'; '***both***' -> '__both__'; 'a **b** and *c*' -> 'a _b_ and _c_'. Bold is universally converted to italic; bold+italic loses all marks.
- **Fix-Vorschlag:** Convert single-asterisk italic BEFORE collapsing bold, or map bold to a placeholder token (e.g.  B.. ) that the italic regex cannot match, then restore it after the italic pass. Do the italic-underscore conversion on the ORIGINAL markdown asterisks, not on the already-emitted Typst bold.

#### 7. Cmd+B is double-bound: toggles the sidebar AND applies Bold on every press

- **Ort:** `src/renderer/App.svelte:916`
- **Schwere / Kategorie:** HIGH · bug
- **Problem:** handleGlobalKeydown() (a window-level keydown listener) intercepts `mod && e.key === 'b'`, calls e.preventDefault(), and toggles panelState.showSidebar. But Cmd/Ctrl+B is also the editor's Bold shortcut: StarterKit.configure() (editor.ts:179) only disables `link`, so Bold with its default `Mod-b` keymap stays active, and ShortcutCheatsheet.svelte:49 documents `${mod}+B` as Bold. ProseMirror handles the key on view.dom (a descendant of window) and calls preventDefault but does NOT stopPropagation, so the same keydown bubbles to the window listener. Result: pressing Cmd+B while editing bolds the selection AND toggles the sidebar. The handler also lacks any e.target/focus guard, so Cmd+B, Cmd+F, Cmd+H fire even while typing in inputs (comment textarea, search box, settings). The sidebar status button even advertises title="Cmd+B" (App.svelte:1304), colliding head-on with the documented Bold binding. Repro: focus editor, select a word, press Cmd+B -> text becomes bold and the sidebar visibility flips.
- **Nachweis:** App.svelte:916-919 `if (mod && e.key === 'b') { e.preventDefault(); panelState.showSidebar = !panelState.showSidebar; }`. editor.ts:179 `StarterKit.configure({ link: false })` leaves Bold/Mod-b enabled. ShortcutCheatsheet.svelte:49 maps `${mod}+B` to shortcutBold. Window listener registered in bubble phase (App.svelte:283), after ProseMirror's Mod-b handler which does not stop propagation.
- **Fix-Vorschlag:** Pick one owner for Cmd+B (either rebind the sidebar toggle to a non-conflicting chord, or gate the global handler on the event not originating in the editor / not already defaultPrevented). Also add an early-return when e.target is inside a contenteditable/input for all editor-conflicting shortcuts.

#### 8. Switching files loses the last <1s of unsaved edits (no flush-save before open)

- **Ort:** `src/main/fileManager.ts:166`
- **Schwere / Kategorie:** HIGH · bug/data-loss
- **Problem:** Saving is driven only by the 1s-debounced autoSave in the main process ('edit' → autoSave(), fileManager.ts:442). Switching files goes switchToTab() → filetree:open → openFile(newPath). openFile() neither saves the previously-open dirty file nor clears the pending autoSaveTimer. It overwrites appState.currentContent/currentFilePath with the new file. When the still-pending autoSaveTimer fires, its guard reads the NOW-current file: `if (appState.isDirty && appState.currentFilePath) saveFile()` writes the NEW file's content to the NEW path — the previous file's edits are never written and are silently lost.
- **Nachweis:** fileManager.ts:444-448 autoSave timer callback saves appState.currentContent to appState.currentFilePath (both already reassigned by openFile). openFile (fileManager.ts:166-297) has no saveFile()/clearTimeout(autoSaveTimer). switchToTab (appState.svelte.ts:174-183) calls invoke('filetree:open', tab.path) with no prior save; renderer exposes no save IPC. Repro: type a sentence in chapter A, within 1s click chapter B in the sidebar → A's last edits are gone.
- **Fix-Vorschlag:** In openFile(), before reading the new file, flush the current one: clear autoSaveTimer and if appState.isDirty && appState.currentFilePath, await saveFile(). Or have switchToTab await an explicit save IPC before filetree:open.
- **Hinweis:** Verwandt (gleiche Ursache): `openFile()` löscht `isDirty` nie (No-op an fileManager.ts:237) und bricht den laufenden Autosave-Timer nicht ab.

---

## 2 · Medium — sollten behoben werden

Bugs mit spürbarer, aber begrenzter Wirkung (Randfälle, einzelne Features, Performance/Leaks).

#### 9. Print export silently discards a hand-written design when the project has no style.json

- **Ort:** `src/main/importExport.ts:184`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** writePrintExportTemp() takes its base style from getProjectStyle(projectDir), which returns sanitizeProjectStyle(DEFAULT_PROJECT_STYLE) whenever no .penwright/style.json exists (persistenceManager.getProjectStyle line 674). It then regenerates a full style.typ from those DEFAULT tokens and REPOINTS the root's `#import "style.typ"` at it (line 205) — or injects `#import ...: *` + `#show: apply-style` when none exists (line 207). For a magazine-pipeline / hand-crafted project whose entire look lives in a hand-written style.typ (or macros) and that never opened the Design Editor, the print PDF is produced with Penwright's DEFAULT look, not the author's design. This is inconsistent with the WEB export path, which for exactly this shape falls back to styleInference (runWebExport line 569-578 gates on hasProjectStyle and infers tokens); the print path has no such fallback.
- **Nachweis:** importExport.ts:184 `const base = ... getProjectStyle(...) : DEFAULT_PROJECT_STYLE` vs runWebExport importExport.ts:569 `hasProjectStyle(...) ? getProjectStyle(...) : null` → prepareWebDesign → inferStyleFromTypst. persistenceManager.ts:674 returns DEFAULT_PROJECT_STYLE when no style.json. Repro: open a magazine-pipeline project (no .penwright/style.json, hand-written style.typ imported by root) → File ▸ Export PDF ▸ 'Für den Druck' → the temp .penwright-style-print.typ replaces the real style.typ import, so the print PDF uses default fonts/margins/colors.
- **Fix-Vorschlag:** In writePrintExportTemp, when hasProjectStyle(projectDir) is false, reuse the web-export design resolution (prepareWebDesign / inferStyleFromTypst) or skip repointing the import entirely and only overlay the bleed/crop-mark page geometry, so a hand-written design survives print export.

#### 10. Preset gallery renders Typst synchronously on the main thread, freezing the whole app

- **Ort:** `src/main/presetManager.ts:105`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** renderPresetPreview() (ipc 'preset:preview', line 215-244) and renderThumbnail() (ipc 'preset:save', line 395-406) call execFileSync (from node:child_process) to compile a preset with the bundled Typst binary. These run inside ipcMain.handle callbacks in the main process, so they block the Electron main-process event loop for the entire compile — up to the 120s / 90s timeout. While it runs, the native menu, all other IPC, and window responsiveness are frozen. Every other Typst invocation in the codebase (typstCompiler.ts) uses async spawn precisely to avoid this. The gallery preview fires on user hover/click, so a slow-compiling preset visibly hangs the UI.
- **Nachweis:** presetManager.ts:18 imports execFileSync; line 225 (renderPresetPreview) and line 397 (renderThumbnail) call execFileSync(getTypstPath(), ..., { timeout: 120_000 / 90_000 }); ipcHandlers.ts:1366 `ipcMain.handle('preset:preview', (_event, presetId) => renderPresetPreview(presetId))` invokes it synchronously in the main process. Compare typstCompiler.ts which uses async spawn.
- **Fix-Vorschlag:** Switch renderPresetPreview / renderThumbnail to an async child_process.execFile (promisified) and make the ipc handlers await them, so the main-process event loop stays responsive during compilation.

#### 11. penwright_reorder_chapters silently drops chapters omitted from the order array

- **Ort:** `src/mcp/server.ts:1519`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** The new include block is rebuilt exclusively from the `order` array (`for (const chPath of order)`), and all original `#include` lines are removed and replaced by this rebuilt list. Any existing chapter whose path is NOT present in `order` is silently deleted from the root document (its `#include` vanishes). An agent that passes a partial order — e.g. to move one chapter — will unintentionally remove every chapter it didn't list, dropping content from the compiled document with no error or warning.
- **Nachweis:** Lines 1518-1526 build `newIncludes` only from `order`; lines 1531-1540 emit `newIncludes` in place of all original include lines. There is no reconciliation that re-appends includes present on disk but absent from `order`.
- **Fix-Vorschlag:** After building newIncludes from `order`, append any original includeLines not matched by any order entry (preserving them), or reject the call if `order` does not cover all existing includes.

#### 12. Strikethrough mark serialized as `~text~`, which is a Typst non-breaking space, not strikethrough

- **Ort:** `src/editor/lib/serializer.ts:334`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** The `strike` mark is emitted as `~${text}~`. In Typst `~` is the shorthand for a non-breaking space (there is no `~…~` strikethrough markup); the correct form is `#strike[…]` — which the project's own markdownImporter already uses (`~~text~~ → #strike[text]`). So striking text produces a spurious leading+trailing nbsp and NO line-through in the PDF. It is also one-way: the deserializer has no `~…~`/`#strike` inline rule, so the formatting does not survive a reopen. Strike is a real, exposed feature (Toolbar S button, Cmd+Shift+X, registered via StarterKit in editor.ts).
- **Nachweis:** serializer.ts:333-335 `case 'strike': text = `~${text}~``. markdownImporter.ts comment/impl maps strikethrough to `#strike[…]` (the correct Typst form), and the deserializer contains no strike handling (CLAUDE.md lists only #emph/#strong/#raw/#footnote as parsed-back inline constructs). Typst treats `~` as U+00A0 nbsp.
- **Fix-Vorschlag:** Emit `#strike[${text}]` (like underline/super/sub) so it renders as real strikethrough and can be parsed back.

#### 13. Nested lists are silently dropped when serializing bulletList/orderedList

- **Ort:** `src/editor/lib/serializer.ts:79`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** bulletList/orderedList serialization maps each list item to `serializeInline(child.content)`, assuming every list-item child is an inline-bearing paragraph. When a list item contains a nested bulletList/orderedList (reachable via Tab / sinkListItem in StarterKit), that nested list node's children are listItem nodes — `serializeInline` matches none of its node types (text/footnote/citation/reference/hardBreak/marginNote) and returns '' — so the entire nested sub-list is dropped from the Typst output on save (data loss).
- **Nachweis:** serializer.ts:79-99: `(item.content ?? []).map((child) => serializeInline(child.content ?? [])).join('\n')`. For a nested list child, `child.content` is an array of `listItem` nodes; serializeInline (lines 312-390) has no branch for list/paragraph/listItem nodes and returns '' for each, yielding an empty string for the whole nested list.
- **Fix-Vorschlag:** Recurse into block children of a list item via serializeNode (with indentation) instead of only serializeInline, so nested lists and multi-block list items survive.

#### 14. Cmd+B is bound to Toggle Sidebar in the native menu, shadowing the editor's Bold shortcut

- **Ort:** `src/main/menuBuilder.ts:159`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** The View menu registers accelerator `CmdOrCtrl+B` for Toggle Sidebar (menuBuilder.ts:159). Electron menu accelerators are triggered globally and intercept the keystroke before it reaches the webContents/editor. StarterKit binds Bold to `Mod-b`, and both the Toolbar bold button title and ShortcutCheatsheet advertise `Cmd+B` = Bold. As a result, pressing Cmd+B while typing toggles the sidebar instead of bolding the selection — the documented Bold shortcut does not work, and the same accelerator is even listed twice in the cheatsheet (Bold at line 49, Toggle Sidebar at line 68).
- **Nachweis:** menuBuilder.ts:159 `accelerator: 'CmdOrCtrl+B'`. ShortcutCheatsheet.svelte:49 shortcutBold `${mod}+B` AND :68 shortcutToggleSidebar `${mod}+B`. StarterKit's Bold default keymap is Mod-b; Toolbar bold button title is toolbarBold (Cmd+B). Only one CmdOrCtrl+B accelerator exists (grep), so the menu wins.
- **Fix-Vorschlag:** Move Toggle Sidebar to a non-conflicting accelerator (e.g. Cmd+Alt+B or Cmd+\) or set the MenuItem's registerAccelerator:false and handle sidebar toggle in the renderer only, so Cmd+B reaches the editor as Bold. Fix the cheatsheet accordingly.

#### 15. Figures/tables without a <label> render an unnumbered caption ('Figure: …' / 'Table: …')

- **Ort:** `src/shared/docxSerializer.ts:1711`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** In renderRawBlock's figure case the caption number is only obtainable via the label map: `const target = desc.label ? activeCtx?.labelMap.get(desc.label) : undefined; const num = target?.n ?? '';` (lines 1708,1711). The pre-pass increments figureN/tableN for EVERY figure/table but only stores the count in labelMap when the block carries a <label> (buildExportContext lines 1576,1583). So an un-labelled #figure produces a caption run `"Figure ".trim()` -> 'Figure' with no number, e.g. 'Figure: A river at dawn'. Unlabelled figures are common; readers expect sequential figure numbers regardless of whether the author cross-references them. (Marking low confidence in case unnumbered-unless-referenced is an intentional policy — but it reads as a defect and the count is computed then discarded.)
- **Nachweis:** renderRawBlock figure case lines 1706-1729; num sourced only from labelMap; buildExportContext stores figureN/tableN into labelMap conditionally on desc.label (lines 1576,1583). A doc with `#figure(image("a.png"), caption:[x])` and no trailing <fig:...> exports a caption with no numeral.
- **Fix-Vorschlag:** Track the running figure/table ordinal in the render pass (or store every figure's number in the pre-pass keyed by document position, not only by label) so unlabelled figures still get 'Figure N'.

#### 16. applySettings/parseSettings corrupt documents that use a font fallback array in #set text(...)

- **Ort:** `src/shared/settingsParser.ts:93`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** Both the parse regex `#set\s+text\s*\(([^)]*)\)` (line 48) and the strip regex `/^#set\s+text\s*\([^)]*\)\s*\n?/gm` (line 93) assume `#set text(...)` contains no nested parentheses. But a font fallback array — `#set text(font: ("Arial", "Helvetica"), lang: "de")`, a common documented Typst idiom — nests parens. `[^)]*` stops at the inner `)`, so parseSettings never sees `lang`, and applySettings strips only `#set text(font: ("Arial", "Helvetica")`, leaving an orphaned `, lang: "de")` in the document which does not compile. The inline comment justifying the flat regex ('text() doesn't accept bracket args') is wrong about parenthesized array args. applySettings is live via MCP penwright_update_settings and projectManager.applyStyleTemplate.
- **Nachweis:** Ran the strip regex on `#set text(font: ("Arial", "Helvetica"), lang: "de")\n\n= Title\nBody` -> result begins `", lang: \"de\")\n\n= Title..."` (orphaned tail). The parse regex captured only `font: ("Arial", "Helvetica"` — lang missing.
- **Fix-Vorschlag:** Match #set text(...) with a balanced-paren scan (like bibParser's brace-depth loop) instead of `[^)]*`, so nested `( )` in the font array are consumed whole.

#### 17. applyLayout() silently wipes the print/prepress setup (bleed, crop marks, facing pages, binding gutter)

- **Ort:** `src/renderer/components/DesignPanel.svelte:308`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** applyLayout does `style.layout = { ...p.layout }`, fully replacing the layout object. Only ONE of the 7 LAYOUT_PRESETS ('magazine-print-a4') carries the print fields bleed/cropMarks/facingPages/binding; the other 6 omit them. So applying any non-print layout preset leaves those fields undefined, and the subsequent auto-save runs through style:save -> sanitizeProjectStyle (styleTypes.ts:628-631), which resets them to their defaults ('' / false). A user who configured a 5 mm bleed + crop marks (e.g. via the 'Für den Druck' export 'remember as default', which merges into style.json) loses that prepress config the moment they pick e.g. 'A5 booklet'. This is inconsistent with the two sibling code paths that deliberately preserve these: applyTheme (lines 289-294) and importFromPreset's 'layout' scope (line 341) both carry `bleed: cur.layout.bleed ?? '', cropMarks: …, facingPages: …, binding: …` forward. applyLayout is the outlier and causes data loss.
- **Nachweis:** DesignPanel.svelte:308 `style.layout = { ...p.layout }` with no print-field preservation. layoutPresets.ts: only 'magazine-print-a4' (lines 157-160) has bleed/cropMarks/facingPages/binding; the other 6 presets have none. styleTypes.ts:628-631 sanitizeProjectStyle falls back bleed->'', cropMarks->false, facingPages->false, binding->''. Contrast DesignPanel.svelte:289-294 (applyTheme) and :341 (import layout) which both preserve `cur.layout.bleed ?? ''` etc.
- **Fix-Vorschlag:** In applyLayout, preserve the current print fields like the other paths: `const cur = style.layout; style.layout = { ...p.layout, bleed: cur.bleed ?? '', cropMarks: cur.cropMarks ?? false, facingPages: cur.facingPages ?? false, binding: cur.binding ?? '' };`

#### 18. Sidebar panels leak an IPC 'penwright' listener on every tab switch (no removal path in preload)

- **Ort:** `src/renderer/components/ProjectPanel.svelte:43`
- **Schwere / Kategorie:** MEDIUM · resource-leak
- **Problem:** ProjectPanel (line 43), Sidebar (line 35) and CommentsPanel (line 130) each register `api.on('penwright', ...)` in onMount. These three components are the mount/unmount `{:else if}` branches of the sidebar tab switch in App.svelte (lines 1083-1092), so they are destroyed and recreated every time the user changes sidebar tabs. The preload bridge (`preload-entry.ts`) exposes only `on()` which calls `ipcRenderer.on(...)` and provides NO `off`/`removeListener`, and none of the onDestroy handlers remove the callback (ProjectPanel/CommentsPanel clear timers but not the IPC listener; Sidebar has no onDestroy at all). Result: each tab visit permanently adds another `penwright` ipcRenderer callback that is never freed. Because `filetreeChanged`/`saveStatus`/`currentFile` are broadcast on virtually every save, AI edit, and project operation (dozens of send sites across ipcHandlers/projectManager/importExport), every stale listener re-fires and re-runs its `filetree:list` / `git:status` / `comments:list` IPC round-trip against a dead component — growing unbounded over a session.
- **Nachweis:** grep shows exactly three `api.on('penwright'` sites (ProjectPanel:43, Sidebar:35, CommentsPanel:130); preload-entry.ts `on()` has no unsubscribe and there is no `.off(`/`removeListener` anywhere in src/renderer. App.svelte renders these under `{:else if panelState.sidebarTab === ...}` so they unmount on tab change. Repro: open a project, switch Files→Project→Comments→Files a few times, then save once — N duplicate git:status/filetree:list/comments:list calls fire (one per past mount) and the ipcRenderer listener count for 'penwright' keeps climbing.
- **Fix-Vorschlag:** Have preload `on()` return a disposer (e.g. return `() => ipcRenderer.removeListener(channel, wrapped)`), then capture it in each panel's onMount and call it in onDestroy. Alternatively route these panels' refresh through the single App-level `penwright` listener via a store, so per-panel subscriptions are not needed.
- **Hinweis:** Grundursache: die `on()`-Bridge im Preload (preload-entry.ts:134) bietet keinen Unsubscribe — jeder Sidebar-Tab-Wechsel hängt einen weiteren `ipcRenderer`-Listener an.

#### 19. Switching text-file tabs silently discards unsaved edits (reactive $effect reload, no dirty guard)

- **Ort:** `src/renderer/components/TextFileViewer.svelte:29`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** TextFileViewer loads its file both in onMount (line 26) AND in a reactive `$effect(() => { if (filePath) loadFile(); })` (lines 29-31). loadFile() unconditionally overwrites `content`/`originalContent` and resets `isDirty=false` with no check for pending unsaved changes. Because App.svelte renders `<TextFileViewer filePath={textViewerFile} />` WITHOUT a `{#key}` (App.svelte:1147-1153) and `textViewerFile` is a derived active-tab path (App.svelte:162), switching from one text tab (e.g. a .bib or SKILL.md with edits) to another reuses the same component instance; the effect fires on the new `filePath` and reloads, throwing away the first file's unsaved edits with no prompt. Secondary issue: on initial mount both onMount and the effect run loadFile(), doing two redundant `textfile:read` IPC round-trips per open.
- **Nachweis:** onMount(loadFile) at line 25-27 + `$effect(() => { if (filePath) loadFile(); })` at 29-31; loadFile (33-43) sets content/originalContent and isDirty=false with no dirty guard. App.svelte:1147-1153 mounts it un-keyed with filePath={textViewerFile}; textViewerFile is $derived from the active tab (App.svelte:162). save() (50-61) is manual-only, so no autosave protects the switch.
- **Fix-Vorschlag:** Drop the onMount call (the $effect already covers first load) or drop the effect and drive reloads via `{#key textViewerFile}` in App.svelte; and guard the reload path so it does not clobber `isDirty` content without saving/prompting.

#### 20. git:restoreVersion never refreshes the open editor buffer; relies on the chokidar 3s self-save guard, which can silently discard the restore

- **Ort:** `src/main/gitManager.ts:161`
- **Schwere / Kategorie:** MEDIUM · bug
- **Problem:** git:restoreVersion runs `git checkout <sha> -- .` to overwrite working-tree files but, unlike project:applyBackup (ipcHandlers.ts:914-919), it does NOT update appState.currentContent, does NOT send a 'update' message to the renderer, and does NOT bump appState.lastSaveTimestamp. The renderer's onRestored callback (ProjectPanel.svelte:326) only calls refreshAll() which refreshes the version/status list, not the editor content. So the ONLY thing that refreshes the editor after a restore is the fileManager chokidar 'change' handler (fileManager.ts:504-542), which is suppressed for 3 seconds after any save via the `Date.now() - appState.lastSaveTimestamp < 3000` guard. If a restore happens within ~3s of an auto-save, the checkout write is ignored, the editor keeps the pre-restore (stale) content while disk holds the restored content, and the very next keystroke's autosave (300ms debounce + 1s autoSaveTimer -> saveFile writes appState.currentContent) overwrites the restored file on disk — silently losing the restored version.
- **Nachweis:** gitManager.ts:161-176 restoreVersion body: only `git.raw(['checkout', sha, '--', '.'])` then `return { ok: true }` — no currentContent/update/lastSaveTimestamp. Contrast project:applyBackup ipcHandlers.ts:909-919 which sets lastSaveTimestamp, appState.currentContent, isDirty=false and sends {type:'update'}. Repro: type in a file (autosave stamps lastSaveTimestamp), open History and click Restore on an older version within 3s -> fileManager.ts:505 `if (Date.now() - appState.lastSaveTimestamp < 3000) return;` drops the checkout change; editor stays stale; next keystroke -> sendUpdate (App.svelte:415) -> autoSave -> saveFile writes stale content over the restored file.
- **Fix-Vorschlag:** Make git:restoreVersion explicitly refresh the open buffer the same way applyBackup does: after the checkout, if the currently-open file was among the restored files, read it, set appState.currentContent + isDirty=false + updateTitle() and send {type:'update', content}. Bump lastSaveTimestamp around the checkout so the watcher doesn't double-handle it, and send filetreeChanged.

---

## 3 · Low — kleinere Bugs & Papierschnitte

Lokale Defekte, kosmetische Fehler, kleinere Leaks und unbehandelte Promise-Rejections.

#### 21. saveFileAs does not rebuild the compiler/watcher for the new path

- **Ort:** `src/main/fileManager.ts:331`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** saveFileAs sets appState.currentFilePath to the new path and calls saveFile(), but never re-runs setupCompiler() or setupFileWatcher(). saveFile() then calls the existing `compiler?.compilePdf()`, but that compiler was constructed against `findRootFile(oldPath)` and still targets the previous root. After a Save As into a different directory the live preview keeps compiling the old document and the chokidar watcher keeps watching the old project directory, so edits to the newly-saved file no longer reflect in the preview until the file is reopened.
- **Nachweis:** fileManager.ts saveFileAs (331-342) only assigns currentFilePath and delegates to saveFile; saveFile (299-329) reuses the module-level `compiler` created by setupCompiler() at open time (406-432, `new TypstCompiler(findRootFile(...))`). No setupCompiler()/setupFileWatcher() call exists in the saveFileAs path.
- **Fix-Vorschlag:** After a successful saveFileAs, call setupCompiler() and setupFileWatcher() so the compiler root and watcher directory track the new file location.

#### 22. async snippet renderers call blocking execFileSync, so Promise.all is not parallel and the main process freezes during export

- **Ort:** `src/main/importExport.ts:382`
- **Schwere / Kategorie:** LOW · efficiency
- **Problem:** createTypstSnippetRenderer (line 305) and createTypstSvgRenderer (line 335) return `async` functions whose bodies call the SYNCHRONOUS execFileSync (lines 314 and 342). buildHtmlExportContext then does `Promise.all(uniqueTex.map(tex => render(...)))` (line 382) expecting parallelism, but because each render blocks synchronously they run strictly sequentially and each blocks the entire main-process event loop for the full duration of a Typst compile. For a magazine/thesis with many display-math blocks (HTML export) or math/SVG figures (DOCX export), the app's main process is frozen for N sequential compiles — no IPC serviced, UI unresponsive — with the Promise.all giving a false impression of concurrency.
- **Nachweis:** importExport.ts:314 `execFileSync(getTypstPath(), buildTypstCompileArgs([...]))` inside an async fn; same at :342; consumed by Promise.all at importExport.ts:382. execFileSync is fully synchronous, so the promises resolve one-at-a-time and block the loop.
- **Fix-Vorschlag:** Use the async execFile (promisified) inside the renderers so Promise.all actually overlaps compiles and the event loop stays responsive, or cap concurrency explicitly; alternatively run these off the main process.

#### 23. Export temp .typ files at the project root escape both the chokidar ignore list and .gitignore (only .penwright-preview* is covered)

- **Ort:** `src/main/importExport.ts:139`
- **Schwere / Kategorie:** LOW · resource-leak
- **Problem:** The export/render temp files are written to the PROJECT ROOT with `.penwright-*` names that are NOT the ignored `.penwright/` DIRECTORY: TEMP_EXPORT_BASENAME `.penwright-export-temp.typ` (line 139), TEMP_STYLE_PRINT_BASENAME `.penwright-style-print.typ` (line 171), and the per-snippet `.penwright-snip-*.typ` / `.penwright-svg-*.typ` (lines 310, 338). The file watcher only excludes `**/.penwright-preview*` (fileManager.ts:499) and the add/unlink handlers only skip paths containing `.penwright-preview` (fileManager.ts:559,565), so these `.typ` temps trigger `filetreeChanged` (sidebar flicker) while an export runs. Worse, the generated .gitignore only lists `.penwright/` and `*.pdf` (projectManager.ts:45), so none of these `.typ` temps are ignored: if the app is killed/crashes mid-export (or a cleanup catch swallows the unlink), a stray `.penwright-export-temp.typ` / `.penwright-style-print.typ` is left in the project and gets committed by the next 'Save Version' (git add -A).
- **Nachweis:** Temp basenames importExport.ts:139,171,310,338 all at path.dirname(rootFile)/os agnostic project root; watcher ignore list fileManager.ts:494-501 has only `**/.penwright-preview*`; add/unlink guards fileManager.ts:559,565 check only `.penwright-preview`; gitignore required entries projectManager.ts:45 `['.penwright/', '*.pdf']`. A `.penwright-export-temp.typ` matches none of these.
- **Fix-Vorschlag:** Broaden the watcher ignore to `**/.penwright-*` (and the add/unlink guards to match) and add `.penwright-*` to the gitignore template, so all export/verify/snippet temp files are consistently hidden and never committed.

#### 24. Preset de-dup order is reversed: a bundled preset shadows a user preset of the same id (opposite of documented intent)

- **Ort:** `src/main/presetManager.ts:98`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** scanPresetDirs() iterates presetRoots() which returns bundled first, then user (lines 66-72). It adds each id to `seen` and skips any later folder whose id is already seen. Because bundled comes first, a bundled preset wins and the user's same-id preset is skipped — yet the code comment on line 94 explicitly states 'A user preset id shadows a bundled one of the same id.' saveProjectAsPreset only de-dups the id against existing USER dirs (line 425), so a user can create a preset whose slug collides with a bundled id (e.g. naming one 'Book Novel' → slug 'book-novel', which is a shipped bundled id). The user's saved preset then never appears in the gallery and, since the delete button is gated on origin==='user' (NewProjectDialog.svelte:152), it is also un-deletable through the UI.
- **Nachweis:** presetManager.ts:66-72 pushes bundled root before user root; scanPresetDirs:105 `if (!manifest || seen.has(manifest.id)) continue;` skips the second occurrence; comment at line 94 claims the reverse. Bundled ids like 'book-novel','doc-clean' exist under resources/presets/. saveProjectAsPreset:425 only checks fs.existsSync(path.join(userRoot,id)), not bundled ids.
- **Fix-Vorschlag:** Either iterate user roots before bundled in presetRoots() (so user shadows bundled, matching the comment), or make saveProjectAsPreset's id-uniqueness check also exclude all bundled preset ids.

#### 25. unescapeYamlString applies replacements in the wrong order, corrupting anchor text containing a backslash followed by 'n'

- **Ort:** `src/main/commentManager.ts:88`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** The hand-rolled unescaper runs `.replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\')` — i.e. it un-escapes \\n and \\" BEFORE collapsing the escaped backslash \\\\ → \\. So an original two-character anchor consisting of a literal backslash then the letter n round-trips incorrectly: escapeYamlString turns `\`+`n` into `\\n` (backslash, backslash, n); on read, /\\n/ matches the second backslash+n and yields `\`+newline instead of `\`+`n`. Real inputs that hit this include a comment anchored on a Windows path like `C:\newfolder`, or on a code/regex snippet containing `\n`. The verbatim anchor is then wrong, which breaks re-anchoring (the corrupted text won't be found in the source) and marks the comment orphaned.
- **Nachweis:** commentManager.ts:88-90 `unescapeYamlString` order; escapeYamlString:85 escapes backslash first so a lone backslash becomes \\. Trace: input '\\'+'n' → escaped '\\\\'+'n' → unescape /\\n/ matches trailing '\\n' → produces '\\'+'\n'(newline). parseScalar:97 routes quoted values through unescapeYamlString, so the path is live for anchor/author/date/file/id fields.
- **Fix-Vorschlag:** Unescape in a single left-to-right pass (e.g. one regex `/\\(\\|"|n)/g` with a replacer mapping n→newline, "→quote, \\→backslash) so an escaped backslash is consumed atomically and can't be re-read as the start of a \n/\" escape.

#### 26. parseAlignedBlock corrupts non-text inner content (e.g. #figure/#table) into literal plain text

- **Ort:** `src/editor/lib/deserializer.ts:632`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** parseAlignedBlock only special-cases a single inner #image or heading; everything else goes through splitAlignedChunks → chunkToAlignedNode, whose final fallback (line 632) is parseInline(chunk). parseInline has no handler for arbitrary `#macro(...)` calls, so content like `#align(center)[#figure(image("x.png"), caption: [..])]` (a centered figure — a very plausible construct) is emitted as a paragraph whose text is the literal string `#figure(image("x.png"), caption: [..])`. The figure semantics are lost and on re-serialize the `#` is subject to escaping, breaking compilation. Because parseAlignedBlock runs at parseBlock line 252 BEFORE isRawBlock, this over-reach actively mis-parses content that, without the align wrapper, would have been safely preserved as a verbatim raw block.
- **Nachweis:** parseBlock order: line 252 `const alignNode = parseAlignedBlock(block); if (alignNode) return alignNode;` precedes isRawBlock (line 304). chunkToAlignedNode (line 589) matches only `#text(...)[...]` and `#datetime.today()...`; all else falls to `parseInline(chunk)` (line 632), and parseInline/splitInlineConstructs has no branch for `#figure(`/`#table(`/other macros, so the call is returned as a text node verbatim.
- **Fix-Vorschlag:** In the align general path, if a chunk isn't a recognized #text/#datetime/plain-inline shape (i.e. it still contains an unhandled `#macro(`), bail out of parseAlignedBlock and let the whole block fall through to isRawBlock so it round-trips verbatim, rather than emitting it as literal paragraph text.

#### 27. Blank line inside a multi-line display equation ($…$) splits the equation block

- **Ort:** `src/editor/lib/deserializer.ts:125`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** splitIntoBlocks tracks `inMath` but the blank-line block-boundary check at line 125 only guards on `!isNested` (braces/brackets/parens/code fence), NOT `inMath`. A multi-line display equation with a blank line for readability is therefore split into two blocks mid-equation. The head becomes an unbalanced-`$` raw math block; the tail line (e.g. `= "result" $`) is then independently re-parsed by parseBlock and its leading `=` matches the heading regex (line 161) — producing a spurious heading out of half an equation.
- **Nachweis:** Line 104 toggles `inMath` on unescaped `$`, and line 116's heading guard consults `wasInMath`, but line 125 `if (line.trim() === '' && !isNested)` omits any `inMath` check, so a blank line inside `$ … $` (when not also inside brackets) ends the block.
- **Fix-Vorschlag:** Include math state in the blank-line guard: `if (line.trim() === '' && !isNested && !inMath)` (mirroring how the heading branch already respects wasInMath).

#### 28. parseTable silently drops table params that appear after the cells

- **Ort:** `src/editor/lib/deserializer.ts:769`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** parseTable rejects unsupported params that come BEFORE the first cell (line 667) but not after. extractAllCells (line 754) stops at the first token that isn't a `[` cell (line 769 `break`), so a table like `#table(columns: 2, [a], [b], align: center, fill: gray)` parses successfully as a 2×1 table and silently discards the trailing `align`/`fill`/`stroke`/`gutter`/`inset` settings. On round-trip those visual settings are lost while the table still looks parseable, so the loss is invisible to the user.
- **Nachweis:** parseTable calls extractAllCells(remaining) at line 683 with the text after columns:/header; extractAllCells breaks on the first non-`[` char (line 769) and returns only the cells collected so far. Column-count validation (line 687) still passes for the cells, so parseTable returns a table node and the trailing params never reach the output.
- **Fix-Vorschlag:** After extractAllCells, if the un-consumed remainder is non-empty (trailing params exist), return null so the whole #table(...) falls back to a verbatim raw block instead of losing the dropped settings.

#### 29. Image alt text is silently discarded on save (never serialized, never re-parsed)

- **Ort:** `src/editor/lib/serializer.ts:119`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** The image node declares an `alt` attribute and the image dialog exposes an 'Alt text' input that writes it (`applyAttrs({ alt: … })`). But the serializer's `image` case only emits `src`, `width`, and `align` — `alt` is never written to the Typst `#image(…)` call (Typst supports `alt:`), and the deserializer's image regex only captures `src`+`width`. So alt text set by the user lives only in the in-memory node: it is lost on the next save/reload and never reaches the PDF or accessibility metadata.
- **Nachweis:** serializer.ts:119-133 builds `#image("src")` / `#image("src", width: …)` with no `alt`. typstImage.ts:169-181 collects and stores alt via the dialog. deserializer image regex is `/^#image\("([^"]+)"(?:\s*,\s*width:\s*([^)]+))?\)$/` (captures src+width only) — grep for `alt` in deserializer.ts returns nothing.
- **Fix-Vorschlag:** Serialize `alt` as `#image("src", alt: "…", width: …)` using typstStr() for escaping, and extend the deserializer image regex to capture `alt:`.

#### 30. Pink highlight renders invisibly in the editor (invalid CSS from a Typst-expression color value)

- **Ort:** `src/editor/components/Toolbar.svelte:82`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** The pink highlight option's applied value is the Typst expression string `rgb("#FFD1DC")` (Toolbar.svelte:82). applyHighlight stores it as the mark's `color` attr, and Highlight.renderHTML (typstMarks.ts:66) emits `background-color: ${cssColor(color)}`. cssColor only maps named colors and otherwise passes the string through (typstMarks.ts:158), producing `background-color: rgb("#FFD1DC")`, which is invalid CSS and ignored by the browser. So selecting the pink swatch (whose preview uses the valid `#FFD1DC`) applies a highlight that is invisible in the WYSIWYG editor, even though it compiles correctly in Typst — a WYSIWYG mismatch.
- **Nachweis:** Toolbar.svelte:82 `value: 'rgb("#FFD1DC")', css: '#FFD1DC'`. typstMarks.ts:61-70 renderHTML uses cssColor(mark.attrs.color); cssColor (line 144-159) returns the input unchanged when not a named color → `background-color: rgb("#FFD1DC")` is invalid CSS.
- **Fix-Vorschlag:** Have cssColor translate the `rgb("#hex")` Typst form to a CSS-valid value (extract the hex), or store the highlight color as a plain hex and convert to the Typst rgb() form only at serialization time.

#### 31. Citation hover dwell timer is not cleared when the nodeview is destroyed

- **Ort:** `src/editor/lib/typstCitation.ts:106`
- **Schwere / Kategorie:** LOW · resource-leak
- **Problem:** The citation nodeview starts a 350ms hover timer on mouseenter (line 88) and clears it on mouseleave (line 107), but returns no `destroy()` handler. If the citation node is removed (deleted, or the doc re-rendered) during the 350ms dwell without a mouseleave firing, the timer still fires against a detached `dom`; `dom.getBoundingClientRect()` returns an all-zero rect and a `penwright:citation-hover` event is dispatched, causing App.svelte to mount the CitationHoverCard at position (0,0) for a citekey that may no longer exist.
- **Nachweis:** typstCitation.ts:83-112 sets `hoverTimer` via window.setTimeout and only clears it in the mouseleave listener; the returned nodeview object (line 114-124) has no `destroy()` (contrast typstFootnote.ts:235 which does clean up). A delete between mouseenter and the 350ms callback leaks the timer and fires on a detached node.
- **Fix-Vorschlag:** Add a `destroy()` to the citation nodeview return that does `if (hoverTimer != null) window.clearTimeout(hoverTimer)`.

#### 32. Callout design element advertises a `kind` param (info/warning/tip) that is completely inert

- **Ort:** `src/shared/designElements.ts:118`
- **Schwere / Kategorie:** LOW · misleading-api
- **Problem:** The `callout` element declares a `kind` param whose description says it 'Controls the icon and accent' and the element description says 'pass kind=warning or kind=tip for variants'. But the template (lines 126-135) hardcodes `style-colors.accent` and has no `{kind}` placeholder, and the `callout` entry in the `conditionals` map (line 631) only handles `title-block` — `kind` is never read. So kind=warning, kind=tip, and kind=note all render identically to kind=info, with no icon at all. The MCP tool `penwright_insert_design_element` exposes this param, so an agent that picks kind=warning to signal danger gets a silently wrong (undifferentiated) block.
- **Nachweis:** designElements.ts template (l.126-135) contains no `{kind}`; `renderDesignElement` conditionals.callout (l.631-635) only defines `title-block`; `rg '\{kind\}|values.kind|params.kind' src/shared/designElements.ts` returns nothing. The `kind` param default 'info' (l.122) is collected into `values` but never substituted.
- **Fix-Vorschlag:** Either implement kind-driven accent/icon selection in a callout conditional (map info/warning/tip/note to accent color + leading glyph), or remove the `kind` param and the description promise so callers aren't misled.

#### 33. Four window listeners and the document drag/drop listeners are never removed (inconsistent cleanup)

- **Ort:** `src/renderer/App.svelte:292`
- **Schwere / Kategorie:** LOW · resource-leak
- **Problem:** onMount registers `penwright:show-mcp-wizard`, `penwright:show-mcp-connection`, `penwright:show-onboarding`, `penwright:edit-chapter-look` (lines 292-295) and `document` `dragover`/`drop` (299-324) as anonymous handlers. onDestroy (1008-1021) removes every other listener but not these six, because anonymous functions cannot be passed to removeEventListener. In production App is the single root component mounted once, so it is benign; but under HMR/dev remounts (and any future non-root use) the handlers accumulate — most visibly the `drop` handler, which would fire N times and dispatch N duplicate dropImagePath/dropImage messages for one dropped image.
- **Nachweis:** App.svelte:292-295 add named-action arrow listeners; 299-300 add document dragover/drop; onDestroy at 1008-1021 removes handleGlobalKeydown and the nine other `penwright:*` handlers by reference but has no matching removeEventListener for these six.
- **Fix-Vorschlag:** Hoist these handlers to named functions and remove them in onDestroy, matching the pattern used for the other listeners.

#### 34. Design-with-AI popover shows a stale selection when re-pinned without being closed first

- **Ort:** `src/renderer/components/DesignAiPopover.svelte:41`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** The popover loads the pinned selection only once, in onMount via loadPin(). App.svelte's pinSelectionForDesign() simply reassigns `designAiPopover = popoverPos` at the end (App.svelte:606) without first setting it to null. If the popover is already open (it has no backdrop, so the editor stays interactive) and the user right-clicks a different spot -> 'Design with AI', Svelte keeps the same component instance mounted and only updates the x/y props — onMount does not re-run, so loadPin() is never called again. The popover repositions to the new selection's coordinates but still displays the OLD selection text and design context (theme/accent/rubric). The on-disk pin (and thus the actual Claude/MCP handoff via penwright_get_selection) is correct; only the displayed preview is stale — so this is a display-consistency bug, not a data bug.
- **Nachweis:** DesignAiPopover.svelte:30-33 loadPin() reads selection:get; :41-44 onMount calls loadPin() once and there is no reactive re-load when x/y change. App.svelte:606 `designAiPopover = popoverPos` reassigns without nulling first, so `{#if designAiPopover}` (App.svelte:1268) keeps the instance mounted across re-pins.
- **Fix-Vorschlag:** Either null designAiPopover before re-assigning in pinSelectionForDesign (forcing a remount), or re-run loadPin() reactively when the x/y props change (e.g. `$effect(() => { void x; void y; loadPin(); })`).

#### 35. 'Import from preset' section does not react to a live UI-language switch

- **Ort:** `src/renderer/components/DesignPanel.svelte:316`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** DesignPanel is the persistent main-view Look designer (mounted once, App.svelte:1157). Its import section captures the locale once at init: `const importDe = getLocale() === 'de'` (line 316), and all import UI strings + the importMsg text (lines 639-655, 360) branch on importDe rather than calling the reactive t() store. Everything else in the panel uses t() and re-renders on locale change. Because the language picker lives in a separate Settings modal that can be toggled while DesignPanel stays mounted, switching language leaves the entire 'Import from preset' block frozen in the old language — a mixed-reactivity inconsistency that the project's own i18n conventions (call t() at call time for transient strings) warn against. (SavePresetDialog/PresetPreview also capture getLocale() once, but they are modals remounted on each open, so their capture is fine.)
- **Nachweis:** DesignPanel.svelte:316 `const importDe = getLocale() === 'de';` used in the template at lines 639-655 and in importMsg at line 360, while the rest of the component uses reactive `t().design.*`. Panel is mounted persistently (App.svelte:1157 `<DesignPanel mainView />`).
- **Fix-Vorschlag:** Move the import-section strings into the design i18n namespace and read them via t() (or compute importDe as a $derived off the i18n store) so they follow a live language switch like the rest of the panel.

#### 36. PdfFileViewer runs loadPdf twice on mount (onMount + $effect), leaking a PDFDocumentProxy/observer

- **Ort:** `src/renderer/components/PdfFileViewer.svelte:64`
- **Schwere / Kategorie:** LOW · resource-leak
- **Problem:** onMount (line 60-62) calls loadPdf(), and the `$effect(() => { if (filePath) loadPdf(); })` (line 64-66) also fires on initial mount since filePath is truthy. Both invocations run concurrently: each reads `currentPdf` as null at entry (before either await resolves), so neither destroys the other's document; whichever `getDocument` resolves first is overwritten by the second, leaking the first PDFDocumentProxy (and an IntersectionObserver) that is never destroyed. It also does the base64 read + PDF parse work twice for one open.
- **Nachweis:** onMount at line 60 and the filePath $effect at line 64 both call loadPdf() unconditionally; loadPdf only guards `if (!filePath) return` and its `if (currentPdf) currentPdf.destroy()` cannot fire on the second concurrent call because currentPdf is still null when both start. The effect alone already covers filePath changes, so onMount is redundant.
- **Fix-Vorschlag:** Drop the onMount call and rely on the `$effect` (which already reloads on filePath change), or guard against concurrent loads with an in-flight token.

#### 37. Handbook default language ignores the app's runtime locale (uses navigator.language)

- **Ort:** `src/renderer/components/HandbookViewer.svelte:17`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** The initial `lang` state is derived from `navigator.language` (lines 17-19), not from the app's actual UI locale (`i18nState.locale` / `getLocale()` from the i18n store). The inline comment even says "Default to the user's UI language". A user who runs the app on an English OS but has switched the in-app language to German (via Document Settings), or vice-versa, gets the handbook opened in the wrong language by default. Every other component reads the runtime locale from the store; this one bypasses it.
- **Nachweis:** Line 17-19: `let lang = $state<'en'|'de'>(navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en')`. The persisted/runtime UI language lives in `@shared/i18n/store.svelte` `getLocale()` (used e.g. in NewProjectDialog.svelte:3,23), which can differ from navigator.language.
- **Fix-Vorschlag:** Import `getLocale` from '@shared/i18n/store.svelte' and seed `lang` from it (fall back to navigator.language only when unset).

#### 38. Fire-and-forget api.invoke() in click handlers produce unhandled promise rejections

- **Ort:** `src/renderer/components/LicenseDialog.svelte:99`
- **Schwere / Kategorie:** LOW · bug
- **Problem:** Several onClick handlers call `api.invoke(...)` without awaiting or attaching a .catch, so any rejection becomes an unhandled promise rejection (console noise, and can be picked up by the app's unhandledRejection crash capture). Instances: LicenseDialog.handleBuy `api.invoke('license:openCheckout')` (line 100), LicenseGate.buy `api.invoke('license:openCheckout')` (LicenseGate.svelte:14), AboutDialog.openExternal `api.invoke('app:openExternal', url)` (AboutDialog.svelte:56), AcknowledgmentsDialog.openExternal (AcknowledgmentsDialog.svelte:77), HandbookViewer external-link branch `api.invoke('app:openExternal', href)` (HandbookViewer.svelte:43). Contrast with McpSetupWizard.openClaude which correctly wraps the invoke in try/catch.
- **Nachweis:** LicenseDialog.svelte:99-101 handleBuy calls `api.invoke('license:openCheckout')` with no await/catch; same pattern in LicenseGate.svelte:13-15, AboutDialog.svelte:55-57, AcknowledgmentsDialog.svelte:76-78, HandbookViewer.svelte:42-44.
- **Fix-Vorschlag:** Add `.catch(() => {})` (or await inside try/catch) to these fire-and-forget invoke calls.

#### 39. git:status labels a newly-created staged file as 'M' instead of 'A'

- **Ort:** `src/main/gitManager.ts:189`
- **Schwere / Kategorie:** LOW · correctness
- **Problem:** In the change list built for ProjectPanel, line 189 emits every `status.staged` path as status 'M' (staged:true), and line 190 separately emits `status.created ∩ status.staged` as 'A' (staged:true). The dedup at lines 195-201 keys on `path:staged`; since both entries have staged:true and the 'M' entry is pushed first, the 'A' entry is discarded. A brand-new file that has been `git add`ed therefore shows the modified badge instead of the added badge.
- **Nachweis:** Lines 188-201: `...status.staged.map(f => ({status:'M',staged:true}))` then `...status.created.filter(f => status.staged.includes(f)).map(f => ({status:'A',staged:true}))`, then `filter` on key `${path}:${staged}` keeps the first (M). simple-git populates a newly-added file in both `staged` and `created` (the code's own line-191 filter `!status.staged.includes(f)` shows the author models created-and-staged files as being in `staged`).
- **Fix-Vorschlag:** Build the staged list from created∪modified with created taking precedence, e.g. map staged files to 'A' when they are in status.created, else 'M' — or drop the plain `status.staged.map(...'M')` line and derive M/A explicitly.

#### 40. documentBaseUri message declares field 'baseUri' but every sender emits 'uri'

- **Ort:** `src/editor/lib/messages.ts:14`
- **Schwere / Kategorie:** LOW · ipc-mismatch
- **Problem:** DocumentBaseUriMessage's typed contract names the payload field `baseUri`, but both main-process senders emit `uri`. The renderer only survives because it defensively reads both fields; any future consumer that trusts the declared type (`message.baseUri`) will read undefined and silently lose the document base URI (breaking relative image resolution).
- **Nachweis:** messages.ts:14 `baseUri: string;`. Senders: fileManager.ts:242-245 `{ type:'documentBaseUri', uri: path.dirname(...) }` and ipcHandlers.ts:280-283 `{ type:'documentBaseUri', uri: ... }`. Renderer coerces at messageHandler.ts:68 `const uri = (message as ...{uri?}).uri || (message as ...{baseUri?}).baseUri || ''`.
- **Fix-Vorschlag:** Pick one field name — rename the senders to `baseUri` (matching the type) or change the type field to `uri` — and drop the dual-read fallback in messageHandler.ts:68.

---

## 4 · Dead Code & ungenutzte Dependencies

Verwaiste Exports/Module/Dateien und nicht importierte npm-Pakete. Reine Aufräum-Kandidaten — kein Laufzeit-Schaden, aber Wartungslast, Bundle-Größe und (bei Deps) Angriffsfläche/Notarisierung.

#### 41. Unused runtime dependencies: node-pty, @xterm/xterm, @xterm/addon-fit (integrated terminal was removed)

- **Ort:** `package.json:47`
- **Schwere / Kategorie:** MEDIUM · dead-code/deps
- **Problem:** CLAUDE.md documents that the integrated terminal / xterm / node-pty / src/cli were removed. These three packages are no longer imported anywhere in src/ or scripts/, yet remain in `dependencies`. node-pty is a native module that electron-builder will still attempt to bundle/rebuild, bloating the package and risking notarization/signing of an unused native binary.
- **Nachweis:** `rg -l "@xterm/xterm|@xterm/addon-fit|node-pty" src scripts` → 0. The only remaining reference is `external: ['electron','node-pty']` in esbuild.main.mjs, which is itself an orphan build file not referenced by any npm script (electron-vite/electron.vite.config.mts is the real build).
- **Fix-Vorschlag:** Remove @xterm/xterm, @xterm/addon-fit, node-pty from dependencies (and the stale node-pty external / esbuild.main.mjs).
- **Hinweis:** Auch separat gemeldet als „obsolete Native-/Terminal-Deps im Production-Build".

#### 42. `getLastProjectPath` / `lastProjectPath` store field is write-only

- **Ort:** `src/main/persistenceManager.ts:178`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** saveLastProjectPath() is called on project open (fileManager.ts:286) but getLastProjectPath() has zero callers anywhere in the repo. Per CLAUDE.md the app 'starts at the Start Screen and never auto-reopens a project', so the stored lastProjectPath is never read back. The getter, setter's effect, and the StoreSchema.lastProjectPath field are dead state.
- **Nachweis:** rg -n "getLastProjectPath" src --glob '!persistenceManager.ts' → no results. Only saveLastProjectPath is called (fileManager.ts:286). CLAUDE.md: 'never auto-reopens a project.'
- **Fix-Vorschlag:** Remove getLastProjectPath, saveLastProjectPath, and the lastProjectPath schema field (or wire the getter into a deliberate reopen feature).

#### 43. Exported `getTrialStartedAt` has no callers

- **Ort:** `src/main/persistenceManager.ts:230`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** getTrialStartedAt() is exported but never imported/called anywhere; the trial clock is read exclusively through ensureTrialStarted() and getTrialEndMs() in licenseManager.ts. Genuinely unused public API.
- **Nachweis:** rg -n "getTrialStartedAt" src --glob '!persistenceManager.ts' → no results. licenseManager.ts uses ensureTrialStarted (lines 202,222) instead.
- **Fix-Vorschlag:** Delete getTrialStartedAt.

#### 44. Low-level git IPC handlers git:stage/unstage/stageAll/commit/init are unreachable

- **Ort:** `src/main/gitManager.ts:217`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** Five low-level git handlers (git:stage, git:unstage, git:stageAll, git:commit, git:init) are registered and whitelisted in preload but invoked by nothing — the renderer's 'Erweitert' cloud-sync section only uses git:push, git:pull, git:getRemote, git:setRemote. CLAUDE.md says the low-level verbs are 'kept for the optional Erweitert cloud-sync section', but these five specific ones have zero callers across the whole repo, so they are currently dead surface area (extra preload channels + handlers).
- **Nachweis:** rg across src for each channel string (excluding gitManager.ts + preload-entry.ts) returns no matches for git:stage, git:unstage, git:stageAll, git:commit, git:init. Only git:push and git:pull are called (ProjectPanel.svelte:184,192).
- **Fix-Vorschlag:** If the Erweitert UI won't use them, drop the five handlers and their preload whitelist entries; keep only push/pull/getRemote/setRemote.

#### 45. Exported isLicensed() and isProUser() are unused across the entire codebase

- **Ort:** `src/main/licenseManager.ts:158`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** isLicensed() (line 158) and its back-compat alias isProUser() (line 166, which just returns isLicensed()) are exported but never called anywhere in src/, the MCP server, or scripts. The single-source gate is getEntitlement(); these two functions are leftover plumbing. They are only referenced by each other and by an archived doc (documentation/done/pricing-and-licensing.md).
- **Nachweis:** rg -n 'isLicensed|isProUser' over the whole repo (excluding node_modules/dist/documentation) returns only the definitions in licenseManager.ts lines 158/166/167 — isProUser calls isLicensed, and nothing calls isProUser. No renderer, ipcHandler, preload, or mcp reference exists.
- **Fix-Vorschlag:** Delete isLicensed() and isProUser(), or keep only if a public API surface is intended; getEntitlement()/license:getStatus already cover all callers.
- **Hinweis:** Ebenfalls bestätigt: der echte Gate ist `getEntitlement()`; `isProUser()`/`isLicensed()` sind tot.

#### 46. Unused imports: styleTemplates and COLOR_SLOTS

- **Ort:** `src/mcp/server.ts:26`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** `styleTemplates` (import line 26) and `COLOR_SLOTS` (import line 30, inside the styleTypes import block) are imported but never referenced anywhere in server.ts. penwright_list_styles / penwright_apply_style were migrated to THEME_PRESETS, leaving the legacy styleTemplates import orphaned in this file. Dead imports only; no runtime effect, but flagged since the audit calls out genuinely-unused symbols.
- **Nachweis:** rg -n "styleTemplates" src/mcp/server.ts → only the import at line 26. rg -n "COLOR_SLOTS" src/mcp/server.ts → only the import at line 30. No other occurrences in the file.
- **Fix-Vorschlag:** Remove `styleTemplates` from the import list and drop `COLOR_SLOTS` from the styleTypes import.

#### 47. `getDocumentBaseUri` is an unused exported function

- **Ort:** `src/editor/lib/typstImage.ts:27`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** `getDocumentBaseUri()` is exported but has zero call sites anywhere in the repo (src, scripts, tests). Only `setDocumentBaseUri` is imported/used (by messageHandler.ts). Dead export. (Note: the sibling `serializeTypst` non-cached export in serializer.ts is NOT dead — it is used by scripts/roundtrip-test.mts and scripts/compile-stability-test.mts.)
- **Nachweis:** `rg -n "getDocumentBaseUri" .` (excluding node_modules/dist) returns only the definition at typstImage.ts:27 — no callers.
- **Fix-Vorschlag:** Remove the unused `getDocumentBaseUri` export.

#### 48. NewFileMessage ('newFile') is defined but never sent or handled

- **Ort:** `src/editor/lib/messages.ts:125`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** NewFileMessage (type 'newFile') is declared and included in the WebviewMessage union but is never dispatched by any sender and has no case in the main-process message switch (ipcHandlers.ts handles every other WebviewMessage type). It is a leftover message type.
- **Nachweis:** rg for `'newFile'` across src returns only messages.ts:126 (the definition). The ipcHandlers.ts switch (grep of every WebviewMessage case) has cases for all other types but no `case 'newFile'`.
- **Fix-Vorschlag:** Remove NewFileMessage and its entry in the WebviewMessage union, or wire up a sender+handler if a New File action is intended.

#### 49. Unused imports: parseTypstGrid, ParsedGrid, RawDesc

- **Ort:** `src/shared/docxSerializer.ts:51`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** docxSerializer imports `parseTypstGrid` and `ParsedGrid` from './typstGrid' (line 51) and the type `RawDesc` from './exportContext' (line 54), but none are referenced anywhere in the file. Grid handling is done entirely via classifyRawBlock (which returns { kind:'grid', parsed } already built by exportContext), so the serializer only ever reads `desc.parsed`, never calls parseTypstGrid or annotates with ParsedGrid/RawDesc. Dead imports; a noUnusedLocals build would flag them.
- **Nachweis:** `rg -n 'parseTypstGrid|ParsedGrid|RawDesc' src/shared/docxSerializer.ts` returns only the two import lines (51 and 54) — zero use sites in the 2117-line file.
- **Fix-Vorschlag:** Remove `parseTypstGrid, type ParsedGrid` from the './typstGrid' import (drop the whole import line) and drop `type RawDesc` from the './exportContext' import list.

#### 50. DocxCtx.equationNumbering field is written but never read

- **Ort:** `src/shared/docxSerializer.ts:153`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** DocxCtx declares `equationNumbering: boolean` (line 153) and buildExportContext assigns it into the returned ctx (line 1606), but no code ever reads activeCtx.equationNumbering / ctx.equationNumbering. The equation-number logic uses the LOCAL `equationNumbering` variable inside buildExportContext (lines 1531,1570,1571); the render pass gets numbers purely from labelMap.numberText. The struct field is write-only dead state.
- **Nachweis:** `rg -n 'equationNumbering' src/shared/docxSerializer.ts` -> 153 (decl), 1531 (local), 1570-1571 (local reads), 1606 (ctx assignment). No `.equationNumbering` read on any ctx/activeCtx value.
- **Fix-Vorschlag:** Drop the equationNumbering field from the DocxCtx interface and from the ctx object literal, or actually consume it if a future render-pass check needs it.

#### 51. isBibliographyNode and isOutlineNode are exported but never used

- **Ort:** `src/shared/exportContext.ts:516`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** Two exported helper predicates in exportContext.ts are never referenced anywhere in the codebase. isBibliographyNode (line 516) and isOutlineNode (line 524) have no call sites. The HTML serializer uses its own local isBibliographyContent (htmlSerializer.ts:661) and an inline /^#outline\b/ test (htmlSerializer.ts:779) instead, and the DOCX serializer does not import them either. They are orphaned API surface.
- **Nachweis:** `rg -n "isBibliographyNode" --type ts` returns only the definition at src/shared/exportContext.ts:516; `rg -n "isOutlineNode"` returns only the definition at line 524. No usages in src/, scripts/, or tests. Meanwhile htmlSerializer.ts:661 defines a separate isBibliographyContent and line 779 inlines the outline check.
- **Fix-Vorschlag:** Delete both exports, or wire renderRawBlockHtml/serializeHtml to use them so the classification logic has one home.

#### 52. Exported `getTheme()` helper is never called anywhere

- **Ort:** `src/shared/themePresets.ts:369`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** `getTheme(id)` is exported to return a sanitized clone of a theme by id, but no code uses it. Every consumer (MCP `src/mcp/server.ts` for penwright_apply_style/generate_layout, renderer `DesignPanel.svelte`, `DesignAiPopover.svelte`) instead does `THEME_PRESETS.find(...)` inline and re-sanitizes itself. The helper is dead and, being unused, quietly duplicates the find+sanitize logic the callers already reimplement.
- **Nachweis:** `rg -n getTheme --glob '!dist/**'` returns only the definition line (themePresets.ts:369). `rg -n THEME_PRESETS` shows all real consumers use `.find(...)` directly (server.ts:925/1251, DesignPanel.svelte:276, DesignAiPopover.svelte:52).
- **Fix-Vorschlag:** Delete `getTheme`, or route the inline `THEME_PRESETS.find` consumers through it to remove the duplication.

#### 53. Exported `getLayout()` helper is never called anywhere

- **Ort:** `src/shared/layoutPresets.ts:167`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** `getLayout(id)` is exported to return `{ layout, baseSize }` for a preset id, but nothing calls it. Both consumers (MCP `penwright_apply_layout` in server.ts and `DesignPanel.svelte`) use `LAYOUT_PRESETS.find(...)` directly. Genuinely dead exported code.
- **Nachweis:** `rg -n getLayout --glob '!dist/**'` returns only the definition (layoutPresets.ts:167). `rg -n LAYOUT_PRESETS` shows server.ts:1119/1252 and DesignPanel.svelte:306 all call `.find` directly instead.
- **Fix-Vorschlag:** Delete `getLayout`, or have the inline `.find` callers use it.

#### 54. Entire SourceImporter module is dead code (and depends on an uninstalled package)

- **Ort:** `src/shared/sourceImporter.ts:28`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** The SourceImporter class (~330 lines: sources/ scan, DOI extraction, CrossRef queries, .bib writing) is never instantiated or imported anywhere in src/. Its only references are in itself and in historical docs under documentation/done/. It also does `require('pdf-parse')` (lines 174, 201), but `pdf-parse` is not a dependency in package.json, so even if the class were wired up its PDF paths would silently no-op via the try/catch. Because serializeBibFile() in bibParser.ts is consumed ONLY by this dead module, that exported function is transitively dead too. Shipping this unreferenced module and its phantom dependency is pure launch risk/bloat.
- **Nachweis:** `rg -n "SourceImporter" --glob '!node_modules' --glob '!dist'` yields only src/shared/sourceImporter.ts:28 plus documentation/done markdown. `rg -n "pdf-parse" package.json` returns nothing. `rg -n "serializeBibFile" src` shows callers only inside sourceImporter.ts (lines 128, 167).
- **Fix-Vorschlag:** Delete src/shared/sourceImporter.ts (and serializeBibFile if no live caller emerges), or wire it up and add pdf-parse as a real dependency. As-is it is orphaned.
- **Hinweis:** Gesamtes 356-Zeilen-Modul verwaist; hängt zudem von einem nicht installierten Paket ab.

#### 55. Unused imports in App.svelte: zoomPdfIn/zoomPdfOut/resetPdfZoom and setEditorLanguage

- **Ort:** `src/renderer/App.svelte:61`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** App.svelte imports `zoomPdfIn`, `zoomPdfOut`, `resetPdfZoom` (lines 61-63) from appState.svelte and `setEditorLanguage` (line 37) from editor, but none are referenced anywhere in App.svelte's script or template. The PDF-zoom functions are used only by PreviewPanel.svelte / PdfFileViewer.svelte and messageHandler.ts (which import them independently); setEditorLanguage is used only by messageHandler.ts. Harmless at runtime (tree-shaken) but genuinely dead imports.
- **Nachweis:** rg across src shows zoomPdfIn/zoomPdfOut/resetPdfZoom referenced in appState.svelte.ts (defs), PdfFileViewer.svelte, PreviewPanel.svelte, and messageHandler.ts — never in App.svelte body (only import lines 61-63). `rg -n setEditorLanguage src/renderer/App.svelte` returns only the import at line 37; usages are messageHandler.ts:64/103.
- **Fix-Vorschlag:** Remove the four unused imports from App.svelte.

#### 56. Orphaned esbuild.main.mjs / esbuild.preload.mjs reference non-existent entry files and are wired to nothing

- **Ort:** `esbuild.main.mjs:6`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** esbuild.main.mjs builds `src/main/main.ts` → dist/main/main.mjs and esbuild.preload.mjs builds `src/main/preload.ts` → dist/main/preload.js. Neither source file exists — the real main/preload entries are src/main/index.ts and src/main/preload-entry.ts, built by electron-vite (electron.vite.config.mts). No package.json script, CI, or hook invokes either esbuild script. They are leftovers from the pre-electron-vite build and would fail with a 'Could not resolve src/main/main.ts' error if anyone ran them. (esbuild.mcp.mjs is different — it targets the real src/mcp/server.ts and is intentionally kept for the legacy Node MCP path.)
- **Nachweis:** `ls src/main/main.ts src/main/preload.ts` → both MISSING (only index.ts / preload-entry.ts exist). `rg 'esbuild\.(main|preload)\.mjs' --glob '!node_modules'` finds no reference except documentation/done/. package.json scripts reference only esbuild.mcp.mjs (build:mcp), never esbuild.main/preload.
- **Fix-Vorschlag:** Delete esbuild.main.mjs and esbuild.preload.mjs (dead relics of the old build); electron-vite handles main/preload/renderer.
- **Hinweis:** Ebenso verwaist: `patch-electron.mjs` und `esbuild.preload.mjs` — an keinen npm-Script/CI-Schritt angebunden.

#### 57. Obsolete electron-builder-notarize devDependency after switch to built-in notarize

- **Ort:** `package.json:73`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** electron-builder-notarize is still a devDependency, but the `afterSign: electron-builder-notarize` hook was removed and the build now uses `mac.notarize: true` (built-in notarytool) as the single notarizer (documented in CLAUDE.md as the deliberate de-dup to avoid double-notarization). The build config no longer has any afterSign entry, so the package is unused.
- **Nachweis:** rg 'electron-builder-notarize|afterSign' over the repo shows references only in package.json/package-lock and historical docs — no `afterSign` key exists in package.json's build config. CLAUDE.md: 'the redundant afterSign: electron-builder-notarize was removed (it double-notarized).'
- **Fix-Vorschlag:** Remove electron-builder-notarize from devDependencies.

#### 58. Unused dependency dompurify (+ devDep @types/dompurify)

- **Ort:** `package.json:54`
- **Schwere / Kategorie:** LOW · dead-code/deps
- **Problem:** dompurify and its @types are declared but never imported. The SVG hardening that CLAUDE.md refers to (sanitizeSvg) is implemented with hand-rolled regex in htmlSerializer.ts, not DOMPurify.
- **Nachweis:** `rg -li "dompurify|DOMPurify" src scripts` → 0 (matches only in package.json / package-lock / project_status.md). sanitizeSvg defined at src/shared/htmlSerializer.ts:567 is pure string/regex.
- **Fix-Vorschlag:** Remove dompurify from dependencies and @types/dompurify from devDependencies.

#### 59. Unused devDependency concurrently

- **Ort:** `package.json:73`
- **Schwere / Kategorie:** LOW · dead-code/deps
- **Problem:** concurrently is not referenced by any package.json script or source file.
- **Nachweis:** `rg -l concurrently` outside node_modules → only package.json and package-lock.json. No npm script uses it.
- **Fix-Vorschlag:** Remove concurrently from devDependencies.

#### 60. Exported clearProjectPenwrightData() is never called

- **Ort:** `src/main/persistenceManager.ts:643`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** The exported helper clearProjectPenwrightData(projectDir) has no callers anywhere in the repo.
- **Nachweis:** `rg -n "\bclearProjectPenwrightData\b" src -t ts -t svelte` returns only the definition in persistenceManager.ts.
- **Fix-Vorschlag:** Remove the function, or wire it to whatever cleanup UI was intended.

#### 61. Dead IPC channel persist:getZoteroBibPath (whitelisted + handled, but no renderer caller)

- **Ort:** `src/main/preload-entry.ts:101`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** The channel is whitelisted in the preload INVOKE list and has a main handler (ipcHandlers.ts:759), but nothing in the renderer ever invokes it — the getZoteroBibPath value is never consumed by the UI.
- **Nachweis:** `rg -rn "getZoteroBibPath|persist:getZoteroBibPath" src/renderer src/editor` → 0 matches. Handler exists at src/main/ipcHandlers.ts:759.
- **Fix-Vorschlag:** Remove the channel from the whitelist + handler + persistenceManager export if the Zotero-path UI path is truly gone, or hook it up.

#### 62. getCurrentLockPath() is exported but never called

- **Ort:** `src/main/lockManager.ts:148`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** `export function getCurrentLockPath()` has zero references anywhere in the repo. The internal `currentLockPath` is used only inside lockManager.
- **Nachweis:** `rg -n "getCurrentLockPath" src scripts` returns only the definition at lockManager.ts:148.
- **Fix-Vorschlag:** Remove the export (and the function if not needed internally).

#### 63. Eight unreachable case branches in the main 'penwright' IPC switch (VS Code-era message handlers)

- **Ort:** `src/main/ipcHandlers.ts:315`
- **Schwere / Kategorie:** LOW · dead-code
- **Problem:** The renderer->main `ipcMain.on('penwright')` switch has cases that no code path can reach. The native menu triggers the corresponding work directly in the main process via state.handle* / direct calls (menuBuilder.ts: handleExportPdf/handleExportDocx/handleExportWeb/handleImportMarkdown/handleLinkZotero at lines 80-97), the renderer never sends these message types, and they are not in MENU_MAIN_ACTIONS (messageHandler.ts:268-278). The matching WebviewMessage variants in messages.ts are also unused. Unreachable cases: exportPdf (315), exportDocx (320), importMarkdown (357), setWordGoal (421), applyStyle (428), linkZotero (457), importStyleTemplate (482), openUserGuide (498).
- **Nachweis:** grep across src for `'exportPdf'`, `'exportDocx'`, `'linkZotero'`, `'importMarkdown'`, `'importStyleTemplate'`, `'openUserGuide'`, `'applyStyle'`, `'setWordGoal'` finds each ONLY in messages.ts (type decl) and ipcHandlers.ts (the case) — zero senders. Menu wires the real work via state.handleExportPdf() etc. (menuBuilder.ts:80,84,88,93,97) and index.ts:200-204 assigns appState.handleExportPdf = handleExportPdf. MENU_MAIN_ACTIONS (messageHandler.ts:268) does not list any of these eight.
- **Fix-Vorschlag:** Delete the eight unreachable case branches and their now-unused WebviewMessage variants (ExportPdfMessage, ExportDocxMessage, SetWordGoalMessage, ApplyStyleMessage, ImportStyleTemplateMessage, OpenUserGuideMessage, plus linkZotero/importMarkdown which have no message type), or route the menu through them if a single dispatch path is desired.

---

## 5 · Duplikation (Drift-Risiko)

Dieselbe nicht-triviale Logik an mehreren Stellen. Kein Sofort-Bug, aber bei Änderung einer Kopie driften die anderen weg — mehrere Fälle sind bereits divergiert.

#### 64. `.gitignore`-ensuring logic copy-pasted across three sites — will drift

- **Ort:** `src/main/gitManager.ts:29`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** The 'ensure .penwright/ and *.pdf are ignored, appending a `# Penwright` block with correct leading-newline handling' logic exists in three near-identical copies: gitManager.ts ensureGitignore (GITIGNORE_REQUIRED_LINES = ['.penwright/', '*.pdf'] at line 27-43), projectManager.ts ensureProjectInfrastructure (required = ['.penwright/', '*.pdf'] at lines 45-50), and projectManager.ts openSampleProject (hard-coded full template string at line 446). The required-ignore list and the prefix/newline append logic are duplicated. Adding a new required ignore line (or fixing the append formatting) requires editing all three, and openSampleProject's variant only writes the template when the file is absent — it won't add missing lines to an existing .gitignore the way the other two do, so the copies already behave differently.
- **Nachweis:** rg -n "\.penwright/'|GITIGNORE|# Penwright" src/main/projectManager.ts src/main/gitManager.ts shows the three sites: gitManager.ts:27,37,41; projectManager.ts:21,41,45,49,446.
- **Fix-Vorschlag:** Extract a single shared ensureGitignore(dir) helper and call it from all three project-setup paths.

#### 65. htmlSerializer re-implements matchBracket instead of importing the one from exportContext, and the two have already drifted

- **Ort:** `src/shared/htmlSerializer.ts:221`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** htmlSerializer.ts already imports many helpers from exportContext.ts, which exports a matchBracket (line 179). Yet htmlSerializer defines its own private matchBracket (line 221) with the same purpose. The two implementations differ in escaped-quote handling: exportContext uses `if (ch === '"' && s[i-1] !== '\\') inStr = !inStr` (mishandles a `\\"` escaped-backslash-then-quote), while htmlSerializer does a proper `if (c === '\\') { i++; ... }` skip. typstGrid.ts has yet a third variant (matchParen/matchPair). This is copy-pasted balanced-bracket logic that has already diverged and will drift further, producing inconsistent parsing of the same Typst source between the DOCX/pre-pass path and the HTML render path.
- **Nachweis:** `rg -n "function matchBracket|const matchBracket" src/shared` shows definitions at exportContext.ts:179 and htmlSerializer.ts:221; htmlSerializer.ts already does `import { classifyRawBlock, ... } from './exportContext'` (line 21-32) but not matchBracket. The string-escape branches differ line-for-line (exportContext.ts:185 vs htmlSerializer.ts:224).
- **Fix-Vorschlag:** Import matchBracket from exportContext in htmlSerializer (and reconcile typstGrid's matchParen/matchPair) so all export paths share one string-aware bracket matcher.

#### 66. Selection→anchor capture logic copy-pasted between addCommentFromSelection and pinSelectionForDesign

- **Ort:** `src/renderer/App.svelte:530`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** pinSelectionForDesign() (530-607) duplicates, nearly verbatim, three non-trivial blocks from addCommentFromSelection() (457-522): (1) the 'no selection -> expand to surrounding word' walk using resolve(from)/parentOffset and the `/\S/` boundary loops (App.svelte:468-482 vs 541-555), (2) the `project:getInfo` fetch + null-projectDir guard, and (3) the project-relative path derivation `startsWith(projectDir + '/') ? slice(...) : replace(/^.*\//,'')` then `.replace(/\\/g,'/')` (498-500 vs 588-590). refreshCommentMarks() (708-714) holds a third copy of the rel-path derivation. These anchor-capture heuristics feed the same offset/occurrence contract consumed by comments and the MCP design tools; an edit to the word-boundary or rel-path logic in one place will silently diverge from the others.
- **Nachweis:** App.svelte:468-482 is identical to 541-555 (word-expansion loop); 498-500, 588-590, and 714 are identical rel-path derivations. CLAUDE.md states pinSelectionForDesign is 'modeled on addCommentFromSelection()'.
- **Fix-Vorschlag:** Extract shared helpers: captureSelectionAnchor(editor) -> { anchorText, occurrence, nodeType } and toProjectRelPath(currentFile, projectDir); call from both functions and refreshCommentMarks.

#### 67. Reference-vs-citation label vocabulary defined in 3 independent, already-divergent places

- **Ort:** `src/shared/docxSerializer.ts:2042`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** The rule for deciding whether an `@name` is a cross-reference or a citation is encoded three times: (a) `deserializer.ts:825` `REFERENCE_PREFIXES` (a Set, used by the editor), and two byte-identical copies of the regex `REF_PREFIXES = /^(fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst|figure|table|equation|section|chapter|appendix)\b/i` in (b) `htmlSerializer.ts:193` and (c) `docxSerializer.ts:2042`. exportContext.ts is explicitly the designated single source of truth for citation classification, yet it does not own this list. The three copies ALREADY diverge: the editor Set knows `theorem`, `lemma`, `definition`, `corollary`, `proposition`, `algorithm`, `listing`, `eqn`, `tab`, `alg`; the two export regexes do not (they only carry the short abbrevs `thm|lem|def|...` plus a handful of full words, and `\b` prevents `lem` from matching `lemma`, `def` from matching `definition`, etc.).
- **Nachweis:** deserializer.ts:848 isReferenceLabel treats a colon-less exact-match `@theorem`/`@lemma`/`@algorithm` (all present in REFERENCE_PREFIXES) as a reference. The html/docx REF_PREFIXES regex does NOT match `theorem`/`lemma`/`definition`/`algorithm` (no such alternative; `\b` blocks lem→lemma), so the same token in a raw-block export path is rendered as a citation `(theorem)` / `[?]`. Result: within one document `@theorem` in prose = cross-ref (editor) but `@theorem` inside a raw magazine container = citation (DOCX/HTML). Adding a new label prefix requires editing all three copies or the editor and the two exports silently disagree. The html and docx regexes being verbatim copy-paste is a textbook drift hazard.
- **Fix-Vorschlag:** Export one shared `REFERENCE_PREFIXES` list (and an `isReferenceLabel`/`refPrefixTest` helper) from exportContext.ts (or a shared module) and import it into deserializer.ts, htmlSerializer.ts and docxSerializer.ts so all four decision points use identical vocabulary.

#### 68. Root-file candidate list ['main.typ','document.typ','index.typ'] hardcoded in 6+ places

- **Ort:** `src/main/ipcHandlers.ts:173`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** The ordered list of default root-file basenames used for root/style resolution is copy-pasted independently in at least six locations. Adding or reordering a candidate (e.g. a future 'root.typ') in one site silently leaves the others behind, so main-process style resolution, preset scanning and the MCP server would disagree about which file is the document root.
- **Nachweis:** Identical literal `['main.typ', 'document.typ', 'index.typ']` at ipcHandlers.ts:173 (resolveStyleRootFile), projectManager.ts:95, presetManager.ts:385 (findRootFileIn), and mcp/server.ts:162, 284, 426. These are separate implementations of the same 'pick the project root file' heuristic.
- **Fix-Vorschlag:** Export a single `ROOT_FILE_CANDIDATES` const (and ideally a `findRootFileIn(dir)` helper) from a shared module and import it everywhere.

#### 69. Label-type classifier duplicated between deserializer.refTypeFromLabel and projectLabels.classifyLabel

- **Ort:** `src/editor/lib/deserializer.ts:857`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** Two near-identical prefix→type classifiers exist: `deserializer.ts:857 refTypeFromLabel` (maps a label prefix to figure/table/equation/heading/other for the editor's reference badge/picker) and `projectLabels.ts:79 classifyLabel` (maps the same prefixes to figure/table/equation/heading/other for the cross-reference picker rows). They share the exact same prefix→type mapping but are maintained separately, so a change to how one classifies (e.g. adding `alg`→listing) will make the picker icons and the editor badge type disagree.
- **Nachweis:** deserializer.ts:857-865 and projectLabels.ts:79-89 both contain the same `if (prefix === 'fig' || prefix === 'figure') return 'figure'; ... 'tbl'/'table'/'tab' → 'table'; 'eq'/'eqn'/'equation' → 'equation'; 'sec'/'section'/'chap'/'chapter' → 'heading'` chain. One reads a colon prefix only; the other also handles the bare-name case — already a subtle divergence.
- **Fix-Vorschlag:** Extract a single `labelType(name)` helper into a shared module and use it in both the deserializer and projectLabels.

#### 70. BCP-47 spellcheck language map duplicated verbatim in two files

- **Ort:** `src/main/fileManager.ts:255`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** The exact same 13-entry lang->BCP47 map (en:'en-US', de:'de-DE', ...ru:'ru-RU') plus the setSpellCheckerLanguages call is copy-pasted in fileManager.openFile and the spellcheck:setLanguage IPC handler. Adding or correcting a language in one place will silently leave the other stale (e.g. open-file spellcheck vs. runtime language-switch spellcheck disagreeing).
- **Nachweis:** fileManager.ts:255-262 and ipcHandlers.ts:713-720 contain byte-identical `const bcp47Map: Record<string,string> = { en:'en-US', de:'de-DE', fr:'fr-FR', es:'es-ES', it:'it-IT', pt:'pt-BR', nl:'nl-NL', sv:'sv-SE', da:'da-DK', nb:'nb-NO', fi:'fi-FI', pl:'pl-PL', ru:'ru-RU' }` followed by the same resolve + setSpellCheckerLanguages logic.
- **Fix-Vorschlag:** Extract a single `resolveSpellcheckLocale(lang)` helper (and/or a setSpellcheck helper) into a shared module and call it from both sites.

#### 71. REF_PREFIXES citation-vs-reference regex duplicated in the DOCX and HTML serializers

- **Ort:** `src/shared/htmlSerializer.ts:193`
- **Schwere / Kategorie:** LOW · duplication
- **Problem:** The identical `REF_PREFIXES` regex that decides whether an @name is a cross-reference or a citation is defined separately in htmlSerializer.ts and docxSerializer.ts. CLAUDE.md designates src/shared/exportContext.ts as the single source of truth for cross-reference/citation classification shared by both serializers, so this pair should live there. If the prefix set changes in one serializer, DOCX and HTML exports will classify @refs differently.
- **Nachweis:** htmlSerializer.ts:193 and docxSerializer.ts:2042 both declare `const REF_PREFIXES = /^(fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst|figure|table|equation|section|chapter|appendix)\b/i;` and use it identically (htmlSerializer.ts:293,372; docxSerializer.ts:2044). A near-identical prefix list also appears in the deserializer and skillTemplates.ts:433.
- **Fix-Vorschlag:** Move REF_PREFIXES (and the `name.includes(':') || REF_PREFIXES.test(name)` predicate) into exportContext.ts and import it in both serializers.

---

## 6 · PLAUSIBLE — laufzeitabhängig, vor Fix verifizieren

Diese Befunde sind statisch plausibel, hängen aber von Laufzeit-Zuständen (frische Maschine, Nebenläufigkeit, Offline-Tage, Timing) ab, die der Verifier nicht abschließend prüfen konnte. Vor einem Fix kurz reproduzieren.

#### P1. Git commits never set a committer identity — Save Version can hard-fail on fresh machines

- **Ort:** `src/main/gitManager.ts:141` · MEDIUM · bug
- **Problem:** Every commit path in the app (git:saveVersion at gitManager.ts:141, and the initial commits in projectManager.ensureProjectInfrastructure:76 and openSampleProject:449, and presetManager) calls simple-git's git.commit() without ever configuring user.name/user.email (no `git config`, no `-c user.*`, no GIT_AUTHOR_* env — confirmed by repo-wide grep: zero matches for user.name/user.email/addConfig/committer). The versioning feature therefore relies entirely on the end user having a GLOBAL git identity, or on git's discouraged auto-detection. Penwright targets non-developer writers (thesis authors, magazine designers) who very often have never run `git config --global user.email`. On any machine where git cannot auto-construct an identity (e.g. user.useConfigOnly=true, or no gecos/hostname), `git commit` fails hard with 'Please tell me who you are'. In ensureProjectInfrastructure/openSampleProject the failure is swallowed by try/catch (repo left initialised but with no initial commit), but git:saveVersion (line 141) has NO catch, so the IPC promise rejects and the user's very first 'Version speichern' throws — the core feature is broken for that user.
- **Nachweis:** rg -n "user\.name|user\.email|addConfig|GIT_AUTHOR|committer" src → no git-config matches anywhere. gitManager.ts:141 `const result = await git.commit(message);` with no identity configured; projectManager.ts:76 and :449 same. On a machine with no global git identity and auto-detect disabled, `git commit` exits non-zero, rejecting the git:saveVersion IPC.
- **Fix-Vorschlag:** Set a local repo identity right after `git.init()` in ensureRepo/ensureProjectInfrastructure/openSampleProject (e.g. `git.addConfig('user.name','Penwright', false, 'local')` + a placeholder email), or pass `-c user.name=… -c user.email=…` on the commit, so version-saving never depends on the user's global git config.

#### P2. In-editor search mutates ProseMirror's managed contentDOM directly on every keystroke

- **Ort:** `src/editor/components/SearchReplace.svelte:91` · MEDIUM · bug
- **Problem:** performSearch()/clearHighlights() wrap matches with `range.surroundContents(mark)` (line 91) and later unwrap with `parent.replaceChild(...); parent.normalize()` (lines 31-42) directly on `editor.view.dom`, which is ProseMirror's managed contentDOM. This runs inside a $effect on every searchTerm change (line 170-174). PM's DOMObserver treats these as foreign mutations and can re-read/repaint the DOM, dropping the inserted <mark>s, resetting the selection, or (with surroundContents across node-view boundaries) throwing. Highlights are the classic use-case for ProseMirror Decorations, not raw DOM surgery.
- **Nachweis:** SearchReplace.svelte:91 `range.surroundContents(mark)` on nodes obtained by walking `editor.view.dom`; clearHighlights (29-42) calls `parent.normalize()` on the same tree; performSearch is driven by `$effect` (170) on each keystroke. None of it goes through editor.view.dispatch.
- **Fix-Vorschlag:** Reimplement highlighting with a ProseMirror Decoration plugin (Decoration.inline) driven by the search term, so PM owns the DOM; drop the surroundContents/normalize mutations.

#### P3. getGitDir() falls back to process.cwd() — git:init/saveVersion could touch the app's working directory

- **Ort:** `src/main/gitManager.ts:18` · LOW · bug
- **Problem:** getGitDir() returns appState.projectDir, else dirname(currentFilePath), else process.cwd(). If a git handler (e.g. git:saveVersion → ensureRepo → git.init, or git:init) is ever invoked with no project and no open file, it will `git init` and commit into the Electron process's current working directory (in dev, the repo root; in prod, an arbitrary launch dir) rather than a project folder. The renderer normally gates these on an open project, but the fallback is a footgun with no guard.
- **Nachweis:** gitManager.ts:18 `return appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : process.cwd());` — combined with ensureRepo's unconditional git.init() (line 49-53) and git:saveVersion (line 121).
- **Fix-Vorschlag:** Have getGitDir() return null when no project/file is open and make the git handlers no-op / throw a clear 'no project open' error instead of defaulting to process.cwd().

#### P4. getEntitlement() silently demotes a paid, licensed device to 'trial'/'expired' after 7 offline days, swapping the MCP license credential for a trial/none

- **Ort:** `src/main/licenseManager.ts:192` · LOW · bug
- **Problem:** getEntitlement() only reports 'licensed' when (Date.now() - lastValidation)/86400000 < OFFLINE_GRACE_DAYS (7). Past 7 offline days it falls through to the trial clock: if the device's trialStartedAt (stamped on first launch) is already >14 days old, the paying user is reported 'expired'; if still within 14 days they are reported 'trial'. There is no distinct 'license-valid-but-offline-reconnect' state at this layer. buildMcpEnv() then rebuilds the env from this entitlement on every boot, so a licensed user who has been offline >7 days has PENWRIGHT_LICENSE_KEY replaced by PENWRIGHT_TRIAL_UNTIL (or nothing → MCP server refuses to start). validateLicense()'s catch branch uses the same 7-day window, so nothing keeps the license 'active' beyond it while offline. (Note CLAUDE.md documents 30-day grace; the code and inline comment intentionally use 7 — the sharp edge is the silent license→trial/expired demotion + MCP env swap, not the constant.)
- **Nachweis:** licenseManager.ts:194-213 computes licensedLocally with OFFLINE_GRACE_DAYS=7 then unconditionally falls through to ensureTrialStarted()/daysUsed. mcpSetup.ts:227-234 buildMcpEnv() keys solely on getEntitlement().access, so an offline>7-day paid user loses PENWRIGHT_LICENSE_KEY on the next idempotent re-registration (index.ts:186 initMcpRegistration runs every boot).
- **Fix-Vorschlag:** When d.licenseStatus==='active' && d.licenseKey but the offline window has lapsed, distinguish an 'offline-grace-expired-license' state rather than collapsing into the trial clock, so a paid user is never re-registered with a trial/none MCP credential merely for being offline.

#### P5. Non-atomic remove-then-add in registerWithClaudeCode can leave zero registered hosts, violating the stated invariant

- **Ort:** `src/main/mcpRegistration.ts:314` · LOW · bug
- **Problem:** registerWithClaudeCode() runs `claude mcp remove <name> --scope user` (line 320) BEFORE `claude mcp add` (line 325). If the remove succeeds but the add throws (line 327 catch), it falls back to writeClaudeCodeConfig(). If that file write also throws (e.g. ~/.claude.json became malformed between the CLI read and the file edit, or an fs error), registerWithClaudeCode throws, ensureMcpTarget's catch (line 397) returns early and never removes the Meta-MCP entry. For a user who was previously Claude-Code-only re-applying target='claude' each boot, the CLI remove has already deleted their working entry and nothing re-added it → zero active hosts until a later successful run. This is the exact 'never drop to zero hosts' invariant the module docblock (lines 14-16, 337-347) promises to uphold.
- **Nachweis:** mcpRegistration.ts:318-332: inner `mcp remove` in its own try; on `mcp add` failure control proceeds to writeClaudeCodeConfig(def) (line 331) which can throw from readJsonObject (lines 125-139 throw on unparseable JSON) or fs.writeFileSync. ensureMcpTarget (lines 394-400) returns on that throw before unregisterFromMeta, so the removed Claude entry is not restored.
- **Fix-Vorschlag:** Add first (idempotently), or snapshot/restore the prior Claude-Code entry and only delete it after the add path has confirmed a working registration; treat a failed add as leaving the previous entry in place.

#### P6. Typst compiles use the default 1 MB maxBuffer; a warning-heavy document reports a bogus compile failure

- **Ort:** `src/main/typstCompiler.ts:49` · LOW · bug
- **Problem:** Both the preview compile (execFile at typstCompiler.ts:49-52, only `timeout` set) and the PDF export (execFileSync at importExport.ts:457, no options at all) rely on Node's default maxBuffer (1 MiB) for the child's stdout/stderr. Typst prints all warnings to stderr; a large document with many warnings (e.g. deprecated syntax, missing fonts, overfull boxes) can exceed 1 MiB. On overflow Node kills the process and returns an ENOBUFS error — so the preview shows a spurious 'compile error' (parseErrors runs on truncated stderr) and the export throws/reports failure even though the PDF actually compiled fine.
- **Nachweis:** typstCompiler.ts:49-52 execFile options `{ cwd: dir, timeout: 30000 }` (no maxBuffer); importExport.ts:457 `execFileSync(getTypstPath(), buildTypstCompileArgs([sourceFile, result.filePath]))` (no options). Node default maxBuffer for execFile/execFileSync is 1024*1024 bytes; exceeding it yields an ENOBUFS error passed to the callback / thrown.
- **Fix-Vorschlag:** Pass `maxBuffer: <large, e.g. 64*1024*1024>` to both execFile/execFileSync (and add a timeout to the export execFileSync), so verbose Typst diagnostics never masquerade as a failed compile.

#### P7. Fixed temp filenames in compile/print export collide under concurrent tool calls

- **Ort:** `src/mcp/server.ts:536` · LOW · concurrency
- **Problem:** penwright_compile writes a fixed `.penwright-compile-output.pdf` into the root dir (line 536); penwright_export_print writes fixed `.penwright-style-print.typ` and `.penwright-print-root.typ` (lines 860, 870). MCP tool invocations can overlap. Two concurrent compiles/exports share the same temp paths: one call's `fs.unlinkSync` can delete the other's in-flight output/temp, or `fs.statSync` can read a file already unlinked, producing spurious 'Export failed' / ENOENT errors or a wrong size report. The per-snippet renderer already uses unique `${pid}-${Date.now()}-${rand}` stamps (line 107) — these paths do not.
- **Nachweis:** Line 536 `const tempPath = path.join(dir, '.penwright-compile-output.pdf')` — constant. Lines 860/870 print export use the constant names `.penwright-style-print.typ` / `.penwright-print-root.typ`. Contrast line 107 which stamps snippet temp names uniquely.
- **Fix-Vorschlag:** Use a unique per-invocation suffix (pid+timestamp+rand) for these temp paths, matching createMcpSnippetRenderer.

#### P8. figureNumbering:none suppresses caption labels but cross-references still emit 'Figure N'

- **Ort:** `src/shared/htmlSerializer.ts:635` · LOW · bug
- **Problem:** When the source sets `#set figure(numbering: none)`, ctx.figureNumbering is false and figcaptionHtml (line 634-639) correctly drops the 'Figure N' / 'Abbildung N' label from captions to match the PDF. But renderReferenceHtml (line 463-477) never consults ctx.figureNumbering — a `@fig:x` / `@tbl:x` cross-reference still resolves to `${w.figure} ${t.n}` (e.g. 'Figure 1'). In Typst with numbering:none the figure has no number, so the web export shows a fabricated 'Figure 1' where the PDF shows nothing, desyncing web from print for exactly the design-block magazine projects this flag targets.
- **Nachweis:** figcaptionHtml at htmlSerializer.ts:635 branches on `rc.ctx?.figureNumbering === false`; renderReferenceHtml at lines 470-471 unconditionally builds `${word} ${t.n}` with no figureNumbering check. `rg -n "figureNumbering" src/shared/htmlSerializer.ts` shows the flag is only read at line 635.
- **Fix-Vorschlag:** In renderReferenceHtml, when ctx.figureNumbering === false and the target is a figure/table, render just the caption or the label text rather than 'Figure N', mirroring figcaptionHtml.

#### P9. renderEqNumber replaces only the first '1' in the numbering pattern

- **Ort:** `src/shared/exportContext.ts:152` · LOW · bug
- **Problem:** renderEqNumber does `pattern.replace(/1/, String(n))` — a non-global replace of the literal character '1'. For the default pattern '(1)' this is correct, but for any pattern that contains a '1' as a static literal (e.g. section-scoped equation numbering `"1.1"`, or a prefix like `"Eq. 1"` that already contains a 1 elsewhere) it substitutes the wrong digit and leaves stray literals, producing equation numbers like '(3.1)' instead of '(3.3)' or 'Eq. 3' misformatted. Both the HTML render (renderMathHtml, htmlSerializer.ts:585) and the pre-pass numberText (buildExportModel, line 598) route through this, so cross-refs and in-text numbers share the corruption.
- **Nachweis:** src/shared/exportContext.ts:153 `return pattern.replace(/1/, String(n));` — regex has no `g` flag and matches the character '1', not the counter placeholder. eqPattern is captured verbatim from `#set math.equation(numbering: "...")` (line 554).
- **Fix-Vorschlag:** Use Typst's actual numbering semantics or at minimum a non-ambiguous placeholder; replacing the full counting symbol run (or using a global replace guarded to the count token) avoids clobbering literal digits.

#### P10. safeUrl fallback returns non-scheme-matching values verbatim, leaving an entity-encoded-scheme gap in sanitizeSvg href filtering

- **Ort:** `src/shared/htmlSerializer.ts:156` · LOW · security
- **Problem:** sanitizeSvg (line 567) neutralises dangerous href/xlink:href in inlined author-controlled math SVGs by delegating to safeUrl (line 575-576). safeUrl blocks explicit `javascript:`/`data:text/html`/etc. schemes, but its final branch `return u` passes through any value that does not match its scheme regexes — including a value beginning with a non-[a-z] character such as an HTML numeric entity (`&#106;avascript:alert(1)`). Because the SVG is inlined into the page origin (not sandboxed in an <img>), the browser decodes entities in the attribute value after parsing, so such a value could resolve to a live `javascript:` click target that survives sanitisation. The documented direct `javascript:` case IS blocked; this is the residual edge where the permissive schemeless-relative fallback is reused for a security filter.
- **Nachweis:** htmlSerializer.ts:159-162: after the safe-scheme and relative-path checks, `if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return ''` only fires for values that START with [a-z]; anything starting with '&', digits, etc. falls through to `return u` at line 162. sanitizeSvg (line 575) keeps the attribute whenever `safeUrl(val) !== ''`.
- **Fix-Vorschlag:** For the SVG href sanitiser, use a strict allowlist (only `#fragment`, http(s), and known-safe relative paths) rather than reusing safeUrl's permissive schemeless fallback, and/or HTML-entity-decode the value before the scheme test.

#### P11. Async refresh() in a $effect can leave the chapter-look dropdown showing the wrong chapter on rapid file switches

- **Ort:** `src/renderer/components/LookStatus.svelte:40` · LOW · bug
- **Problem:** `$effect(() => { void file; void isDesignView; refresh(); })` fires refresh() (an async IPC call to section:context) on every file change but does not guard against out-of-order resolution. Switching quickly from chapter A to chapter B launches refresh(A) and refresh(B) concurrently; if refresh(A) resolves after refresh(B), isChapter/styleId end up reflecting chapter A while file is B, so the status-bar 'Kapitel-Look' dropdown shows the wrong chapter's rubric. IPC is usually fast so the window is small, but the race is real.
- **Nachweis:** LookStatus.svelte:40 effect calls the async refresh(); refresh() (lines 29-38) awaits `section:context` then assigns isChapter/styleId with no generation/cancellation token to discard superseded responses.
- **Fix-Vorschlag:** Capture the file value at call time and ignore the response if `file` has since changed (a simple request-id / `if (requestedFile !== file) return;` guard after the await).

#### P12. Unguarded first await in onMount can prevent Typst status and recent-projects from loading

- **Ort:** `src/renderer/components/StartScreen.svelte:33` · LOW · bug
- **Problem:** onMount does `platform = (await api.invoke('app:getPlatform')) as string;` (line 33) OUTSIDE any try/catch, before the two guarded blocks that fetch the Typst-installed status and the recent-projects list. If `app:getPlatform` ever rejects, the async onMount aborts at that line and the subsequent `app:checkTypst` and `persist:getRecentProjects` fetches never run — the Start Screen would show no Typst banner and an empty recent list — and it surfaces as an unhandled rejection.
- **Nachweis:** StartScreen.svelte:32-46: line 33 `platform = (await api.invoke('app:getPlatform'))` is not wrapped, whereas the checkTypst (34-39) and recent-projects (40-45) reads each have their own try/catch. A throw on line 33 short-circuits both.
- **Fix-Vorschlag:** Wrap the getPlatform await in its own try/catch (default platform to '') so a failure doesn't skip the later fetches.

#### P13. verify() temp PDF is not covered by the chokidar ignore list, so a slow safe-apply verify can emit spurious filetreeChanged events

- **Ort:** `src/main/typstCompiler.ts:83` · LOW · bug
- **Problem:** TypstCompiler.verify() writes/deletes `.penwright-verify.pdf` in the project root. The file watcher's ignore list covers `.penwright/**` and `.penwright-preview*` but not `.penwright-verify*`. safeApplyDesign stamps lastSaveTimestamp before staging, but the verify PDF only appears AFTER the verify compile finishes; on a document that takes longer than the watcher's 3-second self-save guard to compile, the add and unlink of `.penwright-verify.pdf` slip past the guard and fire filetreeChanged (add/unlink handlers do not filter by extension), causing a transient file-tree refresh during design apply.
- **Nachweis:** typstCompiler.ts:83 `const outPath = path.join(dir, '.penwright-verify.pdf')`. Watcher ignore list fileManager.ts:494-501 = ['**/node_modules/**','**/.git/**','**/.penwright/**','**/.DS_Store','**/.penwright-preview*','**/*.lock'] — no `.penwright-verify*`. add/unlink handlers (fileManager.ts:557-567) only special-case `.penwright-preview` and otherwise send filetreeChanged after the 3s guard.
- **Fix-Vorschlag:** Add `'**/.penwright-verify*'` to the watcher ignored list (or rename the verify temp to a `.penwright-preview*`-matching name), matching how the preview PDF is already ignored.

---

## Anhang · Methodik-Notizen

- **Dedup:** 8 exakte Doppelnennungen wurden zusammengeführt (node-pty/xterm, sourceImporter, orphan Build-Scripts, isProUser/isLicensed, openFile-No-op → in den Datenverlust-Befund, preload-Unsubscribe → in den Sidebar-Leak-Befund).
- **False-Positive-Schutz:** Der adversariale Verifier hat 0 Befunde verworfen — die Finder waren durchweg präzise (Schweregrade wurden teils nach unten korrigiert). Trotzdem gilt: Fix-Vorschläge sind Startpunkte, keine fertigen Patches.
- **Nicht geändert:** Diese Runde war rein analytisch. Nächster Schritt ist gemeinsame Triage: welche High/Medium vor Release, welcher Dead Code/Deps in einem Aufräum-Commit.
