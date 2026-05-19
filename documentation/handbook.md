# vswrite Desktop — User Handbook

> **Version:** 0.7.0 (Pre-Release)
> **Last updated:** 2026-04-29
> **Deutsche Version:** [handbuch.md](handbuch.md)

---

## What is vswrite Desktop?

vswrite Desktop is a standalone WYSIWYG editor for Typst documents. Instead of working in markup code, you edit in a visual editor — similar to Google Docs or Notion. At the same time you get the full power of Typst: math formulas, configuration and layout are surfaced as editable code blocks.

Typical use cases: academic theses, books, longer documents with multi-chapter structure, bibliography and math typesetting — everything you would otherwise reach for LaTeX or Word.

---

## Getting Started

### Prerequisites

- **macOS**, **Windows** or **Linux**
- **Typst CLI** — **not required anymore**. The app ships the right Typst binary itself; you don't need to install anything separately.

### Installation

From v0.7.0:
- **macOS:** download the DMG from [vswrite.com](https://vswrite.com) and drop it into your Applications folder
- **Windows:** download the NSIS installer and run it
- **Linux:** download the AppImage, make it executable (`chmod +x`), run it

### Opening your first project

vswrite is project-based: a project is a folder that contains at least one `.typ` file. The app always starts on the Start Screen — you choose what to open.

- **File -> New Project…** (`Cmd+N`) — create a new project from a template
- **File -> Open Project…** (`Cmd+O`) — pick a folder
- **"Open Sample Project"** on the Start Screen — copies an annotated mini-thesis about AI-assisted academic writing to a location of your choice (default: `~/Documents/vswrite-sample-thesis`). Includes five real open-access source PDFs in `sources/`, three sample comments, and one saved version in the history. Every feature demonstrated at least once
- **Recent Projects** appear on the Start Screen and reopen with one click

To stop working on a project without quitting the app, use **File -> Close Project** (`Cmd+Shift+W`) — you return to the Start Screen and can open another project.

---

## App Layout

```
+--------------------------------------------------------------+
|                         (Title bar)                           |
+--------------------------------------------------------------+
|  B I U S  | H1 H2 H3 | bul num | Link  ⚙ ‥ ◎               |  Toolbar
+------+-------------------------------+-----------------------+
|[Files|Outline|Chapters|Project]      |                       |
|      |  [main.typ] [refs.bib]        |                       |
| Side-|                               |   Preview Panel       |
| bar  |  WYSIWYG Editor               |   (live PDF)          |
|      |                               |                       |
+------+-------------------------------+-----------------------+
|  Terminal / AI  (real shell terminal)                         |
+--------------------------------------------------------------+
| [Project] [Terminal/AI] [Preview]   1,247 words · 5 min read  |
+--------------------------------------------------------------+
```

### Toggling panels

| Panel | Shortcut | Status Bar button |
|-------|----------|-------------------|
| Sidebar (left) | `Cmd+B` | **Project** |
| Terminal (bottom) | `` Cmd+` `` | **Terminal / AI** |
| Preview (right) | `Cmd+Shift+P` | **Preview** |

All panels are resizable by dragging their edges.

---

## The Editor

### Toolbar

| Button | Function | Shortcut |
|--------|----------|----------|
| **B** | Bold | `Cmd+B` |
| *I* | Italic | `Cmd+I` |
| S | Strikethrough | `Cmd+Shift+X` |
| `</>` | Inline code | `Cmd+E` |
| Link | Insert/edit link | `Cmd+K` |
| H1 / H2 / H3 | Headings | `Cmd+Alt+1/2/3` |
| bul | Bullet list | `Cmd+Shift+8` |
| num | Numbered list | `Cmd+Shift+7` |
| { } | Code block | `Cmd+Alt+C` |
| Fn | Insert footnote (opens popup editor) | — |
| Cm | Add comment to selection (or word under cursor) | `Cmd+Alt+M` |
| ⚙ Quick | Quick settings dropdown | — |
| ‥ Typewriter | Typewriter mode toggle | — |
| 𝓡 Reading | Reading-mode toggle (book-style typography) | `Cmd+Alt+R` |
| ◎ Focus | Focus mode toggle | — |

### Native menu

All project-level and document-level actions live in the **native menu bar** (top of the screen on macOS, top of the window on Windows / Linux). Five top-level menus:

- **File** — New Project (`Cmd+N`), Open Project (`Cmd+O`), Close Project (`Cmd+Shift+W`), Save (`Cmd+S`), Save As (`Cmd+Shift+S`), Export PDF / DOCX, Import Markdown, Link Zotero Library, Open Sources Folder, Add Citation Manually
- **Edit** — Undo / Redo / Cut / Copy / Paste / Select All, Find & Replace (`Cmd+F`), **Find in Project…** (`Cmd+Shift+F`), **Add Comment** (`Cmd+Alt+M`), **Insert Reference…** (`Cmd+Alt+L`), Undo AI Edit
- **View** — Toggle Sidebar (`Cmd+B`), Toggle Preview (`Cmd+Shift+P`), Toggle Terminal (`` Cmd+` ``), Focus Mode, Typewriter Mode, **Reading Mode** (`Cmd+Alt+R`), plus standard window/zoom roles
- **Document** — Document Settings (language + bibliography style; full design lives in the Design sidebar tab), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help** — User Guide, Keyboard Shortcuts (`Cmd+/`), Report Issue, **Open Crash Reports** (opens `<userData>/crash-reports/` in Finder); About on Windows / Linux

In-text content insertions (image, table, math, citation, divider, page break, etc.) are reachable via [slash commands](#slash-commands) — type `/` at an empty line in the editor.

### Slash Commands

Type `/` at an empty position in the editor:

| Command | Description |
|---------|-------------|
| `/Heading 1-3` | Headings |
| `/Bullet List` | Bullet list |
| `/Numbered List` | Numbered list |
| `/Quote` | Blockquote |
| `/Code Block` | Code block |
| `/Math` | Typst math block |
| `/Typst Code` | Raw Typst code |
| `/Image` | Insert image |
| `/Footnote` | Footnote — popup opens for immediate editing |
| `/Citation` | Inserts `@` to trigger the citation picker |
| `/Reference` | Cross-reference picker — pick a `<label>` to insert `@label` |
| `/Table` | Insert a table (with header row) |

### Multi-tab editor

- Several files open at once as tabs
- Tab bar above the editor with file names
- x button to close individual tabs
- **Right-click** a file in the sidebar -> "Open in New Tab"
- **Right-click** a `.typ` file -> "Open as Text" (opens in the code editor instead of WYSIWYG)
- `.typ` files open in the WYSIWYG editor
- `.bib`, `.txt`, `.md`, `.yaml` etc. open in the code editor (CodeMirror 6)
- `.pdf` files open in the built-in PDF viewer (text selectable and copyable)

### Images

**Insert:**
- **Slash command:** `/Image` -> file picker
- **Drag & drop:** drag an image from Finder/Explorer or from the sidebar (assets/) into the editor

**Image dialog (click on the image):**
- **Width:** presets (25 %, 50 %, 75 %, 100 %) or custom (e.g. `60%`, `8cm`)
- **Alt text**
- **Alignment:** left, center, right

**Guard:** images dropped into a code block (preamble, #show etc.) are automatically inserted *after* the block — no compile error.

Images are copied into `assets/` and inserted as `#image("assets/...")`. Images that already live in the project are not duplicated.

### Citation autocomplete

Type `@` in the editor -> dropdown with all sources from `.bib` files in the project:
- Filterable by citekey, author, title, year
- Click inserts `@citekey` as a Citation node
- Citations are auto-loaded when a file opens
- Works with Zotero-linked `.bib` files as well

### Inline source preview

Hover over an `@citekey` badge for ~ 350 ms and a small popover appears with:
- Author, title and year from the `.bib` entry
- An **Open PDF** button if a matching source is bundled in `sources/`

Naming convention: drop the source PDF into the project's `sources/` folder using a name that **starts with the citekey** — `chen2021codex.pdf`, `chen2021codex_supplement.pdf`, `chen2021codex-arxiv.pdf` all match. Click **Open PDF** and the source opens as a regular tab in the built-in PDF viewer (text selectable + copyable).

The popover stays visible for 250 ms after you leave the badge so you can move the cursor into the card without it vanishing.

---

## Creating a new project

**Open:** File -> New Project… (`Cmd+N`)

**Dialog:**
1. **Project name** (becomes the folder name)
2. **Template:**

| Template | Description |
|----------|-------------|
| **Document** | Simple single-file document |
| **Thesis** | Academic thesis with chapters + bibliography |
| **Paper** | Academic paper (abstract, sections, references) |
| **Letter** | Formal letter |
| **Book** | Book with chapters + table of contents |

3. **Location** — the project structure is created.

Every new project automatically gets:
- Template files (main.typ, chapters/, bibliography.bib)
- `assets/` folder for images
- `sources/` folder for reference PDFs and other research material
- `.claude/skills/` with Claude Code skills (typst, vswrite, research)
- `.git/` repository + `.gitignore` so the version system works from the very first save
- `.vswrite/` folder for auto-backups and AI-edit snapshots (hidden, project-local)
- An initial commit with the template content

---

## Sidebar

The sidebar has six tabs:

### Files
- Recursive file tree, Back button, **New Folder** (inline input — Enter saves, Esc cancels), **Add Asset** (file picker that copies into `assets/`)
- Empty folders like `assets/` and `sources/` stay visible so you always see where to drop things
- `.claude/` folder visible for skills; `.git/` and `.vswrite/` are hidden
- Images from `assets/` are draggable into the editor
- Right-click -> "Open in New Tab"

### Outline
- Live heading hierarchy (H1 -> H2 -> H3), click navigates to the heading
- **Drag to reorder:** grab a heading row and drop it above or below another — the whole section (heading plus everything down to the next heading of equal or higher rank) moves with it. A blue 2 px line shows the drop target. Single-file only; cross-file chapter reordering still happens in the **Chapters** tab.
- **Find backlinks:** hovering over a heading reveals a small **↪** arrow on the right — click it to find every place in the project where that heading is mentioned (see [Backlinks](#backlinks--where-else-is-this-mentioned))

### Chapters (Include manager)
- `#include` statements, arrows to reorder (instant UI update), x to remove, + Add Chapter

### Project
This tab replaces the old Git panel and uses writer-friendly vocabulary instead of raw Git commands. See the **[Versions & Auto-Backup](#versions--auto-backup)** section below for the full workflow. In short:
- **Save Version** — names your current state and stores it in the project's history
- **Changes since last version** — checkboxes for which files go into the next version
- **History** (always visible) — every saved version, click to view diff and restore
- **Auto-Backup status** — small footer showing when the last automatic snapshot was taken
- **Advanced** (collapsed) — optional cloud sync (push/pull to GitHub or any other Git remote)

### Comments
- Lists every comment for the **current file** or **the whole project** (toggle at the top of the panel)
- Per entry: anchor preview (italic, click jumps to the spot in the editor), body textarea (auto-saves shortly after you stop typing), resolved checkmark, delete
- Resolved comments are hidden by default; the "Show resolved" checkbox brings them back
- Full workflow: see the **[Comments & Notes](#comments--notes)** section below

### Design
- The visual style editor — colors, fonts, scale, layout, headings, special elements
- One-click **theme presets** (six full looks) and **palette presets** (eight curated colour sets)
- **Layout presets** for paper / orientation / column count
- **Font browser** with live previews of the seven bundled OFL fonts
- **Custom Typst-Code** section as an escape hatch
- See the [Design panel](#design-panel--visual-style-editor) section below

---

## Find in Project

For **searching and replacing across all chapters at once**, vswrite has a separate project-wide search, distinct from the in-file search (`Cmd+F`).

**Open:** `Cmd+Shift+F` or menu **Edit -> Find in Project…**

**Features:**
- Live search, debounced ~ 200 ms
- Four options as toggle buttons:
  - **Aa** — case-sensitive
  - **W** — whole-word only
  - **.*** — regular expression
  - **.bib** — also search `.bib` files (otherwise `.typ` only)
- Matches grouped by file with hit counts, expandable / collapsible
- **Click a match** to open the file and scroll the editor to the location; the match briefly highlights
- **Replace** (arrow toggle on the left): a second input appears, "Replace all" asks for confirmation ("Replace X matches in Y file(s)?")
- Capped at 1000 matches total — beyond that the list is truncated with a notice

**Tips:**
- Before a sweeping replace it's worth saving a **Version** in the Project panel first — that gives you a one-click rollback.
- The classic `Cmd+F` still works in the active file with the familiar single-file search and visual highlights.

---

## Footnotes

Typst renders footnotes natively — superscript number inline, footnote body at the bottom of the same page.

**Insert:**
- **Toolbar:** click **Fn** in the editor toolbar
- **Slash command:** `/Footnote`

Both insert an empty footnote at the cursor position and **automatically open the inline popup editor** so you can start typing.

**Edit:** clicking an existing footnote in the editor reopens the popup with its body. The body is **saved live** (every keystroke); Esc or `Cmd+Enter` closes the popup.

**In the source:** `#footnote[Your text]` — Typst handles numbering and placement at compile time.

**In the editor:** a small superscript marker with a preview of the first ~30 characters. The actual number and end-of-page placement appear in the PDF preview on the right (400 ms compile debounce).

---

## Cross-References

In Typst you can mark a figure, table, equation or heading with a `<label>` and refer to it from anywhere in the project with `@label`. Typst auto-numbers everything at compile time — when you reorder chapters or insert a new figure, every reference downstream updates with no effort.

vswrite gives you a picker that lists every `<label>` in the project so you don't have to remember exact names.

### Setting a label

Type the label into your source right after the thing you want to refer to:

```typst
#figure(
  image("plot.png"),
  caption: [Parameter scaling],
) <fig:scaling>

= Method <sec:method>

$ "Attention"(Q, K, V) = "softmax"(frac(Q K^T, sqrt(d_k))) V $ <eq:attention>
```

By convention, prefix labels with their kind — `fig:`, `tbl:`, `eq:`, `sec:`, `chap:`, etc. The picker uses these prefixes to group its results, and the editor uses them to tell a reference apart from a citation (see below).

> **Equation references** require numbering to be enabled. Add `#set math.equation(numbering: "(1)")` to your `main.typ` preamble — without it, Typst rejects every `@eq:…` reference at compile time.

### Inserting a reference

Three ways to open the picker:

- **Slash command:** `/Reference`
- **Menu:** `Edit -> Insert Reference…`
- **Shortcut:** `Cmd+Alt+L`

The picker shows every label in the project, grouped by kind (Figures / Tables / Equations / Headings / Other) with a caption preview and the source location (`chapters/04-results.typ:24`). A search field filters across label, caption and path. Use ↑↓ to navigate, Enter to insert, Esc to cancel.

The inserted node renders in the editor as an **orange `↳ label` pill** — visually distinct from the blue `@citekey` citation badge. In the source it serializes to the same `@label` Typst syntax.

### Citation vs. reference disambiguation

Both citations (`@chen2021codex`) and cross-references (`@fig:scaling`) use the same `@…` syntax in Typst. vswrite tells them apart by the label name:

- Contains a colon (`:`) — treated as a reference
- Starts with a known prefix (`fig`, `tbl`, `eq`, `sec`, `chap`, `app`, `thm`, `lem`, `def`, `cor`, `prop`, `algo`, `lst` and their full forms) — treated as a reference
- Anything else — treated as a citation

That's why `@` autocomplete is reserved for citations only (citekeys are bare slugs by convention). For references, use the picker.

---

## Comments & Notes

Comments are **yellow annotations** that are visible only inside the vswrite editor and **never** compile into the PDF/DOCX output. Useful for self-notes ("add a citation here") or supervisor feedback.

**Storage:** every comment is its own **Markdown file** in the visible `comments/` folder at the project root. YAML frontmatter holds the anchor text, target file, author, date, and status. The body is plain Markdown — lists, links, code snippets, anything.

```
my-project/
├── main.typ
├── chapters/
├── comments/                              ← visible
│   ├── 2026-04-28-1432-a3f.md
│   └── 2026-04-29-0901-b1e.md
└── ...
```

The advantage: cloud sync (Dropbox / iCloud) carries the comments along automatically, your supervisor can open them in any plain editor, they are git-diffable, and you can edit them outside the app.

**Create:**
1. Select text in the editor (or place the cursor inside a word)
2. Click the toolbar button **Cm** or use the menu **Edit -> Add Comment** (`Cmd+Alt+M`)
3. The sidebar switches to the **Comments** tab, the new entry is focused, you can start typing immediately
4. Typing is persisted to the `.md` file with ~ 400 ms debounce

**Visual:** the commented text gets a **yellow-orange highlight** with a thin underline. Clicking the highlight scrolls the Comments panel to the matching entry.

**Panel filters:**
- **Current file** vs **Whole project** (tabs at the top of the panel)
- **Show resolved** (checkbox) — resolved comments are hidden by default

**Per-comment actions:**
- **Anchor click** (italic quoted text) jumps to the spot in the editor and briefly flashes the highlight
- **✓ Resolve** hides the comment from the list (reversible with ↺)
- **× Delete** removes the `.md` file after confirmation

**Reanchoring:** if you insert text before a commented stretch, the anchor shifts. vswrite locates it again on file open via the stored anchor text. If the anchor was deleted or changed beyond recognition, the comment is marked **orphaned** (red warning triangle) — you can reassign or delete it manually.

**Known MVP limitations:**
- The anchor text must live within a single paragraph / heading — comments anchored across paragraph boundaries are reported as orphaned.
- Multiple comments with **identical** anchor text in the same file all highlight the same (first) location.

---

## Reading Mode

For proofreading, vswrite can switch the editor into **book-style typography** — serif font, generous line height, justified text, narrow column. Unlike the PDF preview, editing stays active: you can fix typos right in this view.

**Toggle:**
- Toolbar button **𝓡** (between Typewriter and Focus)
- Menu **View → Reading Mode**
- Shortcut `Cmd+Alt+R`

**What changes:**
- Font switches to Iowan Old Style / Palatino / Georgia (whichever is available)
- 17 px / 1.75 line height, 640 px max column width
- Paragraphs are justified with auto-hyphenation
- Background warms slightly (`#fdfcf8`) — easier on the eyes for longer reads
- Headings get classic book-typography styling (italic + 600 weight for H3, etc.)
- **Code, math, and raw-Typst blocks stay monospace** — code must remain structurally readable

The sidebar and preview stay as you had them. For a fully distraction-free read, combine Reading Mode with Focus Mode (the `◎` toolbar toggle).

---

## Backlinks — "Where else is this mentioned?"

For consistency checks in academic work, you often want every mention of a concept or source across all chapters. vswrite has two built-in triggers that under the hood open [Find in Project](#find-in-project) with the right query.

**Heading backlinks:**
- In the **Outline** sidebar tab: hovering over a heading reveals a small **↪** arrow on the right
- Clicking it opens Project Search with the **heading title** as the query
- Lists every place in the project where the term (or a cross-reference to the heading) appears

**Citation backlinks:**
- **Right-click** (Cmd+click on macOS) on a citation badge in the editor (e.g. `@chen2021codex`)
- Opens Project Search with `@<citekey>` as a whole-word query
- Lists every chapter where the source is cited

Both triggers feed into the standard [Find in Project](#find-in-project), so the four option toggles (Aa / W / .* / .bib) work on the result, and you can run "Replace all" right from there if, say, you want to rename a citekey.

---

## Live Preview

- **Root-file compilation:** with chapters, `main.typ` is compiled automatically
- **PDF rendering** via pdf.js — viewport-virtualised, so 100+ page documents stay smooth
- **Text selection & copy** in the preview thanks to pdf.js' TextLayer
- **Error display:** Typst errors show up in the preview panel
- **Live update** as you type, with a 400 ms compile debounce

---

## Zoom (Editor + Preview)

The editor and the PDF preview zoom independently, from 50 % to 200 % in 10 % steps:

- **Editor zoom:** the current `100 %` shows as a button in the bottom-right status bar. Click it to open a small popover with `−` / `+` and a reset button. From the keyboard: `Cmd+Alt+=` (in), `Cmd+Alt+-` (out), `Cmd+Alt+0` (back to 100 %).
- **PDF preview zoom:** a slim `− 100 % +` strip sits at the top of the preview panel. Click the percentage to reset. From the keyboard: `Cmd+Shift+=` (in), `Cmd+Shift+-` (out), `Cmd+Shift+0` (reset). The same PDF zoom applies to opened source PDFs (e.g. via citation hover → "Open PDF").
- **Scrollbars** are always visible — once you zoom past 100 %, the page is wider than the panel and you can scroll horizontally.
- **Saved per project:** the next time you open the same project, your zoom levels are restored. The values live in `<project>/.vswrite/preferences.json` and travel with the folder if you copy it.
- **Window zoom** (`Cmd+=` / `Cmd+-` / `Cmd+0`) zooms the entire window and stays available in the View menu as "Zoom Window In/Out" — rarely needed, but untouched.

---

## Import & Export

### Markdown import
- **File -> Import Markdown…**
- Converts: headings, bold/italic, links, images, lists, code blocks, blockquotes
- YAML frontmatter is skipped
- Produces a new `.typ` file with a default preamble

### Zotero integration
- **File -> Link Zotero Library…**
- Pick a Zotero Better BibTeX `.bib` file
- Gets copied into the project as `zotero.bib`
- **Auto-sync:** changes in Zotero are picked up automatically while the app is running
- All Zotero sources appear in the `@` autocomplete

### Export dialog

For multi-chapter projects, **File -> Export PDF** or **Export DOCX** opens a dialog where you can:
- Switch the **Format** between PDF and DOCX with a single click
- **Tick which chapters** to include — every chapter shows its first H1 as the title
- Toggle the **Bibliography** in/out
- Use **All / None** shortcuts for the chapter list

The title page, abstract and anything else outside `#include` is always part of the export. Single-file projects without `#include` skip the dialog and go straight to the file-save dialog.

### PDF export

Uses the bundled Typst CLI to render the (filtered) project. PDF reflects exactly what you see in the preview.

### DOCX export

The DOCX is produced with real Word styles:
- **Multi-chapter aware:** all `#include`d chapters are merged into the output (the old "current file only" behaviour is gone)
- Headings, bibliography, code blocks and quotes use named Word styles — restyle the whole document from the Word styles panel
- Page size, margins, font, font size and line spacing are inherited from your Typst `#set` settings (e.g. A4 + Libertinus 11pt)
- **Live heading numbering:** if your Typst file has `#set heading(numbering: "1.1")`, the headings get Word multilevel numbering. When your supervisor reorders chapters in Word, the numbers update automatically.
- Citations render as `(Author Year)` when found in the `.bib` file, else as `[citekey]`
- TOC and bibliography headings are localized to the document language (DE/EN/FR/ES/IT/PT/NL)
- **Note:** DOCX export is iteratively improved. Custom Typst constructs (e.g. heavily styled title pages with `#show heading: …` rules) may not render perfectly — for the most faithful layout, prefer PDF.

---

## Design panel — visual style editor

Every design decision lives in the **Design** sidebar tab. Click a theme to apply a complete look; click a palette preset to swap only the colours; tune individual fields (font, padding, heading size, table border colour) for fine control. Every change writes `<project>/.vswrite/style.json` and regenerates `<project>/style.typ` — `main.typ` pulls those rules in via `#import "style.typ": *` plus `#show: apply-style`.

### Sections in the Design tab

| Section | What it controls |
|---------|------------------|
| **Colors** | Five semantic slots (primary / accent / text / background / muted) — each with a Coloris picker plus a hex text field |
| **Palette presets** | Eight curated 5-colour palettes (Modern Tech, Editorial, Earth Tones, High Contrast, Minimal Mono, Forest Deep, Sunset Warm, Ocean Classic). Apply only swaps colours |
| **Themes** | Six full ProjectStyle snapshots (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis). Apply overwrites everything except the Custom Code block |
| **Layout presets** | Seven geometry swaps (A4 Portrait, A4 Landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, Magazine Editorial with header strip) — paper, orientation, margin, columns, optional base size |
| **Fonts** | Three font slots (body / heading / code) plus a font browser. Each card live-renders its family + a sample line via the seven bundled OFL fonts |
| **Scale** | Base size, leading, paragraph spacing, first-line indent |
| **Layout** | Paper, orientation, margin, columns, page numbering, header markup, footer markup, page fill (background colour expression) |
| **Headings** | H1–H6 as collapsible cards — size, weight, colour slot, top margin per level; plus a single numbering pattern setting |
| **Elements** | Blockquote, Code-Block, Figure (incl. photographer-credit separator + label for the `figure-caption-credit(caption, credit)` helper), Table — each a collapsible card with structured fields (border slot / padding / italic toggle / caption position / zebra rows / etc.) |
| **Custom Typst-Code** | Escape hatch: free-form Typst inside a CodeMirror editor. Appended to `style.typ` inside a fenced block that survives every regeneration |

### Themes vs palette presets vs layout presets

- **Palette preset** — only the five colour slots change. Use it when the existing typography and layout are right but the colours feel off.
- **Theme** — colours + fonts + scale + layout + headings + elements all change in one click. Your Custom-Code block is preserved.
- **Layout preset** — only paper / orientation / margin / columns / base-size change. Stack on top of a theme to keep typography but switch geometry (e.g. *Editorial Magazine* theme plus *Magazine 2-Column* layout).

### Power-user escape hatch

The Custom Typst-Code section at the bottom of the Design panel accepts arbitrary Typst — `#import` of bundled packages, custom `#show heading.where(level: 1): it => { … }` rules with line decorations, helper `#let` bindings, etc. The block is fenced (marker comments at start and end) so the auto-generator never overwrites it. Any time you save a theme, palette, or field, the custom block is read back verbatim and re-emitted at the bottom of the regenerated `style.typ`.

### Design element library

A library of **15 parametric snippets** — Banner, Sidebar, Pull-Quote (three variants: regular / Display / Block), Callout, Hero, Section Divider (three variants: regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Image Gallery 2-up and 3-up, Magazine Cover. They're inserted from Claude Desktop via the `vswrite_list_design_elements` / `vswrite_insert_design_element` MCP tools; every reference to `style-colors.*` / `style-fonts.*` means the element re-themes automatically when you swap the palette or fonts. The `magazine-cover` uses `#page(margin: 0pt)` for the cover page only — the rest of the document keeps its configured margins. `style.typ` exports three module-level values for this: `style-colors`, `style-fonts`, and a `figure-caption-credit(caption, credit)` helper for photographer-credit captions.

### Bundled OFL fonts (offline-ready)

Seven font families ship with vswrite — no system install needed, no internet at compile time:

| Family | Category | Best for |
|--------|----------|----------|
| Inter | Sans | Modern / tech / minimal documents |
| IBM Plex Sans | Sans | Brochures, reports, branded docs |
| IBM Plex Serif | Serif | Modern editorial body |
| IBM Plex Mono | Mono | Code blocks |
| JetBrains Mono | Mono | Code-heavy documents |
| Crimson Pro | Serif | Academic body, theses |
| Spectral | Serif | Magazines, newsletters |

### Style Templates menu (legacy)

The old **Document → Style Templates** submenu (Classic / Modern / Minimal / Vibrant / Elegant / Professional / Artsy) was retired in Session 22 and replaced by the Themes section in the Design tab. The MCP tools `vswrite_list_styles` and `vswrite_apply_style` still work — they now point at the new theme presets.

---

## Versions & Auto-Backup

vswrite keeps three independent layers of safety for your work — each with a clearly defined purpose:

| Layer | Trigger | Purpose | Where it lives |
|-------|---------|---------|----------------|
| **Versions** | You click **Save Version** | Deliberate milestones in your project's history | `<project>/.git/` |
| **Auto-Backup** | Timer (configurable, default every 30 s) | Crash / freeze protection — never lose more than X seconds of work | `<project>/.vswrite/backups/` |
| **AI-Edit Undo** | Triggered by an external edit (terminal / MCP) | Quick rollback of the last AI change | `<project>/.vswrite/ai-snapshots/` |

All three live **inside the project folder**, so the project is self-contained: copy or move it and the full history goes with it.

### Saving a version

In the **Project** sidebar tab:
1. Type a short description in **Save Version** ("Chapter 3 first draft", "Before lecturer review", …)
2. Optionally untick files in **Changes since last version** that should not be part of this version
3. Click **Save Version**

The history list updates immediately. Every entry stays available forever (until you delete the project).

### Browsing the history

Click any entry in the **History** to open its detail view:
- Date and message
- A diff per file in source-text style (red removed lines, green added lines — like GitHub)
- **Restore this version** button — replaces the current files with the historical ones (with a confirmation prompt)

The current document is never destroyed: restoring an old version overwrites your working copy, but you can always **Save Version** beforehand to keep your in-progress state.

### Auto-Backup

A small status line at the bottom of the **Project** tab shows when the last automatic backup was taken ("Last backup 12 s ago"). Click it to open the backup browser:
- Every backup is a full snapshot of the project's `.typ` and `.bib` files at that point in time
- **Load** restores a backup into the working tree (with a confirmation prompt — save a version first if you don't want to lose your current state)
- The **gear icon** in the dialog header opens the settings: backup interval (10 s – 5 min), maximum number of backups kept (10 / 30 / 100 / 1000), maximum number of AI-edit snapshots

### AI-Edit Undo

When an external tool (Claude Code in the terminal, the MCP server, …) modifies a file you have open, vswrite saves the previous content into the AI-snapshot ring buffer **before** applying the change. Use the **Undo AI Edit** menu entry to step back through them one by one. Snapshots survive app restarts (they're persisted to `.vswrite/ai-snapshots/`).

### Cloud backup (optional)

The version history is local by default. If you want to push it to GitHub (or any other Git remote) for off-machine backup or to use the project on a second device:

1. Open the **Project** tab and expand **Advanced**
2. Paste the remote URL (e.g. `https://github.com/your-user/your-thesis.git`)
3. Use **Sync to cloud** (push) and **Pull from cloud** as needed

Two devices in parallel are not safe — one machine at a time.

---

## File Watcher

External file changes (e.g. from Claude Code in the terminal) are picked up automatically:
- Current file changed -> editor updates immediately
- `.bib` changed -> citations are reloaded
- Files added/removed -> file tree refreshes
- Your own saves are ignored (3s protection window)
- The `.vswrite/` folder is excluded from the watcher so backups never trigger refresh loops

For rolling back AI edits, see the [Versions & Auto-Backup](#versions--auto-backup) section.

---

## Terminal / AI

Real PTY terminal (xterm.js + node-pty):
- Shell: zsh (macOS), bash (Linux), PowerShell (Windows)
- Working directory: project folder
- Claude Code: run `claude` directly
- Claude Code skills are auto-generated in `.claude/skills/`
- Auto-resize, auto-respawn (max 5 times)

---

## Spell checking

- **Active by default:** uses Electron's built-in spellchecker (Hunspell)
- **Language sync:** language is read from `#set text(lang: "de")` in the Typst document
- **Dynamic switching:** updates when you change Quick Settings or the Settings Panel
- **Right-click misspelled word:** context menu with up to 5 suggestions + "Add to Dictionary"
- **Supported languages:** en, de, fr, es, it, pt, nl, sv, da, nb, fi, pl, ru

---

## PDF Viewer

- `.pdf` files from the sidebar open in the integrated viewer on click
- **Virtualized rendering:** only visible pages are rendered (performant even for large PDFs)
- **Select & copy text:** a TextLayer over the canvas enables Cmd+C
- Header with filename, page count and close button
- Handy for reading sources in `sources/`

---

## Auto-save & Status

- Edits are auto-saved after 1 second
- Status Bar (bottom right) always shows:
  - **Word count + reading time** for the active document (e.g. *1,247 words · 5 min read*) — recalculated live as you type, at 200 words per minute. Code blocks and raw Typst blocks are excluded so the count stays meaningful.
  - **Save state**: "Unsaved" (orange) or "Saved 14:35"
  - **Filename** of the active tab
  - **License tier** badge (Unlicensed / Licensed / Pro)
- Warning on close with unsaved changes
- **Crash recovery:** auto-backups are written to `<project>/.vswrite/backups/<timestamp>/` (interval configurable, default 30 s). If the app crashes and the latest backup is newer than the saved file on disk, vswrite offers to restore it when you reopen the project. See [Versions & Auto-Backup](#versions--auto-backup) for details.

---

## Persistence

vswrite stores two kinds of state separately — **app preferences** that are global to your installation, and **project state** that travels with each project folder.

**Global** (in your OS user data folder):
- Window position & size
- Panel states (sidebar/preview/terminal open/closed, sizes, active tab)
- Recent Projects (the last 10 project folders — entries that no longer exist are filtered out automatically)
- Onboarding flag (Welcome screen tick "Don't show again")
- Zotero `.bib` path
- Auto-Backup configuration (interval, max number of backups, max AI-snapshots)
- License key (encrypted in the OS keychain)

**Per-project** (inside the project folder):
- Version history (`.git/`)
- Auto-backups (`.vswrite/backups/`)
- AI-edit snapshots (`.vswrite/ai-snapshots/`)
- Claude Code skills (`.claude/skills/`)

The app **always starts on the Start Screen** — there is no auto-reopen. This is deliberate so that opening vswrite never surprises you with a project you didn't intend to work on.

---

## License Management

vswrite uses a two-tier license model:

| Tier | Scope |
|------|-------|
| **Basic** | All editor features (WYSIWYG, preview, terminal, Git, import/export) |
| **Pro** | Everything in Basic + MCP server access for AI integration |

### License status in the status bar

The bottom-right of the status bar shows the current license status:
- **Unlicensed** — no license registered
- **Licensed** — valid Basic license active
- **Pro** — valid Pro license active

**Click the status** to open the License dialog.

### Activating a license

1. Open the License dialog (click the license status in the status bar)
2. Enter your **License Key** (e.g. `VSWRITE_PRO_xxxx...`)
3. The key is validated against **Polar** and stored locally (encrypted in the system keychain)
4. Once validated, the license is active immediately

**Buy a license:** at [vswrite.com/pricing](https://vswrite.com/pricing) or via the **"Buy License"** button in the License dialog.

### Offline use

Once validated, vswrite works without an internet connection. A **30-day grace period** applies — after 30 days without re-validation the license is deactivated.

### Security

License data is encrypted via Electron's `safeStorage` and stored in the system keychain (macOS), DPAPI (Windows) or libsecret (Linux). Tampering with the config file alone is not enough to unlock the Pro tier.

---

## About Dialog

Accessible via:
- **macOS:** `vswrite -> About vswrite`
- **Windows/Linux:** `Help -> About vswrite`

The dialog shows:
- App version and logo
- Current license status (Unlicensed / Basic / Pro)
- System info: platform + architecture, Electron / Chromium / Node versions
- Links: User Guide, Website, Report Issue
- **Copy Diagnostics** — copies version + platform + Electron stack + license tier to the clipboard. Handy when you file an issue.

---

## MCP Server — AI integration with Claude Desktop & Co.

vswrite ships a built-in MCP server (Model Context Protocol) that lets external AI applications like **Claude Desktop**, **Codex Desktop** or **Clawdbot** work on your Typst documents directly — without going through the terminal.

> **Note:** the MCP server requires a **Pro** license. See [License Management](#license-management).

### What can the MCP server do?

Over MCP (52 tools) the AI can:
- Open, read, edit and verify Typst documents (separate compile = verify-only; export tools own artifact writing)
- Change document settings (font, size, language, margins, …) and apply style templates
- Manage chapters and bibliography end-to-end (incl. anchor-based comment / footnote / cross-reference inserts)
- Run project-wide search and replace with a versions-safety-net (whole-word lookarounds work for `@citekey` backlinks)
- Look up source PDFs in `sources/` by citekey
- Save / list / show / restore versions in the writer-vocabulary used by the Project panel
- Export PDF and DOCX (DOCX uses real Word styles + live multilevel numbering)
- Import Markdown and add images (with content-hash dedup + figure builder)
- Drive the whole design surface — swap themes / palettes / layouts / fonts, insert design elements (15 of them incl. drop-cap, pull-quote variants, article-opener, section-opener, image galleries, magazine cover) at anchors, map natural-language intents (`brochure` / `magazine` / `thesis` / …) onto matching theme+layout combos
- Switch between projects, run Git operations, and pull Skill Prompts (typst-reference / vswrite-conventions / research-workflow / writing-style / design-conventions)

### Setup: auto-discover wizard (macOS)

On macOS, vswrite offers to connect Claude Desktop automatically — no JSON editing required. Requirements:

- **Pro license activated** (see [License Management](#license-management)) — the MCP server rejects spawn otherwise
- **Claude Desktop installed** at `/Applications/Claude.app` or `~/Applications/Claude.app`

**Flow:**

1. The wizard pops up a few seconds after launch (or via `Help → "Connect to Claude Desktop…"`)
2. Click **"Connect now"**
3. Behind the scenes:
   - The server binary is copied from the .app bundle to `~/Library/Application Support/vswrite/mcp-server/vswrite-mcp`
   - `~/Library/Application Support/Claude/claude_desktop_config.json` gets a `vswrite` entry — any pre-existing MCP servers are preserved untouched, and a timestamped backup of your old config is written first
   - Your Pro license key is written as an environment variable (`VSWRITE_LICENSE_KEY`) into the entry
4. **Restart Claude Desktop** — the vswrite tools appear automatically

**Standalone:** the MCP server runs as an independent process, **decoupled from the vswrite app**. You can quit vswrite, keep using Claude, open vswrite again later — the launch order is irrelevant.

**Idempotent:** running setup again is safe — no duplicate entry. If you activate a new license later, re-run the wizard from the Help menu so the new key lands in the config.

### Setup: manual (Windows, Linux, or power users)

The wizard is currently macOS-only. You can also configure manually on macOS if you prefer:

**Step 1:** build the server binary (once, in the vswrite repo):

```bash
npm run build:mcp-binary       # host arch only
# or
npm run build:mcp-binary:all   # arm64 + x86_64
```

Output: `dist/mcp/bin/vswrite-mcp-<arch>` (~64 MB single-file binary, no Node required).

Alternatively use the classic Node path (requires Node ≥ 20):

```bash
npm run build:mcp   # → dist/mcp/server.mjs
```

**Step 2:** open the configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Step 3:** register vswrite as an MCP server. With the standalone binary (recommended):

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "/PATH/TO/vswrite-desktop/dist/mcp/bin/vswrite-mcp",
      "env": { "VSWRITE_LICENSE_KEY": "VSWRITE_PRO_xxxx..." }
    }
  }
}
```

Or via Node + `.mjs`:

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "node",
      "args": ["/PATH/TO/vswrite-desktop/dist/mcp/server.mjs"],
      "env": { "VSWRITE_LICENSE_KEY": "VSWRITE_PRO_xxxx..." }
    }
  }
}
```

**Step 4:** restart Claude Desktop.

### Usage

After the restart, Claude sees the vswrite tools. You can say things like:

- *"Open my thesis project at /Users/.../my-thesis"*
- *"Show me the content of my Typst document"*
- *"Change the font size to 12pt and the language to English"*
- *"Compile my document and show me the errors"*
- *"Export the document as PDF to ~/Desktop/thesis.pdf"*

Claude uses the vswrite tools behind the scenes. All paths are validated against the project directory — the agent cannot accidentally escape the project.

### Switching projects

You don't need to edit the config every time you switch projects. Just tell Claude:

*"Switch to the project /Users/.../other-project"*

Claude will call `vswrite_set_project` and work with the new project from there on.

### Available tools (43)

The full reference with parameter schemas, return shapes, and end-to-end workflow examples lives in [mcp-server.md](mcp-server.md). All 52 tools with one-line descriptions, grouped by category:

**Project & files (5)**

- `vswrite_set_project` — Set the active project directory; auto-detects `main.typ` / `document.typ`. Call first.
- `vswrite_list_files` — Return the project file tree (`.typ`, `.bib`, `.md`, `.yaml`, `.json`, `.pdf`, images).
- `vswrite_read_file` — Read a file from the project; text content as string, binaries as Base64.
- `vswrite_write_file` — Write content to a project file; creates parent directories as needed.
- `vswrite_create_project` — Create a new Typst project from a template (`document`, `thesis`, `paper`, `letter`, `book`).

**Document operations (4)**

- `vswrite_get_document` — Return the current document (content, path, project dir, word count).
- `vswrite_open_file` — Open a `.typ` file as the current document; path absolute or project-relative.
- `vswrite_update_document` — Replace the current document content and save to disk.
- `vswrite_compile` — Verify that the document compiles cleanly; PDF-only, artifact removed afterwards — use `export_pdf` / `export_docx` for real output.

**Settings (2)**

- `vswrite_get_settings` — Read the document settings (language + bibliography style; everything else has lived in the Design editor since Phase A).
- `vswrite_update_settings` — Update document settings; only passed keys are modified.

**Design (11) — themes, layouts, palette, fonts, elements**

The structured design surface from the Design tab. Writes directly to `.vswrite/style.json`, regenerates `style.typ`, ensures the root `.typ` file has `#import "style.typ": *` + `#show: apply-style` at the top. Theme / layout swaps preserve `style.custom.preamble` (the user escape-hatch block).

- `vswrite_get_style` — Return the full `ProjectStyle` JSON (colors / fonts / scale / layout / headings / elements / custom).
- `vswrite_update_style` — Partial deep-merge patch with per-leaf sanitiser; invalid values fall back to the old value.
- `vswrite_list_styles` — List the six built-in themes (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis).
- `vswrite_apply_style` — Apply a theme; overwrites colors/fonts/scale/layout/headings/elements, preserves `custom.preamble`.
- `vswrite_list_layouts` — Return the seven layout presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, Magazine Editorial).
- `vswrite_apply_layout` — Swap only the `layout.*` values (+ optional `scale.base`) — theme, colors, fonts unchanged.
- `vswrite_list_fonts` — Return the seven bundled OFL fonts with family / category / description.
- `vswrite_apply_palette` — Set the 5-colour palette via `presetId` or per-slot hex overrides (composable).
- `vswrite_list_design_elements` — Library of **15** parametric snippets with their params — Banner, Sidebar, Pull-Quote (regular / Display / Block), Callout, Hero, Divider (regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Gallery 2-up / 3-up, Magazine-Cover.
- `vswrite_insert_design_element` — Insert an element at an anchor; snippets reference `style-colors.*` / `style-fonts.*` so they re-theme automatically.
- `vswrite_generate_layout` — High-level NL composite: `intent: "magazine"` selects e.g. the Editorial theme + Magazine-Editorial layout + optional Hero opener.

**Chapters & structure (6)**

- `vswrite_get_chapters` — Return the `#include` structure (order, paths, file-exists flag).
- `vswrite_reorder_chapters` — Reorder the `#include` statements in the root document.
- `vswrite_add_chapter` — Create a new chapter file in `chapters/` and add an `#include`.
- `vswrite_remove_chapter` — Remove an `#include` entry from the root document; the file itself is kept.
- `vswrite_merge_document` — Resolve all `#include` statements recursively and return the merged document as a string (read-only).
- `vswrite_split_document` — Split the current document at `=` Heading-1 boundaries into individual chapter files.

**Bibliography & citations (3)**

- `vswrite_get_citations` — Return all BibTeX entries from the project's `.bib` files.
- `vswrite_add_citation` — Add a BibTeX entry to `references.bib`; creates the file and `#bibliography` statement if missing.
- `vswrite_ensure_bibliography` — Ensure the project has a `references.bib` and a `#bibliography` statement.

**Cross-references & footnotes (3)**

- `vswrite_list_labels` — Return all `<label>` definitions in the project with type classification (figure / table / equation / heading / other) and caption preview.
- `vswrite_insert_reference` — Insert a Typst cross-reference (`@label`) at an anchor; validates the label exists and suggests close matches if not.
- `vswrite_add_footnote` — Insert a Typst footnote (`#footnote[…]`) at an anchor; bracket-balance check on the body.

**Comments & annotations (4)**

- `vswrite_list_comments` — List vswrite comments (or just those of one file); comments live as `.md` files in `comments/` and never compile.
- `vswrite_add_comment` — Create a comment anchored to a verbatim text snippet; generates id, frontmatter, offset hints.
- `vswrite_resolve_comment` — Mark a comment as resolved (or un-resolve it); the entry stays in the project.
- `vswrite_delete_comment` — Permanently delete a comment (removes the `.md` file).

**Versions (4) — matches the Project panel's vocabulary**

- `vswrite_save_version` — Save a named version (Git commit); auto-initialises the repo if missing; local-only, never pushes.
- `vswrite_list_versions` — Return the version history (max. 200, newest first) including an `isAuto` flag for vswrite-internal auto-versions.
- `vswrite_show_version` — Return the per-file diff for one version (added/modified/deleted/renamed + unified-diff hunks).
- `vswrite_restore_version` — Restore files from a historical version into the working tree; save a version first!

**Discovery — search & sources (3)**

- `vswrite_search_project` — Search across all `.typ` (optionally `.bib`) files; whole-word uses lookarounds so it works for `@citekey` backlinks; capped at 1000 matches.
- `vswrite_replace_in_project` — Replace all matches of a query project-wide; **destructive** — call `save_version` first.
- `vswrite_find_source_for_citation` — Look up a PDF in `sources/` matching a citekey (`<citekey>.pdf` preferred, suffix variants allowed).

**Export (2)**

- `vswrite_export_pdf` — Compile and export as PDF; output path must lie inside the project — convention is `exports/<name>.pdf`.
- `vswrite_export_docx` — Export as DOCX with real Word styles (Heading1-6, Quote, CodeBlock …) and live multilevel-numbering — supervisors can reorder in Word and the numbers refresh.

**Import & assets (2)**

- `vswrite_import_markdown` — Convert Markdown to Typst and write into a project file; inline markdown or `srcPath` to an `.md` file.
- `vswrite_add_image` — Import an image into `assets/` (content-hash dedup), build the Typst snippet (with optional caption + label → `#figure(…)`), and optionally insert it at an anchor.

**Git low-level (3) — for syncing with a remote**

- `vswrite_git_status` — Return branch, ahead/behind, and changed files.
- `vswrite_git_commit` — Stage all changes and commit with the given message.
- `vswrite_git_push` — Push commits to the remote repository.

All file-touching tools route paths through `resolveInsideProject` — symlink-aware, blocks `../`-traversal. Anchor-based tools (`add_comment` / `insert_reference` / `add_footnote` / `add_image`) take an `afterText`/`anchor` plus an optional 1-based `occurrence` when the anchor appears multiple times — the agent never has to compute offsets.

The MCP server also exposes five **prompts** backed by the deployed `.claude/skills/<name>/SKILL.md` content:

- **typst-reference** — Typst language reference (syntax, math, layout, cross-references, footnotes, bibliography, bundled packages with code examples).
- **vswrite-conventions** — Project conventions (folder structure, persistence layers, design surface, comments, cross-references, mode toggles).
- **research-workflow** — Four-phase workflow (discover / capture / synthesize / integrate) plus end-to-end recipes with MCP tools.
- **writing-style** — Prose checklist for academic writing with four sections: **Source Discipline** (never invent citations / BibTeX entries / quotes, pre-submission audit), **Anti-AI-Tells** (em-dash inflation, "not just X but Y", three-list reflex, buzzwords like `delve into` / `Landschaft`), **Active Prose Principles**, **Academic Conventions** (tense, hedging, citation integration). Bilingual (English + German).
- **design-conventions** — Visual design conventions: color theory (5 semantic slots, WCAG contrast rules), typography pairing, heading hierarchy, layout patterns, "Modern Looks 2026", anti-patterns (e.g. multiple drop caps per section, doubled article-openers), workflow recipe for composing design decisions.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Project | `Cmd+N` |
| Open Project | `Cmd+O` |
| Close Project | `Cmd+Shift+W` |
| Save | `Cmd+S` |
| Save As | `Cmd+Shift+S` |
| Find (current file) | `Cmd+F` |
| Find & Replace (current file) | `Cmd+H` |
| Find in Project | `Cmd+Shift+F` |
| Add Comment | `Cmd+Alt+M` |
| Insert Reference | `Cmd+Alt+L` |
| Reading Mode | `Cmd+Alt+R` |
| Toggle sidebar | `Cmd+B` |
| Toggle preview | `Cmd+Shift+P` |
| Toggle terminal | `` Cmd+` `` |
| Undo | `Cmd+Z` |
| Redo | `Cmd+Shift+Z` |
| Exit focus mode | `Escape` |
| Bold | `Cmd+B` |
| Italic | `Cmd+I` |
| Strikethrough | `Cmd+Shift+X` |
| Inline code | `Cmd+E` |
| Link | `Cmd+K` |
| Heading 1/2/3 | `Cmd+Alt+1/2/3` |
| Bullet list | `Cmd+Shift+8` |
| Numbered list | `Cmd+Shift+7` |
| Code block | `Cmd+Alt+C` |
| Keyboard shortcuts overview | `Cmd+/` |

On Windows/Linux use `Ctrl` instead of `Cmd`.

---

## Crash Reports

If vswrite ever crashes, the app writes a plaintext report locally containing:

- The error type and message
- A stack trace with file + line
- Your recent actions (event types only — no document content)
- App, OS, and version info

On next launch, a dialog opens automatically with the report — you decide what happens: **Copy to clipboard**, **Prepare e-mail** (opens your mail client pre-filled to `feedback@vswrite.com`), **Open folder** (shows all stored reports in Finder), or **Discard** (deletes them).

**What vswrite does NOT do:** automatically send data over the internet. There is no external crash telemetry, no account login, no server reading along. Reports stay on your machine until you actively share them.

**What gets anonymized:** Paths like `/Users/<firstname>/...` are replaced with `/Users/<redacted>/...` before the report is written. Document content never enters reports — only file **extensions** and action types (e.g. "file saved", "project opened").

**Later access:** Help → Open Crash Reports opens the reports folder.

---

## Updates

The app checks for new versions on each start (5 seconds after start, then every 4 hours). When a new version is available, a native dialog asks whether to download it now and install on next launch.

Manual check: open the About dialog — the version shown there is your installed version. For the latest release see [vswrite.com/download](https://vswrite.com) or [releases.vswrite.com](https://releases.vswrite.com).

---

## Help & Support

- **User Guide (this handbook):** [vswrite.netlify.app/en/docs](https://vswrite.netlify.app/en/docs) — or via the app menu **Help -> User Guide**
- **Bugs / feature requests:** [github.com/renejes/vswrite-desktop/issues](https://github.com/renejes/vswrite-desktop/issues) — or via the app menu **Help -> Report Issue**
- **Website:** [vswrite.com](https://vswrite.com)

When reporting a bug, it helps a lot to click **"Copy Diagnostics"** in the About dialog and paste the output into the issue — that way the reader immediately sees version, platform and license tier.
