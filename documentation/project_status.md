# Penwright — aktueller Stand

> **Stand:** 2026-08-21 · App **0.12.0** · `MCP_SETUP_VERSION` **0.43.0** · Typst **0.15.1** · MCP **66 Tools** · SDK `@modelcontextprotocol/server` **2.0.0** · `@cursor/sdk` **1.0.x** (In-App-Agent)
>
> Diese Datei ist der **aktuelle** Stand, kein Changelog. Session-Verlauf und verworfene Pläne: [handover.md](handover.md), [done/](done/). Offene Arbeit: [next-steps.md](next-steps.md). Architektur für Agents: [CLAUDE.md](../CLAUDE.md). In-App-Chat-Plan: [01-cursor-sdk-integration-plan.md](01-cursor-sdk-integration-plan.md).

---

## Was es ist

Penwright ist eine eigenständige Electron-Desktop-App zum **Schreiben und Gestalten** von [Typst](https://typst.app)-Dokumenten. Portiert aus der vswrite-VS-Code-Extension, Produktname **Penwright** (`penwright` in Identifiern). Das Git-Repo heißt weiter `vswrite-desktop`.

Projekt-first: jedes Projekt ist ein Ordner. Git-Historie, Auto-Backups, KI-Snapshots, UI-Präferenzen und In-App-Chats liegen darin (`.penwright/`). Die App startet am Start Screen und öffnet kein Projekt von allein.

Zwei Eingänge:

| Eingang | Wahrheit auf der Platte |
|---|---|
| **Typst-Projekt** | `.typ`-Wurzel, Kapitel per `#include`, Design in `style.typ` |
| **[Easy Writing](https://github.com/renejes/easy-writing)-Ordner** | `project.yaml` + `.mdx` (+ optional `references.bib`). Penwright setzt daraus Typst und **schreibt das Manuskript nicht um**. Wording bleibt in Easy Writing; Layout lebt hier. |

### Drei Apps, ein Schreibtisch — oder jede allein

Penwright ist Teil derselben Software-Linie. Die Teile **greifen ineinander** und **funktionieren einzeln**.

| App | Rolle |
|---|---|
| **[Research Overview Platform](https://github.com/renejes/research-overview-platform)** | Transparente KI-Research: Quellen, Provenienz, Zitate. Export ist ein Schreibpaket, kein Artikel. |
| **[Easy Writing](https://github.com/renejes/easy-writing)** | Das Manuskript. Ordnerprojekt, Markdown/MDX, `[@citekey]`, Fußnoten. Kein Layout-Studio. |
| **Penwright** | Satz und Design. Typst-WYSIWYG, Live-PDF, Themes, Druck-Export, Chat in der App. |

Zusammen: recherchieren → schreiben → hier setzen. Jede App bleibt ohne die anderen benutzbar.

---

## Lizenz

**Kostenlos für alle, inklusive Unternehmen.** Kein Key, kein Account, kein „privat oder geschäftlich“.

- **Erlaubt:** die App nutzen (auch kommerziell); den Quelltext lesen, prüfen und für den eigenen Gebrauch bauen.
- **Nicht erlaubt:** Penwright weitergeben; Code aus diesem Repo in ein anderes Projekt, Produkt oder einen Fork übernehmen.

Rechtstext: [`LICENSE.md`](../LICENSE.md) (PolyForm Strict 1.0.0 plus zusätzliche Erlaubnisse). Gebündelte Typst-Packages und Fonts behalten ihre eigenen Lizenzen (`THIRD_PARTY_LICENSES.md`). Code-PRs werden nicht angenommen (`CONTRIBUTING.md`).

Polar, Kaufdialoge, Testphase und Feature-Gates sind entfernt. Der In-App-Chat rechnet über das **Cursor-Abo** der nutzenden Person ab, nicht über Penwright.

---

## Was die App kann

**Schreiben.** WYSIWYG (TipTap/ProseMirror) mit Typst-Knoten: Überschriften, Mathe, Bilder, Tabellen, Zitate, Querverweise, Fußnoten, Magazin-Bausteine, projekt-eigene `#let`-Makros als Karten mit Formular. Live-PDF (pdf.js), Einzelseite oder Doppelseite. Kommentare, Projekt-Suche, Outline mit Drag-to-Reorder. UI Englisch/Deutsch.

**Sicherheit.** Versionen (Git, ohne Stage/Commit-Vokabular). Auto-Backups. KI-Undo (`.penwright/ai-snapshots/`, gleiche Schicht für App, MCP und In-App-Chat). Lokale Crash-Reports, keine Telemetrie.

**Design.** Themes, Paletten, Layouts, gebündelte OFL-Fonts, parametrische Design-Elemente, Kapitel-Looks. Jede Design-Änderung wird vor dem Behalten kompiliert und bei Fehler zurückgerollt (`shared/safeApply.ts`, App und MCP).

**Export.** PDF (wie die Vorschau), Druck-PDF (Beschnitt, Schnittmarken, Bund), DOCX, HTML (eine Seite oder Magazin-Mini-Site). Markdown-Import. Zotero-`.bib` mit Auto-Sync.

**KI — Chat in der App (neu, 2026-08-21).** `@cursor/sdk` im Main-Prozess. Renderer importiert das SDK nie. **Ansicht → Chat** (`Cmd+J`), Leiste unter dem Editor (Editorbreite; PDF volle Höhe). Anmeldung unter Einstellungen → Cursor (90-Tage-Key, nicht die IDE-Session). Composer: Enter senden, Shift+Enter Zeile, Dateien anhängen, `@` auf Kapitel. Agent/Plan, Modell/Fast/Thinking im Dropdown. Mehrere Chats pro Projekt (Tabs, History, +), gespeichert in `<projekt>/.penwright/cursor-agent/`. Ein Stream zur Zeit; Wechsel = `Agent.resume`. Schreiben nur über Penwright-MCP (`tools: mcp, read, grep, glob, ls` — kein Shell/Task, kein builtin write). Dieselben 66 Tools, Snapshots und Safe-Apply wie Cursor IDE / Claude.

**KI — externe Hosts.** MCP-Server, 66 Tools. Beim Start schreibt Penwright sich nach **`~/.cursor/mcp.json`**. Claude Code optional (Hilfe → MCP-Verbindung). Claude Desktop eigener Wizard. Kein Web-Export-Tool (bewusst: Menü + Dialog). „Design with AI“-Popover und Claude-Handoff aus dem Kontextmenü sind entfernt; der Anker ist **In Chat einfügen**.

---

## Stack

| | |
|---|---|
| App | Electron 41 · electron-vite 5 · Svelte 5 (Runes) |
| Editor | TipTap / ProseMirror 3 · CodeMirror 6 · pdf.js 5 |
| Satz | gebündeltes Typst **0.15.1**, 24 Packages, 7 OFL-Familien (meist variabel) |
| Git | simple-git |
| Persistenz | electron-store (`penwright-settings`) + projektlokales `.penwright/` |
| MCP | `@modelcontextprotocol/server` 2.0.0 · Zod 4 · Bun-Binary + Node-esbuild-Fallback |
| In-App-Agent | `@cursor/sdk` · Host `src/main/cursorAgentHost.ts` · UI `ChatPanel.svelte` |
| Hosts | In-App-Chat (Default für KI in der App) · Cursor IDE · Claude Desktop · Claude Code |

---

## Tests

`npm test` ist das Gate vor jedem Commit und in `package:{mac,win,linux}` (~2 min):

`check:mcp` → `typecheck` → Unit (Round-Trip, Makros, HTML/DOCX, Easy-Writing-Import, Chat-Allowlist, …) → DOM-Popups → Korpus-Round-Trip → Pixel-Gate → MCP-E2E.

Die Round-Trip-Baseline ist leer. Das Pixel-Gate hasht **Pixel**, nicht PNG-Bytes, und ignoriert System-Fonts. Korpus zeigt auf echte Projekte außerhalb des Repos (`penwright.corpus.json`, git-ignoriert).

Chat: `scripts/chat-agent-options-test.mts` (Allowlist + Session-Index, ohne SDK).

---

## Distribution

- **macOS / Apple Silicon:** gebaut, signiert, notariert (`npm run package:mac`).
- **Windows:** verdrahtet, auf echtem Gerät **nicht** verifiziert.
- **Linux:** AppImage-Pfad existiert; Claude-Desktop-Wizard n/a.
- Kein Auto-Updater. Domain `penwright.online` ist kanonisch, aber noch nicht registriert. Handbuch liegt in der App (`handbook.md` / `handbuch.md`).

---

## Noch offen

Nicht hier pflegen — in [next-steps.md](next-steps.md):

- Domain + Impressum + SBOM
- Windows auf echtem Gerät
- Anwaltliches Gegenlesen der Lizenz (PolyForm Strict unverändert; Zusätze stehen nur in `LICENSE.md`)
- Finale QA auf echter Thesis
- In-App-Chat: packaged Spike / Notarisierung mit Native-SDK-Binaries (Plan Phase 3)

---

## Dokumente

| Datei | Inhalt |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Architektur, Parität App↔MCP, Konventionen |
| [README.md](../README.md) | Produkt, Suite, Chat, Lizenz |
| [handbook.md](handbook.md) / [handbuch.md](handbuch.md) | Nutzer-Handbuch (in der App) |
| [mcp-server.md](mcp-server.md) | MCP-Tools |
| [01-cursor-sdk-integration-plan.md](01-cursor-sdk-integration-plan.md) | In-App-Chat (Plan + Stand) |
| [next-steps.md](next-steps.md) | Offene Arbeit bis zum Release |
| [done/](done/) | Abgeschlossene Pläne und alte Strategien |
| [handover.md](handover.md) | Session-Handover (Historie) |
