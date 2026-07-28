# MCP-Tools reduzieren? — Handlungsoptionen und Empfehlung

> Stand: 2026-07-28 · Bestandsaufnahme: [mcp-tool-audit.md](mcp-tool-audit.md)
> Status: **Analyse, kein Code.** Entscheidung offen.

---

## Die Frage und die kurze Antwort

**Frage:** Können wir die 60 MCP-Tools reduzieren, ohne Handlungsmöglichkeiten zu verlieren — und müssen wir das überhaupt?

**Antwort:** Reduzieren **können** wir, ohne Fähigkeit zu verlieren — aber der Ertrag ist klein und der Preis hoch. **Müssen** wir nicht. Die Messung widerlegt die naheliegende Begründung:

- Das Manifest kostet **0,86 %** eines 1-M-Fensters und **~$0,004** pro Request bei Cache-Read.
- Der strukturelle Deckel des Tool-Streichens liegt bei **−13 %** (60→37) bis **−27 %** (60→13) Manifestgröße.
- **Reine Textkürzung ohne ein einziges angefasstes Tool bringt −37 %.** Der Editier-Hebel ist größer als der strukturelle.
- Und weil ein sicheres Rename **Deprecation-Shims** braucht (~180 Zeichen je Shim), kostet ein sicheres Rename **mehr Manifest, als es einspart**: 23 gestrichene Tools sparen 4.600 Zeichen, ihre Shims kosten 4.140.

**Die Token-Begründung trägt nicht.** Was trägt, ist etwas anderes: **die zwölf Namenskollisionen, die unsichtbare Zustandsmaschine und ~15 verifizierte Defekte.**

---

## Revision (2026-07-28): Penwright ist noch nicht released

Die ursprüngliche Fassung dieses Dokuments rechnete mit Bestandsnutzern. **Das ist nicht der Fall** — es gibt keine ausgelieferten Installationen, keine eingefrorenen `SKILL.md` im Feld, keinen Wizard-Zwang für Dritte. Das verschiebt genau **eine** Kostenachse, und zwar eine große.

### Was wegfällt

| Argument der Erstfassung | Status |
|---|---|
| „Ein sicheres Rename braucht Deprecation-Shims, die 90 % der Ersparnis kosten" | **hinfällig** — Shims sind nur für Rückwärtskompatibilität nötig |
| „`MCP_SETUP_VERSION`-Bump zwingt jeden Bestandsnutzer durch den Wizard" | **hinfällig** |
| „Bestehende Projekte lesen eine Routing-Tabelle voller nicht-existenter Tools" | **stark reduziert** — betrifft nur noch die eigenen Projekte (LMM, FMM Garden, LANGSAM), s. u. |

Dazu ein Zeitfenster-Argument, das in die Gegenrichtung zeigt: **Wenn je umbenannt wird, ist jetzt der mit Abstand billigste Moment.** Nach dem Release wird jede Namensänderung wieder teuer.

### Was bleibt

Die Argumente gegen die `action`-Multiplexer (Optionen B und C) waren **nie** Migrationsargumente, sondern mechanische:

- `readOnlyHint` und `destructiveHint` schließen sich weiterhin aus.
- Per-Tool-Permissions, Skill-`allowed-tools` und Hook-Matcher in Claude Code kollabieren weiterhin auf eine Regel.
- Die Fehlerklasse verschiebt sich weiterhin von „falsches Tool" (laut) zu „richtiges Tool, falsches Feld" (still).
- Tool Search indiziert weiterhin Namen und Argumentnamen, nicht Enum-Werte.
- Die Ersparnis konvergiert weiterhin — B und C landen bei A.

Von sechs Kostenachsen ist **eine** weggefallen. Daraus folgt die tragende Unterscheidung dieser Revision:

> **Umbenennen ist jetzt praktisch gratis. Zusammenlegen ist es nicht.**
> Renames waren durch *Migration* blockiert. Merges sind durch *Mechanik* blockiert, und die bleibt.

### Konsequenz für die Empfehlung

Stufe 0 und Stufe 1 bleiben unverändert richtig und zuerst. Neu ist, dass **Stufe 2 nicht mehr am Eval hängen muss** — sie darf vorgezogen werden, weil ihr Hauptrisiko (die Skill-Bruchkante) verschwunden ist. Der Umfang von Stufe 2 wächst dabei von neun Streichungen auf Renames **plus** selektive Merges (s. „Stufe 2, revidiert").

### Der eine Punkt, der trotz Narrenfreiheit Vorbedingung bleibt

`ensureClaudeSkills` schreibt `SKILL.md` nur, wenn sie fehlt, hat kein `version:`-Frontmatter und wird von `openProject()` **nicht** gerufen. Die eigenen Projekte auf der Entwicklungsmaschine tragen nach einem Rename also dauerhaft eine veraltete Routing-Tabelle, und **kein Mechanismus erneuert sie**. Das ist kein Kompatibilitäts-, sondern ein Hygieneproblem — und es ist Vorbedingung des Renames, nicht Beiwerk.

### Die Reihenfolge ist der eigentliche Hebel

Der teuerste Posten des Umbaus ist nicht `server.ts`, sondern **`skillTemplates.ts`**: 123 Zeilen mit 39 Tool-Namen, davon eine Routing-Tabelle (`:516–537`), fünf Rezept-Sequenzen (`:589–650`) und ~25 Call-Beispiele mit vollständiger Argumentform. Inhaltliche Arbeit, kein `sed`, ~2 Tage. **Also genau einmal machen.**

Daraus folgt zwingend: **erst** Defektwelle und Semantik geradeziehen → **dann** in einem Zug umbenennen und mergen → **dann** Skills und Doku einmal neu schreiben. Jede andere Reihenfolge schreibt die Skills zweimal.

---

## Drei ausgearbeitete Optionen

Drei Vorschläge wurden unabhängig voneinander entworfen und danach gegeneinander geprüft. Alle drei bilden **alle 60 Tools vollständig ab** (nachgezählt, keiner verliert eines).

### Option A — Chirurgischer Schnitt: 60 → 37

Nur Dubletten, echte `list_*`/`get_*`-Paare derselben Domäne und die konkurrierenden Schreibpfade werden zusammengelegt. Kein `action`-Multiplexer; kein Tool wird gleichzeitig lesend und schreibend.

| neu | absorbiert |
|---|---|
| `read_file` | `read_file` + `get_document` + `merge_document` (`resolveIncludes`-Flag) |
| `write_file` | `write_file` + `update_document` (optionaler `path`) |
| `export` | `export_pdf` + `export_docx` + `export_print` (`format`-Enum) |
| `get_style` | `get_style` + `get_settings` + `list_section_styles` |
| `update_style` | `update_style` + `update_settings` + `define_section_style` |
| `apply_design_preset` | `apply_style` + `apply_palette` + `apply_layout` (komponierbar, feste Reihenfolge) |
| `list_design_presets` | `list_styles` + `list_layouts` + `list_fonts` + `list_design_elements` (`kind`-Enum) |
| `set_chapter_look` | `apply_section_style` + `clear_section_style` (`styleId: null`) |
| `set_chapter_order` | `reorder_chapters` + `remove_chapter` |
| `get_citations` | `get_citations` + `find_source_for_citation` (Feld `sourcePdf`) |
| `add_bib_entry` | `add_citation` + `ensure_bibliography` |
| `save_version` | `save_version` + `git_commit` |
| `list_versions` | `list_versions` + `show_version` + `git_status` |
| `create_project` | `create_project` + `create_from_preset` |
| `scaffold_design` | `generate_layout` (Rename) |
| `set_current_file` | `open_file` (Rename) |
| — entfällt | `git_push` (einziger ersatzloser Streich) |

Der Rest bleibt unverändert. **Aufwand ~13 Personentage.** Benannter Verlust: `git_push` (Agent kann nicht mehr pushen); zwei Aufrufe statt einem für „Rubrik aus Preset ableiten und sofort umbauen".

### Option B — Domänen-Verben: 60 → 14

Ein Tool pro Domäne mit `action`-Diskriminator, aber die vier Hochfrequenz-Einstiege bleiben eigene Verben.

`project` (4) · `read` (5) · `write` (3) · `compile` (1) · `export` (3) · `chapters` (5) · `insert` (4) · `refs` (5) · `search` (2) · **`design` (12)** · `chapter_look` (4) · `comments` (4) · `versions` (7) · `get_selection` (1)

**Aufwand ~15 Personentage.** B ist in der Selbstkritik am ehrlichsten: *„ohne den Verify-plus-Rollback-Schritt ist dieser Vorschlag netto riskanter als der Status quo."*

### Option C — Minimal Surface: 60 → 13

Penwright exportiert keine API mehr, sondern 13 Autoren-Absichten. Das Domänenwissen wandert aus 60 Tool-Namen in zwei modell-aufrufbare Wissens-Tools (`penwright_catalog`, `penwright_help`); die Zustandsmaschine entfällt.

`context` (12) · `design` (9) · `edit` (4) · `build` (4) · `catalog` (5) · `history` (5) · `structure` (4) · `file` (5) · `search` (2) · `comment` (3) · `project` (3) · `bibliography` (2) · `help` (neu) · entfällt: `git_commit`, `git_push`

**Aufwand ~18 Personentage** — die teuerste Option, weil sich nicht nur Namen, sondern **alle Signaturen** ändern.

---

## Die Gegenrechnung

Die drei Vorschläge wurden adversarial geprüft. Fünf Befunde entscheiden die Sache.

### 1. Die Ersparnis konvergiert — B und C landen bei A

Aus der Messung rekonstruiert: **~200 Zeichen konstanter Rahmen pro Tool**, ~37 Zeichen pro Parameter (Gegenprobe gegen die gemessenen 15.955 Gerüstzeichen: 0,5 % Abweichung). Daraus folgt der strukturelle Deckel — alles, was Tool-Streichen überhaupt sparen kann:

| Ziel | gestrichene Tools | strukturell | plausible Landung |
|---|---:|---:|---|
| A (37) | 23 | −13 % | **−23…−27 %** |
| B (14) | 46 | −26 % | **−31…−39 %** |
| C (13) | 47 | −27 % | **−31…−40 %** |

Alles darüber muss aus Beschreibungstext kommen — und dort läuft die Rechnung **gegen** B und C: Ein `penwright_design`, das Routing für zwölf ehemalige Tools trägt, landet realistisch bei 1.000–1.400 Zeichen Beschreibung, nicht bei den budgetierten 450. Die behauptete Parameter-Dedup ist zu ~80 % illusorisch, weil eine flach publizierte Union die **Vereinigung** aller Varianten-Felder als optionale Top-Level-Parameter trägt — und jedes Feld künftig „Pflicht bei `action=add|remove`" in seinem `describe()` mitschleppen muss.

**Ergebnis: B und C zahlen drei bis vier zusätzliche Personenwochen für ~600–800 Token gegenüber A.**

### 2. Ein sicheres Rename kostet mehr, als es spart

> ⚠️ **Gilt erst ab Release** — siehe Revision oben. Vorab-Release braucht es keine Shims, und dieses Argument entfällt.

Es gibt **keinen Alias-Pfad**: `RegisteredTool.update({name})` ist wegen eines Closure-Bugs unbrauchbar, ein `disable()`tes Tool wird bei `tools/call` abgewiesen, ein unbekannter Name gibt ein generisches „Tool not found". Der einzige sichere Weg sind **Deprecation-Shims** — je ein weiterregistriertes Tool mit dem alten Namen.

| | Ersparnis | Shim-Kosten |
|---|---:|---:|
| A (23 Shims) | 4.600 Z. | **4.140 Z.** |
| B/C (46–47 Shims) | 9.200–9.400 Z. | **8.400 Z.** |

Das disqualifiziert Tool-Umbenennung als Token-Maßnahme endgültig.

### 3. Nach der Multiplexierung ist ein Fehlgriff **still**

Heute ist ein Fehlgriff **laut**: `apply_layout({presetId:'magazine'})` bei einem Preset namens `magazine-2col` liefert eine Fehlermeldung mit den gültigen IDs — der Agent korrigiert sich in einem Turn. `apply_palette` statt `apply_style` antwortet „5 Farben geändert" statt „Theme angewendet", und die Diskrepanz ist sichtbar.

Nach der Fusion ist `penwright_design({palette:'modern-tech'})` statt `{theme:'modern-tech'}` ein **erfolgreicher Aufruf mit falschem Ergebnis**. Kein Schema-Reject, kein Lernsignal. Die Fehlerklasse verschiebt sich von „falsches Tool" (sichtbar, in einem Turn heilbar) zu „richtiges Tool, falsches Feld" (unsichtbar).

Auf einem Server, dessen **schreibende Pfade sämtlich ohne Verify, ohne Rollback und ohne AI-Snapshot laufen**, ist das keine akademische Sorge.

Verschärfend: C entfernt die Preset-IDs aus den Schemata, B nutzt `theme?: string` statt Enum. Nachgerechnet: 6 Themes + 8 Palettes + 7 Layouts + 5 Rubriken = 26 IDs ≈ **364 Zeichen ≈ 100 Token**. Für 100 Token bekommt man Schema-Validierung, Null-Roundtrip-Discovery und das beste Selbstkorrektur-Signal, das der Server hat. Die 24 Element-IDs und ~30 Preset-IDs gehören in einen Katalog — **die vier kleinen Enums gehören ins Schema.**

### 4. Annotations und Permissions kollabieren

Ein Tool kann nicht gleichzeitig `readOnlyHint:true` und `destructiveHint:true` sein. Jede Fusion, die Operationen mit unterschiedlichem Profil zusammenlegt, muss **alle Annotations auf den konservativsten Wert setzen** — und ein konservativ als destruktiv markiertes Tool erzeugt in Hosts mit Auto-Approve-Heuristik einen Approval-Prompt **pro Aufruf**. Claude Code adressiert Tools zudem als `mcp__penwright__<tool>` in Permission-Rules, Skill-`allowed-tools`, Subagent-`tools` und Hook-Matchern: `search` vs. `replace` kollabiert auf eine Regel.

**B und C erkaufen ihre Token-Ersparnis mit mehr Nutzerklicks und gröberen Rechten.**

### 5. Zwei Vorschläge haben Fehler, die man kennen muss

- **C behauptet, der `set_project`-Zwang entfalle ersatzlos** — mit der Begründung, `parseArgs` setze `projectDir` bereits. Das ist **verifiziert falsch**: `--project` setzt kein Host, `PENWRIGHT_PROJECT_DIR` schreibt kein Host; es bleibt ausschließlich `process.cwd()`. C erklärt denselben Mechanismus an einer Stelle zum Bug und an anderer zur Grundlage. Wer C so baut, produziert einen Server, der ohne expliziten Aufruf auf einem Zufallsverzeichnis operiert — **und C entfernt zugleich das „Call this first" aus allen Beschreibungen.**
- **A schließt die `currentFile`-Falle nicht, obwohl es das behauptet.** A schließt das Sandbox-Loch von `update_document`, aber die Sequenz `set_current_file(B)` → `read_file({path:A})` → ändern → `write_file({content})` schreibt A's Inhalt nach B — exakt der zitierte Fallstrick, nur ohne den zweiten Toolnamen als Warnsignal. A behält die unsichtbare Zustandsmaschine **und** führt überall optionale Pfad-Parameter ein, ohne die Präzedenzregel auszusprechen.
- **C löst `penwright_get_selection` auf** — der Name steht wörtlich im nutzersichtbaren Starter-Prompt der App. Ein Nutzer mit neuer App und alter Binary pastet dann einen Prompt, der ein nicht existentes Tool nennt.
- **B erzeugt eine neue Dublette**, die sie zu bekämpfen antritt: `write({format:'markdown'})` **und** `chapters({action:'add', format:'markdown'})` konvertieren beide Markdown.

---

## Empfehlung: drei Stufen

**Stufe 0 → Stufe 1 → Stufe 2 in dieser Reihenfolge. Keine der drei Optionen wie vorgelegt bauen.**

Am ehrlichsten formuliert: **Option A ist in der Diagnose richtig und in der Dosis falsch** — ihre Migrationsschritte 0–2 (Wächterskript, Skill-Versionierung, Bugfix-Welle) *sind* Stufe 0+1. Vorab-Release wird aus „höre nach Schritt 2 auf" allerdings „mach Schritt 3 gleich mit, aber selektiv": die Namensarbeit ist jetzt gratis, die Merges sind es nicht (siehe Revision oben). Optionen B und C bleiben abgelehnt — ihre Kosten waren nie Migrationskosten.

### Stufe 0 — sofort, 2–3 Tage, **kein einziger geänderter Tool-Name**

| # | Maßnahme | Warum |
|---|---|---|
| 1 | **`server.instructions` setzen (≤ 2 KB)** | Höchster Hebel im ganzen Dokument. Verifiziert vorhanden, verifiziert ungenutzt (`server.ts:360` übergibt kein Options-Objekt). Liefert die 60-Tool-Karte, den Standardablauf und die vier heute impliziten Regeln (`set_project` zuerst · Design-Reihenfolge Theme → Layout → Palette · `insert_reference` = gedruckt / `add_comment` = redaktionell · Kapitel-Operationen wirken auf die Wurzel) **in der Binary versionsfest** — statt aus einer projektlokalen Datei, die es in drei von vier Projekt-Entstehungswegen gar nicht gibt. Der einzige Kanal, der auch in Claude Desktop funktioniert, wo das Modell die `SKILL.md` nie sieht. Aufwand: ½ Tag. |
| 2 | **Migration `server.tool()` → `registerTool()`** + vollständige Annotations + `_meta['anthropic/alwaysLoad']` auf 4–5 Einstiegstools | Die Alt-API kann verifiziert **kein** `title`, **kein** `_meta`, **kein** `outputSchema`. `readOnlyHint` für die 21 Leser (Claude Code nutzt es für Auto-Approve), `destructiveHint` für die sechs echten Zerstörer. Rein mechanisch, kein Name ändert sich. **`outputSchema` bewusst NICHT mitnehmen** — es erzwingt `structuredContent` in jedem Return. |
| 3 | **Beschreibungs-Chirurgie** | Die zwölf Kollisionspaare **wechselseitig abgrenzen** („Use X, NOT Y, when …"). `get_selection` 412 → ~180 Zeichen kürzen, `list_presets` 338 → ~140. `get_settings` faktisch korrigieren (verspricht 8 Felder, liefert 2). Element-Zahl 19 → 24. |
| 4 | **Drei Nulltage-Bugfixes** | `projectDir`-Guard in den drei Git-Tools · `compile`-Wegwerf-PDF nach `os.tmpdir()` · `server.ts:287` akzeptiert `cwd` nur bei `findRootFileIn`-Treffer, sonst Fehler mit Verweis auf `penwright_set_project`. Letzteres ist ein Fünf-Zeilen-Fix und beseitigt eine Fehlerklasse, die **keiner** der drei Vorschläge adressiert. |
| 5 | **`scripts/check-mcp-tool-consistency.mjs`** im `package:*`-Lauf | Diffed die registrierten Namen gegen `mcp-server.md`, `handbook.md`, `handbuch.md`, `manifest.template.json`, `skillTemplates.ts` — analog zu `audit-bundled-deps.mjs`. Beendet die Drift, die heute vier Zustände produziert hat. |
| 6 | `MCP_SETUP_VERSION`-Bump + `build:mcp-binary:all` | **Bestehende `SKILL.md` bleiben zu 100 % gültig** — das ist der ganze Punkt dieser Stufe. |

*Nutzen:* der größte Teil der Selektionsverbesserung, Auto-Approve für die Leser, Ende der Doku-Drift, drei behobene Fehlerklassen. *Risiko:* praktisch null — kein Aufruf, der heute funktioniert, funktioniert danach nicht.

### Stufe 1 — 5–7 Tage, **immer noch kein geänderter Tool-Name**

| # | Maßnahme |
|---|---|
| 1 | **Die Defektwelle** aus [mcp-tool-audit.md §5](mcp-tool-audit.md): Root-statt-`currentFile` in `get_chapters`/`add_chapter`/`reorder`/`remove`/`split`/`add_citation` — **additiv** über einen optionalen `file`-Parameter mit Root-Default; Druckfelder in die Preserve-Liste von `apply_layout` und `generate_layout`; `sections` in `deepMergeStyle` (schaltet h2–h6 frei und macht `define_section_style` faktisch redundant, **ohne es zu streichen**); rekursiver `.bib`-Scan; `export_print` zweite Bahn für Projekte ohne `style.json`; `update_document` bekommt den `resolveInsideProject`-Guard; `restore_version` verlangt `confirmAll`; `replace_in_project` bekommt `dryRun`; Caps + `truncated` für `list_comments`, `show_version`, `list_design_elements`, `get_document`. |
| 2 | **Die eine echte Fähigkeitslücke schließen, additiv:** `insert_reference.target` akzeptiert auch Citekeys. Damit ist „füge Kapitel 4 ein und zitiere @chen2021 im dritten Absatz" **erstmals** bedienbar — heute gibt es dafür im ganzen Server kein Tool. |
| 3 | **Die Schreib-Ziel-Falle schließen** (Nachtrag — in der Erstfassung dieses Plans übersehen). `read_file(A)` → ändern → `update_document` schreibt still nach `B`, weil `read_file` `currentFile` nicht verschiebt. Der `resolveInsideProject`-Guard aus Punkt 1 ist eine Sandbox-Maßnahme und schließt das **nicht** — derselbe Vorwurf, den ich Option A mache, trifft die Erstfassung dieses Stufenplans. Zwei billige, namensneutrale Auswege: **(a)** jede Lese-Antwort trägt den aktiven Schreib-Ziel-Pfad mit (der Agent sieht „gelesen A, Ziel B"), oder **(b)** `update_document` verweigert, wenn die zuletzt gelesene Datei nicht das aktive Ziel ist, und nennt im Fehler beide Pfade. Laut scheitern statt still falsch schreiben. |
| 4 | **`safeApplyMcp`** — stage → `verify()` → commit/rollback + Undo-Journal um die vier `style.json`-Schreiber. **Die einzige Maßnahme in allen drei Vorschlägen, die reales Schadenspotenzial senkt** — und sie hat mit Konsolidierung nichts zu tun. Unabhängig baubar, ~1,5 Tage. Alle drei Vorschläge führen sie als Voraussetzung *ihres* Umbaus; richtig ist die umgekehrte Priorisierung. **Reichweite ehrlich benennen:** das deckt Design-Schreibvorgänge ab, **nicht** `insert_design_element`, `add_chapter`, `split_document`, `replace_in_project`, `import_markdown` oder `write_file`. Für Inhalts-Schreibvorgänge gibt es per MCP weiterhin kein Netz — die AI-Snapshots greifen nur für die im Editor offene Datei. Das billigste Netz dafür ist kein neues Tool, sondern ein **erzwungener `save_version` vor Bulk-Operationen**; die Skills empfehlen das heute, nichts erzwingt es. |
| 5 | **Skill-Versionierung — Vorbedingung des Renames, nicht Beiwerk:** `version:`-Frontmatter + `SKILLS_VERSION`; `ensureClaudeSkills` in `openProject()` / `ensureProjectInfrastructure()` / `openSampleProject()` / `presetManager` / MCP-`create_project` verdrahten; Hash-basierte Upgrade-Semantik (unveränderte Datei überschreiben, modifizierte daneben als `SKILL.md.new`); `mcp-server.md:477/479` faktisch korrigieren. Ohne diesen Schritt tragen auch die **eigenen** Projekte nach dem Rename dauerhaft eine veraltete Routing-Tabelle. |
| 6 | **Eval-Set aufbauen und messen** — 10–15 verifizierbare Autorenaufgaben, gegen Claude Code **und** Claude Desktop. Baseline **vor** Stufe 0, Wiederholung nach Stufe 1 und nach Stufe 2. Vorab-Release ist das Eval die *einzige* Rückmeldung, die es überhaupt gibt — es ersetzt die Nutzerberichte, die es noch nicht gibt. |

*Nutzen:* der eigentliche Qualitätssprung. Fast alles, was in den drei Vorschlägen als „Fix reitet mit" firmiert, wird hier zum Hauptzweck. *Risiko:* Verhaltensänderungen (Root statt offene Datei, rekursive Bib-Suche) gehören in die Release Notes, brechen aber keine Namen.

### Stufe 2, revidiert — 5–7 Tage, Renames **und** selektive Merges, in **einem** Zug

Vorab-Release ist Stufe 2 nicht mehr eval-gebunden, sondern nur noch reihenfolgegebunden: **nach** der Defektwelle (sonst schreibt man die Skills zweimal), **nach** der Skill-Versionierung (sonst veralten die eigenen Projekte still). Ohne Shims, ohne Aliase, in einem Release.

**2a — Renames. Nur da, wo der Name sachlich falsch ist, nicht bloß lang.** Kostenlos, weil rein nominal; jeder Fall behebt eine belegte Fehlleitung.

| heute | neu | warum |
|---|---|---|
| `add_citation` | `add_bib_entry` | heißt für jeden Autor „setz `@key` in den Text", fasst Prosa aber nie an |
| `generate_layout` | `scaffold_design` | heißt „layout", überschreibt Theme, Farben, Fonts, Headings **und** setzt einen Hero |
| `open_file` | `set_current_file` | klingt nach lesen, liefert nur eine Wortzahl; identisches Schema wie `read_file` |
| `list_styles` | `list_themes` | liefert Themes, kollidiert mit `get_style` |
| `split_document` | `split_into_chapters` | suggerierte ein Paar mit `merge_document`, von dem eine Hälfte read-only war |

**2b — Ersatzlose Streichungen.** Kein Retrieval-Signal geht verloren, weil das Tool eine Dublette oder die schlechtere Variante war.

| streichen | Ersatz |
|---|---|
| `git_commit` | `save_version` (Dublette ohne Auto-Init, ohne `.gitignore`, ohne No-Change-Erkennung) |
| `ensure_bibliography` | `add_bib_entry` ohne `bibtex` |
| `update_document` | `write_file` (schließt zugleich dessen Sandbox-Lücke) |
| `merge_document` | `read_file({resolveIncludes})` |
| `find_source_for_citation` | Feld `sourcePdf` auf `get_citations` |
| `show_version` | `list_versions({sha})` |
| `clear_section_style` | `set_chapter_look({styleId: null})` |
| `define_section_style` | `update_style` (setzt Stufe-1-Fix des `sections`-Zweigs voraus) |
| `git_push` | streichen **oder** hinter `PENWRIGHT_MCP_ALLOW_PUSH` — einziges Tool mit Netzwerkwirkung, widerspricht dem eigenen Blockkommentar |

**2c — Merges: jeder einzeln entscheiden, nicht als Paket.** Hier liegt das Restrisiko, und es ist migrationsunabhängig.

| Merge | Urteil |
|---|---|
| `apply_style` + `apply_layout` + `apply_palette` → ein komponierbares `apply_design_preset({theme?, palette?, layout?})` | **ja** — kodiert die heute nur im Kopf existierende Reihenfolge Theme → Layout → Palette und macht die Preserve-Liste einmalig statt dreifach. Preset-IDs bleiben `z.enum` im Schema. |
| `apply_section_style` + `clear_section_style` → `set_chapter_look` | **ja** — `styleId: null` ist ein nullable Wert, kein `action`-Diskriminator |
| `reorder_chapters` + `remove_chapter` → `set_chapter_order` | **ja** — zwei Zeileneditoren auf derselben Include-Liste, gleicher Blast-Radius |
| die vier `list_*`-Konstanten-Dumps → ein `list_design_presets({kind})` | **ja** — alle Zweige read-only, keiner mit eigenen Pflichtfeldern; behebt zugleich den 19-statt-24-Fehler und den 19-k-Zeichen-Dump |
| `export_pdf` + `export_docx` + `export_print` → ein `export({format})` | **eher nicht** — formatabhängige Pflichtfelder (`print.*` nur bei `format:'print'`) sind im JSON-Schema nicht ausdrückbar; Fehlgriffe werden Laufzeit- statt Schema-Fehler. Wenn doch: „bleed"/„Schnittmarken" müssen wörtlich in die `describe()`-Texte, sonst verliert Tool Search die Begriffe. |
| `get_style` + `get_settings` + `list_section_styles` → ein Leser | **nein** — produziert eine Antwort, die niemand ganz braucht. Besser: `get_settings` faktisch korrigieren (Stufe 0) und stehen lassen. |
| das Anker-Quartett → ein generisches `insert_at_anchor({payload})` | **nein** — löst vier payload-spezifische Schemata in `z.unknown()` auf, macht `readOnlyHint`/`destructiveHint` pro Payload unmöglich und kollabiert die Per-Tool-Permissions |
| `search_project` + `replace_in_project` → ein Tool mit optionalem `replacement` | **nein** — genau die Lesen-plus-zerstörendes-Schreiben-Fusion aus „Was man nicht tun sollte" |

**Landung:** ~44–46 Tools bei den empfohlenen Merges, ~42 wenn der Export mitgeht. Nicht 37 und schon gar nicht 13 — aber jede verbleibende Grenze ist begründet statt geerbt.

### Falls doch einmal nach dem Release umbenannt werden muss

Dann **additiv statt ersetzend**: das neue Tool kommt hinzu (+1 Tool, ~600 Zeichen), `instructions` und Skills zeigen nur noch darauf, die alten bekommen „legacy — prefer `<neu>`" in die Beschreibung, und erst im übernächsten Release fallen sie weg. Zwischen beiden Releases funktioniert **beides**, also bricht keine eingefrorene `SKILL.md` je — und die Deprecation-Shims entfallen, weil die alten Implementierungen in der Übergangszeit ohnehin stehen bleiben. Netto nach beiden Releases: dieselbe Reduktion, null Bruchkante.

### Zwei Ideen aus B und C, entkoppelt herausziehen

Beide haben mit Konsolidierung nichts zu tun, sind additiv und namensneutral — also **direkt in Stufe 0/1 einbaubar**:

- **`penwright_help`** (aus C): versionsfestes Routing-Wissen als **modell-aufrufbares** Tool. Das ist die einzige Ergänzung, die `server.instructions` sinnvoll flankiert — und es kann heute zu den 60 Tools **hinzukommen**.
- **Einheitlicher Rückgabe-Envelope** (aus B): `{ok, data, warnings, errors[{file,line,message}]}` über alle Tools, plus `parseCompileDiagnostics` auch auf den Export-Pfaden.

---

## Was man nicht tun sollte

**1. Tool-Namen ändern, bevor die Skill-Upgrade-Mechanik steht.** Vorab-Release betrifft das nur die eigenen Projekte — aber es betrifft sie dauerhaft: `ensureClaudeSkills` schreibt nur bei fehlender Datei, kennt kein `version:` und wird von `openProject()` nicht gerufen. Der Failure-Mode ist nicht „Fehler", sondern der **stille Rückfall auf `penwright_write_file`** — also die Umgehung genau der Validierungen, für die die Tools existieren. **Nach** dem Release kommt der ganze Rest dazu: `MCP_SETUP_VERSION` steuert nur die Binary, nicht den Skill-Inhalt; wer den Wizard wegklickt, behält die alte Binary; es gibt keinen Alias-Pfad (`update({name})` ist kaputt), und Shims kosten 90 % der Ersparnis. Ab Release gilt deshalb ausschließlich der additive Weg (siehe Stufe 2, letzter Absatz).

**2. Lesen und zerstörendes Schreiben unter einen Tool-Namen legen.** `versions({action:'restore'})`, `search({replacement})`, `design({theme})` — in jedem Fall ist ein Enum-Wert die Grenze zwischen Abfrage und irreversiblem Schaden, auf einem Server ohne Verify, ohne Rollback, ohne Snapshot. Es zerstört zusätzlich `readOnlyHint` (Auto-Approve für 21 Leser) und kollabiert die Per-Tool-Permissions. **Der einzige Punkt, an dem eine Konsolidierung die Sicherheit senkt statt sie zu heben.**

**3. Preset-IDs aus den Schemata in einen Katalog-Roundtrip verlagern.** Ersparnis ~100 Token für die vier kleinen Enums; Kosten: Schema-Validierung, Null-Roundtrip-Discovery und das beste Selbstkorrektur-Signal des Servers. Die 24 Element-IDs und ~30 Preset-IDs gehören in einen Katalog — `theme`, `palette`, `layout`, `rubric` gehören ins Schema.

---

## Was vor der Entscheidung gemessen werden muss

| # | Offene Frage | Aufwand | Warum entscheidungsrelevant |
|---|---|---|---|
| 1 | **Ist Tool Search in Claude Code für Penwright aktiv?** Server verbinden, `/context` prüfen bzw. `ENABLE_TOOL_SEARCH=false` gegen Default A/B-en. | 20 Min | `auto` heißt „upfront laden, solange < 10 % des Fensters" = 100.000 Token bei Opus 5. Penwright liegt bei 9.500 — **dann greift Tool Search nie**, und die Retrieval-Sorge ist gegenstandslos. Greift es doch, sind die Kontextkosten ~0 und Retrieval ist der zentrale Punkt. **In beiden Zweigen stirbt das Token-Argument** — aber was übrig bleibt, unterscheidet sich diametral. |
| 2 | **Reicht der Meta-MCP-Proxy `resources/*` und `notifications/*` durch?** | ½ Tag | Solange unbekannt, darf keine Resource als Ersatz für ein Tool verbucht werden. |
| 3 | **Eval-Set: 10–15 Autorenaufgaben, Baseline vor Stufe 0, Wiederholung nach 1 und nach 2.** | 2 Tage | Es gibt **keine** publizierte Accuracy-über-N-Kurve für MCP und **keine** Head-to-Head-Messung Multiplex vs. granular; die „30–50"-Schwelle ist eine Vendor-Behauptung. Jede Behauptung „weniger Fehlgriffe" ist unbelegt. Vorab-Release gatet das Eval Stufe 2 nicht mehr (die Renames sind ohnehin billig), aber es ist die **einzige** Rückmeldung, die es vor dem Launch überhaupt gibt — und es entscheidet, ob die strittigen Merges aus 2c nötig sind. |
| 4 | Exakte Token-Zahl via `count_tokens` statt der 3,7-Zeichen-Heuristik | 30 Min | Ändert die Entscheidung nicht — 0,86 % bleibt 0,86 % auch bei ±15 %. |

**Beispielaufgaben für das Eval-Set:** „mach mir daraus ein Magazin-Layout" · „füge Kapitel 4 ein und zitiere @chen2021 im dritten Absatz" · „exportiere druckfertig mit 5 mm Beschnitt" · „welche Kapitel benutzen den feature-Look" · „stell die letzte Version von Kapitel 3 wieder her" · „finde alle Stellen, an denen @schmidt2019 zitiert wird" · „mach die Überschriften eine Stufe kleiner".

---

## Zusammengefasst

| | |
|---|---|
| **Müssen wir reduzieren?** | Nein. Das Manifest kostet 0,86 % des Fensters — ein Token-Problem existiert nicht. |
| **Können wir?** | Ja. Vorab-Release sogar billig: 60 → ~44 ohne Fähigkeitsverlust. 60 → 13 weiterhin nur mit benanntem Verlust an Annotations, Permissions und Retrieval-Signal. |
| **Lohnt es?** | Nicht als Token-Maßnahme (der Editier-Hebel −37 % schlägt den strukturellen Deckel −27 %). Wohl aber als Klarheits-Maßnahme — und **jetzt** zum billigsten Zeitpunkt, den es je geben wird. |
| **Was ist das echte Problem?** | Zwölf Namenskollisionen, eine unsichtbare Zustandsmaschine samt Schreib-Ziel-Falle, ~15 verifizierte Defekte, fehlendes Verify/Rollback auf **allen** Schreibpfaden, sechs driftende Tool-Listen. |
| **Fixen Stufe 0+1 das?** | Vollständig: `cwd`-Fallback, die 15 Defekte, die Listen-Drift, die Citekey-Lücke. Teilweise: Verify (nur Design-Schreiber), Zustandsmaschine (verkleinert). **Abgemildert, nicht gelöst: die Namenskollisionen** — dafür ist Stufe 2 da. |
| **Was tun?** | Stufe 0 (2–3 Tage) → Stufe 1 (5–7 Tage) → Stufe 2 (5–7 Tage), in dieser Reihenfolge. Renames und Streichungen vollständig, Merges einzeln entschieden. Skills und Doku **einmal** am Ende neu schreiben. |
