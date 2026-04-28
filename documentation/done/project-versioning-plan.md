# vswrite Desktop — Implementierungsplan: Projekt-Versionierung & Auto-Backup

> Plan-Datum: 2026-04-27 | Status: Entwurf | Vorbedingung: Aktuelle Code-Basis (0.7.0 Pre-Release)

---

## 0. Zusammenfassung

Das aktuelle Git-Panel ([src/renderer/components/GitPanel.svelte](src/renderer/components/GitPanel.svelte)) exponiert rohe Git-Konzepte (Stage, Unstage, Commit, Push, Pull, Branch), die für nicht-technische Schreibende eine eigene Anleitung erfordern. Dieser Plan ersetzt das Git-Panel durch ein **„Projekt"-Panel** mit drei klar getrennten, intuitiv benannten Schichten — Git bleibt als Speicher-Engine darunter, ist aber im UI unsichtbar.

**Kernprinzip:** Jedes vswrite-Projekt ist self-contained. Backups, AI-Snapshots und Git-Historie liegen alle innerhalb des Projektordners. Wer das Projekt kopiert/verschiebt/teilt, nimmt seinen vollständigen Verlauf mit.

---

## 1. Drei-Schichten-Modell

| Schicht | Auslöser | Zweck | Persistenz | UI |
|---|---|---|---|---|
| **Auto-Backup** | Timer (konfigurierbar, Default 30 s) | Crash-/Hänger-Schutz | `<projekt>/.vswrite/backups/` | Status-Zeile + Backup-Liste |
| **Versionen** (Git) | Nutzer-Klick „Version speichern" | Bewusste Meilensteine | `<projekt>/.git/` | Verlauf-Liste (immer sichtbar) |
| **AI-Edit-Undo** | AI-Tool ändert Datei extern | Schnelles Rückgängig nach AI-Edits | `<projekt>/.vswrite/ai-snapshots/` | Bestehender „AI-Edit rückgängig"-Button |

**Wichtig:** Diese drei Systeme sind unabhängig. Eine Auto-Backup-Wiederherstellung erzeugt **keine** Version. Ein AI-Edit erzeugt **keinen** Verlaufseintrag. Der Nutzer entscheidet bewusst, was eine „Version" wird.

---

## 2. Projektordner-Struktur

```
mein-projekt/
├── main.typ
├── chapter1.typ
├── settings.typ
├── images/
├── .git/                              ← Versionen (Git-Repo)
├── .gitignore                         ← schließt .vswrite/ aus
└── .vswrite/                          ← versteckt, projekt-lokal
    ├── backups/
    │   ├── 2026-04-27_14-32-15/       ← Ordner pro Snapshot
    │   │   ├── main.typ
    │   │   ├── chapter1.typ
    │   │   └── settings.typ
    │   └── 2026-04-27_14-33-45/
    │       └── …
    └── ai-snapshots/
        ├── 001_2026-04-27_14-30-02.json   ← Ringpuffer (max N Einträge)
        └── 002_2026-04-27_14-31-15.json
```

**Designentscheidungen:**
- **Ordner-pro-Snapshot statt Zip:** Im Notfall („App startet nicht mehr") sieht der Nutzer im Finder direkt seine Klartext-Dateien. Bei reinen Typst-Dateien ist der Speicherbedarf vernachlässigbar.
- **Punkt-Präfix `.vswrite/`:** Versteckt in Finder/Explorer, kein visueller Lärm, paralleles Vorbild: `.git/`.
- **`.gitignore` schließt `.vswrite/` aus:** Sonst würden Backups in die Git-Historie gespült und `.git/` aufgebläht. Beim Projektanlegen wird `.gitignore` automatisch mit dem Eintrag versehen; bei bestehenden Projekten beim ersten Backup ergänzt.
- **AI-Snapshots als JSON:** Müssen pro Datei den vorherigen Inhalt + Metadaten halten (Pfad, Timestamp). JSON pro Eintrag ist einfacher zu verwalten als ein wachsendes Logfile.

---

## 3. UI-Änderungen

### 3.1 Neues `ProjectPanel.svelte` (ersetzt `GitPanel.svelte` 1:1)

Sechs Bereiche, von oben nach unten:

| # | Bereich | Inhalt |
|---|---------|--------|
| 1 | **Projekt-Header** | Projektname, Pfad, „Im Finder zeigen"-Button |
| 2 | **„Version speichern"-Card** | Großer primärer Button + Namensfeld („Was hast du gerade fertig?"). Ausgegraut, wenn keine Änderungen vorhanden. |
| 3 | **Änderungen seit letzter Version** | Liste aller geänderten Dateien mit Checkbox („In nächste Version aufnehmen"), alle standardmäßig angehakt. Bei einer einzigen Datei: kompakte Einzeilen-Anzeige. |
| 4 | **Verlauf** (immer sichtbar, scrollbar) | Chronologische Liste der Versionen. Pro Eintrag: Titel, Datum, optional Diff-Vorschau-Icon. Klick öffnet Detail-Panel mit Diff + „Wiederherstellen". |
| 5 | **Auto-Backup-Status** | Kleine Zeile am unteren Rand: „Letztes Auto-Backup: vor 12 s". Klick öffnet Backup-Auswahl-Dialog. |
| 6 | **„Erweitert" (zugeklappt)** | Cloud-Sync-Buttons: Push („Mit Cloud-Backup synchronisieren"), Pull („Cloud-Backup laden"), Remote-URL-Setup. |

### 3.2 Verlauf-Detail-Panel (Slide-In oder Modal)

Bei Klick auf einen Verlauf-Eintrag:
- Titel + Datum + Autor (falls Git-Config gesetzt)
- **Diff-Anzeige im Quelltext-Stil:** Rote/grüne Zeilen pro geänderter Datei (wie GitHub-Diff). Implementierung: `git show <sha>` parsen.
- Buttons:
  - „Diese Version wiederherstellen" → `git checkout <sha> -- <files>` (alle Dateien dieser Version)
  - „Schließen"

### 3.3 Auto-Backup-Auswahl-Dialog

Bei Klick auf die Backup-Status-Zeile:
- Liste aller gespeicherten Backups (Datum, Uhrzeit, Größe)
- Pro Eintrag: „Laden"-Button
- Beim Laden: **Warndialog** „Aktueller Stand wird durch Backup ersetzt — vorher Version speichern?" mit Optionen „Erst Version speichern" / „Trotzdem laden" / „Abbrechen"
- Nach dem Laden: Backup-Inhalt ersetzt Working-Tree → normaler „Version speichern"-Flow greift

### 3.4 Settings-Erweiterung (in bestehendem Settings-Panel)

Neuer Abschnitt **„Auto-Backup"**:
- **Intervall:** Slider 10 s – 5 min (Default 30 s)
- **Maximale Anzahl gespeicherter Backups:** Auswahl 10 / 30 / 100 / unbegrenzt (Default 30)
- **Speicherort anzeigen:** Button „Backup-Ordner öffnen" (öffnet `<projekt>/.vswrite/backups/` im Finder)

Optional, falls gewünscht — neuer Abschnitt **„AI-Edit-Verlauf"**:
- **Maximale Anzahl gespeicherter AI-Snapshots:** Default 20 (entspricht heutigem `MAX_AI_SNAPSHOTS`)

### 3.5 Was wegfällt aus dem alten Git-Panel

| Alt | Neu |
|-----|-----|
| Branch-Anzeige | entfällt (Branches sind kein Schreiber-Konzept) |
| Ahead/Behind-Badges | nur sichtbar im „Erweitert"-Bereich |
| Stage/Unstage als separate Listen | ersetzt durch Checkboxen in einer Liste |
| „Initialize Git"-Button | entfällt, automatisch beim Projektanlegen |
| `+`/`−`-Icons pro Datei | ersetzt durch Checkbox |

---

## 4. Backend-Änderungen

### 4.1 Erweiterung [src/main/gitManager.ts](src/main/gitManager.ts)

**Neue Funktionen:**
- `git:log` — Liste aller Commits mit `{sha, message, date, author}`
- `git:show` — Diff eines bestimmten Commits (`git show <sha> --stat` + Patches)
- `git:restoreVersion` — `git checkout <sha> -- <files>` zum Wiederherstellen
- `git:saveVersion` — High-Level-Wrapper: `git add <selected files>` + `git commit -m <message>`. Ersetzt die getrennten `git:stage` / `git:commit` aus Schreiber-Sicht (die alten Channels bleiben für Power-User erreichbar).
- `git:ensureRepo` — Beim Projektöffnen: prüfen ob `.git/` existiert, sonst `git init` + `.gitignore` mit `.vswrite/`-Eintrag anlegen.

**Bestehend, bleibt:** `git:status`, `git:push`, `git:pull` (für „Erweitert"-Bereich)

### 4.2 Umbau [src/main/persistenceManager.ts](src/main/persistenceManager.ts)

**Heute:** `app.getPath('userData')/backups/` (global, single-file)
**Neu:** `<projekt>/.vswrite/backups/<timestamp>/` (projekt-lokal, multi-file)

**Neue Funktionen:**
- `saveBackup(projectDir, files)` — Schreibt alle aktuell geöffneten/geänderten Dateien in einen neuen Timestamp-Ordner.
- `listBackups(projectDir)` — Liest alle Backup-Ordner, sortiert chronologisch.
- `loadBackup(projectDir, timestamp)` — Liest Dateiinhalte eines Backups zurück (in Memory; Schreiben in den Working-Tree macht der Aufrufer).
- `pruneBackups(projectDir, maxCount)` — Löscht älteste Backups, wenn Limit überschritten.
- `getBackupConfig()` / `setBackupConfig({intervalSec, maxCount})` — gespeichert in electron-store (global, gilt für alle Projekte).

**Crash-Recovery-Flow ([fileManager.ts:113-125](src/main/fileManager.ts#L113-L125)):**
Bleibt erhalten, wird aber auf die neue projekt-lokale Backup-Liste umgestellt: Beim Projektöffnen prüfen, ob das jüngste Backup neuer ist als die zuletzt gespeicherte Version → Recovery-Dialog.

### 4.3 Umbau AI-Snapshots ([src/main/fileManager.ts:22-68](src/main/fileManager.ts#L22-L68))

**Heute:** In-Memory-Ringpuffer, beim App-Neustart weg.
**Neu:** Ringpuffer wird zusätzlich nach `<projekt>/.vswrite/ai-snapshots/` persistiert.

**Verhalten:**
- Bei `pushAiSnapshot()`: zusätzlich JSON-Datei schreiben
- Bei `popAiSnapshot()`: zusätzlich entsprechende JSON-Datei löschen
- Beim Projektöffnen: vorhandene AI-Snapshots aus dem Ordner laden (Ringpuffer rekonstruieren)
- Limit `MAX_AI_SNAPSHOTS` weiterhin 20 (oder konfigurierbar via Settings, siehe 3.4)

**API bleibt unverändert:** `pushAiSnapshot()`, `popAiSnapshot()`, IPC `aiSnapshotCount` — nur die Persistenz wird ergänzt.

### 4.4 Projektanlage anpassen [src/main/projectManager.ts](src/main/projectManager.ts)

Beim Anlegen eines neuen Projekts zusätzlich:
1. `git init` ausführen
2. `.gitignore` mit Standardinhalt anlegen:
   ```
   .vswrite/
   *.pdf
   ```
3. `.vswrite/` und Unterordner `backups/`, `ai-snapshots/` anlegen (lazy beim ersten Backup ist auch ok)
4. Initial-Commit mit Projekt-Templates: „Initiale Version"

---

## 5. Neue IPC-Channels

Alle in [src/main/preload-entry.ts](src/main/preload-entry.ts) zur Whitelist hinzufügen.

| Channel | Pattern | Payload | Rückgabe |
|---------|---------|---------|----------|
| `project:saveVersion` | invoke | `{ message: string, files?: string[] }` | `{ sha: string }` |
| `project:listVersions` | invoke | — | `Array<{sha, message, date, author}>` |
| `project:showVersion` | invoke | `{ sha: string }` | `{ files: Array<{path, diff, status}> }` |
| `project:restoreVersion` | invoke | `{ sha: string, files?: string[] }` | `{ ok: boolean }` |
| `project:listBackups` | invoke | — | `Array<{ timestamp, fileCount, sizeBytes }>` |
| `project:loadBackup` | invoke | `{ timestamp: string }` | `{ files: Array<{path, content}> }` |
| `project:getBackupConfig` | invoke | — | `{ intervalSec, maxCount }` |
| `project:setBackupConfig` | invoke | `{ intervalSec, maxCount }` | `{ ok: boolean }` |
| `project:openBackupFolder` | invoke | — | `{ ok: boolean }` |

**Alte Git-Channels** (`git:stage`, `git:unstage`, `git:stageAll`, `git:commit`, `git:init`, `git:push`, `git:pull`, `git:status`) bleiben erreichbar, werden aber im Standard-UI nicht mehr verwendet (nur „Erweitert"-Bereich nutzt `git:push` / `git:pull` / `git:status`).

---

## 6. Migrationsstrategie

**Bewusst minimal**, da noch keine zahlenden Kunden:
- Alte Backups in `app.getPath('userData')/backups/` werden **ignoriert** (nicht migriert, nicht gelöscht). Können vom Nutzer bei Bedarf manuell gelöscht werden.
- Bestehende Projekte ohne `.vswrite/`-Ordner: lazy beim ersten Backup angelegt. Kein Migrations-Prompt.
- Bestehende Projekte ohne `.git/`: beim ersten „Version speichern"-Klick wird `git init` durchgeführt + `.gitignore` ergänzt.

---

## 7. Phasen / Milestones

### Phase 1: Backend-Fundament (1–2 Tage)
- [ ] [persistenceManager](src/main/persistenceManager.ts) auf projekt-lokale Backups umstellen
- [ ] [gitManager](src/main/gitManager.ts) um `git:log`, `git:show`, `git:restoreVersion`, `git:saveVersion`, `git:ensureRepo` erweitern
- [ ] AI-Snapshots in [fileManager](src/main/fileManager.ts) zusätzlich persistieren
- [ ] [projectManager](src/main/projectManager.ts): Projekt-Anlage erweitern (`git init` + `.gitignore` + `.vswrite/`)
- [ ] Neue IPC-Channels in [preload-entry.ts](src/main/preload-entry.ts) whitelisten
- [ ] Settings-Keys für Backup-Config in electron-store

### Phase 2: Frontend-Umbau (2–3 Tage)
- [ ] `ProjectPanel.svelte` neu schreiben (ersetzt `GitPanel.svelte`)
- [ ] Verlauf-Detail-Komponente mit Diff-Renderer (Quelltext-Stil)
- [ ] Auto-Backup-Auswahl-Dialog
- [ ] Settings-Panel: Abschnitt „Auto-Backup"
- [ ] Auto-Backup-Status-Zeile mit Live-Update
- [ ] Bestehende Aufrufe von `git:*` aus dem Renderer ersetzen

### Phase 3: Polish & Testing (1 Tag)
- [ ] Crash-Recovery-Flow auf neue Backup-Struktur testen
- [ ] Multi-File-Diff korrekt rendern (mehrere Kapitel)
- [ ] Edge-Cases: Projekt ohne `.git/`, Projekt mit fremder `.gitignore`, sehr viele Verlaufseinträge (Performance)
- [ ] Lock-Manager-Kompatibilität bei Dropbox/iCloud-Projekten verifizieren
- [ ] [handbuch.md](documentation/handbuch.md) und [handbook.md](documentation/handbook.md) aktualisieren — Git-Sektion entfernen, „Versionen" / „Auto-Backup" dokumentieren

### Phase 4 (optional, später): Cloud-Sync-UX
- [ ] „Erweitert"-Bereich mit geführtem GitHub-Setup-Dialog
- [ ] „Mit Cloud synchronisieren"-Button mit Status-Feedback
- [ ] Konflikterkennung bei Pull mit nutzerverständlichem Dialog

---

## 8. Risiken & offene Punkte

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Auto-Backup-I/O bei großen Multi-Chapter-Projekten (40+ Dateien) | Performance | Backup nur für **geänderte** Dateien schreiben (verglichen mit letztem Backup), nicht das ganze Projekt jedes Mal |
| `.vswrite/`-Ordner wird vom Nutzer manuell gelöscht | Datenverlust nur bei Backups; Versionen sind in `.git/` sicher | Akzeptabel — Versionen sind wichtiger und liegen anderswo |
| Git-Repo-Korruption bei Stromausfall mitten im Commit | Selten, aber möglich | simple-git nutzt git-CLI, die atomar arbeitet — Standard-Git-Robustheit |
| Sehr lange Verlaufsliste (>1000 Versionen) → langsame Anzeige | UX | Pagination oder Virtual-Scroll im Verlauf-Panel |
| Diff-Anzeige bei sehr großen Dateien (z.B. 100 KB Typst-Quelle) | Performance | Diff-Größenlimit + Hinweis „Diff zu groß, anklicken zum Laden" |
| Multi-File-Auswahl beim Wiederherstellen einer alten Version | UX-Komplexität | Default: alle Dateien dieser Version wiederherstellen. Selektives Restore nur via Power-User-Menü. |

**Offen für später (nicht blocking):**
- Soll `git tag` als „Meilenstein-Markierung" (Stern-Icon) eingebaut werden? Würde Versionen visuell von Auto-/Quick-Saves trennen, falls wir später doch Auto-Commit ergänzen.
- Soll der Verlauf eine Suchfunktion haben (z.B. „Welche Version hatte 'Einleitung' im Namen")?
- Branching für „Was wäre wenn"-Szenarien (Schreibvarianten parallel verfolgen) — bewusst aus dem Standard-UI rausgehalten, könnte aber als „Erweitert"-Feature später ergänzt werden.

---

## 9. Anhang: Übersetzungstabelle Git → vswrite-UI

| Git intern | Button / Beschriftung | Wo |
|---|---|---|
| `git init` | *(automatisch beim Projektanlegen)* | — |
| `git status` | *(immer sichtbar via „Änderungen seit letzter Version")* | Projekt-Panel |
| `git add <file>` | Checkbox „in nächste Version aufnehmen" | Änderungsliste |
| `git reset HEAD <file>` | Checkbox aus | Änderungsliste |
| `git commit -m "…"` | **„Version speichern"** + Namensfeld | Hauptaktion |
| `git log` | „Verlauf" | Sidebar (immer sichtbar) |
| `git show <sha>` | „Diese Version anzeigen" | Klick auf Verlauf-Eintrag |
| `git diff <sha> HEAD` | „Was hat sich seitdem geändert?" | Versions-Detail |
| `git checkout <sha> -- file` | „Diese Version wiederherstellen" | Versions-Detail |
| `git push` | „Mit Cloud-Backup synchronisieren" | „Erweitert" |
| `git pull` | „Cloud-Backup laden" | „Erweitert" |
| `git stash` | *(weglassen)* | — |
| `git branch` / `merge` | *(weglassen)* | — |
