<div align="center">

<img src="documentation/penwright-logo.svg" alt="Penwright" width="340">

**Typst, visually written.**

A standalone desktop app for WYSIWYG editing of [Typst](https://typst.app) documents —
from academic theses to design-grade magazines, brochures and reports.

![version](https://img.shields.io/badge/version-0.12.0-3b6ea5)
![platform](https://img.shields.io/badge/macOS-Apple%20Silicon-111111?logo=apple)
![Windows](https://img.shields.io/badge/Windows-scaffolded-777777)
![license](https://img.shields.io/badge/license-PolyForm%20Strict%201.0.0-3fa45b)

</div>

---

Penwright lets you **write and design** Typst documents in a rich WYSIWYG editor —
without installing Typst (the CLI is bundled). Every project is self-contained: version
history, auto-backups, comments and design tokens live inside the folder, so copying it
takes the whole state along.

The app is **free for everyone, including companies.** You may run it. You may not reuse
this repository’s source in another project. Details below.

> **A note on names.** The product is **Penwright**; this repository is still named
> `vswrite-desktop` (its original name) to keep clones, remotes and paths stable.

## Write in Easy Writing, typeset in Penwright

[Easy Writing](https://github.com/renejes/easy-writing) is a separate, MIT-licensed
desktop app: a folder is the project, the `.mdx` on disk is the manuscript. Citations,
footnotes, figures, chapters — no layout studio, no live PDF.

That split is the intended workflow:

1. **Write** in [Easy Writing](https://github.com/renejes/easy-writing) — sentences,
   `[@citekey]`, footnotes, figures.
2. **Export → MDX** and copy the project folder (`project.yaml`, chapters, `assets/`,
   optional `references.bib`).
3. **Open that folder** in Penwright (**File → Open Project…**). Penwright recognises
   `project.yaml` and typesets from the `.mdx`.
4. **Style** here: themes, palettes, layout, print export. The manuscript is not rewritten
   — `[@key]` stays `[@key]`, the `.bib` is left alone, wording changes go back to Easy
   Writing.

Penwright also opens ordinary Typst projects (templates, an existing `.typ` tree, the
bundled sample). **File → Import Markdown…** is the older one-file path and writes a new
`.typ`; do not use it on an Easy Writing folder.

## Features

**Writing**
- WYSIWYG editor (TipTap / ProseMirror) with custom Typst nodes — headings, math, figures,
  tables, citations, cross-references, footnotes, magazine building blocks
- Live PDF preview (pdf.js), single page or 2-up spread, that stays usable on 100+ pages
- Comments, project-wide find/replace, citation backlinks, a draggable outline, source-PDF
  preview on citation hover
- Bilingual UI (English + German), switchable at runtime

**Versions & safety**
- Git-backed *Versions* in plain language — Save Version / History / Restore
- Timed per-project auto-backups + crash recovery, plus an AI-edit undo stack
- Local crash reporting (plaintext, no external telemetry)

**Design**
- Themes, palettes, layouts, bundled OFL fonts, parametric design elements, per-chapter
  section styles
- Every design change is compiled **before** it is kept, and rolled back if it would break
  the document
- Print-ready PDF: bleed, crop marks, inner/outer margins, dpi pre-flight
- Fully offline: Typst CLI, 24 Typst packages and the fonts ship in the app

**Export & AI**
- PDF (what the preview shows), journal-grade DOCX, and HTML / magazine mini-site
- Markdown import · Zotero `.bib` with live auto-sync
- MCP server (66 tools). On launch Penwright registers itself with **Cursor**
  (`~/.cursor/mcp.json`); Claude Desktop and Claude Code are optional. The same tools, no
  key, no time limit.

## Tech stack

Electron 41 · electron-vite 5 · Svelte 5 (runes) · TipTap / ProseMirror 3 · pdf.js ·
simple-git · bundled Typst 0.15.1

## Development

```bash
npm install
npm run dev            # dev server + hot reload
npm test               # typecheck + editor / corpus / MCP gates (~2 min)
npm run build          # main + preload + renderer
npm run package:mac    # notarized DMG (needs Apple Developer credentials)
```

From a VS Code / Cursor terminal the scripts prefix `unset ELECTRON_RUN_AS_NODE`
(already in the npm scripts).

The in-app User Guide is `documentation/handbook.md` (English) and
`documentation/handbuch.md` (German).

## Status

Pre-release **0.12.0**. macOS / Apple Silicon is built, signed and notarized. Windows is
scaffolded (unverified on a real device). The app starts at a Start Screen and never
auto-reopens a project.

## License

**Source-available, not Open Source.** [PolyForm Strict 1.0.0](LICENSE-PolyForm-Strict-1.0.0.md)
plus additional permissions in [`LICENSE.md`](LICENSE.md). © René Jesser.

| You may | You may not |
|---|---|
| **Run the app** for any purpose, including commercially — no key, no fee, no “personal vs business” question | **Distribute** Penwright (the app or this source) to anyone else |
| **Read** the source, audit it, and **build it for your own use** | **Reuse this code** in another project, product, or competing editor |
| Use every feature, including the MCP / AI integration | Ship a fork, or copy modules out of this repo into yours |

The legal text is [`LICENSE.md`](LICENSE.md). Where this table and those terms disagree,
the terms win.

Bundled Typst packages and fonts keep their own licenses — see
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

Bug reports, documents that break the round-trip, and wording fixes are welcome.
**Code pull requests are not accepted** — see [`CONTRIBUTING.md`](CONTRIBUTING.md).
