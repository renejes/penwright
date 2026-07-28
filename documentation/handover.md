# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-29, Ende der Paritäts-Session (Session 41) · Branch `main`, **alles committet** (12 Commits, `561c22e` … `516755d`) · App-Version **0.12.0** · `MCP_SETUP_VERSION` **0.19.0** (noch nicht gebumpt — s. §6)
>
> **Lies zuerst diese Datei, dann `CLAUDE.md`, dann leg los.** Referenzdokumente dieser Session: [app-mcp-parity.md](app-mcp-parity.md) (Ist-Zustand + Restliste), [mcp-rebuild-plan.md](mcp-rebuild-plan.md) (der MCP-Umbau — ~1/3 erledigt, Rest in die Paritätssequenz einsortiert, s. §4b), [mcp-tool-audit.md](mcp-tool-audit.md) + [mcp-tool-consolidation.md](mcp-tool-consolidation.md) (warum wir die Tool-Zahl **nicht** reduzieren).

---

## 0. Worum es ging — und was das Ziel bleibt

Die Ausgangsfrage war: *„Können wir die 60 MCP-Tools reduzieren?"* Die Antwort war **nein, und die Frage war die falsche.** Das Manifest kostet 0,86 % eines 1-M-Kontextfensters — es gibt kein Token-Problem. Beim Nachprüfen fiel dafür etwas anderes auf, und daraus wurde die eigentliche Arbeit:

> **Das Paritätsprinzip:** Die KI (über den MCP-Server) sieht, was der Mensch sieht, und beide beschreiben dieselben Dateien. Beide arbeiten mit demselben Wissen und haben denselben Zugriff.

Das ist ab jetzt die Leitlinie. Es zerfällt in vier prüfbare Forderungen, die im ganzen Repo so benannt werden:

| | | Stand |
|---|---|---|
| **P1 Schreiben** | Derselbe Vorgang trifft von beiden Seiten dieselbe Datei mit denselben Bytes und denselben Nebenwirkungen. | **teilweise** |
| **P2 Lesen** | Jede Seite kann vollständig lesen, was die andere erzeugt. Nichts darf nur eine Seite sehen. | **teilweise** |
| **P3 Wissen** | Beide kennen denselben Zustand: welches Projekt, welche Datei, ungespeicherte Änderungen, Sperren. | **schwächste Achse** |
| **P4 Schutz** | Was auf einer Seite abgesichert ist (Verify, Rollback, Snapshot, Guard), ist es auf der anderen auch. | **nicht erfüllt** |

**Der Satz, der den Stand am besten trifft:** *Auf der Ebene der Dateien weitgehend eingelöst, auf der Ebene des Zustands noch nicht.* Die beiden Prozesse teilen Dateien, aber sie teilen keine Gegenwart.

**Das Muster, das funktioniert und fortgeschrieben werden soll:** Divergenz nicht durch Synchronhalten zweier Implementierungen beseitigen, sondern durch einen **gemeinsamen Planer** in `src/shared/`, den beide Prozesse aufrufen. Wo das angewandt wurde, hält die Parität nachweislich byte-genau. Prototyp: `styleWrite.ts` — reines Planen (`planStyleWrites` gibt Writes *zurück*), der Aufrufer entscheidet, wie er sie anwendet (App: über `safeApplyDesign` mit Verify; MCP: direkt).

---

## 1. Architektur-Grundlage, die man kennen muss

**Zwei getrennte Prozesse, kein IPC dazwischen.** Die Electron-App (`src/main`, `src/renderer`) und der MCP-Server (`src/mcp/server.ts`, eigenständige Bun-Binary) teilen sich **ausschließlich den Projektordner auf der Platte**. Alles, was sie voneinander wissen, geht über Dateien.

Daraus folgt die ganze Problemklasse: derselbe Vorgang existiert zweimal, an zwei Stellen, und driftet. Und: keiner der beiden weiß, was der andere gerade tut.

**Der Begriff, der im Code gefehlt hat: Ko-Präsenz.** Dieselbe Person, zwei Werkzeuge. Der Lock-Fehler unten ist die reinste Ausprägung — der Code hielt „anderer Prozess" für gleichbedeutend mit „anderer Bearbeiter" und sperrte den Menschen gegen sich selbst aus.

---

## 2. Was diese Session gebaut hat (12 Commits, alle auf `main`)

### Neue gemeinsame Module in `src/shared/` — das ist der Kern

| Modul | Löst |
|---|---|
| **`styleWrite.ts`** | EIN Schreibpfad für `style.json` / `style.typ` / Root-`#import`. `planStyleWrites` + `resolveDesignRoot` + `readProjectStyleWithCustom` + `isDesignAdopted`. Verweigert bei handgeschriebener `style.typ`. |
| **`fileWrite.ts`** | Schreib-Provenienz per Inhalts-Hash (`noteDiskContent` / `isKnownContent`). Ersetzt das 3-Sekunden-Zeitfenster des Watchers. |
| **`watchIgnore.ts`** | Das Watcher-Ignore-Prädikat, testbar herausgezogen. |
| **`sessionState.ts`** | `.penwright/session.json` (welche Datei, dirty) + `<appData>/active-project.json` (welches Projekt). Nur die App schreibt, der MCP liest. |
| **`editHistory.ts`** | Snapshot-Format der AI-Undo-Schicht, von beiden Prozessen beschreibbar. |
| **`lockFile.ts`** | Ex-`main/lockManager.ts`, jetzt geteilt. Neu: `isForeignEditor()`. |
| **`bibDiscovery.ts`** | Eine Regel für „wo liegt die `.bib`" und „wo steht der `#bibliography`-Aufruf". |
| **`stylePresetMerge.ts`** | Die Preserve-Liste beim Anwenden eines Presets — einmal statt viermal. |
| **`printExportPlan.ts`** | Die Weiche Token-Projekt ↔ handdesigntes Projekt beim Druckexport. |

### Die Fehler, die dabei gefunden und behoben wurden

Chronologisch, weil einer den nächsten aufdeckte:

1. **`561c22e` — handgeschriebene `style.typ` wurde überschrieben.** `section:apply` schrieb `style.json` + `style.typ` **außerhalb** von `safeApplyDesign`; ein Klick auf einen Kapitel-Look zerstörte in einem handdesignten Projekt das komplette Designsystem, während die UI „nicht angewendet" meldete. Kein Git, keine Backups in solchen Projekten → unwiederbringlich.
2. **`c744ce5` — der Guard war entwaffnbar.** „Version speichern" → `git:ensureRepo` → `ensureProjectInfrastructure` → `ensureStyleFile` legte bedingungslos eine Default-`style.json` an — genau die Bedingung, auf die der Guard konditioniert hatte. **Merksatz: eine Guard-Bedingung, die eine andere Routine erzeugen kann, ist keine.** Adoption ist jetzt allein der Marker in `style.typ`. Im selben Commit: `add_image` schrieb einen projektrelativen Bildpfad in Kapiteldateien — Typst löst dateirelativ auf, das Dokument kompilierte nicht mehr.
3. **`cf9b16b` + `c5f22cd` — der Watcher.** Das 3-Sekunden-Fenster war global und verwarf statt aufzuschieben: eine KI-Änderung während des Tippens war spurlos weg, und das nächste Autosave schrieb den alten Puffer darüber. Ersetzt durch Inhalts-Provenienz. Der Reparatur-Commit fand dabei: **die chokidar-Ignore-Globs waren seit dem Upgrade auf chokidar 4 komplett wirkungslos** (`matcher === string`), wodurch jedes Auto-Backup einen vollen Typst-Lauf auslöste; `openFile` zeichnete nichts auf → Phantom-Snapshots, bei denen ein Klick auf „Undo AI Edit" die Sitzungsarbeit verworfen hätte.
4. **`31b0476` — der Zustandskanal + das Undo-Netz für Maschinen-Edits.** Alle 29 schreibenden MCP-Stellen laufen jetzt über `guardedWrite` (Lock prüfen, Vorversion sichern).
5. **`f30fe0a` — drei Regressionen aus `31b0476`.** Der Verifikationsdurchgang fand: `guardedWrite` wies **die eigene App als Fremden ab** (die KI konnte genau die offene Datei nicht bearbeiten, und die Meldung nannte den Nutzer als Blockierer); `publishSession()` lief eine Zeile zu früh, also nannte `session.json` die *vorher* offene Datei; der Server las die Session nur beim Prozessstart. Zusammen: *auf die Datei von vorhin zielen, an der von jetzt abgewiesen werden.*
6. **`708dc7a`** — Bibliografie (App legte sie neben die offene Datei, MCP schrieb den Aufruf in ein Kapitel → nicht auflösbarer Pfad → Compile-Bruch) und Preset-Merge (drei Tools löschten still die Druckvorstufe; `facingPages`/`binding` wirken auch auf die **Bildschirm**-Geometrie, nicht nur im Druck).
7. **`9e44ee7`** — Druckexport: der MCP kannte die Weiche nicht und ersetzte bei handdesignten Projekten das Autorendesign durch Penwright-Defaults.

### Sechs neue Testsuiten

`npx tsx scripts/<name>-test.mts` — alle grün, keine Framework-Abhängigkeit, alles auf Wegwerf-Fixtures in `os.tmpdir()`:

| Suite | Prüft |
|---|---|
| `style-guard-test` | Guard gegen handgeschriebene `style.typ`, Design-Root-Auflösung, Preset-Merge, E2E über stdio |
| `write-provenance-test` | Inhalts-Provenienz inkl. des Cross-File-Falls, der die eigentliche Regression war |
| `watch-ignore-test` | **gegen das installierte chokidar**, inkl. „ein voller Backup-Snapshot ist still" |
| `session-handoff-test` | Zustandskanal, Ko-Präsenz-Lock, Snapshots — E2E über stdio |
| `bibliography-test` | `.bib`-Ort + Aufrufstelle, mit echtem Compile am Ende |
| `print-export-test` | Beide Projektformen, E2E, `style.typ` muss byte-identisch bleiben |

**Lehre aus dieser Session:** Der Lock-Test war grün und die Funktion kaputt — er prüfte `user: 'someone-else', machine: 'their-mac'` (den Dropbox-Kollegen), nie den Alltagsfall gleicher Nutzer / gleiche Maschine. **Beim Testen den häufigsten Fall zuerst.**

---

## 3. Was heute verlässlich geht — und was nicht

**Geht:** Design-Tokens von beiden Seiten byte-identisch mit demselben Guard · Bibliografie (ein Ort, eine Aufrufstelle) · Kommentare · Versionen inkl. Lazy-git-init · Suche, Querverweise, Quellen-PDFs · **die KI die gerade offene Datei bearbeiten lassen** (seit `f30fe0a`).

**Geht nicht:**
- Die KI weiß nicht, wie das Dokument **aussieht** — sie hat es nie gesehen (kein gerendertes Bild).
- Design von der KI ändern lassen ohne Absturzrisiko — **kein Verify, kein Rollback** auf der MCP-Seite.
- KI-Änderungen an mehreren Dateien zurücknehmen — die Snapshots liegen auf der Platte, `listSnapshots` hat **null Produktivaufrufer**, im Verlaufs-Hub sind sie unsichtbar.
- Erwarten, dass die KI die Projektkonventionen kennt — **0 von 35 Presets** haben `.claude/skills`, `ensureClaudeSkills` wird von `openProject` nicht gerufen.
- Die App kann nicht anzeigen, woran die KI gerade arbeitet (kein Rückkanal).

---

## 4. Nächste Session — Vorschlag in dieser Reihenfolge

Vollständige, priorisierte Liste in [app-mcp-parity.md](app-mcp-parity.md) → „Restliste". Kurzfassung mit Begründung:

### Zuerst: P4 Schutz (~10 h) — der einzige verbliebene Bereich mit Schadenspotenzial

1. **`safeApplyMcp`** (4–5 h) — Staging → Compile-Verify → commit/rollback nach `shared/` ziehen, Verifier injiziert (App: `TypstCompiler.verify`, MCP: eigener Typst-Aufruf). `style.json` gehört in die Rollback-Menge. **Warum zuerst:** ein einziger Tool-Call kann das Dokument heute unkompilierbar hinterlassen, ohne Rückweg.
2. **Undo-Netz lesbar machen** (4–5 h) — `ai:list` auf `listSnapshots(projectDir)` umstellen (die Funktion existiert und wird nicht benutzt), `popAiSnapshot` einen `filePath` geben, MCP-Gegenstücke `list_edits` / `undo_last_edit`, **eine** Aufbewahrungsgrenze statt zwei (fest 40 vs. konfigurierbar 20). **Warum:** das Netz existiert und ist unsichtbar — ausgerechnet beim Mehrdatei-Umbau, für den es gebaut wurde.
3. **`unsavedEditsNote` in `guardedWrite` hochziehen** (1,5 h) — steht heute an 3 von 28 Tools; eine Stelle statt siebenundzwanzig.

### Dann: P1 Schreiben vervollständigen (~9 h) — bekannt, bounded, dasselbe Muster

4. **`shared/projectScaffold.ts`** (6 h) — `penwright_create_project` erzeugt heute drei Dateien, die App zwölf plus Git, `.gitignore`, `sources/`, Skills, `style.typ`. Ein `scaffoldProject()`, das beide `create_*`-Wege rufen. Nimmt die `.gitignore`-Divergenz und die Skill-Lücke gleich mit.
5. **`shared/assetPlacement.ts`** (3 h) — drei Ablageschemata; **die App überschreibt heute still ein gleichnamiges Bild** (`copyFileSync` ohne Existenzprüfung). Eine Regel: `<projectDir>/assets`, Dedup per Inhalt, Pfad relativ zur Zieldatei.

### Dann: P3 Wissen — bewusst *begrenzt* ausbauen

`session.json` trägt vier Felder. Die Versuchung ist, es zum Spiegel des Editors zu machen — **das wäre falsch.** Ein Zustandsspiegel mit Cursor, Auswahl, Scrollposition und Puffer ist eine zweite Wahrheit, die veralten kann, und der Aufwand wächst mit jedem Feld. Sinnvoll ist nur, woraus die KI eine **andere Entscheidung** ableitet:

6. **`lastCompileOk`** in `session.json` (1 h) — damit die KI weiß, ob sie auf einem kaputten Dokument aufsetzt.
7. **`agent-activity.json`** als Rückkanal (3 h) — der MCP schreibt „arbeite gerade an X", die App **zeigt es an** und gehorcht ihm nicht. Rein informativ.
8. **`get_style` liefert `initialized` / `rootFile`** (1 h) — die KI designt sonst gegen eine Fiktion (Defaults sehen aus wie Tatsachen).

### Dann: P2 Lesen — eine echte Fähigkeit fehlt

9. **`penwright_render_page`** (5 h) — die KI hat das Dokument **nie gesehen**. Typst rendert direkt PNG (`--format png`, `--pages`), die Binary ist gebündelt, der Rückgabetyp `type:'image'` ist im MCP-Protokoll vorgesehen und wird bisher nirgends benutzt. **Das ist die größte einzelne Annäherung an „die KI sieht, was der Mensch sieht"** — und Voraussetzung dafür, dass Design-Feedback der KI überhaupt fundiert sein kann.

---

## 4b. Und der MCP-Umbau? — er ist kein eigenes Projekt mehr

[mcp-rebuild-plan.md](mcp-rebuild-plan.md) wurde geschrieben, **bevor** das Paritätsprinzip formuliert war. Inzwischen ist **rund ein Drittel davon durch die Paritätsarbeit nebenbei erledigt** (A1, A1b, A3-Teil, C1, C4, C5), und der Rest überlappt zur Hälfte mit der offenen Paritätsliste. Der Plan ist auf diesen Stand revidiert (§0 dort). Aus ~20 PT sind **~13–14 PT** geworden, davon ~7 an eine Messung geknüpft.

**Die Gesamtreihenfolge — das ist der Fahrplan:**

| Block | Inhalt | PT |
|---|---|---:|
| **1** | **Parität fertig** (§4 oben). Enthält Phase D des Umbauplans (`safeApplyMcp` = Paritätspunkt 1) und die Skill-Deploy-Lücke aus Phase F (fährt in `projectScaffold` mit). | 4 |
| **2** | **Phase B allein** — `server.instructions`, `registerTool()` + Annotations, Beschreibungs-Chirurgie. Plus A2 (Wächterskript gegen die sechs driftenden Tool-Listen) und die drei A3-Reste: Git-Tools ohne Projekt-Guard, Compile-Temp-PDF liegt neben dem Root, kein Extension-Guard beim Export (`outputPath: "main.typ"` überschreibt heute die Quelldatei mit einem PDF). | 2 |
| **3** | **Phase C-Rest** — Kapitel-Tools auf die Wurzel, `restore_version` verlangt Bestätigung, `replace_in_project` bekommt Dry-Run, Caps gegen Kontext-Flutung, `insert_reference` nimmt auch Citekeys (**heute die einzige echte Fähigkeitslücke** — „zitiere @chen2021 im dritten Absatz" ist im ganzen Server nicht bedienbar). | 1,5 |
| **4** | **Eval** — 10–15 nachprüfbare Autorenaufgaben, einmal vor und einmal nach Block 2. | 1 |
| **5** | **Phase E + F** — Renames, Streichungen, Merges, Skill-Rewrite. **Nur wenn das Eval Fehlgriffe zeigt.** | 7 |

**Warum Block 2 vorgezogen wird, obwohl er „Umbau" heißt:** `server.instructions` ist vorhanden, dokumentiert und **ungenutzt** (`server.ts:472` übergibt kein Options-Objekt) — laut Audit der größte Einzelhebel im ganzen Umbau, ein halber Tag Arbeit. `registerTool()` + Annotations schaltet `readOnlyHint` frei (Auto-Approve für die Leser in Claude Code) und ändert **keinen einzigen Tool-Namen**. Kein Aufruf, der heute funktioniert, funktioniert danach nicht.

**Warum Block 5 hinten steht und an einer Messung hängt:** Der teuerste Posten ist nicht `server.ts`, sondern `skillTemplates.ts` — 39 Tool-Namen, Routing-Tabelle, fünf Rezeptsequenzen, ~25 Call-Beispiele mit vollständiger Argumentform. Inhaltliche Arbeit, kein `sed`, ~2 Tage, und sie **darf genau einmal passieren**: erst alle Namens- und Signaturänderungen, dann einmal Skills neu. Ob die Renames überhaupt nötig sind, ist **unbelegt** — es gibt keine publizierte Accuracy-Kurve für MCP-Tool-Anzahl und keine Head-to-Head-Messung Multiplex vs. granular. Wenn `instructions` + geschärfte Beschreibungen die Fehlgriffe schon beseitigen, ist die ganze Rename-Frage erledigt. Das halte ich für das wahrscheinlichste Ergebnis.

**Harter Kern (Blöcke 1–4): ~8,5 PT.** Danach ist entschieden, ob Block 5 überhaupt gebaut wird.

**Gate am Ende jedes Blocks, der `server.ts` anfasst:** `MCP_SETUP_VERSION` bumpen **und** `npm run build:mcp-binary:all` — siehe §6.

---

## 5. Was bewusst asymmetrisch bleibt — nicht „fixen"

Symmetrie ist Mittel, nicht Selbstzweck. An diesen Stellen wäre sie **falsch**, und das ist eine Entscheidung, keine Lücke:

- **Die Export-Sandbox der KI bleibt enger.** Der Mensch wählt per Dialog frei und trägt die Entscheidung; ein Modell darf nicht irgendwohin auf die Platte schreiben.
- **Der Zustandskanal bleibt einseitig.** Nur die App schreibt `session.json` / `active-project.json`. Ein veralteter Agentenstand darf die App nicht steuern. Der Rückkanal (#7) ist rein informativ.
- **Echte Fremd-Locks bleiben harte Ablehnung.** Der Ko-Präsenz-Fix entschärft nur dieselbe Person auf derselben Maschine. Der Mensch behält seinen „Trotzdem öffnen"-Dialog; ein pauschaler `force`-Parameter für die KI wäre die falsche Antwort.
- **Kein Compile-Verify vor gewöhnlichen Textänderungen** — auf beiden Seiten. Der Mensch tippt unfertiges Typst; ein Verify-Zwang wäre auf beiden Seiten falsch. Der Verify gehört an **Design**-Mutationen, weil dort eine einzelne Änderung global bricht.
- **Zwei Undo-Systeme dürfen bestehen bleiben.** Design-Undo (verify-basiert) und AI-Snapshots (inhaltsbasiert, pro Datei) lösen verschiedene Probleme. Sie müssen nur **beide von beiden Seiten sichtbar** sein.
- **Der Web-Export bleibt ohne MCP-Tool** (dokumentierte Produktentscheidung). Aber die Tool-Beschreibungen sollten es *sagen*, damit die KI dem Nutzer die richtige Stelle nennt statt zu schweigen.

---

## 6. Offene Punkte, die man vor dem Weiterarbeiten wissen muss

- **`MCP_SETUP_VERSION` steht auf `0.19.0` und ist NICHT gebumpt**, obwohl sich `src/mcp/server.ts` erheblich geändert hat. Vor dem nächsten `package:mac` bumpen **und** `npm run build:mcp-binary:all` laufen lassen. Achtung: `ensureInstalledBinary` (`mcpSetup.ts:210`) kopiert bei **jedem App-Start bedingungslos** aus `dist/mcp/bin/` — die installierte Binary trackt den letzten Build, nicht den Quellstand.
- **Die App wurde in dieser Session nie vom Assistenten gestartet.** Alle Verifikation ist Unit-/Integrationstest plus Quelltext-Zusicherung. René ist stichprobenartig durchgegangen (Phantom-Snapshots weg, Adopt-Zweig funktioniert — beides an `~/Desktop/LANGSAM` belegt), aber ein vollständiger Durchgang steht aus, besonders Design-Panel, Kapitel-Look und Druckexport.
- **Renés echte Projekte sind der Härtefall.** `~/Desktop/Marketing/FMM/*` und `~/Desktop/Marketing/Ludwig Maier Mastering/*`: **kein Git, keine `.penwright/style.json`, keine `.claude/skills`, handgeschriebene `style.typ` mit `#let`-Makros, keine `main.typ`** (Wurzeln heißen `Angebot.typ` / `Sichtbarkeitskonzept.typ`, also liefert `findRootFileIn` dort `null`). Jeder Root-Resolver muss zweistufig sein und bei `null` **hart fehlschlagen**, nie einen nicht existierenden Pfad zurückgeben — ein geschriebenes `main.typ` würde die Design-Wurzel dauerhaft verschieben.
- **Ungetrackt im Working-Tree** (Renés eigene Arbeit, nicht anfassen): `documentation/done/`-Verschiebungen, `resources/*/manifest.json`-Timestamps.
- **Der Web-Export-Branch `feat/web-export`** ist unverändert und **nicht** nach `main` gemergt. Diese Session hat ihn nicht berührt.
- **Launch-Blocker unverändert:** `penwright.online` registrieren · finales QA auf realer 100-Seiten-Thesis + Design-Use-Cases · Windows als Fast-Follow.

---

## 7. Arbeitsweise, die sich bewährt hat

- **Erst prüfen, ob die eigenen Fixes halten, dann nach neuen Lücken suchen.** Der Verifikationsdurchgang fand drei Regressionen aus dem Vor-Commit. Ohne diesen Schritt wären sie im Release gelandet.
- **Gemeinsamer Planer statt synchron gehaltener Kopien.** Reines Planen (`plan*` gibt Writes zurück), der Aufrufer wendet an. Testbar ohne Electron.
- **Jeder Fix bekommt einen Test, der ihn ohne den Fix rot sieht.** Bei `add_image` und beim Ignore-Prädikat explizit gegengeprüft.
- **E2E über stdio gegen die gebaute Binary** ist die härteste verfügbare Evidenz und kostet wenig — Muster in `session-handoff-test.mts`.
- **Adversariale Multi-Agent-Reviews haben sich zweimal ausgezahlt** (Watcher-Umbau, Paritäts-Sweep). Beide Male fanden sie etwas, das der Assistent selbst eingebaut hatte.
