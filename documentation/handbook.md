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
- **Document** — Document Settings, Style Templates submenu (7 predefined + Import Custom), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help** — User Guide, Keyboard Shortcuts, Report Issue (and About on Windows / Linux)

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

The sidebar has five tabs:

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

## Style Templates

7 predefined + your own templates:

| Template | Description |
|----------|-------------|
| Classic Academic | Serif, numbered headings |
| Modern Clean | Sans-serif, blue accents |
| Minimal | Ultra-clean, roomy |
| Vibrant | Strong colours |
| Elegant | Decorative, gold accents |
| Professional Report | Business layout |
| Artsy | Red/blue colour scheme |

**Apply a template:** Document menu -> Style Templates -> pick a style. Applies the chosen preamble to your `main.typ` (only allowed when the main file is active — see note below).

**Import your own template:** Document menu -> Style Templates -> Import Custom Template… -> pick a `.typ` file. Only the preamble (#set/#show rules) is extracted, even when you pass a complete document. Stored in `.claude/style-templates/`.

**Note:** styles can only be applied while you have the project's main file (`main.typ` or whichever file your `#include`s point at) active in the editor. If you try to apply a style while a chapter is open, vswrite blocks the action with a dialog — otherwise the style preamble would be prepended to that chapter and silently corrupt it.

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

Over MCP (26 tools) the AI can:
- Open, read and edit Typst documents
- Change document settings (font, size, language, margins, etc.)
- Apply style templates (7 predefined styles)
- Compile Typst and analyze errors
- Export PDFs
- Manage chapters (read, reorder, add, remove, merge, split)
- Manage bibliography and citations (add BibTeX entries)
- Manage project files (read, write, list)
- Create new projects from templates
- Run Git operations (status, commit, push)
- Switch between projects

### Setup: Claude Desktop

**Step 1:** build the MCP server (once, in the vswrite directory):

```bash
npm run build:mcp
```

**Step 2:** open the configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Create it if it doesn't exist.

**Step 3:** register vswrite as an MCP server:

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "node",
      "args": [
        "/PATH/TO/vswrite-desktop/dist/mcp/server.mjs",
        "--license-key", "VSWRITE_PRO_xxxx..."
      ]
    }
  }
}
```

Replace `/PATH/TO/vswrite-desktop` with the actual install path and `VSWRITE_PRO_xxxx...` with your Pro license key.

**Alternative:** use the `VSWRITE_LICENSE_KEY` env variable instead of `--license-key`:

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

### Available tools (26)

**Document & Project:**

| Tool | Description |
|------|-------------|
| `vswrite_set_project` | Set/switch the project directory |
| `vswrite_get_document` | Read the current document |
| `vswrite_open_file` | Open a .typ file |
| `vswrite_update_document` | Edit the document and save |
| `vswrite_compile` | Compile Typst (SVG/PDF) |
| `vswrite_export_pdf` | Export PDF |
| `vswrite_create_project` | Create a new project from a template |
| `vswrite_list_files` | Show the file tree |
| `vswrite_read_file` | Read a file |
| `vswrite_write_file` | Write a file |

**Settings & styling:**

| Tool | Description |
|------|-------------|
| `vswrite_get_settings` | Read document settings |
| `vswrite_update_settings` | Change settings |
| `vswrite_list_styles` | List available style templates |
| `vswrite_apply_style` | Apply a style template |

**Chapters:**

| Tool | Description |
|------|-------------|
| `vswrite_get_chapters` | Read the chapter structure |
| `vswrite_reorder_chapters` | Change chapter order |
| `vswrite_add_chapter` | Create a new chapter |
| `vswrite_remove_chapter` | Remove a chapter |
| `vswrite_merge_document` | Merge all chapters |
| `vswrite_split_document` | Split the document by heading |

**Bibliography:**

| Tool | Description |
|------|-------------|
| `vswrite_get_citations` | Read all citations from .bib |
| `vswrite_add_citation` | Add a BibTeX entry |
| `vswrite_ensure_bibliography` | Ensure bibliography is set up |

**Git:**

| Tool | Description |
|------|-------------|
| `vswrite_git_status` | Show git status |
| `vswrite_git_commit` | Commit changes |
| `vswrite_git_push` | Push to remote |

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

**Later access:** Help → Crash-Berichte oeffnen opens the reports folder.

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
