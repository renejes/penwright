# vswrite Desktop — User Handbook

> **Version:** 0.7.0 (Pre-Release)
> **Last updated:** 2026-04-17
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

### Opening your first file

- **File -> Open** (`Cmd+O`) -> pick a `.typ` file
- **File -> Open Folder** -> open a project folder
- **File -> New Project** -> create a new project from a template

---

## App Layout

```
+--------------------------------------------------------------+
|                         (Title bar)                           |
+--------------------------------------------------------------+
|  B I U S  | H1 H2 H3 | bul num | Link | Quick Focus Hub      |  Toolbar
+------+-------------------------------+-----------------------+
|[Files|Outline|Chapters|Git]          |                       |
|      |  [main.typ] [refs.bib]        |                       |
| Side-|                               |   Preview Panel       |
| bar  |  WYSIWYG Editor               |   (SVG Pages)         |
|      |                               |                       |
+------+-------------------------------+-----------------------+
|  Terminal / AI  (real shell terminal)                         |
+--------------------------------------------------------------+
| [Project] [Terminal/AI] [Preview]      Saved 14:35  main.typ |
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
| Quick | Quick settings | — |
| Focus | Focus mode | — |
| Hub | Action menu (Command Hub) | — |

### Command Hub

Opens a dropdown with every available action:

- **Insert** — headings, lists, quote, code block, math formula, Typst code, image, line
- **Format** — bold, italic, strikethrough, inline code, link, text alignment
- **View** — focus mode, find & replace
- **File** — export PDF/DOCX, import Markdown, link Zotero, document settings, merge, split, new project/file
- **Style Templates** — 7 predefined + import your own templates
- **Help** — keyboard shortcuts

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
- **Command Hub:** Hub -> Insert -> Image

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

---

## Creating a new project

**Open:** File -> New Project or Hub -> File -> New Project

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
- `.claude/skills/` with Claude Code skills (typst, vswrite, research)

---

## Sidebar

The sidebar has four tabs:

### Files
- Recursive file tree, Back button, Open Folder
- `.claude/` folder visible for skills
- Images from `assets/` are draggable into the editor
- Right-click -> "Open in New Tab"

### Outline
- Live heading hierarchy (H1 -> H2 -> H3), click navigates to the heading

### Chapters (Include manager)
- `#include` statements, arrows to reorder (instant UI update), x to remove, + Add Chapter

### Git
- Branch, Stage/Unstage, Commit, Push/Pull, Init
- **Note:** creating a new GitHub repo currently happens in the integrated terminal, e.g. via `gh repo create my-thesis --public --source . --push`. Push/Pull via the sidebar work once a remote is configured.

---

## Live Preview

- **Root-file compilation:** with chapters, `main.typ` is compiled automatically
- **Chapter navigation:** preview scrolls to the active chapter
- **Scroll preservation:** position stays put on recompile
- **Virtualized:** for larger documents (50+ pages) only visible pages are rendered — smooth scrolling even on 100+ pages
- **Error display:** Typst errors show up in the preview panel
- **SVG/PDF mode:** toggle in the preview header — SVG (fast, default) or PDF (via pdf.js, with text selection)

---

## Import & Export

### Markdown import
- **File -> Import Markdown** or Hub -> Import Markdown
- Converts: headings, bold/italic, links, images, lists, code blocks, blockquotes
- YAML frontmatter is skipped
- Produces a new `.typ` file with a default preamble

### Zotero integration
- **File -> Link Zotero Library** or Hub -> Link Zotero Library
- Pick a Zotero Better BibTeX `.bib` file
- Gets copied into the project as `zotero.bib`
- **Auto-sync:** changes in Zotero are picked up automatically while the app is running
- All Zotero sources appear in the `@` autocomplete

### PDF export
Hub -> File -> Export PDF

### DOCX export

Hub -> File -> Export DOCX.

The DOCX is produced with real Word styles:
- Headings, bibliography, code blocks and quotes use named Word styles — restyle the whole document from the Word styles panel
- Page size, margins, font, font size and line spacing are inherited from your Typst `#set` settings (e.g. A4 + Libertinus 11pt)
- **Live heading numbering:** if your Typst file has `#set heading(numbering: "1.1")`, the headings get Word multilevel numbering. When your supervisor reorders chapters in Word, the numbers update automatically.
- Citations render as `(Author Year)` when found in the `.bib` file, else as `[citekey]`
- TOC and bibliography headings are localized to the document language (DE/EN/FR/ES/IT/PT/NL)

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

**Import your own template:** Hub -> Style Templates -> Import Style Template -> pick a `.typ` file. Only the preamble (#set/#show rules) is extracted, even when you pass a complete document. Stored in `.claude/style-templates/`.

---

## File Watcher

External file changes (e.g. from Claude Code in the terminal) are picked up automatically:
- Current file changed -> editor updates immediately
- `.bib` changed -> citations are reloaded
- Files added/removed -> file tree refreshes
- Your own saves are ignored (3s protection window)

**Undo AI Edit:** before an external change lands in the editor, the current state is saved into a ring buffer (up to 20 entries). You can jump back to the state before the AI edit from the menu.

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
- Status Bar: "Unsaved" (orange) or "Saved 14:35"
- Warning on close with unsaved changes
- **Crash recovery:** every 30 s a backup snapshot is written to `~/Library/Application Support/vswrite/backups/` (macOS). If the app crashes and you later reopen the file, vswrite offers to restore the backup.

---

## Persistence

vswrite remembers your app state between restarts:

- **Window position & size** — the window opens where you last left it
- **Panel states** — sidebar, preview, terminal stay open/closed as last used
- **Panel sizes** — sidebar width, preview width, terminal height
- **Recent Projects** — the last 10 projects appear on the Start Screen
- **Auto-reopen** — the last project opens automatically on app start
- **Onboarding** — the welcome screen doesn't reappear if you ticked "Don't show again"

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
| Save | `Cmd+S` |
| Find | `Cmd+F` |
| Find & Replace | `Cmd+H` |
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

On Windows/Linux use `Ctrl` instead of `Cmd`.

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
