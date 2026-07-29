# App ↔ MCP — Paritäts-Audit

> Stand: 2026-07-28 · Anlass: der Style-Fix in `561c22e` war *eine* Instanz einer Klasse. Diese Untersuchung sucht den Rest.
> Frage: arbeiten Mensch (App) und KI (MCP) verlässlich am selben Projekt — schreiben beide dasselbe, sieht jede Seite, was die andere tut?
> Verwandt: [mcp-rebuild-plan.md](mcp-rebuild-plan.md) · [mcp-tool-audit.md](mcp-tool-audit.md)

---

## Stand nach Session 42 — Block 1 abgeschlossen

Alles unter „Restliste, priorisiert" aus der Verifikation unten ist gebaut, bis auf die dort genannten Reste. Kurzfassung; Details in [handover.md](handover.md).

| | Urteil | Was sich geändert hat |
|---|---|---|
| **P1 Schreiben** | **erfüllt** | `shared/projectScaffold` (alle vier Anlagewege, inkl. Skills und `.gitignore`) und `shared/assetPlacement` (eine Ablageregel, Dedup per Inhalt, nie ein Overwrite, Pfad relativ zur Zieldatei) schließen die letzten beiden Divergenzen ohne gemeinsamen Planer. |
| **P2 Lesen** | **erfüllt bis auf die Backups** | `penwright_render_page` — die KI sieht eine gerenderte Seite. Der Undo-Stack ist beidseitig lesbar. **Offen bleibt `history/VER-03`**: Auto-Backups sind für die KI unlesbar, aber ungeschützt beschreibbar. |
| **P3 Wissen** | **beidseitig, bewusst schmal** | `lastCompileOk` im Kanal (die KI unterscheidet einen selbst verursachten Bruch von einem vorbestehenden), `get_style` meldet `initialized`/`adopted`/`rootFile`, und `agent-activity.json` ist der **rein informative** Rückkanal: die App zeigt an, woran die KI arbeitet, und gehorcht ihm nicht. Kein Cursor, keine Auswahl, kein Puffer — der Kanal trägt nur, woraus eine **andere Entscheidung** folgt. |
| **P4 Schutz** | **erfüllt** | `shared/safeApply` — Staging → Verify → commit/rollback, Verifier + IO injiziert, auf beiden Seiten. Der Undo-Stack ist beidseitig sichtbar und bedienbar, mit **einer** Aufbewahrungsgrenze. Die Warnung vor ungespeicherter Arbeit hängt am Schreib-Guard statt an drei Tools. |

**Nicht mehr wahr:** *„Auf der Ebene der Dateien weitgehend eingelöst, auf der Ebene des Zustands noch nicht."* Die beiden Prozesse teilen jetzt auch eine Gegenwart.

**Was aus Klasse 1 offen bleibt:** `insert_design_element` bekommt `file` (2 h) · Backup-Tools (VER-03) · Design-Elemente für den Menschen · Magazin-Makros ins Skill · User-Presets für die KI · Handbuch als Resource. Nichts davon hat heutiges Schadenspotenzial.

---

## Verifikation (2026-07-28, nach neun Commits)

Ein zweiter Durchgang über die gesamte App hat geprüft, ob das Prinzip jetzt eingehalten wird — und zuerst, ob die gebauten Fixes überhaupt halten. **Sechs von acht hielten. Einer hatte eine harte Regression eingebaut**, gefunden, verifiziert und behoben in `f30fe0a`:

| Regression | Wirkung |
|---|---|
| `guardedWrite` wies den eigenen Menschen als Fremden ab | Die App sperrt jede geöffnete `.typ`; `isOwnLock` verlangt PID-Gleichheit, der MCP ist ein eigener Prozess → **die KI konnte genau die Datei nicht bearbeiten, über die gerade gesprochen wurde**, mit einer Meldung, die den Nutzer als Blockierer nannte |
| `publishSession()` lief eine Zeile zu früh | `session.json` nannte die **vorher** offene Datei — die KI zielte eine Datei hinterher |
| Der Server las die Session nur beim Prozessstart | Claude Desktop startet ihn einmal und er lebt Stunden — er zeigte bis zum Neustart auf das Projekt vom Morgen |

Zusammen: *die KI zielte auf die Datei von vorhin und wurde an der von jetzt abgewiesen.* Kein Test hatte das gefangen — der Lock-Test prüfte den Dropbox-Kollegen, nie den Alltagsfall gleicher Nutzer / gleiche Maschine.

Der Begriff, der im Code fehlte: **Ko-Präsenz** — dieselbe Person, zwei Werkzeuge. `isForeignEditor()` unterscheidet das jetzt: fremder Nutzer oder fremde Maschine bleibt harte Ablehnung, die eigene App wird gesnapshottet und geschrieben.

### Stand pro Prinzip

| | Urteil | Begründung |
|---|---|---|
| **P1 Schreiben** | teilweise | Wo ein gemeinsamer Planer existiert (`planStyleWrites`, `planBibliography`, `planPrintExport`, `splitIntoChapters`, `commentManager`), ist die Forderung **wörtlich** erfüllt — dieselben Pfade, dieselben Bytes, nachgemessen. Wo keiner existiert, driftet alles: Projektanlage, Kapitel-Include, Bild-Ablage, `.gitignore`. |
| **P2 Lesen** | teilweise | Alle Textinhalte sind beidseitig lesbar, oft über dieselbe Funktion. Aber: **alles, was nicht als Datei im Projekt liegt, ist für die KI unsichtbar** — der gerenderte PDF-Zustand, die Auto-Backups, der Undo-Stack. Umgekehrt erzeugt die KI mit den 24 Design-Elementen etwas, wofür der Mensch keine Oberfläche hat. |
| **P3 Wissen** | schwächste Achse | Nach `f30fe0a` zielt der Kanal richtig und wird laufend gelesen. Er bleibt aber **einseitig** (nur App → MCP) und trägt **vier Felder**: Projekt, Datei, Dirty, PID. Kein Cursor, keine Auswahl, keine Vorschauseite, kein „kompiliert das gerade". Die App kann nicht anzeigen, woran die KI arbeitet. |
| **P4 Schutz** | nicht erfüllt | Die App verifiziert jede Design-Änderung per Testkompilat und rollt zurück; der MCP schreibt dieselben Dateien ungeprüft. Und der „Rückgängig"-Knopf im Design-Panel behauptet nach einer KI-Änderung etwas Falsches und löscht sie beim Druck mit. |

### Was heute verlässlich geht

Design-Tokens von beiden Seiten byte-identisch, mit demselben Guard · Bibliografie (ein Ort, eine Aufrufstelle) · Kommentare · Versionen inklusive Lazy-git-init · Suche, Querverweise, Quellen-PDFs · **und seit `f30fe0a` auch: die KI die gerade offene Datei bearbeiten lassen.**

### Was nicht

Sich darauf verlassen, dass die KI weiß, wie das Dokument *aussieht* — sie hat es nie gesehen · Design von der KI ändern lassen ohne Absturzrisiko (kein Verify, kein Rollback) · KI-Änderungen an mehreren Dateien zurücknehmen (die Snapshots liegen auf der Platte und sind im Verlaufs-Hub unsichtbar) · erwarten, dass die KI die Projektkonventionen kennt (in praktisch jedem real entstandenen Projekt fehlen alle fünf Skills).

### Restliste, priorisiert

**Klasse 1 — echte Asymmetrie mit heutigem Nutzerschaden (~30 h nach Abzug des Erledigten):**
`safeApplyMcp` (Verify/Rollback über die Prozessgrenze, 4–5 h) · Undo-Netz lesbar machen — `listSnapshots` hat **null Produktivaufrufer** (4–5 h) · `unsavedEditsNote` in `guardedWrite` hochziehen statt an 3 von 28 Tools (1,5 h) · `insert_design_element` bekommt `file` (2 h) · Skills auf allen Anlagewegen — **0 von 35 Presets** haben `.claude/` (3 h) · Snapshot-Schleife in `replaceInProject`/`restore_version`/Kommentar-Tools/`textfile:write` (4 h) · `shared/projectScaffold.ts` (6 h) · `shared/assetPlacement.ts` — die App überschreibt heute still ein gleichnamiges Bild (3 h) · `get_style` liefert `initialized`/`rootFile` (1 h) · Design-Undo ehrlich machen (2–5 h).

**Klasse 2 — fehlende Fähigkeiten:** `penwright_render_page` (die KI sieht eine gerenderte Seite) · Backup-Tools · Design-Elemente für den Menschen · Magazin-Makros ins Skill · User-Presets für die KI · Handbuch als Resource.

### Was bewusst asymmetrisch bleibt

- **Die Export-Sandbox der KI.** Der Mensch wählt per Dialog frei und trägt die Entscheidung; das Modell darf nicht irgendwohin schreiben. Richtige Richtung der Ungleichheit.
- **Der Zustandskanal bleibt einseitig.** Nur die App schreibt `session.json` — ein veralteter Agentenstand darf die App nicht steuern. Ein Rückkanal wäre rein informativ.
- **Echte Fremd-Locks bleiben harte Ablehnung.** Der Ko-Präsenz-Fix entschärft nur dieselbe Person auf derselben Maschine.
- **Kein Compile-Verify vor gewöhnlichen Textänderungen** — auf beiden Seiten. Der Verify gehört an Design-Mutationen, weil dort eine einzelne Änderung global bricht.
- **Zwei Undo-Systeme dürfen bestehen bleiben** — sie lösen verschiedene Probleme. Sie müssen nur beide von beiden Seiten sichtbar sein.

**Schlussurteil:** *Auf der Ebene der Dateien weitgehend eingelöst, auf der Ebene des Zustands noch nicht.* Die beiden Prozesse teilen Dateien, aber sie teilen keine Gegenwart.

---

## Die Antwort (Ausgangsbefund, 2026-07-28 vormittags)

**Nein, heute nicht.** Nicht „mit Einschränkungen" — die Kernschleife bricht in ihrer wahrscheinlichsten Ausprägung, und sie bricht **still**.

82 Befunde über sechs Domänen, nach Zusammenführung **31 eigenständige Sachverhalte**, davon 13 kritisch und 30 hoch. Alle bis auf einen am Code belegt.

Der wichtigste Einzelbefund: **`561c22e` war entwaffnbar.** „Version speichern" → `git:ensureRepo` → `ensureProjectInfrastructure` → `ensureStyleFile` legte bedingungslos eine Default-`style.json` an — und genau darauf hatte der Guard konditioniert. Ein Klick auf den harmlosesten Knopf der Oberfläche gab die Erlaubnis, das Autorendesign zu überschreiben, dauerhaft und auf beiden Seiten. **Behoben in `c744ce5`**: Adoption ist jetzt der Marker in `style.typ` und sonst nichts; `ensureStyleFile` fragt dieselbe Funktion und schreibt für ein handdesigntes Projekt gar nichts mehr.

Ebenfalls in `c744ce5` behoben: `penwright_add_image` schrieb einen projektrelativen Bildpfad in eine Kapiteldatei. Typst löst Bildpfade **dateirelativ** auf — jeder KI-Bildimport in ein Kapitel machte das gesamte Dokument nicht mehr kompilierbar. Empirisch belegt, Fix gegen die gebündelte Typst-Binary verifiziert.

---

## Wo es bricht

**Der wahrscheinlichste Verlustfall, Schritt für Schritt:**

Du schreibst in einem Kapitel und bittest die KI parallel um eine Änderung an derselben Datei. Fällt der MCP-Schreibvorgang in die 3 Sekunden nach einem Autosave — bei stoßweisem Tippen der Normalfall — verwirft der Watcher das Ereignis **vollständig** ([fileManager.ts:556](../src/main/fileManager.ts#L556)). Kein Editor-Update, kein Dateibaum-Refresh, **kein AI-Snapshot**, kein Recompile. Dein nächster Tastendruck löst ein Autosave aus, das den unveränderten In-Memory-Puffer über die Datei schreibt. Die Arbeit der KI ist weg, ohne je auf dem Bildschirm gewesen zu sein, und es gibt keinen Wiederherstellungspfad — der Snapshot, der sie gerettet hätte, wurde im selben verworfenen Zweig nicht angelegt. Die KI hat „Kapitel aktualisiert" gemeldet.

Zur Reproduktion wichtig: das Fenster ist **nicht** dauerhaft offen. Der Autosave ist nachrüstend, durchgehendes Tippen erreicht die Platte nie. Es öffnet sich 1 s nach einer Tipp-Pause und schließt 3 s später. Wer den Fehler nachstellen will: tippen, kurz pausieren, den MCP-Aufruf in den folgenden 3 Sekunden auslösen.

**Ändert die KI eine andere Datei** als die geöffnete, kommt die Änderung durch — aber die PDF-Vorschau rekompiliert nicht (`compilePdf()` steht nur im `currentFilePath`-Zweig). Du beurteilst die KI-Arbeit an einem PDF, das lügt.

**Ändert die KI das Design**, entsteht nicht einmal ein Ereignis: `**/.penwright/**` ist im Watcher ignoriert. Das Design-Panel hält seinen Mount-Snapshot und schreibt beim nächsten Reglerklick den **kompletten** veralteten Zustand zurück. Die Palette der KI ist weg, und es sieht aus, als hätte Claude nichts getan.

**Umgekehrt** kennt die KI weder das Projekt (`buildMcpEnv` setzt kein `PENWRIGHT_PROJECT_DIR`, der Server sandboxt gegen `process.cwd()`) noch die geöffnete Datei (`state.currentFile` ist die Wurzel, du siehst ein Kapitel) noch den ungespeicherten Puffer. „Schreib den letzten Absatz um" trifft strukturell die falsche Datei. Wer eine gerade getippte Passage anpinnt und übergibt, übergibt einen Anker, der auf der Platte noch nicht existiert.

**Bei einem Mehrdatei-Umbau hast du kein Netz:** kein AI-Snapshot (nur die offene Datei), kein Auto-Backup (nur die offene Datei, und der Timer wird nur durch menschliches Tippen scharfgestellt), kein Design-Undo (kennt MCP-Writes nicht), keine Version (nur wenn die KI daran denkt).

---

## Die fünf Wurzeln

| | Wurzel | Funde | Charakter |
|---|---|---:|---|
| **R0** | Ein Schutz, dessen Vorbedingung von außen erodierbar war | 1 | ✅ behoben in `c744ce5` |
| **R1** | Es gibt keinen Kanal App → MCP | 13 | Der MCP kennt weder Projekt, offene Datei, dirty-Puffer noch Locks |
| **R2** | Der Kanal MCP → App ist der Watcher, und er hat fünf Löcher | 10 | globaler 3-s-Guard · `.penwright/**` ignoriert · Recompile nur für `currentFilePath` · `.typ`/`.bib`-Filter · `depth: 3` |
| **R3** | Die vier Sicherungsschichten sind einseitig | 7 | Nur Git ist beidseitig erreichbar |
| **R4** | Doppelte Implementierung statt shared/-Modul | 24 | die `styleWrite.ts`-Klasse |

**Die Verteilung ist die eigentliche Nachricht.** R4 — die Klasse, die `561c22e` adressiert hat — ist die *größte*, aber mit Abstand nicht die *gefährlichste*. **Kein einziger Fall von stillem, unwiederbringlichem Datenverlust liegt in R4.** Sie liegen alle in R0, R2 und R3. Wer die Paritätsarbeit als reine „Module zusammenführen"-Aufgabe plant, arbeitet an der falschen Hälfte.

---

## Was nachweislich sauber ist — nicht anfassen

- **Der Design-Schreibpfad selbst.** `planStyleWrites` / `readProjectStyleWithCustom` / `resolveDesignRoot` werden von beiden Seiten benutzt. `section:apply` staged korrekt in `safeApplyDesign`.
- **Vier Module sind buchstäblich geteilt** (per Import verifiziert, `server.ts:62-65`): `commentManager`, `projectLabels`, `projectSearch`, `citationSources`. Eine Implementierung, gleiche Regex, gleiche Caps. Die Divergenzen liegen bei den *Aufrufern*, nicht in den Modulen.
- **Die Temp-Datei-Konvention.** Beide schreiben `.penwright-*`, der Watcher ignoriert sie, beide `.gitignore`-Varianten enthalten die Zeile. Ein MCP-Export löst kein Flackern und keinen falschen Snapshot aus.
- **Git-Lesepfade.** `listVersions`, `showVersion`, `parseUnifiedDiff`, SHA-Validierung, `shared/gitIdentity.ts` — heute Zeile für Zeile deckungsgleich, die App sieht MCP-Commits (`ProjectPanel` pollt alle 8 s). *Aber:* Duplikat ohne Schutz — die Divergenz von morgen.
- **Sanitizer** (`sanitizeProjectStyle`/`sanitizeSection`), **Kapitel-Opt-in-Block** (`ensureSectionStyle`/`clearSectionStyle`), **Encoding** (beidseitig utf-8 ohne BOM), **der Reload-Pfad selbst** — wenn der Guard ihn durchlässt, ist er richtig gebaut.

---

## Der kleinste Satz, nach dem es verlässlich geht

Sieben Punkte, **6–8 Personentage**. Zwei davon sind erledigt.

| # | Maßnahme | Aufwand | Status |
|---|---|---:|---|
| 1 | `ensureStyleFile` legt bei handgeschriebener `style.typ` nichts an | 0,5 h | ✅ `c744ce5` |
| 2 | **Watcher-Provenienz statt Zeitfenster** — `Map<abs, sha256>` eigener Writes; Fremdinhalt wird *immer* verarbeitet | 6 h | offen |
| 3 | `saveFile` prüft vor dem Schreiben gegen die Platte; bei Abweichung nicht überschreiben, sondern Fremdstand snapshotten und Konflikt sichtbar machen | 6 h | offen |
| 4 | Invalidierung erweitern: `.penwright/style.json`+`selection.json` aus dem Ignore; Recompile für jede `.typ` im Kompilierbaum; `comments/*.md` in den Refresh; `depth: 6` | 4 h | offen |
| 5 | `.penwright/session.json` — App schreibt, MCP liest (`currentFile`, `isDirty`, Projektpfad) | 8 h | ✅ `31b0476` |
| 6 | Der MCP legt vor jedem mutierenden Write selbst einen Snapshot an und prüft `checkLock` | 10 h | ✅ `31b0476` |
| 7 | `add_image` relativiert gegen die Zieldatei | 1 h | ✅ `c744ce5` |

**Der Minimalsatz ist damit vollständig.** Was aus Punkt 5 bewusst offen blieb: der `file`-Parameter für die Anker-Tools (`insert_design_element` schreibt weiterhin nach `currentFile`, ohne eigenen Zielparameter) — der gehört in Phase C2 des Umbauplans, wo die Zielauflösung ohnehin angefasst wird.

Zwei Dinge, die beim Umbau nebenbei auffielen und ebenfalls behoben sind: die Watcher-Ignore-Liste war **seit dem chokidar-4-Upgrade komplett wirkungslos** (Globs werden dort mit `===` verglichen), und `lockManager` lag in `main/`, obwohl es electron-frei ist — beide Prozesse nutzen es jetzt aus `shared/`.

### Restrisiko danach — gehört in die Release-Notiz

- **Echte Gleichzeitigkeit auf derselben Datei bleibt Last-Writer-Wins.** Punkt 3 macht die Kollision *sichtbar* und *sicherbar*, nicht auflösbar. Ein Textmerge auf Typst-Quelltext ist machbar und deutlich mehr Arbeit — Produktentscheidung, nicht technisch.
- **Nicht-atomare Writes.** Weder App noch MCP schreiben über temp+rename, der Watcher läuft ohne `awaitWriteFinish`. Ein gerissener Read ist nicht beobachtet, aber es gibt keine einzige Schutzmaßnahme. `awaitWriteFinish: { stabilityThreshold: 200 }` + ein gemeinsames `writeFileAtomic` kosten zusammen unter vier Stunden.
- **Windows.** `changedPath === appState.currentFilePath` ist separator- und case-sensitiv. Auf keinem echten Gerät geprüft.
- **`git checkout` als Massenschreiber** — ob pro Datei ein Ereignis kommt oder gebündelt, nicht zur Laufzeit gemessen.

---

## Einordnung in den Umbauplan

Der Plan optimiert den MCP-Server. **Kein einziges seiner Items macht MCP-Arbeit in der laufenden App sichtbar.** Nach vollständiger Ausführung aller sechs Phasen wäre der Server exzellent — und die App würde von seiner Arbeit immer noch nichts mitbekommen. Drei Ergänzungen sind plan-fremd und müssen rein:

**Phase A wächst um drei Items:**
- **A1b** ✅ erledigt (`c744ce5`)
- **A3** um `add_image` erweitert ✅ erledigt (`c744ce5`)
- **A4 (neu, ~6 h): Watcher-Provenienz.** Muss vor den Umbau, weil Phase D (`safeApplyMcp` + Undo-Journal) das MCP-Schreibvolumen erhöht. Ein Undo-Journal auf einem Watcher, der Ereignisse verwirft, zementiert den Defekt in einer neuen Schicht. Außerdem Voraussetzung dafür, dass die Absicherung von D3 reproduzierbar rot/grün wird.
- **A5 (neu, ~4 h): `.penwright/session.json`, nur die Schreibseite.** Grund für die frühe Platzierung: C2 und C3 entscheiden, was „aktuelles Dokument" heißt. Existiert die Sitzungsdatei dann, konsumieren sie sie direkt; existiert sie nicht, wird „Root-Datei" festgeschrieben und muss später erneut angefasst werden.

**In bestehende Phasen einsortiert:** D2 → C1 (schon enthalten) · X1/CH1/C7/S1 → C2 · D1/D11 (export_print-Weiche) → C4, dort **erweitern** — der Plan sagt nur „liest die Tokens am richtigen Ort", nötig ist die Weiche `hasProjectStyle` → Token-Pfad vs. `buildPrintGeometryOverlay` · C6 → C5 · D9/CONC-05/VER-02/D5 → **D2/D3, aber `safeApplyMcp` muss von „Design-Schreiber" auf *alle* mutierenden Writes erweitert werden**, sonst bleibt R3 offen · Lock → D3 · CH2/CH3/VER-14 → **E5, nicht vorher** (werden dort ersetzt; Ausnahme: der Substring-Filter in `remove_chapter` ist ein Compile-Breaker und braucht bis dahin eine Einzeiler-Verankerung).

**Reihenfolge-Warnung:** `shared/projectScaffold.ts` (Phase F) enthält `ensureProjectInfrastructure`. Es durfte erst nach A1b gebaut werden — sonst multipliziert man die Aufrufer einer Routine, die den Guard entwaffnet. Diese Vorbedingung ist mit `c744ce5` erfüllt.

---

## Empfohlene shared/-Module

Nach Abhängigkeit sortiert, nicht nach Nutzen.

| # | Modul | h | löst |
|---|---|---:|---|
| 1 | `shared/projectPaths.ts` — `penwrightDir()` als einzige Auflösung, mit `.vswrite`-Migration als Vorbedingung | 2 | PL-10 |
| 2 | ~~`isDesignAdopted()`~~ | — | ✅ PL-01 |
| 3 | `shared/fileWrite.ts` — `writeFileAtomic`, `markSelfWrite`/`isSelfWrite`, `writeIfUnchanged` | 10 | C1, CONC-01/02/13/15 |
| 4 | `shared/sessionState.ts` — `.penwright/session.json`, Gegenstück zu `selection.json` | 8 | X1, C2, CONC-06, D7, S1, C11 |
| 5 | `shared/editHistory.ts` — Snapshot-Ringpuffer, von beiden beschreibbar | 10 | C3, CONC-05, VER-02/03, D5 |
| 6 | `shared/lockFile.ts` — `lockManager` ist bereits electron-frei, nur verschieben | 4 | L1, CONC-07, PL-05 |
| 7 | `shared/assetWrite.ts` — eine Ablageregel, ein Dedup, eine Relativierung | 4 | A1 (Rest), A2 |
| 8 | `shared/bibWrite.ts` — `findBibFiles` + `planBibliographyWrites` | 6 | C6, C7, C8 |
| 9 | `shared/projectScaffold.ts` — ein `scaffoldProject()` für alle vier Entstehungswege | 6 | VER-05, PL-03, VER-07, VER-08, PL-04, PL-07 |
| 10 | `shared/printExportPlan.ts` — die Weiche genau einmal | 5 | D1, D11 |
| 11 | `gitOps` / `chapterWrite` / `projectTree` / `pathSandbox` | 12 | R4-Rest, **erst nach Phase E** |

---

## Befunde: kritisch und hoch

| ID | | Befund | Aufwand |
|---|---|---|---:|
| `lifecycle/PL-01` | 🔴 | „Version speichern" entschärfte den handgeschriebenen-`style.typ`-Schutz — **✅ `c744ce5`** | 2 h |
| `content/A1` | 🟠 | `add_image` schrieb einen projektrelativen Bildpfad in eine Kapiteldatei — **✅ `c744ce5`** | 4 h |
| `annotations/C1` | 🔴 | 3-s-Watcher-Guard verschluckt MCP-Schreibvorgänge — Fußnote/Referenz/Replace gehen verloren | 6 h |
| `annotations/C7` | 🔴 | `ensure_bibliography`/`add_citation`: App und MCP legen die `.bib` an verschiedenen Orten an; die MCP-Variante kann einen nicht auflösbaren `#bibliography`-Pfad erzeugen | 5 h |
| `concurrency/CONC-01` | 🔴 | Der 3-s-Guard ist global, nicht pro Datei — verschluckte Events werden nie nachgeholt | 6 h |
| `concurrency/CONC-02` | 🔴 | App-Save schreibt den In-Memory-Puffer ohne Kollisionsprüfung zurück | 10 h |
| `concurrency/CONC-03` | 🔴 | Preview rekompiliert nur bei Änderung der geöffneten Datei | 3 h |
| `concurrency/CONC-04` | 🔴 | Design-Panel bekommt MCP-Änderungen nie mit und schreibt seinen veralteten Stand zurück | 5 h |
| `concurrency/CONC-06` | 🔴 | Kein gemeinsames „welches Projekt", kein gemeinsames „welche Datei" | 10 h |
| `content/C1` | 🔴 | Lost Update: Guard verwirft, nächstes Autosave überschreibt | 8 h |
| `design/D1` | 🔴 | `penwright_export_print` kennt die Weiche für handdesignte Projekte nicht | 5 h |
| `history/VER-01` | 🔴 | wie CONC-01, aus der Versionen-Perspektive | 6 h |
| `history/VER-02` | 🔴 | KI-Änderungen außerhalb der geöffneten Datei haben keine Rückfallebene | 12 h |
| `lifecycle/PL-06` | 🔴 | wie CONC-01, aus der Lifecycle-Perspektive | 5 h |
| `annotations/C2` | 🟠 | Kommentar-Änderung des MCP löst kein `filetreeChanged` aus | 4 h |
| `annotations/C3` | 🟠 | Editor-Highlights aktualisieren sich nur bei gemountetem Comments-Tab | 2 h |
| `annotations/C4` | 🟠 | App und MCP verankern Kommentare in zwei Textwelten (Rendertext vs. Typst-Quelltext) | 8 h |
| `annotations/C5` | 🟠 | `occurrence`/`rangeStart` werden geschrieben, aber von der Markierungsebene nie gelesen | 6 h |
| `annotations/C6` | 🟠 | `.bib`-Suche: App drei Verzeichnisse, MCP nur die Wurzel | 4 h |
| `concurrency/CONC-05` | 🟠 | AI-Snapshots nur für die eine geöffnete Datei | 8 h |
| `concurrency/CONC-07` | 🟠 | `lockManager` greift gegenüber dem MCP-Prozess nicht | 5 h |
| `concurrency/CONC-08` | 🟠 | Externe Änderung ersetzt ungespeicherten Editorinhalt ohne Rückfrage | 6 h |
| `concurrency/CONC-09` | 🟠 | `safeApplyDesign`-Rollback schreibt Bytes zurück, ohne zu prüfen, ob inzwischen jemand anders geschrieben hat | 3 h |
| `concurrency/CONC-12` | 🟠 | Massenschreibende MCP-Tools ohne die Schutzmaßnahmen, die die App für ihre eigenen bereits hat | 8 h |
| `content/C2` | 🟠 | Der dirty In-Memory-Puffer ist für den MCP unsichtbar | 6 h |
| `content/C3` | 🟠 | AI-Snapshots nur für die geöffnete Datei | 7 h |
| `content/S1` | 🟠 | Dokument-Settings landen in verschiedenen Dateien (App: offene Datei, MCP: Root) | 4 h |
| `content/X1` | 🟠 | „Aktuelles Dokument" bedeutet zwei verschiedene Dateien | 4 h |
| `design/D2` | 🟠 | `apply_layout`/`generate_layout` löschen die Druckvorstufe, die die App bewahrt | 3 h |
| `design/D3` | 🟠 | Design-Panel cached und invalidiert nie | 4 h |
| `design/D4` | 🟠 | MCP-Designänderung löst keinen Preview-Recompile aus | 3 h |
| `design/D5` | 🟠 | `design:undo` restauriert Byte-Snapshots, die MCP-Änderungen nicht kennen | 6 h |
| `design/D6` | 🟠 | `insert_design_element` ignoriert die angepinnte Datei | 5 h |
| `design/D7` | 🟠 | Der Pin-Handoff transportiert kein Projekt | 2 h |
| `design/D9` | 🟠 | MCP-Section-Tools umgehen `safeApplyDesign` vollständig | 8 h |
| `history/VER-03` | 🟠 | Auto-Backups und AI-Snapshots sind für die KI unlesbar, aber ungeschützt beschreibbar | 8 h |
| `history/VER-04` | 🟠 | `restore_version` kennt den dirty Puffer nicht — das Autosave macht die Wiederherstellung rückgängig | 5 h |
| `history/VER-05` | 🟠 | `create_project` legt weder Repo noch `.gitignore` noch `.penwright/` an | 5 h |
| `history/VER-06` | 🟠 | `git_commit` umgeht `ensureGitRepo` und committet mit `add -A` die Sicherungsschicht mit | 2 h |
| `lifecycle/PL-02` | 🟠 | MCP-Sandbox fällt auf `process.cwd()` zurück; die App scheitert geschlossen, der MCP offen | 3 h |
| `lifecycle/PL-03` | 🟠 | `create_project` erzeugt ein anderes Projekt als „Neues Projekt" | 5 h |
| `lifecycle/PL-04` | 🟠 | Eigene gespeicherte Presets sind für den MCP unsichtbar | 3 h |
| `lifecycle/PL-05` | 🟠 | Der MCP kennt `lockManager` nicht | 4 h |

39 weitere Befunde mit `medium`/`low` sind im Audit erfasst und in den Wurzeln R2–R4 enthalten.

---

## Verworfen bei der Gegenprüfung

Nicht jeder gemeldete Befund hielt stand — festgehalten, damit sie nicht wieder auftauchen:

- **„Der `StyleWriteRefused`-Throw kommt bei Claude als Stacktrace an."** Falsch. Das SDK (`mcp.js:135-141`) fängt und liefert `createToolError` — Claude bekommt exakt den Text als sauberes `isError`. Übrig bleibt nur: `DESIGN_SKILL` könnte eine Regel „bei dieser Meldung nicht per `write_file` auf `style.typ` ausweichen" gebrauchen.
- **„`safeApplyDesign` hält den 3-s-Guard über den ganzen Verify offen."** Umgekehrt: der Stempel steht bei `T`, der Guard läuft nach 3 s **ab**, mitten im Verify. Der echte Defekt liegt woanders (Rollback ohne Ist-Vergleich, CONC-09).
- **„`add`/`unlink` senden `filetreeChanged` unconditional."** Nein, beide tragen denselben Guard. Die Schlussfolgerung hält trotzdem, aus zwei Gründen statt einem.
- **„`sections` muss in `deepMergeStyle`."** Kollidiert mit einer bereits getroffenen Entscheidung ([mcp-tool-consolidation.md](mcp-tool-consolidation.md) §6): ein Teil-Patch würde die übrigen Sections löschen. Das aktuelle Verhalten ist gewollt.
- **`D1` ist `high`, nicht `critical`.** `export_print` schreibt eine *Temp*-Datei und repointet den *Temp*-Root; die Autoren-`style.typ` überlebt. Das Ergebnis ist ein falsches PDF, nicht der Verlust des Designs.
