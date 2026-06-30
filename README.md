<div align="center">

<img src="documentation/penwright-logo.svg" alt="Penwright" width="340">

**Typst, visually written.**

A standalone desktop app for WYSIWYG editing of [Typst](https://typst.app) documents —
from academic theses to design-grade magazines, brochures and reports.

![version](https://img.shields.io/badge/version-0.10.0-3b6ea5)
![platform](https://img.shields.io/badge/macOS-Apple%20Silicon-111111?logo=apple)
![Windows](https://img.shields.io/badge/Windows-fast--follow-777777)
![license](https://img.shields.io/badge/license-MIT-3fa45b)

</div>

---

Penwright lets you write **and design** Typst documents without leaving a rich WYSIWYG
editor — and without installing Typst (the CLI is bundled). Every project is
self-contained: its version history, auto-backups, comments and design tokens all live
inside the project folder, so copying or moving the folder takes the whole state along.

> **A note on names.** The product is **Penwright**; this repository is still named
> `vswrite-desktop` (its original name) to keep clones, remotes and paths stable.

## ✨ Features

**Writing**
- WYSIWYG editor (TipTap / ProseMirror) with ~19 custom Typst node types — headings,
  math, figures, tables, citations, cross-references, footnotes, callouts
- Live PDF preview (pdf.js) that stays smooth on 100+ pages — single page **or a 2-up
  double-page spread** view
- Comments & annotations, project-wide find/replace, citation backlinks, a draggable
  outline, inline source-PDF preview on citation hover
- Bilingual UI (English + German), switchable at runtime

**Versions & safety**
- Git-backed *Versions* with plain-language UI — Save Version / History / Restore
  (no stage/commit/branch vocabulary)
- Timed per-project auto-backups + crash recovery, plus an AI-edit undo stack
- Local crash reporting (plaintext, no external telemetry)

**Design — the "Look" model**
- Visual design editor: themes, palettes, layouts, fonts, **23 parametric design
  elements**, and per-chapter section styles
- Every design change is a *safe experiment* — it is compiled to verify **before** it is
  applied, and rolled back if it would break the document
- **Print-ready export** ("For print"): bleed, crop marks, inner/outer margins with a
  binding gutter, and a dpi pre-flight — magazine- and brochure-grade PDFs
- Bundled OFL fonts + 24 Typst packages, so design output works fully offline

**Export & interop**
- **PDF** (exactly what the preview shows) and journal-grade **DOCX** (real Word styles,
  live multilevel numbering, figures, math, tables, cross-refs, footnotes)
- Markdown import · Zotero `.bib` integration with live auto-sync
- **MCP server** with 58 typed tools — an AI agent (Claude Desktop / Claude Code /
  Meta-MCP) can drive the full editor and design workflows

## 🧱 Tech stack

Electron 41 · electron-vite 5 · Svelte 5 (runes) · TipTap / ProseMirror 3 · pdf.js ·
simple-git · a bundled Typst CLI (no user install needed)

## 🚀 Development

```bash
npm install
npm run dev            # dev server + hot reload
npm run build          # build main + preload + renderer
npm run package:mac    # notarized DMG (needs Apple Developer credentials)
```

> From a VS Code / Cursor terminal the dev/build scripts prefix `unset ELECTRON_RUN_AS_NODE`
> (already wired into the npm scripts). There are no test or lint scripts configured yet.

## 📦 Status

Pre-release (**0.10.0** — adds the Editorial Web Pack: print **and** web from one source). macOS / Apple Silicon is built, signed and **notarized**;
Windows is scaffolded as a fast-follow. Updates ship via newsletter + manual download
(no auto-updater). The app starts at a Start Screen and never auto-reopens a project.

## 📄 License

MIT © René Jesser. Bundled third-party Typst packages and fonts keep their own licenses —
see [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
