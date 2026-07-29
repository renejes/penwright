# MCP-Server-Umbau — Ausführungsplan

> **Revidiert 2026-07-29** (Session 41). Prämisse unverändert: **Penwright ist nicht released.**
> Vorlauf: [mcp-tool-audit.md](mcp-tool-audit.md) · [mcp-tool-consolidation.md](mcp-tool-consolidation.md) · **[app-mcp-parity.md](app-mcp-parity.md)** (das übergeordnete Ziel, siehe unten)
> Ursprünglicher Umfang ~22–24 PT · **Rest heute ~13–14 PT**, davon ~7 an ein Messergebnis geknüpft.

---

## 0. Revision: dieser Plan ist kein eigenes Projekt mehr

Der Plan wurde geschrieben, **bevor** das Paritätsprinzip formuliert war (App und KI sehen dasselbe, schreiben dieselben Dateien — [app-mcp-parity.md](app-mcp-parity.md)). Seither ist zweierlei passiert: **rund ein Drittel wurde durch die Paritätsarbeit nebenbei erledigt**, und der Rest überlappt zur Hälfte mit der offenen Paritätsliste. Ihn weiterhin als eigenständiges 20-Tage-Vorhaben zu führen, würde Arbeit doppelt planen.

### Was durch Session 41 bereits erledigt ist

| Plan-Item | Erledigt in |
|---|---|
| **A1** Style-Guard (`planStyleWrites`, Verweigerung bei handgeschriebener `style.typ`) | `561c22e` |
| **A1b** `isDesignAdopted` — Guard nicht mehr von außen erodierbar | `c744ce5` |
| **A3** (teilweise) `cwd`-Fallback nur bei echtem Projekt · `add_image`-Pfadfehler | `f30fe0a`, `c744ce5` |
| **C1** (teilweise) Preserve-Liste — als `shared/stylePresetMerge.ts` | `708dc7a` |
| **C4** `export_print` kennt die Weiche Token ↔ handdesigntes Projekt | `9e44ee7` |
| **C5** rekursiver `.bib`-Scan | `708dc7a` |
| *(nicht im Plan)* Bibliografie-Aufrufstelle, Watcher-Provenienz, Zustandskanal, Ko-Präsenz-Lock, MCP-Snapshots | Session 41 |

**Der Befund, der ursprünglich in §0 stand** — `section:apply` schrieb `style.json` + `style.typ` außerhalb von `safeApplyDesign` und zerstörte damit handgeschriebene Designs — **ist behoben** (`561c22e`, abgesichert durch `c744ce5`). Die historische Beschreibung steht unten in §0b, weil sie die Fehlerklasse erklärt, auf die alles Weitere achtet.

### Wie der Rest jetzt eingeplant ist

Der Rest zerfällt in zwei Sorten, die nicht zusammengehören:

**Sorte 1 — Defekte und Absicherung.** A3-Rest, C2/C3/C6–C9, D, F. Das ist **dieselbe Arbeit** wie die offene Paritätsliste, nur anders gruppiert: Phase D (`safeApplyMcp`) *ist* Paritätspunkt 1; die Skill-Lücke aus F fährt in `shared/projectScaffold.ts` mit; „Kapitel-Tools zielen auf die Wurzel" ist P1-Schreiben. **Wird in der Paritätssequenz abgearbeitet, nicht daneben.**

**Sorte 2 — Oberfläche.** Phase B (Metadaten, `instructions`, Beschreibungen) und Phase E (Renames, Streichungen, Merges). Genuin ein anderes Thema, läuft separat — und die beiden sind sehr unterschiedlich teuer und sicher.

### Die Reihenfolge

| Block | Inhalt | Aufwand | Wann |
|---|---|---|---|
| **1** | **Parität fertig** — P4 Schutz (enthält Phase D), P1 Schreiben (enthält Phase F/Skills), P3 Wissen begrenzt, P2 `render_page` | ~4 PT | zuerst |
| **2** | **Phase B allein** + A2 Wächterskript + A3-Rest | ~2 PT | direkt danach, **vorziehen** |
| **3** | **Phase C-Rest** — Kapitel-Tools auf Root, `restore_version`-Bestätigung, `replace_in_project`-Dry-Run, Caps, `insert_reference` nimmt Citekeys | ~1,5 PT | danach |
| **4** | **Eval** — 10–15 nachprüfbare Autorenaufgaben, vor und nach Block 2 | ~1 PT | begleitend |
| **5** | **Phase E + F** — Renames, Streichungen, Merges, Skill-Rewrite | ~7 PT | **nur wenn das Eval Fehlgriffe zeigt** |

**Warum Phase B vorgezogen wird:** `server.instructions` ist vorhanden, dokumentiert und **ungenutzt** (`server.ts:472` übergibt kein Options-Objekt) — laut Audit der größte Einzelhebel im ganzen Umbau, ein halber Tag. `registerTool()` + Annotations schaltet `readOnlyHint` frei (Auto-Approve für die Leser in Claude Code) und **ändert keinen einzigen Tool-Namen**. Risiko praktisch null: kein Aufruf, der heute funktioniert, funktioniert danach nicht.

**Warum Phase E hinten steht und an einer Messung hängt:** Der teuerste Posten des Umbaus ist nicht `server.ts`, sondern `skillTemplates.ts` — 123 Zeilen mit 39 Tool-Namen, Routing-Tabelle, fünf Rezeptsequenzen, ~25 Call-Beispiele mit vollständiger Argumentform. Inhaltliche Arbeit, kein `sed`, ~2 Tage, und sie **darf genau einmal passieren**. Also erst alle Namens- und Signaturänderungen, dann einmal Skills neu. Ob die Renames überhaupt nötig sind, ist **unbelegt** — es gibt keine publizierte Accuracy-Kurve für MCP-Tool-Anzahl und keine Head-to-Head-Messung. Wenn `instructions` + geschärfte Beschreibungen die Fehlgriffe schon beseitigen, ist die Rename-Frage erledigt. Das ist das wahrscheinlichste Ergebnis.

### Gate am Ende jedes Blocks, der `server.ts` anfasst

`MCP_SETUP_VERSION` bumpen (steht auf `0.19.0` und ist trotz erheblicher Änderungen **nicht** gebumpt) **und** `npm run build:mcp-binary:all`. `ensureInstalledBinary` (`mcpSetup.ts:210`) kopiert bei **jedem App-Start bedingungslos** aus `dist/mcp/bin/` — die installierte Binary trackt den letzten Build, nicht den Quellstand.

---

## 0b. Der Befund, der ursprünglich die Reihenfolge bestimmte *(historisch — behoben)*

Beim Nachprüfen der Migrationsfrage ist etwas aufgetaucht, das schwerer wiegt als der ganze Umbau — und das **heute schon scharf ist**, ohne dass eine Zeile geändert wurde.

**`section:apply` zerstört handgeschriebenes Design, ohne Rückrollmöglichkeit.**

[ipcHandlers.ts:1144-1152](../src/main/ipcHandlers.ts#L1144-L1152):

```ts
const style = getProjectStyle(appState.projectDir);   // kein style.json → DEFAULTS
if (!style.sections.some(s => s.id === styleId)) {
  const preset = getSectionPreset(styleId);
  style.sections.push(preset);
  const saved = saveProjectStyle(appState.projectDir, style);  // legt style.json an
  regenerateStyleTyp(saved);                                    // ← ROHER WRITE
}
...
const res = await safeApplyDesign([{ abs, content: injected }], …);  // NUR das Kapitel
```

`regenerateStyleTyp` ([ipcHandlers.ts:1016-1036](../src/main/ipcHandlers.ts#L1016-L1036)) ist ein nacktes `fs.writeFileSync(… 'style.typ', generateStyleTypst(style))`. Der Kommentar darüber gibt es selbst zu: *„Section presets are well-formed, so this structured write doesn't go through safe-apply."*

**Der Ablauf für z. B. `FMM - Sichtbarkeitskonzept`, ein Klick in der ChapterLookBar:**

1. `style.json` wird mit Default-Tokens **neu angelegt** — das Projekt gilt ab jetzt als „designt".
2. `style.typ` wird **überschrieben**. Die 238 handgeschriebenen Zeilen — `#cover`, `#insight`, `#divider`, `#lead`, `#stat`, `#claim`, die Oliv-Palette, Playfair/Montserrat — sind weg.
3. Erst danach läuft `safeApplyDesign`, und zwar **nur über die Kapiteldatei**.
4. Der Verify-Compile schlägt fehl (`unknown variable: cover`), `safeApplyDesign` rollt die Kapiteldatei zurück.
5. Die UI meldet „nicht angewendet".

**Du siehst eine Fehlermeldung, glaubst es sei nichts passiert — und hast dein komplettes Design verloren.** Kein Undo-Eintrag (der wird nur in `safeApplyDesign` gepusht), kein Git, keine Backups.

Die MCP-Seite hat dasselbe Loch, sogar ohne den nachgelagerten Verify: `penwright_apply_section_style` → `writeProjectStyleAndRegenerate` ([server.ts:180](../src/mcp/server.ts#L180), bedingungsloses Überschreiben).

**Konsequenz:** Phase A steht vor allem anderen. Bis der Guard steht, wird keines der vier Projekte in Penwright geöffnet.

---

## 1. Ausgangslage — deine Projekte

Selbst geprüft, rein lesend:

| Projekt | `.git` | `.penwright` | `style.json` | `style.typ` | Wurzel | `.claude/skills` |
|---|---|---|---|---|---|---|
| FMM – Angebot | nein | nein | nein | **handgeschrieben** | `Angebot.typ` | nein |
| FMM – Sichtbarkeitskonzept | nein | nein | nein | **handgeschrieben** (238 Z.) | `Sichtbarkeitskonzept.typ` | nein |
| LMM – Angebot | nein | nein | nein | **handgeschrieben** | `Angebot.typ` | nein |
| LMM – Marketing Konzept | nein | nur `backups/` | nein | **handgeschrieben** | `Sichtbarkeitskonzept.typ` | nein |
| *(LANGSAM, optional)* | nein | ja | **ja** | generiert (Marker) | `main.typ` | nein |

Drei Befunde, die den Plan formen:

**(a) Keine Skills, nirgends.** Der Rename-Migrationsteil ist für dich gegenstandslos — es gibt nichts Veraltetes. Umgekehrt: der Agent arbeitet dort heute völlig ohne Penwright-Wissen ([server.ts:405](../src/mcp/server.ts#L405) liefert nur den Fallback-String). Das macht `server.instructions` zum einzigen Wissenskanal, der ankommt.

**(b) Keines der vier hat `main.typ`.** `ROOT_FILE_CANDIDATES` ist `['main.typ','document.typ','index.typ']` ([rootFinder.ts:10](../src/shared/rootFinder.ts#L10)) → **`findRootFileIn()` liefert für alle vier `null`**. Jeder Fix, der „die Projektwurzel" über `findRootFileIn` allein auflöst, sperrt deine Projekte aus oder — schlimmer — **erzeugt eine `main.typ`**, die danach in der Auflösung gegen `Angebot.typ` gewinnt und die Design-Wurzel dauerhaft verschiebt.

**(c) Kein Git, keine Backups.** Es gibt heute **kein** Sicherheitsnetz in diesen Projekten.

---

## 2. Die Garantie: was sich nicht ändert — und wie das bewiesen wird

**Unberührt, als Code-Konstante `MIGRATION_UNTOUCHED` festzuschreiben:** alle `.typ`-Dateien · `style.typ` · `.penwright/style.json` · `.penwright/preferences.json` · `.penwright/backups/**` · `comments/**` · `assets/` · `sources/` · `fonts/` · `.git/`.

**Angefasst wird ausschließlich:** `.claude/skills/<slug>/SKILL.md` (fünf neue Dateien) und `.penwright/pre-migration/<ts>/` (Sicherungskopie).

Der Nachweis läuft **dreistufig, und nur die dritte Stufe deckt deine vier Projekte ab**:

1. `style.json` → Sanitizer-Roundtrip byte-identisch — *deckt nur LANGSAM ab*
2. `generateStyleTypst(style.json) === style.typ` byte-identisch — *deckt nur LANGSAM ab*
3. **Gerenderte Seiten-PNG-Hashes gegen eine Baseline** — *deckt alle ab, auch die ohne `style.json`*

Stufe 3 ist der eigentliche Beweis. Die Maschinerie existiert bereits als Muster in [scripts/compile-stability-test.mts](../scripts/compile-stability-test.mts) (`compileToPngs`, Zeile 53-70). **Nicht neu erfinden — `compileToPngs` in ein eigenes Modul heben und von beiden Skripten importieren.** Wichtig: das neue Skript darf, anders als `compile-stability-test.mts:86`, **niemals in ein echtes Projekt schreiben**.

```sh
R="/Users/renejesser/Desktop/Programming - Projekte/vswrite-desktop"
"$R/resources/bin/typst-arm64-darwin" compile \
  --package-path "$R/resources/typst-packages" --font-path "$R/resources/fonts" \
  --root "<projekt>" --format png --ppi 72 "<projekt>/<wurzel>.typ" "$OUT/p-{p}.png"
find "$OUT" -name '*.png' | sort | xargs shasum -a 256 | awk '{print $1}' | shasum -a 256
```

Alle Projekte kompilieren heute fehlerfrei. Die Baseline wird **vor** dem ersten Commit erzeugt.

---

## 3. Der Plan in Phasen

> **Status je Phase — siehe §0 für die neue Blockeinteilung.** Die Detailbeschreibungen unten bleiben gültig; erledigte Items sind markiert.

Randbedingungen: solo auf `main`, nach jedem Commit ein lauffähiger Server, **kein Test- und kein Lint-Script im Repo**. Der mechanische Absicherer nach jedem Commit ist der Manifest-Roundtrip:

```sh
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| PENWRIGHT_TRIAL_UNTIL=99999999999999 node dist/mcp/server.mjs > /tmp/tools.json
```

### Phase A — Netz spannen ✅ *überwiegend erledigt* (A1/A1b/A3-Teil in Session 41; **offen: A2 Wächterskript + drei A3-Kleinigkeiten, ~1,5 h — gehen in Block 2**)

> Nichts aus späteren Phasen beginnen, bevor A vollständig ist.

**A0 — Versiegelte Vollkopie + Pixel-Baseline.** *Kein Commit, aber Vorbedingung.*
```sh
STAMP=$(date +%Y%m%d-%H%M); D="$HOME/Desktop/_penwright-preflight-$STAMP"
mkdir -p "$D" && cp -Rp "<die vier Projekte>" "$D/" && chmod -R a-w "$D"
```
Nicht Git (`git add -A` zöge `fonts/` und `assets/` in den Index — ungefragte Großaktion), nicht `saveProjectBackup` (sichert nur `.typ`/`.bib`, keine Assets), nicht `.penwright/pre-migration/` (liegt im Projekt und stirbt mit ihm). Danach Baseline-Hashes nach `$D/baseline.txt`.

**A1 — `guard: handgeschriebenes style.typ wird nie überschrieben`**
Gemeinsame, electron-freie Prüfung in [styleParser.ts](../src/shared/styleParser.ts) neben `STYLE_TYPST_MARKER` (Zeile 24), damit Main und MCP dieselbe nutzen:
```ts
export function isHandwrittenStyle(styleTypSource: string | null): boolean {
  if (styleTypSource === null) return false;          // keine Datei → frei
  return styleTypSource.split('\n')[0] !== STYLE_TYPST_MARKER;
}
```
**Regel: Schreiben verboten, wenn `isHandwrittenStyle(onDisk) === true` UND `hasProjectStyle(projectDir) === false`.** Beides zusammen ist eindeutig; LANGSAM (Marker + `style.json`) ist nicht betroffen.

Eingebaut an **allen vier** Stellen, die `generateStyleTypst` auf eine echte Datei anwenden: `ipcHandlers.ts:989` (`style:save`), `:1021` (`regenerateStyleTyp`), `:1122` (`section:saveStyle`), `server.ts:180` (`writeProjectStyleAndRegenerate`).

**Zusätzlich, unabhängig vom Guard und billiger als jede Diskussion:** `section:apply` muss `saveProjectStyle` + `regenerateStyleTyp` **in das `writes`-Array von `safeApplyDesign` heben**, statt sie davor auszuführen. ~10 Zeilen, und der bestehende Mechanismus rollt dann auch `style.typ` und `style.json` zurück.

*Nachweis (an einer Kopie):* FMM-Projekt öffnen → Kapitel wählen → Rubrik in der ChapterLookBar klicken → `shasum -a 256 style.typ` unverändert, **keine** `.penwright/style.json` entstanden, Dokument kompiliert. LANGSAM: Farbe ändern + speichern → funktioniert wie bisher, kein Dialog.

**A2 — `guard: Wächterskript`** — `scripts/check-mcp-tool-consistency.mjs`, noch **nicht** in `package:*` eingehängt.
*Absicherung:* Es muss auf HEAD **genau den bekannten Drift melden** — `export_print` fehlt in drei Docs, 3× Zählfehler 59 vs. 60, Manifest 53 statt 60, `penwright_apply_theme` ([themePresets.ts:11](../src/shared/themePresets.ts#L11), existierte nie), `penwright_export_web` in CLAUDE.md. Meldet es weniger, ist der Scanner blind.

**A3 — `fix: vier Nulltage-Guards`**
- `server.ts:285-288` — cwd-Fallback nur noch, wenn das Verzeichnis **mindestens eine `.typ` auf oberster Ebene** enthält. **Nicht** „`findRootFileIn`-Treffer" — das würde alle vier deiner Projekte aussperren (Befund 1b). Der `readdirSync`-Fallback, der irgendeine `.typ` (auch `style.typ`) zum Schreibziel macht, entfällt ersatzlos.
- `requireProjectGit()` für die drei Git-Tools: `git.checkIsRepo()` + `revparse(['--show-toplevel'])` gegen `projectDir` — simple-git löst sonst nach oben auf und würde ein umgebendes Fremd-Repo stagen, committen und pushen.
- `compile`-Wegwerf-PDF nach `os.tmpdir()` statt neben das Root-File ([server.ts:530](../src/mcp/server.ts#L530)).
- **Extension-Guard für die drei Export-Tools** — heute besteht `outputPath: "main.typ"` die Sandbox-Prüfung, Typst überschreibt die Quelldatei mit einem PDF, das Tool meldet Erfolg. 0,5 h, Datenverlust.

### Phase B — Metadaten, in einem Zug ⏳ **offen — Block 2, vorziehen** (≈ 1,5–2 Tage; 0 von 60 Tools auf `registerTool`, `instructions` ungesetzt)

**B1 — `refactor: registerTool + instructions + annotations + Beschreibungs-Chirurgie`**
Ein einziger Commit über alle 60 Registrierungen, von unten nach oben (`server.ts:2810` → `:414`). Die 60 Stellen werden genau einmal angefasst, deshalb alles zusammen.

- `new McpServer({name:'penwright', version:'0.19.0'}, { instructions: SERVER_INSTRUCTIONS })` — heute fehlt das Options-Objekt komplett ([server.ts:360](../src/mcp/server.ts#L360)).
- Annotations für alle 60: `readOnlyHint` für die Leser, `destructiveHint` nur, wo wirklich Daten verloren gehen.
- `_meta['anthropic/alwaysLoad']` auf `set_project`, `get_document`, `write_file`, `compile`, `get_style`.
- **Kein `outputSchema`** — es erzwingt `structuredContent` in jedem Return.
- Die fertigen Beschreibungs-Strings für die Kollisionspaare; `get_selection` 412 → ~180 Zeichen, `list_presets` 338 → ~140, `get_settings` faktisch korrigieren (verspricht 8 Felder, `DocumentSettings` hat 2), Element-Zahl 19 → **24**.

*Absicherung:* `grep -c 'server\.tool('` → 0 · `grep -n 'outputSchema'` → leer · Manifest-Roundtrip: 60 Tools, jedes mit `title` + `annotations`, `result.instructions` vorhanden und < 2048 Bytes. **`npm run build:mcp` hat keinen Typecheck** — ein `annotation:` statt `annotations:` fällt still durch, also den Roundtrip wirklich laufen lassen.

Danach `MCP_SETUP_VERSION = '0.20.0'`.

**B2 — `chore: Eval-Baseline einfrieren`** — der einzige Zeitpunkt, an dem die Namen noch alt und die Beschreibungen schon neu sind. Falls das Eval als Ganzes zu teuer wird: **dieser Teil rechnet sich am ehesten** — 15 Aufgaben kosten unter 10 USD und sind danach der einzige Beleg, dass der Umbau etwas verbessert hat.

### Phase C — Defekte ◐ *teilweise* (C1/C4/C5 erledigt; **Rest ~1,5 Tage — Block 3**)

**C1** `fix: sections überleben update_style; Druckfelder überleben jeden Preset` — `deepMergeStyle` + **ein** Preserve-Helfer `preserveProjectLocalStyle(current, next)` an allen vier Aufrufstellen inkl. `DesignPanel.svelte`. (`facingPages`/`binding` sind **nicht** export-only — sie wirken in `generateStyleTypst:355-384` auf die Seitenränder. Der Fix behebt einen sichtbaren Design-Verlust, nicht nur eine Kosmetik.)
**C2** `fix: Struktur-Tools zielen auf die Projektwurzel` — `get_chapters`, `add_chapter`, `add_citation`, `split_document`, `update_settings`. Root-Resolver **zweistufig** (`findRootFileIn(dir)` → `findRootFile(state.currentFile)`) und bei `null` **hart fehlschlagen** — niemals einen nicht existierenden `main.typ`-Pfad zurückgeben (Befund 1b). `reorder`/`remove` bleiben Phase E, sie werden dort ersetzt.
**C3** `feat: update_document gestrichen, write_file bekommt Pflicht-filePath` — löst den schwersten Datenverlustpfad. **`filePath` ist Pflicht, kein Default auf `currentFile`.** Die Bequemlichkeit kostet sonst eine Kapiteldatei.
**C4** `fix: export_print liest die Tokens am richtigen Ort` — inkl. der Rückmeldung, dass `facingPages`/`binding` bei handgestalteten Projekten **nicht** angewandt werden (`buildPrintGeometryOverlay` kennt nur `bleed` und `cropMarks`).
**C5–C9** einzeln: rekursiver `.bib`-Scan · `restore_version` verlangt `confirmAll` · Caps + `truncated` (inkl. `read_file`, das nach dem `merge_document`-Merge den größtmöglichen Rückgabewert bekommt) · `update_settings` typisiert · `insert_reference.target` akzeptiert Citekeys.

### Phase D — Safe-Apply ⏳ **offen — läuft als Paritätspunkt 1 in Block 1** (`safeApplyMcp`)

**D1** `refactor: typstRun.ts` — Compile + Diagnostics-Parser herausgezogen.
**D2** `feat: safeApplyMcp + Undo-Journal`, noch ohne Verbraucher.
**D3** `feat: die Design- und Struktur-Schreiber laufen über safeApplyMcp`.

*Absicherung für D3 — der beste einzelne Nachweis im ganzen Plan:* `scripts/mcp-safeapply-test.mts` **einmal vor D2 laufen lassen, es muss rot sein** (`custom.preamble = '#set text(fill: penwright-does-not-exist)'` landet auf der Platte, Dokument kompiliert nicht mehr). Ohne roten Lauf weiß niemand, ob der Test greift.

### Phase E — Oberfläche ⏸ **zurückgestellt — Block 5, nur nach Eval** (≈ 5 Tage)

**E1** Renames · **E2** Streichungen · **E3** `apply_design_preset` · **E4** `set_chapter_look` · **E5** `set_chapter_order` (mit Mengen-Assertion: `order` ist eine **Reihenfolge, keine Inhaltsliste** — ein unbekannter Pfad ist ein Tippfehler und wird abgelehnt, nicht angelegt) · **E6** `list_design_presets` · **E7** die neun Listen nachziehen, Manifest generieren, `MCP_SETUP_VERSION = '1.0.0'`, `check:mcp` in `package:*` einhängen.

### Phase F — Skills, genau einmal ⏸ **Block 5** (≈ 3 Tage) · *die Skill-Deploy-Lücke selbst fährt schon in `projectScaffold` (Block 1) mit*

**F1** Skill-Versionierung + `openProject`-Hook · **F2** Skill-Fallback **in die Binary einbetten** · **F3** Skill-Rewrite (alle fünf in EINEM Commit) · **F4** Migrationskommando *(optional, s. §7)*.

*Absicherung F3:* `grep -oE 'penwright_[a-z_]+' src/shared/skillTemplates.ts | sort -u` gegen die registrierten Namen → leere Differenz. Zusätzlich jedes Call-Beispiel gegen die Zod-Shapes prüfen — **das hätte die zwei heute schon falschen Beispiele gefunden** (`add_citation({entry:…})`, der Parameter heißt `bibtex`; `reorder_chapters({newOrder:…})`, er heißt `order`).

---

## 4. Die Projekt-Migration

Weil deine Projekte **keine** Skills haben, ist „Migration" hier nicht Aktualisierung, sondern Erstausstattung — und mit F2 (Skills in der Binary) sogar optional.

`migrateProject(dir, { dryRun })` tut genau drei Dinge:
1. `.claude/` nach `.penwright/pre-migration/<ts>/` sichern (falls vorhanden — bei dir: nicht).
2. Die fünf `SKILL.md` schreiben, mit Provenienz in einer **Seitendatei** `.claude/skills/.penwright-skills.json` statt im Frontmatter (umgeht den unverifizierten Frontmatter-Vertrag mit Claude Code).
3. Einen Report drucken, inklusive des wörtlichen **UNBERÜHRT**-Blocks aus `MIGRATION_UNTOUCHED`.

**Es ruft niemals `ensureProjectInfrastructure`** — dessen `ensureStyleFile` legt in Projekten ohne `style.json` eine Default-Datei an ([projectManager.ts:82-92](../src/main/projectManager.ts#L82-L92)), und damit gilt das Projekt als „designt" und der Guard aus A1 greift nicht mehr.

Zwei Nebenwirkungen, die in die Release-Notiz gehören, damit sie nicht wie Bugs wirken: `.claude` ist in `readDirTree` ([projectManager.ts:128](../src/main/projectManager.ts#L128)) **erlaubt** — die fünf Ordner erscheinen im Dateibaum. Und `ensureClaudeSkills` hat **kein try/catch** ([projectManager.ts:638-649](../src/main/projectManager.ts#L638-L649)); der `openProject`-Hook muss den **ganzen** Aufruf umschließen, sonst scheitert `openProject` auf einem schreibgeschützten Ordner komplett.

**Ausdrücklich nicht:** `style.json` aus dem handgeschriebenen `style.typ` inferieren. `shared/styleInference.ts` könnte es technisch, aber deine `style.typ` enthalten `#let cover(…)`, `#let insight(…)`, `#let chapctr = counter(…)` — Dinge, die kein Token-Schema abbildet. Sobald eine `style.json` existiert, **greift der Guard aus A1 nicht mehr**, und der nächste Design-Klick ersetzt die Datei durch eine Fassung ohne diese Definitionen. Eine Inferenz würde genau den Schutz deaktivieren, den wir einbauen.

---

## 5. Pre-Flight-Checkliste

Vor dem ersten Lauf über ein echtes Projekt:

- ☐ **1** Versiegelte Vollkopie aller vier Projekte außerhalb jeder Penwright-Reichweite (`cp -Rp` + `chmod -R a-w`).
- ☐ **2** Pixel-Baseline erzeugt und neben der Kopie abgelegt.
- ☐ **3** **A1 ist gebaut und bewiesen** — FMM öffnen, Rubrik klicken → `style.typ` bit-identisch, keine `style.json` entstanden, kompiliert weiterhin. LANGSAM: Design-Panel funktioniert unverändert.
- ☐ **4** Root-Resolver ist zweistufig und schlägt bei `null` hart fehl. *Nachweis:* in `FMM - Angebot` (kein `main.typ`) `set_chapter_order` aufrufen → schreibt in `Angebot.typ`, `ls *.typ` zeigt weiterhin genau eine Datei.
- ☐ **5** Dry-Run über alle vier: `touch /tmp/marker`, Lauf, dann `find "<projekt>" -newer /tmp/marker` → **leer**.
- ☐ **6** Nach dem Echtlauf: `diff -r --exclude=.claude "<kopie>" "<projekt>"` → leer.
- ☐ **7** Nach dem Echtlauf: Pixel-Hashes identisch zur Baseline.
- ☐ **8** `npm run build:mcp-binary:all` ist **nach** dem letzten `server.ts`- und `skillTemplates.ts`-Commit gelaufen.

Zu Punkt 8 eine Falle, die nicht offensichtlich ist: `ensureInstalledBinary` ([mcpSetup.ts:210](../src/main/mcpSetup.ts#L210)) kopiert die Binary bei **jedem App-Start bedingungslos** — `MCP_SETUP_VERSION` gated nur den Wizard, nicht diesen Pfad. Die installierte Binary trackt also den letzten `build:mcp-binary`-Lauf, nicht den Quellstand. Wer nach einem Rename die App startet, ohne vorher zu bauen, bekommt eine Binary mit den **alten** Namen bei Skills, die schon die neuen nennen. Deshalb gehört in `check-mcp-tool-consistency.mjs` eine mtime-Assertion Binary vs. `server.ts`/`skillTemplates.ts`.

---

## 6. Entscheidungen, die ich getroffen habe

Die Spezifikationsblöcke widersprachen sich an sieben Stellen. Aufgelöst:

| Konflikt | Entscheidung |
|---|---|
| Skill-Rewrite war **dreifach** spezifiziert (14 h + 12,75 h + 16 h) | **Einmal**, in Phase F3, mit `dependsOn` auf Skill-Versionierung UND Abschluss aller Renames. Ein Rewrite vor der Versionierung erreicht kein einziges Projekt und wäre komplett wirkungslos. |
| Zwei Frontmatter-Schlüssel (`penwright-skill-version` vs. `penwright-version`) | Weder noch — **Seitendatei** `.penwright-skills.json`. |
| Zwei Preserve-Helfer mit **vertauschter Argumentreihenfolge** | Nur `preserveProjectLocalStyle(current, next)`. |
| `dryRun` zweimal, an zwei Orten | In `projectSearch.ts`, weil `safeApplyMcp` die exakten Writes braucht — die Tool-Ebenen-Variante hätte eine Race-Lücke. |
| `set_chapter_order`: unbekannten Pfad anlegen oder ablehnen? | **Ablehnen.** `order` heißt Reihenfolge. Zum Anlegen gibt es `add_chapter`. |
| cwd-Kriterium: `findRootFileIn` oder „hat `.typ`"? | **„Mindestens eine `.typ` auf oberster Ebene"** — sonst sperrt der Guard alle vier deiner Projekte aus. |
| `write_file` ohne Pfad = aktuelle Datei? | **Nein, `filePath` ist Pflicht.** |

Zwei weitere Festlegungen:

**Die Zielliste ist eine Datei, keine Zahl.** Die Blöcke rechneten 44, 45 und 47 — und das Wächterskript prüft **bijektiv** gegen die Doku und hängt in `package:*`. Bei falscher Zahl bricht das Packaging mit einem Fehler ab, der wie ein Doku-Fehler aussieht, als solcher „repariert" wird und die Bijektivitätsprüfung stillschweigend aufweicht. Also: `src/mcp/tools.expected.txt` mit einer Zeile je Tool, das Skript liest die Datei. Nach heutigem Umfang **47** (60 − 9 Streichungen − 6 Merges + 2 Undo-Tools).

**`sections` bleibt aus `deepMergeStyle` heraus.** `sanitizeSections` dedupliziert und kappt bei 12 — ein Patch mit einer Teilmenge **löscht** die übrigen. LANGSAM hat fünf Sections. Ein Feld, dessen Teilangabe stillschweigend andere Einträge löscht, gehört nicht in ein Werkzeug namens „update". Der `deepMergeStyle`-Fix beschränkt sich darauf, dass `sections` **überlebt**; geschrieben wird es weiterhin nur über `set_chapter_look`.

---

## 7. Was ich dir nicht abnehme

1. **`git_push`: streichen oder hinter `PENWRIGHT_MCP_ALLOW_PUSH`?** Einziges Tool mit Netzwerkwirkung, widerspricht dem eigenen Blockkommentar („All operations are local"), und es gibt per MCP keinen Weg, ein Remote zu konfigurieren. Ich neige zu streichen — es ändert die Zielzahl auf 47 vs. 48.
2. **Sollen deine vier Projekte überhaupt `.claude/skills` bekommen?** Mit F2 (Skills in der Binary) braucht kein Projekt lokale Skills, damit ein Agent arbeiten kann. Dann wird F4 (Migrationskommando + Menüpunkt, ~1 Tag) ein Komfort-Feature statt einer Notwendigkeit — und die Zahl der schreibenden Pfade in deine echten Projekte sinkt auf **einen**. Das ist in diesem Umbau mehr wert als Vollständigkeit. **Empfehlung: F2 bauen, `openProject`-Hook bauen (drei Zeilen), F4 zurückstellen.**
3. **Eval-Umfang.** 15 Aufgaben mit je 4–7 maschinellen Assertions kosten realistisch 50–55 h, nicht die veranschlagten 32 — jede Assertion muss einmal absichtlich rot und einmal grün gesehen werden. Die Baseline allein (B2) ist der Teil, der sich sicher rechnet.

---

## 8. Aufwand

**Ursprünglich veranschlagt:** ~20 PT ohne Eval. **Heute noch offen: ~13–14 PT**, davon ~7 (Block 5) an ein Messergebnis geknüpft.

| Block | Inhalt | PT |
|---|---|---:|
| 1 | Parität fertig (enthält Phase D + die Skill-Deploy-Lücke aus F) | 4 |
| 2 | Phase B + A2 + A3-Rest | 2 |
| 3 | Phase C-Rest | 1,5 |
| 4 | Eval-Set aufbauen + messen | 1 |
| **Harter Kern (1–4)** | | **~8,5** |
| 5 | Phase E + F — nur wenn das Eval Fehlgriffe zeigt | 7 |

Systematisch unterschätzt wird erfahrungsgemäß dreierlei: die `registerTool`-Migration (60 Stellen × 4 Vorlagen, eher 8 h als 5), die Doku-Items (drei Dateien zweisprachig zeilensynchron, je 5 h statt 3), und **jedes Item, das eine Svelte-Komponente anfasst** — jede i18n-Ergänzung braucht `en/` **und** `de/`, und die in CLAUDE.md dokumentierte Falle (bare Ternär von String-Literalen → Literal-Union-Rückgabetyp, mit `: string` annotieren) kostet beim ersten Mal garantiert einen Compile-Fehler. Rechne pro Renderer-Item +1 h.

---

## 9. Die drei wahrscheinlichsten Bruchstellen

**1. Der handgeschriebene `style.typ` geht verloren.** Der Weg dorthin braucht keinen Fehler, nur die falsche Reihenfolge: jemand verdrahtet `openProject` mit `ensureClaudeSkills`, fügt „zur Sicherheit" `ensureProjectInfrastructure` dazu, `ensureStyleFile` legt eine Default-`style.json` an, das Design-Panel zeigt Default-Tokens, ein Klick auf Speichern generiert `style.typ` neu. → **A1 muss vor jedem Item stehen, das `openProject` oder die Projekt-Infrastruktur anfasst, und `MIGRATION_UNTOUCHED` gehört als Konstante in den Code, nicht nur in dieses Dokument.**

**2. Der Skill-Rewrite passiert zu früh oder mehrfach.** Ein Rewrite ohne Versionierung erreicht kein bestehendes Projekt, weil `ensureClaudeSkills` nur bei fehlender Datei schreibt und `openProject` es gar nicht aufruft. Die Arbeit wäre wirkungslos und müsste wiederholt werden. → **Harte Regel: F3 erst, wenn F1 steht und Phase E abgeschlossen ist.**

**3. Die Zielzahl driftet und das eigene Wächterskript blockiert den Build.** → **`tools.expected.txt` festschreiben, bevor E7 oder irgendein Doku-Item beginnt.**
