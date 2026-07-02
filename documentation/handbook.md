# Penwright Desktop — User Handbook

> **Version:** 0.10.0 (Pre-Release)
> **Last updated:** 2026-06-30
> **Deutsche Version:** [handbuch.md](handbuch.md)

---

## What is Penwright Desktop?

Penwright Desktop is a standalone WYSIWYG editor for Typst documents. Instead of working in markup code, you edit in a visual editor — similar to Google Docs or Notion. At the same time you get the full power of Typst: math formulas, configuration and layout are surfaced as editable code blocks.

Typical use cases: academic theses, books, longer documents with multi-chapter structure, bibliography and math typesetting — everything you would otherwise reach for LaTeX or Word.

---

## Getting Started

### Prerequisites

- **macOS**, **Windows** or **Linux**
- **Typst CLI** — **not required anymore**. The app ships the right Typst binary itself; you don't need to install anything separately.

### Installation

From v0.7.0:
- **macOS:** download the DMG from [penwright.online](https://penwright.online) and drop it into your Applications folder
- **Windows:** download the NSIS installer and run it
- **Linux:** download the AppImage, make it executable (`chmod +x`), run it

### Opening your first project

Penwright is project-based: a project is a folder that contains at least one `.typ` file. The app always starts on the Start Screen — you choose what to open.

- **File -> New Project…** (`Cmd+N`) — create a new project from a template
- **File -> Open Project…** (`Cmd+O`) — pick a folder
- **"Open Sample Project"** on the Start Screen — copies an annotated mini-thesis about AI-assisted academic writing to a location of your choice (default: `~/Documents/penwright-sample-thesis`). Includes five real open-access source PDFs in `sources/`, three sample comments, and one saved version in the history. Every feature demonstrated at least once
- **Recent Projects** appear on the Start Screen and reopen with one click

To stop working on a project without quitting the app, use **File -> Close Project** (`Cmd+Shift+W`) — you return to the Start Screen and can open another project.

---

## App Layout

```
+--------------------------------------------------------------+
|                         (Title bar)                           |
+------------------------------+-------------------------------+
|[Files Outline Chapters       | ＋ B I U S  H1 H2 H3  bul Link|  Top bar:
| Project Comments]            |                              |  nav tabs + toolbar
+------+-------------------------------+-----------------------+
|      |  [main.typ] [refs.bib]        |                       |
| Side-|                               |   Preview Panel       |
| bar  |  WYSIWYG Editor               |   (live PDF)          |
|      |                               |                       |
+------+-------------------------------+-----------------------+
| [Project][Preview]  Chapter Look ▾  1,247 words · …  DE  Trial |
+--------------------------------------------------------------+
```
The **navigation tabs** (Files / Outline / Chapters / Project / Comments) sit in the top bar; clicking one shows that panel, clicking the active one collapses the sidebar. The **＋ button** on the left of the toolbar opens the insert menu (see [Inserting content](#inserting-content---button--and-)). The **status bar centre** is the contextual **Look** control (Chapter Look / Global-Look / Look — see [the Look model](#design--the-look-model)). There is no separate "Design" tab — design lives in `style.typ` and the status bar.

**Interface language (English / German):** Penwright picks your OS language on first launch. Switch it anytime with the small **DE/EN toggle** at the right of the status bar, or under **Document → Document Settings → Interface**. (This is the *app* language — separate from a document's text language, which is `#set text(lang: …)`.)

### Toggling panels

| Panel | Shortcut | Status Bar button |
|-------|----------|-------------------|
| Sidebar (left) | `Cmd+B` | **Project** |
| Preview (right) | `Cmd+Shift+P` | **Preview** |

All panels are resizable by dragging their edges.

---

## The Editor

### Toolbar

| Button | Function | Shortcut |
|--------|----------|----------|
| **＋ Insert** | Opens a menu with everything insertable — headings, lists, images, tables, math, footnotes, citations, references, page breaks, Typst blocks. **Same list as typing `/`** in the text; `@` jumps straight to citations & references. | — |
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

### Native menu

All project-level and document-level actions live in the **native menu bar** (top of the screen on macOS, top of the window on Windows / Linux). Five top-level menus:

- **File** — New Project (`Cmd+N`), Open Project (`Cmd+O`), Close Project (`Cmd+Shift+W`), Save (`Cmd+S`), Save As (`Cmd+Shift+S`), Export PDF / DOCX, **Export to Web (HTML)**, Import Markdown, Link Zotero Library, Open Sources Folder, Add Citation Manually
- **Edit** — Undo / Redo / Cut / Copy / Paste / Select All, Find & Replace (`Cmd+F`), **Find in Project…** (`Cmd+Shift+F`), **Add Comment** (`Cmd+Alt+M`), **Insert Reference…** (`Cmd+Alt+L`), Undo AI Edit
- **View** — Toggle Sidebar (`Cmd+B`), Toggle Preview (`Cmd+Shift+P`), plus standard window/zoom roles
- **Document** — Document Settings (**interface language** + document language + bibliography style; the document's Look lives in `style.typ`), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help** — User Guide, Keyboard Shortcuts (`Cmd+/`), Report Issue, **Open Crash Reports** (opens `<userData>/crash-reports/` in Finder); About on Windows / Linux

In-text content insertions (image, table, math, citation, divider, page break, etc.) are reachable three ways: the **＋ Insert** button on the left of the toolbar, **slash commands** (type `/` in the editor — see below), or `@` for citations & references.

### Inserting content — ＋ button, `/` and `@`

The toolbar **＋** button and the slash menu draw from the **same list**, so use whichever you prefer — the button is the discoverable starting point, `/` is the fast path once you know the names. Type `@` directly for citations and cross-references.

| Command | Description |
|---------|-------------|
| `/Heading 1-3` | Headings |
| `/Bullet List` | Bullet list |
| `/Numbered List` | Numbered list |
| `/Quote` | Blockquote |
| `/Code Block` | Generic code block (for showing code samples in the text) |
| `/Divider` | Horizontal rule |
| `/Page Break` | Start a new page |
| `/Table of Contents` | Inserts `#outline()` |
| `/Math` | Typst math block |
| `/Typst Code` | Raw Typst block — for `#set` / `#show` / colours etc. Exit with **✓ Done**, `Esc` or `Cmd+Enter` |
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
| **Magazine** | Editorial magazine with cover, editorial, TOC, and article slots. Cover macro lives stably in `chapters/_cover-macro.typ`; the macro call in `chapters/00-cover.typ` is rewritten per issue by the `cover-designer` skill from [ai-magazine-designer](https://github.com/renejes/ai-magazine-designer) |

3. **Location** — the project structure is created.

Every new project automatically gets:
- Template files (main.typ, chapters/, bibliography.bib)
- `assets/` folder for images
- `sources/` folder for reference PDFs and other research material
- `.claude/skills/` with Claude Code skills (typst, Penwright, research)
- `.git/` repository + `.gitignore` so the version system works from the very first save
- `.penwright/` folder for auto-backups and AI-edit snapshots (hidden, project-local)
- An initial commit with the template content

---

## Sidebar

The sidebar has six tabs:

### Files
- Recursive file tree, Back button, **New Folder** (inline input — Enter saves, Esc cancels), **Add Asset** (file picker that copies into `assets/`)
- Empty folders like `assets/` and `sources/` stay visible so you always see where to drop things
- `.claude/` folder visible for skills; `.git/` and `.penwright/` are hidden
- Images from `assets/` are draggable into the editor
- Right-click -> "Open in New Tab"

### Outline
- Live heading hierarchy (H1 -> H2 -> H3), click navigates to the heading
- **Drag to reorder:** grab a heading row and drop it above or below another — the whole section (heading plus everything down to the next heading of equal or higher rank) moves with it. A blue 2 px line shows the drop target. Single-file only; cross-file chapter reordering still happens in the **Chapters** tab.
- **Find backlinks:** hovering over a heading reveals a small **↪** arrow on the right — click it to find every place in the project where that heading is mentioned (see [Backlinks](#backlinks--where-else-is-this-mentioned))

### Chapters (Include manager)
- `#include` statements, arrows to reorder (instant UI update), x to remove, + Add Chapter
- The chapter's **Look** is no longer set here — it lives in the **status bar** while you edit the chapter (Chapter Look ▾ + the **✎** editor). See [the Look model](#design--the-look-model).

### Project
This tab replaces the old Git panel and uses writer-friendly vocabulary instead of raw Git commands. See the **[Versions & Auto-Backup](#versions--auto-backup)** section below for the full workflow. In short:
- **Save Version** — names your current state and stores it in the project's history
- **Changes since last version** — checkboxes for which files go into the next version
- **History & Restore** — one button opens a hub with everything you can get back: your saved versions, automatic backups, and AI edits (see below)
- **Advanced** (collapsed) — optional cloud sync (push/pull to GitHub or any other Git remote)

### Comments
- Lists every comment for the **current file** or **the whole project** (toggle at the top of the panel)
- Per entry: anchor preview (italic, click jumps to the spot in the editor), body textarea (auto-saves shortly after you stop typing), resolved checkmark, delete
- Resolved comments are hidden by default; the "Show resolved" checkbox brings them back
- Full workflow: see the **[Comments & Notes](#comments--notes)** section below

> **Note:** there is no longer a "Design" sidebar tab. Design now lives **where it applies** — open `style.typ` for the whole-document Look, use the status-bar control for a chapter's Look, and right-click → "Design with AI" for a single spot. See [the Look model](#design--the-look-model).

---

## Find in Project

For **searching and replacing across all chapters at once**, Penwright has a separate project-wide search, distinct from the in-file search (`Cmd+F`).

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

Penwright gives you a picker that lists every `<label>` in the project so you don't have to remember exact names.

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

Both citations (`@chen2021codex`) and cross-references (`@fig:scaling`) use the same `@…` syntax in Typst. Penwright tells them apart by the label name:

- Contains a colon (`:`) — treated as a reference
- Starts with a known prefix (`fig`, `tbl`, `eq`, `sec`, `chap`, `app`, `thm`, `lem`, `def`, `cor`, `prop`, `algo`, `lst` and their full forms) — treated as a reference
- Anything else — treated as a citation

That's why `@` autocomplete is reserved for citations only (citekeys are bare slugs by convention). For references, use the picker.

---

## Comments & Notes

Comments are **yellow annotations** that are visible only inside the Penwright editor and **never** compile into the PDF/DOCX output. Useful for self-notes ("add a citation here") or supervisor feedback.

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

**Reanchoring:** if you insert text before a commented stretch, the anchor shifts. Penwright locates it again on file open via the stored anchor text. If the anchor was deleted or changed beyond recognition, the comment is marked **orphaned** (red warning triangle) — you can reassign or delete it manually.

**Known MVP limitations:**
- The anchor text must live within a single paragraph / heading — comments anchored across paragraph boundaries are reported as orphaned.
- Multiple comments with **identical** anchor text in the same file all highlight the same (first) location.

---

## Backlinks — "Where else is this mentioned?"

For consistency checks in academic work, you often want every mention of a concept or source across all chapters. Penwright has two built-in triggers that under the hood open [Find in Project](#find-in-project) with the right query.

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

- **Root-file compilation:** with chapters, `main.typ` is compiled automatically (the preview always shows the *whole* document, not a single chapter)
- **PDF rendering** via pdf.js — viewport-virtualised, so 100+ page documents stay smooth
- **Text selection & copy** in the preview thanks to pdf.js' TextLayer
- **Error display:** Typst errors show up in the preview panel
- **Update mode (auto / manual):** by default the preview updates live as you type (400 ms debounce). For long documents you can switch to **manual** under **Document → Document Settings → Preview** — then saving still happens automatically, but the preview only recompiles when you click the **↻ Refresh** button in the preview header. An "Outdated" hint + a highlighted ↻ tell you when the preview is behind.
- **Follows the chapter you're editing:** when you switch to a chapter file, the preview scrolls to that chapter's first page (matched via the PDF's bookmarks). It only jumps on a *switch*, never while you type.
- **Single page or double-page spread:** a small `▭▭` toggle in the preview bar switches between single-page scrolling and a **2-up facing-pages** view — page 1 on its own, then 2–3, 4–5 … side by side, the way a magazine opens. Handy for spreads and full-bleed layouts. Saved per project alongside the zoom levels.

---

## Zoom (Editor + Preview)

The editor and the PDF preview zoom independently, from 50 % to 200 % in 10 % steps:

- **Editor zoom:** the current `100 %` shows as a button in the bottom-right status bar. Click it to open a small popover with `−` / `+` and a reset button. From the keyboard: `Cmd+Alt+=` (in), `Cmd+Alt+-` (out), `Cmd+Alt+0` (back to 100 %).
- **PDF preview zoom:** a slim `− 100 % +` strip sits at the top of the preview panel. Click the percentage to reset. From the keyboard: `Cmd+Shift+=` (in), `Cmd+Shift+-` (out), `Cmd+Shift+0` (reset). The same PDF zoom applies to opened source PDFs (e.g. via citation hover → "Open PDF").
- **Scrollbars** are always visible — once you zoom past 100 %, the page is wider than the panel and you can scroll horizontally.
- **Saved per project:** the next time you open the same project, your zoom levels are restored. The values live in `<project>/.penwright/preferences.json` and travel with the folder if you copy it.
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

### Print export ("For print")

When you export a PDF, the dialog now shows a **"For print"** option that turns the on-screen PDF into a **print-shop-ready** file — entirely inside Typst, no external tool:

- **Bleed** (3 mm / 5 mm / custom): the physical page grows beyond the trim on all sides so full-bleed images leave no white edge after cutting.
- **Crop marks:** corner trim marks drawn in the bleed — *these marks are the trim definition* (see the note below).
- **Facing pages + binding gutter:** inner/outer margins per page parity, with extra room at the spine. Unlike bleed, facing pages are **also shown while you edit**, because a bound booklet genuinely looks different.
- **dpi pre-flight:** a non-blocking note lists images that are probably too low-resolution for print (under ~1500 px on the short edge).
- **"Remember as default":** stores the print settings in the project's design, so the dialog comes pre-filled next time.

Fastest way: **File → Export PDF → tick "For print"**. To set a project up as a print project once, apply the **"Magazine (Print) · A4 + 5 mm bleed"** layout preset in the Design tab — then the dialog is pre-filled and facing pages show live while editing.

A **spread image** ("double-truck" — one photo running across two facing pages over the gutter) is available as a design element; it bleeds to the physical edges automatically in the print export. Use the **double-page preview** (see Live Preview) to judge it.

> **RGB, not CMYK.** Penwright delivers a print-ready **RGB** PDF with bleed + crop marks. Typst cannot embed an ICC profile or set PDF/X trim/bleed boxes, so the **drawn crop marks are the trim definition** — the CMYK / PDF-X conversion is a downstream step (the print shop with their calibrated profile, or Acrobat / Ghostscript). For colour-accurate offset printing, let the print shop convert.

### DOCX export

The DOCX is produced with real Word styles and now covers the rich academic constructs, not just prose:
- **Multi-chapter aware:** all `#include`d chapters are merged into the output (the old "current file only" behaviour is gone)
- Headings, bibliography, code blocks and quotes use named Word styles — restyle the whole document from the Word styles panel
- Page size, margins, font, font size and line spacing are inherited from your Typst `#set` / Design settings (e.g. A4 + Libertinus 11pt); a centered **page-number footer** is written when the design enables page numbering
- **Live heading numbering:** if your Typst file has `#set heading(numbering: "1.1")`, the headings get Word multilevel numbering. When your supervisor reorders chapters in Word, the numbers update automatically.
- **Figures** become an embedded image plus a "Figure N" caption; a `#figure(table(…))` becomes a real Word table with a "Table N" caption
- **Equations** (`$ … $` display math) are rendered to crisp images via the bundled Typst, keeping their equation number; **SVG figures** are rasterised the same way
- **Cross-references** (`@fig:…` / `@tbl:…` / `@eq:…`) resolve to "Figure 1" / "Table 2" / "(3)"
- **Footnotes** become real Word footnotes (with their inline markup); nested and consecutive numbered lists keep correct numbering
- Citations render as `(Author Year)`, or as `[n]` when the bibliography style is numeric (IEEE, Vancouver, …); `#info` / `#tip` / `#warning` / … callouts become a shaded accent box
- TOC and bibliography headings are localized to the document language (DE/EN/FR/ES/IT/PT/NL)
- **What is intentionally dropped:** pure page-design code — full-bleed layouts, magazine openers, multi-column spreads, drop caps and other visual-only Typst — has no Word equivalent, so it is *skipped* rather than dumped as monospace source. For design-driven output the deliverable is PDF; **DOCX is the manuscript format** (prose, structure, figures, math, tables, footnotes, references).

### Web export (HTML) — the Editorial Web Pack

New in 0.10.0: **print *and* web from one source.** Export your document — or a whole magazine — as self-contained, responsive HTML you can put on the web. The same manuscript that becomes your print PDF becomes a live web page, with no second edit.

**Do it:** **File → Export to Web (HTML)…**, then pick a folder — Penwright writes a small bundle there.

**Two shapes, auto-detected from your document:**
- A **regular document** (thesis, report, paper) → **one self-contained page** (`index.html`), plus `fragment.html` (just the article, to embed elsewhere), a neutral `meta.json`, and an `assets/` folder for images.
- A **magazine** (a cover page, or two or more article openers) → a **mini-website**: an issue **index** (the cover + a clickable table of contents) and **one page per article**, each with a "‹ back to contents" link and previous/next navigation. Every article gets its own file, so a single article is shareable on its own.

**What carries across** — everything that means something, not just prose:
- headings, lists, quotes, code
- **figures** and **tables** with automatic "Figure N" / "Table N" captions
- **math** — display equations are rendered to crisp, scalable inline SVG by the bundled Typst (no blurry raster, no external math library)
- **cross-references** — `@fig:x` becomes "Figure 1", `@sec:y` becomes "Section 2.1", linked to the target on the page
- **citations** — grouped and formatted like the PDF (`(Bender et al., 2021; …)`, or `[1, 2]` for numeric styles) and linked into the bibliography
- **footnotes** — numbered, collected into an endnotes section at the foot of the article with "↩" back-links
- **bibliography** — an APA-shaped "References" section, each entry anchored so citations link straight to it
- the **magazine design** — drop caps, pull-quotes, callouts, multi-column sections, margin notes, article openers, and the cover — as real, responsive web design; your colours and fonts come from the same design tokens as the PDF, and justified body text carries over

**It's a re-interpretation, not a screenshot of the PDF.** The web is one reflowing column, so print-only geometry is *translated*, not copied: a full-bleed opener or a double-page image becomes a full-width web hero; margin notes sit in an outer column on wide screens and fold inline on a phone; multi-column sections collapse to a single column on mobile.

**Framework-agnostic on purpose** — the output makes no assumptions about where it goes:
- the article carries its own **scoped CSS**, prefixed so it never collides with a host site's styles
- `fragment.html` is just the `<article>` — drop it into Astro, WordPress, Ghost, a static-site generator or your own CMS
- `index.html` is a standalone page you can host as a plain file
- `meta.json` is neutral metadata (title, language, and — for a magazine — the list of articles)
- images are copied into `assets/` with relative links

---

## Design — the "Look" model

Penwright decouples writing from design. You design **where it applies** — three surfaces, one word ("Look"):

- **Whole document → open `style.typ`.** Double-clicking `style.typ` in the Files tree (or the **✦ Look** control in the centre of the status bar) opens the **visual Look designer** — not the raw generated code. Themes, palette, fonts, scale, layout, headings, elements, custom code. Every project has a `style.typ`.
- **One chapter → the status bar.** While editing a chapter, the centre of the status bar shows **Chapter Look ▾** — pick a magazine rubric (Feature / Interview / Essay / …). The **✎** button opens a full editor for that look (accent + primary colour, body/heading font, base size, leading, columns, H1–H3), with **"Apply to all chapters with this look"** vs **"Only this chapter"** (forks a chapter-unique variant). Page format, margins and running heads always stay document-wide.
- **One spot → Design with AI.** Select a passage, right-click **✨ Design with AI** — a small popover appears at the selection (copy a starter prompt / open Claude). Claude reads it via `penwright_get_selection` and designs that exact spot.

**Safe by design:** every in-app design change is compiled *before* it's committed. If a change wouldn't compile, it's rolled back and your last working look stays on screen — the document is never left broken. The Look designer has an **↩ Undo** for the last design change.

Every change writes `<project>/.penwright/style.json` and regenerates `<project>/style.typ` — the root file pulls those rules in via `#import "style.typ": *` plus `#show: apply-style`.

### Sections in the Look designer (open `style.typ`)

| Section | What it controls |
|---------|------------------|
| **Colors** | Five semantic slots (primary / accent / text / background / muted) — each with a Coloris picker plus a hex text field |
| **Palette presets** | Eight curated 5-colour palettes (Modern Tech, Editorial, Earth Tones, High Contrast, Minimal Mono, Forest Deep, Sunset Warm, Ocean Classic). Apply only swaps colours |
| **Themes** | Six full ProjectStyle snapshots (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis). Apply overwrites everything except the Custom Code block |
| **Layout presets** | Seven geometry swaps (A4 Portrait, A4 Landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, Magazine Editorial with header strip) — paper, orientation, margin, columns, optional base size |
| **Fonts** | Three font slots (body / heading / code) plus a font browser. Each card live-renders its family + a sample line via the seven bundled OFL fonts |
| **Scale** | Base size, leading, paragraph spacing, first-line indent |
| **Layout** | Paper, orientation, margin, columns, page numbering, header markup, footer markup, page fill (background colour expression). Header/Footer accept `{chapter}` (current H1 title) and `{section}` (current H2 title) placeholders — e.g. `{chapter} · ISSUE 1` produces a per-chapter running head that follows the document. |
| **Headings** | H1–H6 as collapsible cards — size, weight, colour slot, top margin per level; plus a single numbering pattern setting |
| **Elements** | Blockquote, Code-Block, Figure (incl. photographer-credit separator + label for the `figure-caption-credit(caption, credit)` helper), Table — each a collapsible card with structured fields (border slot / padding / italic toggle / caption position / zebra rows / etc.) |
| **Section Styles** | Per-chapter "rubrics" for magazine layouts — named overlays (accent / fonts / columns / heading treatment) you assign to a single chapter from the **Chapters** tab. Five built-in presets (Feature / Interview / Essay / Photo-Essay / Department); collapsible list with an accent swatch, column count and delete. Page geometry and running heads stay document-level |
| **Custom Typst-Code** | Escape hatch: free-form Typst inside a CodeMirror editor. Appended to `style.typ` inside a fenced block that survives every regeneration |

### Themes vs palette presets vs layout presets

- **Palette preset** — only the five colour slots change. Use it when the existing typography and layout are right but the colours feel off.
- **Theme** — colours + fonts + scale + layout + headings + elements all change in one click. Your Custom-Code block is preserved.
- **Layout preset** — only paper / orientation / margin / columns / base-size change. Stack on top of a theme to keep typography but switch geometry (e.g. *Editorial Magazine* theme plus *Magazine 2-Column* layout).

### Power-user escape hatch

The Custom Typst-Code section at the bottom of the Design panel accepts arbitrary Typst — `#import` of bundled packages, custom `#show heading.where(level: 1): it => { … }` rules with line decorations, helper `#let` bindings, etc. The block is fenced (marker comments at start and end) so the auto-generator never overwrites it. Any time you save a theme, palette, or field, the custom block is read back verbatim and re-emitted at the bottom of the regenerated `style.typ`.

### Design element library

A library of **22 parametric snippets** — Banner, Sidebar, Pull-Quote (three variants: regular / Display / Block), Callout, Hero, Section Divider (three variants: regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Image Gallery 2-up / 3-up / asymmetric (1 hero + 2 stacked), Image-Overlay (photo with gradient + headline on top), Stats Box ("By the numbers" sidebar), Photo Caption Wrap (small photo with caption flowing around it via wrap-it), Magazine Cover. They're inserted from Claude Desktop via the `penwright_list_design_elements` / `penwright_insert_design_element` MCP tools; every reference to `style-colors.*` / `style-fonts.*` means the element re-themes automatically when you swap the palette or fonts. The `magazine-cover` uses `#page(margin: 0pt)` for the cover page only — the rest of the document keeps its configured margins. `style.typ` exports three module-level values for this: `style-colors`, `style-fonts`, and a `figure-caption-credit(caption, credit)` helper for photographer-credit captions.

### Bundled OFL fonts (offline-ready)

Seven font families ship with Penwright — no system install needed, no internet at compile time:

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

The old **Document → Style Templates** submenu (Classic / Modern / Minimal / Vibrant / Elegant / Professional / Artsy) was retired in Session 22 and replaced by the Themes section of the Look designer (open `style.typ`). The MCP tools `penwright_list_styles` and `penwright_apply_style` still work — they now point at the new theme presets.

---

## Versions & Auto-Backup

Penwright keeps three independent layers of safety for your work — each with a clearly defined purpose:

| Layer | Trigger | Purpose | Where it lives |
|-------|---------|---------|----------------|
| **Versions** | You click **Save Version** | Deliberate milestones in your project's history | `<project>/.git/` |
| **Auto-Backup** | Timer (configurable, default every 30 s) | Crash / freeze protection — never lose more than X seconds of work | `<project>/.penwright/backups/` |
| **AI-Edit Undo** | Triggered by an external edit (an AI agent / MCP) | Quick rollback of the last AI change | `<project>/.penwright/ai-snapshots/` |

All three live **inside the project folder**, so the project is self-contained: copy or move it and the full history goes with it. They're all reached from one place — the **History & Restore** button in the **Project** tab opens a hub with a labelled section for each.

### Saving a version

In the **Project** sidebar tab:
1. Type a short description in **Save Version** ("Chapter 3 first draft", "Before lecturer review", …)
2. Optionally untick files in **Changes since last version** that should not be part of this version
3. Click **Save Version**

Your new version appears in the **Versions** section of **History & Restore**. Every entry stays available forever (until you delete the project).

### Browsing the history

Open **History & Restore** (in the **Project** tab) and click any entry in the **Versions** section to open its detail view:
- Date and message
- A diff per file in source-text style (red removed lines, green added lines — like GitHub)
- **Restore this version** button — replaces the current files with the historical ones (with a confirmation prompt)

The current document is never destroyed: restoring an old version overwrites your working copy, but you can always **Save Version** beforehand to keep your in-progress state.

### Auto-Backup

The **Auto-backups** section of **History & Restore** lists every automatic snapshot:
- Every backup is a full snapshot of the project's `.typ` and `.bib` files at that point in time
- **Restore** loads a backup into the working tree (with a confirmation prompt — save a version first if you don't want to lose your current state)
- The **gear icon** on that section opens the settings: backup interval (10 s – 5 min), maximum number of backups kept (10 / 30 / 100 / 1000), maximum number of AI-edit snapshots

### AI-Edit Undo

When an external tool (an AI agent, the MCP server, …) modifies a file you have open, Penwright saves the previous content into the AI-snapshot ring buffer **before** applying the change. Step back through them one at a time from the **AI changes** section of **History & Restore** (or the **Undo AI Edit** menu entry). Snapshots survive app restarts (they're persisted to `.penwright/ai-snapshots/`).

### Cloud backup (optional)

The version history is local by default. If you want to push it to GitHub (or any other Git remote) for off-machine backup or to use the project on a second device:

1. Open the **Project** tab and expand **Advanced**
2. Paste the remote URL (e.g. `https://github.com/your-user/your-thesis.git`)
3. Use **Sync to cloud** (push) and **Pull from cloud** as needed

Two devices in parallel are not safe — one machine at a time.

---

## File Watcher

External file changes (e.g. from an AI agent or the MCP server) are picked up automatically:
- Current file changed -> editor updates immediately
- `.bib` changed -> citations are reloaded
- Files added/removed -> file tree refreshes
- Your own saves are ignored (3s protection window)
- The `.penwright/` folder is excluded from the watcher so backups never trigger refresh loops

For rolling back AI edits, see the [Versions & Auto-Backup](#versions--auto-backup) section.

---

## Spell checking

- **Active by default:** uses Electron's built-in spellchecker (Hunspell)
- **Language sync:** language is read from `#set text(lang: "de")` in the Typst document
- **Dynamic switching:** updates when you change the document language in Document Settings
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
- **Crash recovery:** auto-backups are written to `<project>/.penwright/backups/<timestamp>/` (interval configurable, default 30 s). If the app crashes and the latest backup is newer than the saved file on disk, Penwright offers to restore it when you reopen the project. See [Versions & Auto-Backup](#versions--auto-backup) for details.

---

## Persistence

Penwright stores two kinds of state separately — **app preferences** that are global to your installation, and **project state** that travels with each project folder.

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
- Auto-backups (`.penwright/backups/`)
- AI-edit snapshots (`.penwright/ai-snapshots/`)
- Claude Code skills (`.claude/skills/`)

The app **always starts on the Start Screen** — there is no auto-reopen. This is deliberate so that opening Penwright never surprises you with a project you didn't intend to work on.

---

## License Management

Penwright is a **one-time purchase — €59**. A single license, no subscription, no tiers. **One key (`pw_LIC…`) unlocks everything**, including the MCP server for AI integration.

### Free trial

On first launch you get a **14-day local trial** with the full feature set — no key and no account required. The status bar shows the days remaining, and a slim banner offers **"Buy now – €59"**. When the trial runs out, Penwright is blocked behind a purchase screen until you enter a key.

### License status in the status bar

The bottom-right of the status bar shows your current state:
- **Trial: N days** — trial active, N days remaining
- **Licensed** — a valid key is active
- **Locked** — trial expired and no key yet; the app is blocked until you activate

**Click the status** to open the License dialog.

### Buying & activating

1. **Buy** — the **"Buy"** button (in the trial banner, the License dialog, or the lock screen) opens the **Polar checkout** directly. After payment you receive your `pw_LIC…` key by e-mail.
2. **Activate** — open the License dialog (click the license status), paste the key, confirm. It is validated against **Polar** and stored locally (encrypted in the system keychain). The license is active immediately and any lock screen disappears.

### Offline use

Once validated, Penwright works without an internet connection. A **7-day grace period** applies — after 7 days without an online re-validation it falls back to the trial/locked state until you reconnect. Offline grace never extends the free trial.

### Security

License data is encrypted via Electron's `safeStorage` and stored in the system keychain (macOS), DPAPI (Windows) or libsecret (Linux). The MCP server independently validates the same key on startup.

---

## About Dialog

Accessible via:
- **macOS:** `Penwright -> About Penwright`
- **Windows/Linux:** `Help -> About Penwright`

The dialog shows:
- App version and logo
- Current license status (Licensed / Unlicensed)
- System info: platform + architecture, Electron / Chromium / Node versions
- Links: User Guide, Website, Report Issue
- **Copy Diagnostics** — copies version + platform + Electron stack + license tier to the clipboard. Handy when you file an issue.

---

## MCP Server — AI integration with Claude Desktop & Co.

Penwright ships a built-in MCP server (Model Context Protocol) that lets external AI applications like **Claude Desktop**, **Codex Desktop** or **Clawdbot** work on your Typst documents directly.

> **Note:** the MCP server requires a **valid license** — the same `pw_LIC…` key as the app (there are no tiers). See [License Management](#license-management).

### What can the MCP server do?

Over MCP (57 tools) the AI can:
- Open, read, edit and verify Typst documents (separate compile = verify-only; export tools own artifact writing)
- Change document settings (font, size, language, margins, …) and apply style templates
- Manage chapters and bibliography end-to-end (incl. anchor-based comment / footnote / cross-reference inserts)
- Run project-wide search and replace with a versions-safety-net (whole-word lookarounds work for `@citekey` backlinks)
- Look up source PDFs in `sources/` by citekey
- Save / list / show / restore versions in the writer-vocabulary used by the Project panel
- Export PDF and DOCX (DOCX uses real Word styles + live multilevel numbering, and renders figures, display-math, tables, cross-references, footnotes and callouts; pure design code is skipped)
- Import Markdown and add images (with content-hash dedup + figure builder)
- Drive the whole design surface — swap themes / palettes / layouts / fonts, insert design elements (22 of them incl. drop-cap, pull-quote variants, article-opener, section-opener, image galleries incl. asymmetric, image-overlay, stats-box, photo-caption-wrap, magazine cover) at anchors, assign per-chapter section styles (magazine rubrics: feature / interview / essay / …), map natural-language intents (`brochure` / `magazine` / `thesis` / …) onto matching theme+layout combos
- Switch between projects, run Git operations, and pull Skill Prompts (typst-reference / penwright-conventions / research-workflow / writing-style / design-conventions)

### Setup: auto-discover wizard (macOS)

On macOS, Penwright offers to connect Claude Desktop automatically — no JSON editing required. Requirements:

- **A valid license activated** (see [License Management](#license-management)) — the MCP server rejects spawn otherwise
- **Claude Desktop installed** at `/Applications/Claude.app` or `~/Applications/Claude.app`

**Flow:**

1. The wizard pops up a few seconds after launch (or via `Help → "Connect to Claude Desktop…"`)
2. Click **"Connect now"**
3. Behind the scenes:
   - The server binary is copied from the .app bundle to `~/Library/Application Support/Penwright/mcp-server/penwright-mcp`
   - `~/Library/Application Support/Claude/claude_desktop_config.json` gets a `Penwright` entry — any pre-existing MCP servers are preserved untouched, and a timestamped backup of your old config is written first
   - Your license key is written as an environment variable (`PENWRIGHT_LICENSE_KEY`) into the entry
4. **Restart Claude Desktop** — the Penwright tools appear automatically

**Standalone:** the MCP server runs as an independent process, **decoupled from the Penwright app**. You can quit Penwright, keep using Claude, open Penwright again later — the launch order is irrelevant.

**Idempotent:** running setup again is safe — no duplicate entry. If you activate a new license later, re-run the wizard from the Help menu so the new key lands in the config.

### Setup: manual (Windows, Linux, or power users)

The wizard is currently macOS-only. You can also configure manually on macOS if you prefer:

**Step 1:** build the server binary (once, in the Penwright repo):

```bash
npm run build:mcp-binary       # host arch only
# or
npm run build:mcp-binary:all   # arm64 + x86_64
```

Output: `dist/mcp/bin/penwright-mcp-<arch>` (~64 MB single-file binary, no Node required).

Alternatively use the classic Node path (requires Node ≥ 20):

```bash
npm run build:mcp   # → dist/mcp/server.mjs
```

**Step 2:** open the configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Step 3:** register Penwright as an MCP server. With the standalone binary (recommended):

```json
{
  "mcpServers": {
    "Penwright": {
      "command": "/PATH/TO/vswrite-desktop/dist/mcp/bin/penwright-mcp",
      "env": { "PENWRIGHT_LICENSE_KEY": "pw_LIC_xxx..." }
    }
  }
}
```

Or via Node + `.mjs`:

```json
{
  "mcpServers": {
    "Penwright": {
      "command": "node",
      "args": ["/PATH/TO/vswrite-desktop/dist/mcp/server.mjs"],
      "env": { "PENWRIGHT_LICENSE_KEY": "pw_LIC_xxx..." }
    }
  }
}
```

**Step 4:** restart Claude Desktop.

### Usage

After the restart, Claude sees the Penwright tools. You can say things like:

- *"Open my thesis project at /Users/.../my-thesis"*
- *"Show me the content of my Typst document"*
- *"Change the font size to 12pt and the language to English"*
- *"Compile my document and show me the errors"*
- *"Export the document as PDF to ~/Desktop/thesis.pdf"*

Claude uses the Penwright tools behind the scenes. All paths are validated against the project directory — the agent cannot accidentally escape the project.

### Switching projects

You don't need to edit the config every time you switch projects. Just tell Claude:

*"Switch to the project /Users/.../other-project"*

Claude will call `penwright_set_project` and work with the new project from there on.

### Available tools (57)

The full reference with parameter schemas, return shapes, and end-to-end workflow examples lives in [mcp-server.md](mcp-server.md). All 57 tools with one-line descriptions, grouped by category:

**Project & files (5)**

- `penwright_set_project` — Set the active project directory; auto-detects `main.typ` / `document.typ`. Call first.
- `penwright_list_files` — Return the project file tree (`.typ`, `.bib`, `.md`, `.yaml`, `.json`, `.pdf`, images).
- `penwright_read_file` — Read a file from the project; text content as string, binaries as Base64.
- `penwright_write_file` — Write content to a project file; creates parent directories as needed.
- `penwright_create_project` — Create a new Typst project from a template (`document`, `thesis`, `paper`, `letter`, `book`, `magazine`). The `magazine` template is designed for the [ai-magazine-designer](https://github.com/renejes/ai-magazine-designer) pipeline.

**Document operations (4)**

- `penwright_get_document` — Return the current document (content, path, project dir, word count).
- `penwright_open_file` — Open a `.typ` file as the current document; path absolute or project-relative.
- `penwright_update_document` — Replace the current document content and save to disk.
- `penwright_compile` — Verify that the document compiles cleanly; PDF-only, artifact removed afterwards — use `export_pdf` / `export_docx` for real output.

**Settings (2)**

- `penwright_get_settings` — Read the document settings (language + bibliography style; everything else has lived in the Design editor since Phase A).
- `penwright_update_settings` — Update document settings; only passed keys are modified.

**Design (16) — themes, layouts, palette, fonts, elements, section styles, selection handoff**

The structured design surface — the visual Look designer (open `style.typ`). Writes directly to `.penwright/style.json`, regenerates `style.typ`, ensures the root `.typ` file has `#import "style.typ": *` + `#show: apply-style` at the top. Theme / layout swaps preserve `style.custom.preamble` (the user escape-hatch block) and `style.sections` (per-chapter section styles).

- `penwright_get_style` — Return the full `ProjectStyle` JSON (colors / fonts / scale / layout / headings / elements / custom).
- `penwright_update_style` — Partial deep-merge patch with per-leaf sanitiser; invalid values fall back to the old value.
- `penwright_list_styles` — List the six built-in themes (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis).
- `penwright_apply_style` — Apply a theme; overwrites colors/fonts/scale/layout/headings/elements, preserves `custom.preamble`.
- `penwright_list_layouts` — Return the seven layout presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, Magazine Editorial).
- `penwright_apply_layout` — Swap only the `layout.*` values (+ optional `scale.base`) — theme, colors, fonts unchanged.
- `penwright_list_fonts` — Return the seven bundled OFL fonts with family / category / description.
- `penwright_apply_palette` — Set the 5-colour palette via `presetId` or per-slot hex overrides (composable).
- `penwright_list_design_elements` — Library of **22** parametric snippets with their params — Banner, Sidebar, Pull-Quote (regular / Display / Block), Callout, Hero, Divider (regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Gallery 2-up / 3-up / asymmetric, Image-Overlay, Stats-Box, Photo-Caption-Wrap, Magazine-Cover, Full-Bleed-Image, Spread-Opener, Margin-Note.
- `penwright_insert_design_element` — Insert an element at an anchor; snippets reference `style-colors.*` / `style-fonts.*` so they re-theme automatically.
- `penwright_generate_layout` — High-level NL composite: `intent: "magazine"` selects e.g. the Editorial theme + Magazine-Editorial layout + optional Hero opener.
- `penwright_list_section_styles` — Per-chapter "rubrics": the five presets (feature / interview / essay / photo-essay / department), the project's defined variants, and which chapters use which.
- `penwright_define_section_style` — Create/update a section overlay (from a preset and/or explicit accent / fonts / columns / heading overrides); regenerates a `#let <id>-style` per variant.
- `penwright_apply_section_style` — Assign a variant to one chapter (injects the scoped `#show`; auto-defines a preset if needed). Restyles just that chapter; page geometry stays document-level.
- `penwright_clear_section_style` — Remove the section opt-in from a chapter.
- `penwright_get_selection` — Design-with-AI handoff: read the pinned editor selection from `.penwright/selection.json` (anchor text + occurrence + a design snapshot); the agent acts at the anchor, and the watcher clears the pin after the external edit.

**Chapters & structure (6)**

- `penwright_get_chapters` — Return the `#include` structure (order, paths, file-exists flag).
- `penwright_reorder_chapters` — Reorder the `#include` statements in the root document.
- `penwright_add_chapter` — Create a new chapter file in `chapters/` and add an `#include`.
- `penwright_remove_chapter` — Remove an `#include` entry from the root document; the file itself is kept.
- `penwright_merge_document` — Resolve all `#include` statements recursively and return the merged document as a string (read-only).
- `penwright_split_document` — Split the current document at `=` Heading-1 boundaries into individual chapter files.

**Bibliography & citations (3)**

- `penwright_get_citations` — Return all BibTeX entries from the project's `.bib` files.
- `penwright_add_citation` — Add a BibTeX entry to `references.bib`; creates the file and `#bibliography` statement if missing.
- `penwright_ensure_bibliography` — Ensure the project has a `references.bib` and a `#bibliography` statement.

**Cross-references & footnotes (3)**

- `penwright_list_labels` — Return all `<label>` definitions in the project with type classification (figure / table / equation / heading / other) and caption preview.
- `penwright_insert_reference` — Insert a Typst cross-reference (`@label`) at an anchor; validates the label exists and suggests close matches if not.
- `penwright_add_footnote` — Insert a Typst footnote (`#footnote[…]`) at an anchor; bracket-balance check on the body.

**Comments & annotations (4)**

- `penwright_list_comments` — List Penwright comments (or just those of one file); comments live as `.md` files in `comments/` and never compile.
- `penwright_add_comment` — Create a comment anchored to a verbatim text snippet; generates id, frontmatter, offset hints.
- `penwright_resolve_comment` — Mark a comment as resolved (or un-resolve it); the entry stays in the project.
- `penwright_delete_comment` — Permanently delete a comment (removes the `.md` file).

**Versions (4) — matches the Project panel's vocabulary**

- `penwright_save_version` — Save a named version (Git commit); auto-initialises the repo if missing; local-only, never pushes.
- `penwright_list_versions` — Return the version history (max. 200, newest first) including an `isAuto` flag for Penwright-internal auto-versions.
- `penwright_show_version` — Return the per-file diff for one version (added/modified/deleted/renamed + unified-diff hunks).
- `penwright_restore_version` — Restore files from a historical version into the working tree; save a version first!

**Discovery — search & sources (3)**

- `penwright_search_project` — Search across all `.typ` (optionally `.bib`) files; whole-word uses lookarounds so it works for `@citekey` backlinks; capped at 1000 matches.
- `penwright_replace_in_project` — Replace all matches of a query project-wide; **destructive** — call `save_version` first.
- `penwright_find_source_for_citation` — Look up a PDF in `sources/` matching a citekey (`<citekey>.pdf` preferred, suffix variants allowed).

**Export (2)**

- `penwright_export_pdf` — Compile and export as PDF; output path must lie inside the project — convention is `exports/<name>.pdf`.
- `penwright_export_docx` — Export as DOCX with real Word styles (Heading1-6, Quote, CodeBlock, Caption …) and live multilevel-numbering — supervisors can reorder in Word and the numbers refresh. Renders the rich constructs too: figures → image + "Figure N" caption, `#figure(table())` → real Word table, display-math + SVG → images via the bundled Typst, `@fig/@tbl/@eq` cross-refs → resolved, footnotes → real Word footnotes, callouts → accent box; pure design/layout code is skipped rather than leaked (DOCX = manuscript, PDF = design).

**Import & assets (2)**

- `penwright_import_markdown` — Convert Markdown to Typst and write into a project file; inline markdown or `srcPath` to an `.md` file.
- `penwright_add_image` — Import an image into `assets/` (content-hash dedup), build the Typst snippet (with optional caption + label → `#figure(…)`), and optionally insert it at an anchor.

**Git low-level (3) — for syncing with a remote**

- `penwright_git_status` — Return branch, ahead/behind, and changed files.
- `penwright_git_commit` — Stage all changes and commit with the given message.
- `penwright_git_push` — Push commits to the remote repository.

All file-touching tools route paths through `resolveInsideProject` — symlink-aware, blocks `../`-traversal. Anchor-based tools (`add_comment` / `insert_reference` / `add_footnote` / `add_image`) take an `afterText`/`anchor` plus an optional 1-based `occurrence` when the anchor appears multiple times — the agent never has to compute offsets.

The MCP server also exposes five **prompts** backed by the deployed `.claude/skills/<name>/SKILL.md` content:

- **typst-reference** — Typst language reference (syntax, math, layout, cross-references, footnotes, bibliography, bundled packages with code examples).
- **penwright-conventions** — Project conventions (folder structure, persistence layers, design surface, comments, cross-references, mode toggles).
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
| Toggle sidebar | `Cmd+B` |
| Toggle preview | `Cmd+Shift+P` |
| Undo | `Cmd+Z` |
| Redo | `Cmd+Shift+Z` |
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

If Penwright ever crashes, the app writes a plaintext report locally containing:

- The error type and message
- A stack trace with file + line
- Your recent actions (event types only — no document content)
- App, OS, and version info

On next launch, a dialog opens automatically with the report — you decide what happens: **Copy to clipboard**, **Prepare e-mail** (opens your mail client pre-filled to `feedback@penwright.online`), **Open folder** (shows all stored reports in Finder), or **Discard** (deletes them).

**What Penwright does NOT do:** automatically send data over the internet. There is no external crash telemetry, no account login, no server reading along. Reports stay on your machine until you actively share them.

**What gets anonymized:** Paths like `/Users/<firstname>/...` are replaced with `/Users/<redacted>/...` before the report is written. Document content never enters reports — only file **extensions** and action types (e.g. "file saved", "project opened").

**Later access:** Help → Open Crash Reports opens the reports folder.

---

## Updates

Penwright does **not** auto-update. To see your installed version, open the About dialog.

New releases are announced via the **Penwright newsletter**; download the latest build from [penwright.online](https://penwright.online) and replace your installed copy. Your projects are self-contained (everything lives in the project folder), so updating the app never touches your work.

---

## Help & Support

- **User Guide (this handbook):** open it any time from the app menu **Help -> User Guide** — it ships inside the app, no internet needed
- **Bugs / feature requests:** [github.com/renejes/vswrite-desktop/issues](https://github.com/renejes/vswrite-desktop/issues) — or via the app menu **Help -> Report Issue**
- **Website:** [penwright.online](https://penwright.online)

When reporting a bug, it helps a lot to click **"Copy Diagnostics"** in the About dialog and paste the output into the issue — that way the reader immediately sees version, platform and license tier.
