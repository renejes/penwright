# Penwright — aktueller Stand

> **Stand:** 2026-10-10 · App **0.20.0** · `MCP_SETUP_VERSION` **0.44.0** · Typst **0.15.1** · MCP **65 Tools** · SDK `@modelcontextprotocol/server` **2.0.0** · `@cursor/sdk` **1.0.x** (In-App-Agent, nur Mac)
>
> Diese Datei ist der **aktuelle** Stand, kein Changelog. Session-Verlauf: [handover.md](handover.md), [done/](done/). Offene Arbeit: [next-steps.md](next-steps.md). Architektur für Agents: [CLAUDE.md](../CLAUDE.md).

---

## Was es ist

Penwright ist ein WYSIWYG-Editor für [Typst](https://typst.app)-Dokumente. Produktname **Penwright** (`penwright` in Identifiern). Das Git-Repo heißt weiter `vswrite-desktop`.

Zwei Hosts, ein Projektordner:

| Host | Rolle |
|---|---|
| **Mac** | Electron-App. Schreiben, Gestalten, Live-PDF, Export, Chat, MCP. Typst-CLI ist gebündelt. |
| **iPad** | Tauri-Schreibhost im selben Repo. Derselbe Editor, derselbe Ordner. Kein Kompilieren, kein Design-Studio, kein Chat. |

Projekt-first: jedes Projekt ist ein Ordner. Kapitelversionen (`versions/`), Auto-Backups, KI-Snapshots, UI-Präferenzen und In-App-Chats liegen darin. Die Mac-App startet am Start Screen und öffnet kein Projekt von allein. Dropbox ist die Wolke: der Ordner wandert, die Fassung wandert mit.

Zwei Eingänge auf dem Mac:

| Eingang | Wahrheit auf der Platte |
|---|---|
| **Typst-Projekt** | `.typ`-Wurzel, Kapitel per `#include`, Design in `style.typ` |
| **[Easy Writing](https://github.com/renejes/easy-writing)-Ordner** | `project.yaml` + `.mdx` (+ optional `references.bib`). Penwright setzt daraus Typst und **schreibt das Manuskript nicht um**. |

### Drei Apps, ein Schreibtisch — oder jede allein

| App | Rolle |
|---|---|
| **[Research Overview Platform](https://github.com/renejes/research-overview-platform)** | Transparente KI-Research: Quellen, Provenienz, Zitate. Export ist ein Schreibpaket, kein Artikel. |
| **[Easy Writing](https://github.com/renejes/easy-writing)** | Das Manuskript. Ordnerprojekt, Markdown/MDX. Kein Layout-Studio. |
| **Penwright** | Satz und Design auf dem Mac. Schreiben auf dem Mac und auf dem iPad. |

---

## Kapitelversionen

Eine Version ist **eine benannte Kopie eines Kapitels**. Kein Git-Commit, kein Snapshot des ganzen Projekts.

- Anlegen bezieht sich auf die **`.typ`-Datei im aktiven Tab**.
- Ablage: `versions/<Kapitelpfad>/<Name>.typ`. Beispiel: `versions/chapters/01.typ/Entwurf.typ`. Der Ordner heißt wie die Datei, inklusive `.typ`.
- Vorschlagsname: `Dateiname_V1_Jahr_Monat_Tag`, editierbar. Die nächste freie `V`-Nummer wird genommen.
- Im Reiter **Projekt**, gruppiert nach Kapitel. Das Menü **⋮** an der Zeile: Lesen, Bearbeiten, Zur Hauptfassung, Umbenennen, Löschen.
- **Lesen** öffnet einen Tab ohne Eingabe. **Bearbeiten** schreibt in die Versionsdatei, nicht in das lebende Kapitel.
- **Zur Hauptfassung** tauscht die beiden Texte. Die Version behält ihren Namen und enthält danach den bisherigen Kapiteltext.

Derselbe Planer (`src/shared/chapterVersions.ts`) läuft auf dem Mac und auf dem iPad. Ein vorhandener `.git`-Ordner im Projekt wird nicht angefasst und nicht als Verlauf benutzt. Eine `.gitignore` wird weiter geschrieben, damit `.penwright/` aus einem eigenen Repo herausbleibt.

### Zwei weitere Netze

| Netz | Was es hält | Wo |
|---|---|---|
| **Auto-Backups** | Zeitkopien der `.typ`- und `.bib`-Dateien, inklusive des offenen Kapitels | `.penwright/backups/` |
| **KI-Änderungen** | Der Text einer Datei, bevor ein Agent sie überschrieben hat, auch wenn sie nicht offen war | `.penwright/ai-snapshots/` |

**Verlauf & Wiederherstellen** im Projekt-Reiter listet Backups und KI-Änderungen. Ein Backup stellt das Projekt auf diesen Zeitpunkt zurück. **Letzte rückgängig** holt eine Datei zurück. Die Kapitelversionen liegen in der Liste darüber, nicht in diesem Fenster.

Beide Netze gelten auf dem iPad für dieselben Ordner. Das Intervall und die Anzahl der Backups stellt man dort ein. Das iPad schreibt keine Agenten-Änderungen; es kann eine Kopie zurückholen, die der Mac-Agent schon in den Ordner gelegt hat.

---

## iPad

Schreibhost für einen Projektordner, den man auswählen kann (Dropbox eingeschlossen). Derselbe Serializer wie auf dem Mac.

**Kann:** Projekt öffnen, aus Vorlage oder Preset anlegen, schließen. Kapitel bearbeiten, Ordner und Bilder, Kapitel (`#include`) und Kommentare. Versionen anlegen, lesen, bearbeiten, umbenennen, löschen, zur Hauptfassung machen. Suchen und Ersetzen im offenen Kapitel, Querverweis, `@` aus den `.bib`-Dateien inklusive `zotero.bib`. PDFs im Projekt öffnen, auch unter `sources/`. Einen Zotero-PDF-Ordner einmal wählen und die verknüpfte PDF daraus öffnen, ohne sie nach `sources/` zu kopieren; der Abgleich ist der Dateiname aus `zotero.bib`. Auto-Backups und die letzte KI-Änderung. Menüknopf mit denselben Namen wie die Mac-Menüleiste, soweit die Aktion hier läuft.

**Kann nicht:** Typst kompilieren, Live-PDF, Export (PDF, DOCX, Druck, Web), Chat, Design-Werkzeuge, Suche im ganzen Projekt, eine Better-BibTeX-Datei beobachten. Die Bibliothek verknüpft man auf dem Mac. Das iPad liest die `zotero.bib`, die schon im Projekt liegt.

---

## Lizenz

**Kostenlos für alle, inklusive Unternehmen.** Kein Key, kein Account, kein „privat oder geschäftlich“.

- **Erlaubt:** die App nutzen (auch kommerziell); den Quelltext lesen, prüfen und für den eigenen Gebrauch bauen.
- **Nicht erlaubt:** Penwright weitergeben; Code aus diesem Repo in ein anderes Projekt, Produkt oder einen Fork übernehmen.

Rechtstext: [`LICENSE.md`](../LICENSE.md) (PolyForm Strict 1.0.0 plus zusätzliche Erlaubnisse). Gebündelte Typst-Packages und Fonts behalten ihre eigenen Lizenzen (`THIRD_PARTY_LICENSES.md`). Code-PRs werden nicht angenommen (`CONTRIBUTING.md`).

Der In-App-Chat auf dem Mac rechnet über das **Cursor-Abo** der nutzenden Person ab, nicht über Penwright.

---

## Was die Mac-App kann

**Schreiben.** WYSIWYG (TipTap/ProseMirror) mit Typst-Knoten: Überschriften, Mathe, Bilder, Tabellen, Zitate, Querverweise, Fußnoten, Magazin-Bausteine, projekt-eigene `#let`-Makros als Karten mit Formular. Live-PDF (pdf.js), Einzelseite oder Doppelseite. Kommentare, Projekt-Suche, Outline mit Drag-to-Reorder. UI Englisch/Deutsch.

**Design.** Themes, Paletten, Layouts, gebündelte OFL-Fonts, parametrische Design-Elemente, Kapitel-Looks. Jede Design-Änderung wird vor dem Behalten kompiliert und bei Fehler zurückgerollt (`shared/safeApply.ts`, App und MCP).

**Export.** PDF (wie die Vorschau), Druck-PDF (Beschnitt, Schnittmarken, Bund), DOCX, HTML (eine Seite oder Magazin-Mini-Site). Markdown-Import. Zitierstil **DGPs** (`deutsche-gesellschaft-für-psychologie`) steht in den Dokumenteinstellungen. Die Projektvorlage **Hausarbeit** setzt das SRH-Deckblatt, Arial, die Ränder 2,5/2/4/2 cm und diesen Stil. Ohne `style.json` liest der DOCX-Export Schrift, Ränder und Zeilenabstand aus den `#set`-Regeln. Das Deckblatt bleibt ohne Seitenzahl, der Text beginnt bei 1. DGPs-Kurzzitate (mit Seite) und das Literaturverzeichnis folgen dem PDF. Das Inhaltsverzeichnis ist ein Word-Feld mit bereits eingetragenen Zeilen, weil Word Online ein leeres Feld nicht berechnet.

**Quellen.** Verknüpfte Better-BibTeX-Datei (`zotero.bib`), die der Mac beobachtet, solange die App läuft. Beim Verknüpfen: PDFs verknüpft lassen oder erst beim Öffnen nach `sources/` kopieren, plus der Ordner der verknüpften Anhänge (häufig ein Dropbox-Ordner). `@` fragt nach der Seite (`@key[S. 12]`). PDF öffnen folgt dem `file`-Feld, dann diesem Ordner, dann der lokalen Zotero-Schnittstelle, dann `sources/`. Auf dem iPad entfällt die lokale Schnittstelle; es zählt der Dateiname in dem einmal gewählten Ordner. `penwright_search_sources` durchsucht alle Paper dieser Bibliothek, auch ohne Zitat im Text; `penwright_read_source` liest die Fundstelle. Der Textindex liegt unter `.penwright/source-index/`.

**KI — Chat in der App (nur Mac).** `@cursor/sdk` im Main-Prozess. Renderer importiert das SDK nie. **Ansicht → Chat** (`Cmd+J`). Anmeldung unter Einstellungen → Cursor. Mehrere Chats pro Projekt, gespeichert in `<projekt>/.penwright/cursor-agent/`. Dieselben 65 MCP-Tools, Snapshots und Safe-Apply wie Cursor IDE / Claude. Kein Web-Export-Tool.

**KI — externe Hosts.** MCP-Server, 65 Tools. `penwright_save_version` legt eine benannte Kapitelfassung unter `versions/` ab. Wiederherstellen tauscht sie mit der lebenden Datei. Beim Start schreibt Penwright sich nach **`~/.cursor/mcp.json`** und kopiert das gebündelte MCP-Binary. Claude Code optional (Hilfe → MCP-Verbindung). Claude Desktop eigener Wizard.

---

## Stack

| | |
|---|---|
| Mac | Electron 41 · electron-vite 5 · Svelte 5 (Runes) |
| iPad | Tauri 2 · dieselbe Svelte-Oberfläche · Ordnerfreigabe · kein Typst |
| Editor | TipTap / ProseMirror 3 · CodeMirror 6 · pdf.js 5 |
| Satz (nur Mac) | gebündeltes Typst **0.15.1**, 24 Packages, 7 OFL-Familien (meist variabel) |
| Persistenz | electron-store (`penwright-settings`) auf dem Mac + projektlokales `.penwright/` und `versions/` |
| MCP | `@modelcontextprotocol/server` 2.0.0 · Zod 4 · Bun-Binary + Node-esbuild-Fallback |
| In-App-Agent | `@cursor/sdk` · Host `src/main/cursorAgentHost.ts` · UI `ChatPanel.svelte` |
| Hosts | In-App-Chat (Mac) · Cursor IDE · Claude Desktop · Claude Code |

---

## Tests

`npm test` ist das Gate vor jedem Commit und in `package:{mac,win,linux}` (~2 min):

`check:mcp` → `typecheck` → Unit (Round-Trip, iPad-Host, Makros, HTML/DOCX, Easy-Writing-Import, Chat-Allowlist, Zotero-PDF, …) → DOM-Popups → Korpus-Round-Trip → Pixel-Gate → MCP-E2E.

Die Round-Trip-Baseline ist leer. Das Pixel-Gate hasht **Pixel**, nicht PNG-Bytes, und ignoriert System-Fonts. Korpus zeigt auf echte Projekte außerhalb des Repos (`penwright.corpus.json`, git-ignoriert).

---

## Distribution

- **macOS / Apple Silicon:** gebaut und mit Developer ID signiert, nicht notariert (`mac.notarize: false`). Der DMG enthält `Installation.txt` für den Erststart.
- **iPad:** Debug-Build aus diesem Repo auf ein angeschlossenes Gerät (`tauri ios build`). Kein App-Store-Paket.
- **Windows:** verdrahtet, auf echtem Gerät **nicht** verifiziert.
- **Linux:** AppImage-Pfad existiert; Claude-Desktop-Wizard n/a.
- Kein Auto-Updater. Domain `penwright.online` ist kanonisch, aber noch nicht registriert. Handbuch liegt in der App (`handbook.md` / `handbuch.md`).

---

## Noch offen

Nicht hier pflegen — in [next-steps.md](next-steps.md):

- Domain + Impressum + SBOM
- Windows auf echtem Gerät
- Anwaltliches Gegenlesen der Lizenz (PolyForm Strict unverändert; Zusätze stehen nur in `LICENSE.md`)
- iPad: App-Store-Paket, Typst-Vorschau bleibt draußen

---

## Dokumente

| Datei | Inhalt |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Architektur, Parität App↔MCP, Konventionen |
| [README.md](../README.md) | Produkt, Versionen, iPad, Lizenz |
| [handbook.md](handbook.md) / [handbuch.md](handbuch.md) | Nutzer-Handbuch (in der App) |
| [mcp-server.md](mcp-server.md) | MCP-Tools |
| [next-steps.md](next-steps.md) | Offene Arbeit |
| [done/](done/) | Abgeschlossene Pläne |
| [handover.md](handover.md) | Session-Handover (Historie) |
