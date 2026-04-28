# vswrite Desktop — Writer-Features-Plan

> Plan-Datum: 2026-04-28 | Status: Entwurf | Vorbedingung: Aktuelle Code-Basis nach Session 10

---

## Zweck

Dieser Plan beschreibt **neun Features**, die vswrite vom „funktioniert" zu „fühlt sich wie ein vollwertiges Writing-Tool an" heben — sowohl für wissenschaftliche Arbeiten als auch für Prosa. Jedes Feature wird so dokumentiert, dass eine zukünftige Session sofort weiß: was, wo, wie, mit welchen Risiken.

**Reihenfolge nach Impact:**

1. [Find in Project](#1-find-in-project) — entscheidend für lange Dokumente
2. [Footnote-UI](#2-footnote-ui) — beide Zielgruppen nutzen Fußnoten ständig
3. [Cross-References](#3-cross-references) — Auto-Update von Abbildungs-/Tabellen-Nummern
4. [Comments / Annotations](#4-comments--annotations) — Betreuer-Feedback / Selbstnotizen
5. [Outline drag-to-reorder](#5-outline-drag-to-reorder) — Sektionen umordnen ohne Source zu editieren
6. [Reading Mode](#6-reading-mode) — Korrekturlesen ohne Preview zu wechseln
7. [Inline Source Preview](#7-inline-source-preview) — Klick auf Citation öffnet PDF-Popup
8. [Backlinks](#8-backlinks) — „Wo wird das sonst noch erwähnt?"
9. [Manuscript Export](#9-manuscript-export) — Industriestandard-Format für Belletristik

---

## 1. Find in Project ✅ (Session 12)

### Problem
Die aktuelle Suche ([SearchReplace.svelte](src/editor/components/SearchReplace.svelte)) operiert nur auf `editor.state.doc` der gerade aktiven Datei. Bei einem Multi-Chapter-Projekt mit 14 Kapiteln muss man jede Datei einzeln öffnen und durchsuchen.

### Zielverhalten
- `Cmd+Shift+F` öffnet Project-Search (analog zu VS Code).
- Sucheingabe + Optionen (case sensitive, whole word, regex, „include `.bib`?").
- Treffer-Liste gruppiert nach Datei: jede Datei aufklappbar mit allen Treffern + 1 Zeile Kontext.
- Klick auf Treffer → öffnet die Datei + scrollt zur Stelle + highlightet das Match.
- Replace-All über alle Dateien (mit Confirm-Dialog: „X Treffer in Y Dateien ersetzen?").

### Implementierung

**Backend:**
- Neuer IPC-Handler `project:search` in [ipcHandlers.ts](src/main/ipcHandlers.ts):
  - Input: `{ query, caseSensitive, wholeWord, regex, includeBib }`
  - Walks alle `.typ`/`.bib`-Dateien im Projekt (analog zu `collectProjectFiles` in [persistenceManager.ts](src/main/persistenceManager.ts))
  - Pro Datei: zeilenweise Match suchen, gibt `{ filePath, matches: [{ line, col, matchText, contextBefore, contextAfter }] }`
  - Begrenzung: max 1000 Treffer total, dann Cutoff-Hinweis
- Neuer Handler `project:replaceAll`:
  - Input: `{ query, replacement, files: Array<{path, matchPositions[]}> }`
  - Schreibt jede Datei zurück; löst `lastSaveTimestamp`-Guard aus
- Channels in [preload-entry.ts](src/main/preload-entry.ts) whitelisten

**Frontend:**
- Neue Komponente `ProjectSearchPanel.svelte` — entweder als 5. Sidebar-Tab „Suchen" oder als Slide-In von links bei `Cmd+Shift+F`
- State in [appState.svelte.ts](src/renderer/appState.svelte.ts): `searchState` mit `query`, `results`, `loading`
- Treffer-Klick: `api.invoke('filetree:open', filePath)` + nach Datei-Open per Custom-Event Editor scrollen lassen

**Risiken:**
- Performance bei 100+ Dateien: wenn synchron, kann Main-Process blockieren. → Asynchron mit `Promise.all` + 500ms-Limit, sonst Worker-Thread
- Regex-Sicherheit: User-Input → niemals direkt als RegExp; mit `try/catch` + Validierung
- Replace-All ohne Backup: vor Replace **automatisch eine Version anlegen** („Version vor Suchen-Ersetzen"), damit Rollback möglich ist

### Aufwand
**1 Tag.** Backend `project:search` + `replaceAll` ist ~150 LOC, Frontend-Panel ~250 LOC.

---

## 2. Footnote-UI ✅ (Session 12)

### Problem
Typst hat `#footnote[Inhalt]`. Es gibt aktuell keinen UI-Weg, eine Fußnote einzufügen oder zu bearbeiten — User muss manuell Typst-Code tippen. Beide Zielgruppen (akademisch + Prosa) nutzen das ständig.

### Zielverhalten
- Toolbar-Button „Fn" (oder Slash-Command `/Footnote`).
- Klick fügt an Cursor-Position eine Inline-Footnote-Anzeige ein (kleine hochgestellte Nummer wie `[1]`).
- Footnote-Inhalt wird in einem **Sidepane unten am Editor** (oder als Inline-Box, ausklappbar) editiert.
- Im Source: `#footnote[Text]` an der Cursor-Position.
- In der Preview: Typst rendert nativ als nummerierte Fußnote.
- Klick auf bestehende Footnote im Editor → Sidepane öffnet sich mit dem Inhalt zum Editieren.
- ESC oder Click-Out: Sidepane schließt, Änderung übernommen.

### Implementierung

**Editor:**
- Neue TipTap-Node `typstFootnote` analog zu den ~19 vorhandenen `typst*.ts` in [src/editor/extensions/](src/editor/extensions/)
- Inline-Node, atomic (nicht editierbar inline), zeigt fortlaufende Nummer als Badge
- Attribut: `content: string` (Footnote-Body als Typst-Source)
- Serializer ([serializer.ts](src/editor/lib/serializer.ts)) → emittiert `#footnote[<content>]`
- Deserializer ([deserializer.ts](src/editor/lib/deserializer.ts)) → erkennt `#footnote[...]` als Inline-Konstrukt, parst den Inhalt

**UI:**
- Neue Komponente `FootnoteEditor.svelte` — Sidepane oder Modal
- Liste aller Footnotes im Dokument (links) + Detail-Editor (rechts) für die ausgewählte
- Toolbar-Button + Slash-Command verdrahten
- Click-Handler auf Footnote-Node → öffnet Editor mit pre-selected entry

**Risiken:**
- Footnote-Body kann selbst Typst-Code enthalten (z.B. Citations `@key`, Italic `_word_`). → Footnote-Editor muss ein Mini-TipTap mit reduziertem Schema sein, oder einfaches Code-Eingabefeld mit Live-Preview
- Numbering: Typst erledigt das automatisch in der Compile-Phase. Im Editor zeigen wir nur Platzhalter wie `[N]` oder fortlaufende Indizes via DOM-Counter

### Aufwand
**1–1,5 Tage.** TipTap-Node ist Routine (Vorlagen vorhanden); Komplexität liegt im Mini-Editor für den Body.

---

## 3. Cross-References

### Problem
Typst kennt `<label>` und `@label`-Verweise mit Auto-Numbering. Beispiel: `#figure(image("a.png"), caption: "X") <fig:1>` und im Text `siehe @fig:1`. User muss die Label-Namen aktuell manuell tippen + sich merken, welche Labels existieren.

### Zielverhalten
- Slash-Command `/Reference` öffnet Picker mit allen Labels im Projekt:
  - Figures mit Caption
  - Tables mit Caption  
  - Equations mit Label
  - Headings (auch Kapitel-Headings)
- Filter-Eingabe + Vorschau des Captions/Headings
- Klick fügt `@label` ein
- Inline-Anzeige im Editor: kleine Pille mit „Fig. 3" (resolved) statt `@fig:3` Code
- Hover/Klick auf bestehende Reference → springt zum Label

Zusätzlich: **Label-Erstellung beim `#figure`/`#table`-Insert** automatisieren — wenn der User `/Image` mit Caption nutzt, wird automatisch `<fig:slugify(caption)>` angehängt.

### Implementierung

**Backend:**
- Neuer Handler `project:listLabels` in [ipcHandlers.ts](src/main/ipcHandlers.ts):
  - Walks alle `.typ`-Dateien
  - Regex `/<([\w:-]+)>/g` extrahiert alle Labels
  - Zusätzlich: matched-up mit `#figure(...)`/`#table(...)`/`= Heading`-Kontext aus den 3 vorigen Zeilen → Label + Typ + Caption
  - Returns `Array<{ label, type: 'figure'|'table'|'equation'|'heading', caption, file }>`

**Editor:**
- Neue TipTap-Node `typstReference` (analog Citation) — Inline-atomic-Node
- Attribut: `label: string`
- Serializer → `@label`
- Deserializer → erkennt `@label` (außer `@citekey`-Form, die durch das vorhandene Citation-System gehen) — Heuristik: wenn `label` ein `:` enthält oder mit `fig|tbl|eq|sec|chap` beginnt, ist es Reference, sonst Citation
- Live-Anzeige: bei jedem Render fragt der Renderer einmal `project:listLabels` ab und zeigt die resolved-Form (Caption oder Nummer)

**UI:**
- ReferencePicker.svelte ähnlich CitationSuggestion
- Toolbar-Button optional

**Risiken:**
- Konflikt mit dem `@`-Citation-Trigger: User tippt `@`, will eine Citation, aber die Suche findet Labels — Auflösung über Heuristik (Citations sind in `.bib`, Labels in `.typ`) oder zwei separate Picker mit verschiedenen Triggern (`@@` für Reference?)
- Performance: Label-Liste neu zu lesen bei jedem Editor-Update wäre teuer — Cache + Watch auf `.typ`-Änderungen

### Aufwand
**1,5–2 Tage.** Hauptkomplexität: Disambiguierung Citation vs Reference.

---

## 4. Comments / Annotations ✅ (Session 12)

> **Implementiert.** Comments leben jetzt als sichtbare Markdown-Dateien im
> `comments/`-Ordner des Projekts (nicht in `.vswrite/`), eine `.md` pro
> Comment. Der Source bleibt komplett clean — Comments werden nie in PDF/DOCX
> kompiliert. Highlights im Editor laufen über ProseMirror-Decorations
> (ephemer, nicht im Doc), Reanchoring per `anchorText` mit Offset-Hint.

**Stand:**

- Backend: [src/main/commentManager.ts](src/main/commentManager.ts) — YAML-Frontmatter-Parse/Serialize, Reanchoring per `indexOf`, Orphaned-Detection
- IPC: `comments:list` / `create` / `update` / `delete`
- Editor-Plugin: [src/editor/lib/commentDecorations.ts](src/editor/lib/commentDecorations.ts) — Decoration-Set basierend auf Anker-Text, Click → `vswrite:comment-click`-Event
- UI: [CommentsPanel.svelte](src/renderer/components/CommentsPanel.svelte) als 5. Sidebar-Tab; Filter „Aktuelle Datei / Ganzes Projekt", Resolved-Toggle, debounced Body-Save (400 ms)
- Trigger: Toolbar-Button „Cm" + Menü „Edit → Add Comment" (Cmd+Alt+M); ohne Selektion expandiert auf das Wort am Cursor



### Problem
Es gibt keinen Weg, Notizen oder Feedback ins Dokument zu schreiben, die **nicht** in den PDF-/DOCX-Output kompiliert werden. Sowohl wissenschaftlich (Betreuer-Kommentare zu eigenem Text) als auch Prosa (Selbstnotizen) brauchen das.

### Zielverhalten
- Text markieren → Toolbar-Button „💬 Comment" oder Rechtsklick → „Comment hinzufügen"
- Side-Panel rechts vom Editor klappt aus, zeigt Comment-Bubble mit Text-Eingabe
- Im Editor wird die kommentierte Stelle gelb hinterlegt + zeigt kleinen Indikator am Rand
- Comments **kompilieren nicht** in PDF/DOCX — sie sind nur im vswrite-Editor sichtbar
- Comments können „resolved" werden (verstecken aus der Side-Panel-Liste)
- Comments haben Author + Timestamp (aus Git-Config)

### Implementierung

**Speicherformat:**
Typst-Comments `// …` werden ignoriert vom Compiler. Wir definieren ein eigenes Marker-Pattern:

```typst
//// VSWRITE-COMMENT id=c1 author="René" date="2026-04-28T14:32" range=42-58
//// Hier sollte noch ein Beispiel rein.
//// VSWRITE-COMMENT-END
```

Die `////`-Marker sind doppelte Slashes, die kein gängiger Typst-User schreibt. Range-Angabe als Char-Offset im aktuellen File (nicht stable bei Edits — siehe Risiken).

**Editor:**
- Neue TipTap-Mark `commentMark` mit Attribut `commentId`
- Beim Insert: Mark um die Selektion wrappen, Comment-Eintrag in projekt-lokaler `.vswrite/comments.json` (oder direkt als Marker im Source)
- Render: gelber Hintergrund + Klick öffnet Side-Panel-Eintrag

**Side-Panel:**
- Neue Komponente `CommentsPanel.svelte` — rechte Sidebar oder Slide-In
- Liste aller Comments des aktuellen Files (oder optional: alle im Projekt)
- Eingabe-Feld pro Comment, „Resolved"-Toggle, „Delete"
- Click springt zum markierten Range

**Persistenz (umgesetzte Variante):**
Sichtbarer `comments/`-Ordner im Projekt-Root, eine `.md`-Datei pro Comment, YAML-Frontmatter + Markdown-Body. Sichtbar im File-Tree, in jedem Editor lesbar, git-diffbar, von außen bearbeitbar. Schema:

```markdown
---
id: "2026-04-28-1432-a3f"
file: "chapters/03-method.typ"
anchor: "five reference works"
rangeStart: 42
rangeEnd: 58
author: "René Jesser"
date: "2026-04-28T14:32:00.000Z"
resolved: false
---

Quelle ergänzen — vielleicht den Müller-Artikel?
```

**Reanchoring** (umgesetzt): Beim Laden prüfen, ob `anchor` an `rangeStart` steht — wenn ja, fertig. Sonst `indexOf(anchor)` ab `rangeStart - 200` als Fuzzy-Hint, sonst global. Nicht gefunden → `orphaned: true` im Listen-Result, der Eintrag bleibt in der Panel-Liste, hat aber kein Highlight im Editor.

**Bekannte Limitierungen (aktuelle MVP-Implementierung):**
- Anker-Text muss innerhalb eines einzelnen ProseMirror-Textnodes liegen (also nicht über Absatz-/Heading-Grenzen). Multi-Node-Anker werden als orphaned markiert.
- Mehrere Comments mit identischem Anker-Text in derselben Datei → alle markieren dieselbe (erste) Stelle. Klick öffnet den ersten Eintrag in der Panel-Liste.
- Cloud-Sync: `comments/` liegt jetzt **im Projekt-Root**, also außerhalb von `.vswrite/`. Dropbox/iCloud syncen die Comments mit — Betreuer-Workflow funktioniert.

### Aufwand
**Erledigt** in Session 12. Storage als sichtbare `.md` (statt JSON in `.vswrite/`) machte das Schreiben aufwändiger (eigener YAML-Parser, ein File pro Comment) als der Plan es vorsah, dafür ist das Ergebnis benutzer-transparent.

---

## 5. Outline drag-to-reorder

### Problem
[OutlinePanel.svelte](src/renderer/components/OutlinePanel.svelte) ist read-only Navigation. Der User kann sehen, welche Headings es gibt, aber sie nicht umordnen ohne in der Source zu editieren.

### Zielverhalten
- Headings in der Outline-Sidebar sind drag-bar
- Drag eines H1-Eintrags an eine neue Position → ganzer Block (H1 + alle darunter liegenden Inhalte bis zum nächsten H1 gleicher Stufe) wird verschoben
- Visual: Drop-Indikator zwischen Einträgen, Cursor-Highlight
- Im Editor wird der entsprechende ProseMirror-Bereich umgeordnet
- Source wird neu serialisiert + gespeichert

### Implementierung

**Renderer:**
- HTML5 Drag & Drop API auf den Outline-Items
- Beim Drop: berechne Source-Range des verschobenen Blocks (vom H1 bis vor dem nächsten H1 derselben oder höheren Stufe)
- TipTap `editor.commands.deleteRange + insertContentAt` oder direkter ProseMirror-Transaction

**Komplexität:**
- Multi-File-Projekte: was wenn ein H1 in `chapter1.typ` lebt und ein H2 von `chapter2.typ` darunter? In diesem Setup macht Reorder nur **innerhalb einer Datei** Sinn. Cross-File-Reorder ist Sache des Chapters-Tabs (existiert).
- Sub-Heading-Reorder: H2 verschieben innerhalb eines H1-Bereichs ist trivial (nur ein H2-Block bewegt). H2 in anderen H1-Bereich verschieben: erlaubt, aber nicht das Default-Verhalten — vielleicht Modifier-Key (Shift) für „Cross-Section-Move".

**Risiken:**
- Wenn der User einen H1 verschiebt, der ProseMirror-Nodes mit komplexen Strukturen (Footnotes, Tables) enthält, muss die Transaction sauber sein, sonst Datenverlust
- Drag-Feedback in Svelte 5: HTML5-Drag ist proprietär — muss sauber gestylt werden, sonst Browser-Default-Geist erscheint

### Aufwand
**1 Tag** (single-file-Reorder), **2–3 Tage** wenn Cross-Section-Move robust werden soll.

---

## 6. Reading Mode ✅ (Session 13)

### Problem
Zum Korrekturlesen gibt's heute nur die PDF-Preview rechts daneben — schön, aber nicht im Editor selbst editierbar. Wer nur lesen + kleine Korrekturen machen will, muss zwischen Editor und Preview hin- und herklicken.

### Zielverhalten
- Toggle in der Toolbar oder View-Menü („Reading Mode" / `Cmd+Alt+R`)
- Editor wechselt von WYSIWYG-Look zu **typografisch schöner Render-Ansicht**:
  - Serifen-Font (Libertinus / Computer Modern)
  - Größerer Zeilenabstand
  - Justified text
  - Größere Margins
  - Heading-Stile wie in echtem Buchsatz
- Cursor + Editing bleiben aktiv — User kann Tippfehler in dieser Ansicht direkt korrigieren
- Slash-Commands + Toolbar bleiben funktional

### Implementierung

**Renderer:**
- Neue CSS-Klasse `.reading-mode` auf `.vswrite-app`
- CSS-Override für `.editor-container` innerhalb `.reading-mode`:
  - `font-family: 'Libertinus Serif', 'Computer Modern Serif', Georgia, serif`
  - `font-size: 18px; line-height: 1.7`
  - `max-width: 680px; margin: 40px auto`
  - Heading-Sizes größer + andere Color
- State `uiState.readingMode: boolean` (in [appState.svelte.ts](src/renderer/appState.svelte.ts))
- View-Menu-Eintrag in [menuBuilder.ts](src/main/menuBuilder.ts) sendet `toggleReadingMode`-Message
- messageHandler toggelt das Flag

**Optional:** Reading Mode hat „Distraction-Free"-Variante, die zusätzlich Sidebar + Preview ausblendet (analog zu Focus Mode, aber mit anderer Typografie).

**Risiken:**
- Code-Blocks und Math-Blocks bleiben monospace im Reading Mode (CSS scoped via `:not(.code-block, .math-block)`)
- TipTap-Toolbar verschwindet vielleicht visuell besser im Reading Mode — vielleicht im RM nur die Toolbar dünn machen statt ganz weg

### Aufwand
**0,5–1 Tag.** Reines CSS + State-Toggle, keine neue Logik.

---

## 7. Inline Source Preview

### Problem
Der `sources/`-Ordner enthält PDFs zu jeder Zitation. Wer im Text auf `@chen2021codex` klickt, will direkt die Quelle nachschauen — heute muss man manuell zur Sidebar, das PDF suchen, öffnen.

### Zielverhalten
- Hover über `@citekey` → kleines Popover zeigt:
  - Autor, Titel, Jahr aus der `.bib`
  - Wenn `sources/<citekey>*.pdf` existiert → „PDF anzeigen"-Button
  - Klick auf Button → Tab mit PDF öffnet sich mit der ersten Seite


### Implementierung

**Backend:**
- Neuer Handler `project:findSourceForCitation` in [ipcHandlers.ts](src/main/ipcHandlers.ts):
  - Input: `citekey`
  - Sucht in `sources/` nach Datei, deren Name mit `<citekey>` beginnt (oder den citekey enthält)
  - Returns Pfad oder null
- Optional: ein Mapping in `<project>/.vswrite/citation-sources.json`, wenn Auto-Erkennung versagt — User kann manuell zuordnen

**Frontend:**
- TipTap Plugin oder Hover-Handler auf Citation-Nodes
- Popover-Komponente: zeigt BibEntry-Daten (aus `citationSuggestion.ts`-Cache) + PDF-Button
- Inline-PDF-Viewer: Mini-Modal mit pdf.js (gleiche Lib wie [PdfPreviewPanel.svelte](src/renderer/components/PdfPreviewPanel.svelte)), Zoom + 1. Seite

**Risiken:**
- Auto-Naming: User muss seine PDFs sinnvoll benennen (`chen2021codex.pdf`). Im StartScreen-Onboarding hinweisen
- PDF-Größe: 50 MB-PDF im Hover-Popover wäre tragisch — Lazy-Load nur 1. Seite, dann „Vollständig öffnen"-Button

### Aufwand
**1 Tag.**

---

## 8. Backlinks ✅ (Session 13)

> **Implementiert** als dünner Aufsatz auf Find-in-Project. Trigger:
> Hover-Button (`↪`) neben jedem Heading im Outline-Panel + Right-Click auf
> Citation-Badges im Editor. Beides setzt einen `projectSearchPreset` und
> öffnet die Project-Search mit vorgefüllter Query: für Headings die
> Heading-Text-Suche, für Citations `@<citekey>` als Whole-Word-Treffer.
> Volltext-Suche ergibt automatisch auch Cross-References, sobald die
> existieren — kein extra Backend nötig.



### Problem
„Wo wird dieser Begriff/dieses Heading sonst noch erwähnt?" — typische Frage bei wissenschaftlichem Schreiben (Konsistenz-Check).

### Zielverhalten
- Im Outline oder im Editor-Kontextmenü auf einem Heading: „Show backlinks"
- Side-Panel zeigt:
  - Alle anderen Stellen im Projekt, die auf dieses Heading verlinken (`@sec:X` Cross-Refs)
  - Alle Fließtext-Stellen, die das Heading-Wort wörtlich enthalten (Volltext-Match)
- Klick auf Eintrag → springt dorthin

Erweiterung: Backlinks für Citations — „wo wird @chen2021codex sonst noch zitiert?" zeigt alle Vorkommen über alle Kapitel.

### Implementierung

**Backend:**
- Neuer Handler `project:findBacklinks` in [ipcHandlers.ts](src/main/ipcHandlers.ts):
  - Input: `{ kind: 'label' | 'citation' | 'text', value: string }`
  - Walks alle `.typ`-Dateien
  - Sucht je nach kind: `@<value>`, oder `value` als Wort
  - Returns `Array<{ file, line, context }>`
- Im Wesentlichen ein **spezialisierter Find-in-Project**

**Frontend:**
- Erweitert `OutlinePanel.svelte`: Rechtsklick auf Heading → „Show backlinks"
- Neue Komponente `BacklinksPanel.svelte` oder integriert in Project-Search

### Aufwand
**0,5 Tag** wenn Find-in-Project (#1) bereits drin ist — dann nur ein Filter darauf.

---

## 9. Manuscript Export

### Problem
Belletristik-Autoren brauchen ein Export-Format das **nicht** an akademischer Typografie orientiert ist:
- Doppelter Zeilenabstand
- 12pt Courier oder Times New Roman
- 1-Zoll-Margins
- Kontaktinfos oben links auf Seite 1
- Wortzahl oben rechts
- Header mit „Surname / Title / Page"
- „THE END" am Ende

Das ist der „**Shunn Standard Manuscript Format**", quasi-Standard für Einreichungen bei Verlagen + Magazinen.

### Zielverhalten
- File → Export → „Manuscript (Shunn Standard)"
- Vor Export: Modal mit Eingabefeldern für:
  - Author (Vor + Nachname)
  - Adresse / E-Mail
  - Word-Count-Override (Default: berechnet)
  - Genre / Wortanzahl-Kategorie
- Generiert ein PDF (oder DOCX) mit dem Shunn-Layout:
  - Title-Page mit Kontaktinfo
  - Body in Courier 12pt double-spaced

### Implementierung

**Backend:**
- Neuer Style-Template `shunn-manuscript` in [src/shared/styleTemplates.ts](src/shared/styleTemplates.ts)?
  - Nein — Style Templates ändern den Document-Source. Manuscript-Format ist nur für Export.
- Alternativ: Export-Variante in [importExport.ts](src/main/importExport.ts) — `runManuscriptExport(config)`, baut eine **separate temporäre `.typ`-Datei** mit Shunn-Preamble + dem Body-Content (via `resolveIncludes`), kompiliert das mit typst CLI
- Shunn-Preamble als Asset in `src/shared/manuscript-preamble.typ` mit Platzhaltern (`__AUTHOR__`, `__TITLE__`, `__WORDCOUNT__`)

**Frontend:**
- Erweitere [ExportDialog.svelte](src/renderer/components/ExportDialog.svelte) um eine dritte Format-Option „Manuscript (Shunn)"
- Bei Auswahl Manuscript: zusätzliche Felder (Author, Adresse, Wordcount-Override) erscheinen im Modal
- Submit → IPC `export:run` mit `{ format: 'manuscript', author, address, ... }`

**Risiken:**
- Shunn-Format ist underspecified am Rand (Headers/Footers, Page-Numbers in Word-Counts). Strikt nach https://shunn.net/format/story.html implementieren
- Wer ein Buch (nicht Short Story) einreicht, will andere Variante (`book.html`) — Variant-Selector im Dialog

### Aufwand
**1 Tag.** Hauptarbeit: Shunn-Preamble korrekt in Typst nachbauen + Dialog-Felder.

---

## Zusammenfassung & vorgeschlagene Reihenfolge

| # | Feature | Aufwand | Audience | Block-Wert |
|---|---------|---------|----------|------------|
| 1 | Find in Project | ✅ | beide | hoch — ohne nicht skalierbar |
| 2 | Footnote-UI | ✅ | beide | hoch — täglich genutzt |
| 5 | Outline drag-to-reorder | 1 Tag | beide | hoch — User-Reibung |
| 4 | Comments/Annotations | ✅ | beide | hoch — Betreuer-Workflow |
| 3 | Cross-References | 1,5–2 Tage | akademisch | mittel-hoch |
| 6 | Reading Mode | ✅ | Prosa | mittel |
| 7 | Inline Source Preview | 1 Tag | akademisch | mittel |
| 8 | Backlinks | ✅ | beide | mittel |
| 9 | Manuscript Export | 1 Tag | Prosa | niedrig — Nische |

**Gesamtaufwand:** ~10–12 Werktage für alle 9 Features.

**Empfohlene Reihenfolge** (Quick-Wins zuerst, dann tiefe Features):

1. **Reading Mode** (½–1 Tag) — sofortiger Polish-Effekt, simpel
2. **Find in Project** (1 Tag) — entscheidet Skalierbarkeit
3. **Backlinks** (½ Tag) — kommt fast gratis nach #2
4. **Footnote-UI** (1–1,5 Tage) — beide Audiences zufrieden
5. **Outline drag-to-reorder** (1 Tag) — sehr sichtbarer UX-Gewinn
6. **Cross-References** (1,5–2 Tage) — akademisch unverzichtbar
7. **Comments/Annotations** (2 Tage) — eigenes Mini-System
8. **Inline Source Preview** (1 Tag) — abgerundet
9. **Manuscript Export** (1 Tag) — letzte Audience-Erweiterung

**Sinnvolle Mini-Releases:**
- **Polish-Sprint** (#1, #2, #3, #6): 3–4 Tage → „v0.8 — Writer-Polish"
- **Annotation-Sprint** (#4, #5): 3 Tage → „v0.9 — Collaboration & Structure"
- **Reference-Sprint** (#3, #7, #8): 3 Tage → „v0.10 — Academic Polish"
- **Audience-Erweiterung** (#9): einzeln nachschieben

---

## Anhang: betroffene Dateien pro Feature (Quick-Reference)

| Feature | Backend | Frontend | Editor |
|---------|---------|----------|--------|
| Find in Project | [ipcHandlers.ts](src/main/ipcHandlers.ts), [persistenceManager.ts](src/main/persistenceManager.ts), [preload-entry.ts](src/main/preload-entry.ts) | neu: `ProjectSearchPanel.svelte`; [appState.svelte.ts](src/renderer/appState.svelte.ts) | – |
| Footnote-UI | – | neu: `FootnoteEditor.svelte` | neu: `typstFootnote.ts` (Extension); [serializer.ts](src/editor/lib/serializer.ts), [deserializer.ts](src/editor/lib/deserializer.ts) |
| Cross-References | [ipcHandlers.ts](src/main/ipcHandlers.ts) | neu: `ReferencePicker.svelte` | neu: `typstReference.ts`; [serializer.ts](src/editor/lib/serializer.ts), [deserializer.ts](src/editor/lib/deserializer.ts) |
| Comments | [ipcHandlers.ts](src/main/ipcHandlers.ts), [persistenceManager.ts](src/main/persistenceManager.ts) | neu: `CommentsPanel.svelte`; [appState.svelte.ts](src/renderer/appState.svelte.ts) | neu: `commentMark.ts` (Mark-Extension) |
| Outline reorder | – | [OutlinePanel.svelte](src/renderer/components/OutlinePanel.svelte) | – |
| Reading Mode | [menuBuilder.ts](src/main/menuBuilder.ts) | [appState.svelte.ts](src/renderer/appState.svelte.ts), [App.svelte](src/renderer/App.svelte), [messageHandler.ts](src/renderer/messageHandler.ts) | – |
| Inline Source Preview | [ipcHandlers.ts](src/main/ipcHandlers.ts) | neu: `CitationHoverCard.svelte` | – (Hover-Plugin) |
| Backlinks | [ipcHandlers.ts](src/main/ipcHandlers.ts) | neu: `BacklinksPanel.svelte` (oder als Erweiterung von ProjectSearch) | – |
| Manuscript Export | [importExport.ts](src/main/importExport.ts), neu: `src/shared/manuscript-preamble.typ` | [ExportDialog.svelte](src/renderer/components/ExportDialog.svelte) | – |
