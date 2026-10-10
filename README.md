<div align="center">

<img src="documentation/penwright-logo.svg" alt="Penwright" width="340">

**Write. Design. Typeset.**

A WYSIWYG editor for [Typst](https://typst.app) documents — on the Mac, and for writing on the iPad.
From academic theses to design-grade magazines, brochures and reports.

![version](https://img.shields.io/badge/version-0.20.1-3b6ea5)
![platform](https://img.shields.io/badge/macOS-Apple%20Silicon-111111?logo=apple)
![iPad](https://img.shields.io/badge/iPad-writing%20host-111111?logo=apple)
![license](https://img.shields.io/badge/license-PolyForm%20Strict%201.0.0-3fa45b)

</div>

---

Penwright is for **writing and design** in one place: a rich WYSIWYG editor, and on the Mac a live PDF,
themes and print export — without installing Typst (the CLI is bundled with the Mac app). Every project is
a folder. Chapter versions, auto-backups, comments, design tokens and in-app chats live
inside it, so copying the folder — Dropbox included — takes the whole state along.

The app is **free for everyone, including companies.** You may run it. You may not reuse
this repository’s source in another project. Details below.

## Two hosts

| Host | What it is |
|---|---|
| **Mac** | The Electron app. Writing, design, live PDF, export, in-app chat, MCP. |
| **iPad** | A Tauri writing host in the same repo. The same editor and the same project folder. No Typst compile, no design studio, no chat. |

The Mac app does not auto-reopen a project. It starts at the Start Screen.

## Chapter versions

A version is **one named copy of one chapter**, not a snapshot of the whole project and not a Git commit.

- You save a version of the **.typ file in the active tab**.
- It is stored as a normal file: `versions/<chapter path>/<name>.typ`. A chapter `chapters/01.typ` with the name `Entwurf` lives at `versions/chapters/01.typ/Entwurf.typ`. The folder is named after the file on purpose, including the `.typ`.
- The suggested name is `Dateiname_V1_2026_10_10`. You can change it. The next free `V` number is used when that name already exists.
- In the **Project** tab, versions are grouped by chapter. The **⋮** menu on a row offers **Read**, **Edit**, **Make main**, **Rename** and **Delete**.
- **Read** opens the version as a tab you cannot type into. **Edit** opens it as its own file; what you type stays in that version and does not change the living chapter.
- **Make main** swaps the two texts. The living chapter becomes what the version said. The version keeps its name and afterwards holds what the chapter used to say.

Dropbox copies the `versions/` folder with the project, so the same versions show up on the iPad.

Git is not the version system. Penwright does not create commits for versions. A `.git` folder you already have is left in place. A `.gitignore` is still written so `.penwright/` stays out of a repository you keep yourself.

### Two other safety nets

These are not versions. They live in `penwright/` inside the project and stay out of the file tree. Older copies under `.penwright/` are still read.

| Net | What it keeps | Where |
|---|---|---|
| **Auto-backups** | Timed copies of the project’s `.typ` and `.bib` files, including the open chapter | `penwright/backups/` |
| **AI changes** | The previous text of a file before an agent overwrote it, including files you do not have open | `penwright/ai-snapshots/` |

**History & Restore** in the Project tab lists the backups and the AI changes. Restoring a backup puts the whole project back to that time. **Undo last** on an AI change restores that one file. Chapter versions stay in the list above that button.

On the iPad both nets work against the same folders. The backup interval and how many copies to keep are set in that window. The iPad does not run the agent; it can still undo a snapshot the Mac agent already wrote into the project.

## iPad

The iPad app is for writing in a project that already lives in a folder you can open (Dropbox included). It uses the same serializer as the Mac, so a chapter saved on one device opens on the other.

**It can**

- Open a project folder, create a project from a template or a bundled preset, and close it
- Edit `.typ` chapters, add folders and images, and manage chapters (`#include`) and comments
- Save, read, edit, rename and delete chapter versions, and swap one in as the living chapter
- Find and replace in the open chapter, insert a cross-reference, and complete `@` citations from the project’s `.bib` files, including `zotero.bib`
- Open PDFs that sit in the project, including `sources/`
- Open a linked Zotero PDF from a Dropbox folder you pick once. The file stays in that folder; it is not copied into `sources/`. The match is the file name stored in `zotero.bib`
- Keep auto-backups and step back the latest AI edit
- Use the same menu names as the Mac menu bar, from a button in the top bar: save, sidebar, editor zoom, the user guide, shortcuts, about

**It does not**

- Compile Typst or show a live PDF preview
- Export PDF, DOCX, print or web
- Run the in-app chat or the design tools
- Search the whole project
- Watch a Better BibTeX export. Linking the library — copying `zotero.bib` and keeping it updated while Zotero runs — stays on the Mac. The iPad reads the `zotero.bib` that is already in the project

## Two apps, one desk — or each on its own

Penwright is part of a small suite. The pieces **fit together** and **each works alone**.

| App | Job |
|---|---|
| **[Research Overview Platform](https://github.com/renejes/research-overview-platform)** | Transparent AI research: sources you can check, citations, a writing pack. It does not write the article. |
| **Penwright** (this repo) | Writing and design. You write in the editor and, on the Mac, shape the page in the same project. |

Used together: research → write and typeset here.

Penwright also opens an existing Typst project or the bundled sample. **File → Import Markdown…** on the Mac turns one Markdown file into a new `.typ`.

## Chat in the Mac app

With a [Cursor](https://cursor.com) account you can chat **inside Penwright**
(**View → Toggle Chat**, `Cmd+J`). The agent works in the open project — drafts, design,
“make this a magazine” — through the same 65 MCP tools Cursor IDE and Claude Desktop use.
Several chats per project, tabs and history, stored in `.penwright/cursor-agent/` so they
travel with the folder. A follow-up typed while the agent is working waits for the
next turn. The transcript stays put when you scroll up.

Penwright stays free. Usage is billed to your Cursor plan. Without signing in, the editor,
preview and export still work. Cursor IDE and Claude remain optional under
**Help → MCP Connection…**.

## Features on the Mac

**Writing**
- WYSIWYG editor (TipTap / ProseMirror) with custom Typst nodes — headings, math, figures,
  tables, citations, cross-references, footnotes, magazine building blocks
- Live PDF preview (pdf.js), single page or 2-up spread, that stays usable on 100+ pages
- Comments, project-wide find/replace, citation backlinks, a draggable outline, source-PDF
  preview on citation hover
- Linked Zotero library: a page on each citation (`@key[S. 12]`), PDFs opened from the
  folder Zotero uses (often a Dropbox folder) instead of copied, and the in-app agent can
  search every paper in that library
- Bilingual UI (English + German), switchable at runtime

**Design**
- Themes, palettes, layouts, bundled OFL fonts, parametric design elements, per-chapter
  section styles
- Every design change is compiled **before** it is kept, and rolled back if it would break
  the document
- Print-ready PDF: bleed, crop marks, inner/outer margins, dpi pre-flight
- Fully offline: Typst CLI, 24 Typst packages and the fonts ship in the app

**Export & AI**
- PDF (what the preview shows), journal-grade DOCX, and HTML / magazine mini-site
- Markdown import · Zotero `.bib` kept in step while the Mac app is running
- **In-app chat** (Cursor account) plus MCP server (65 tools). On launch Penwright also
  registers itself with **Cursor IDE** (`~/.cursor/mcp.json`); Claude Desktop and Claude
  Code are optional. Same tools, no Penwright key, no time limit. `penwright_save_version`
  writes a named chapter under `versions/`. Restore swaps it with the living file.

## Tech stack

Mac: Electron 41 · electron-vite 5 · Svelte 5 (runes) · TipTap / ProseMirror 3 · pdf.js ·
bundled Typst 0.15.1 · `@cursor/sdk` (in-app agent)

iPad: Tauri 2 · the same Svelte editor · scoped folder access · no Typst compiler

## Development

```bash
npm install
npm run dev            # Mac app; the script unsets ELECTRON_RUN_AS_NODE
npm test               # typecheck + editor / corpus / MCP gates (~2 min)
npm run build          # main + preload + renderer
npm run package:mac    # signed DMG (Developer ID; not notarized)
npm run dev:ipad       # iPad UI in the browser
npm run ipad           # Tauri iOS dev build
```

From a VS Code / Cursor terminal the scripts prefix `unset ELECTRON_RUN_AS_NODE`
(already in the npm scripts).

The in-app User Guide is `documentation/handbook.md` (English) and
`documentation/handbuch.md` (German).

## Status

Pre-release **0.20.1**. macOS / Apple Silicon is built and Developer-ID signed, not notarized.
The iPad app is a writing host for a project folder, installed from this repo onto a device.
Windows is scaffolded (unverified on a real device).

## License

**Source-available, not Open Source.** [PolyForm Strict 1.0.0](LICENSE-PolyForm-Strict-1.0.0.md)
plus additional permissions in [`LICENSE.md`](LICENSE.md). © René Jesser.

| You may | You may not |
|---|---|
| **Run the app** for any purpose, including commercially — no key, no fee, no “personal vs business” question | **Distribute** Penwright (the app or this source) to anyone else |
| **Read** the source, audit it, and **build it for your own use** | **Reuse this code** in another project, product, or competing editor |
| Use every feature, including the MCP / in-app chat | Ship a fork, or copy modules out of this repo into yours |

The legal text is [`LICENSE.md`](LICENSE.md). Where this table and those terms disagree,
the terms win.

Bundled Typst packages and fonts keep their own licenses — see
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

Bug reports, documents that break the round-trip, and wording fixes are welcome.
**Code pull requests are not accepted** — see [`CONTRIBUTING.md`](CONTRIBUTING.md).
