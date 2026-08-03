# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-08-03, Ende Session 48 · Branch `main`, alles committet und gepusht · App **0.12.0** · `MCP_SETUP_VERSION` **0.41.0** (Binaries neu gebaut) · Typst gebündelt: **0.15.1** · MCP: **66 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md`.** Für das *was und warum* der Veröffentlichung: [release-strategy.md](release-strategy.md).

---

## 0. Wo das Projekt steht

Die Frage aus Session 47 — **kann jemand Penwright benutzen, der kein Typst schreibt** — ist beantwortet und im laufenden Programm bestätigt. René hat die sechs offenen Punkte des letzten Handovers einzeln durchgeprüft: Slash-Menü am Cursor, Datei-Picker, Scrollen bei offenem Popup, das siebenfeldrige `#cover`-Formular, Blocknamen und `#v`-Lücke, Zahnrad-Menü. **Alle sechs bestätigt.**

Damit verschiebt sich der Schwerpunkt. Was jetzt oben liegt, ist nicht mehr Editor-Funktionalität, sondern **Veröffentlichung** — und die Entscheidungen dazu stehen seit dieser Session fest.

> ### ▶ Hier anfangen: die Startbahn aus [release-strategy.md](release-strategy.md)
>
> Der Lizenzumbau ist **fertig und committet** (`9542ec1`): keine Testphase, keine Sperre, kein Feature-Gate. Was noch fehlt, ist überwiegend nicht-technisch und steht dort in §10 — Domain registrieren, die Lizenzwahl anwaltlich gegenlesen (PolyForm Strict 1.0.0, unverändert — die zwei geplanten Zusätze sind verworfen), SBOM, drei Bildschirmaufnahmen, und das **Tor am 2026-08-24**: zwanzig Gespräche, ≥6 schriftliche Zusagen.
>
> **Der einzige technische Launch-Blocker ist Windows** (§5 dort: ungeprüft auf echtem Gerät, Signaturschiene ungeklärt).
>
> Wer stattdessen am Code weiterarbeiten will: §5 dieser Datei nennt die verbliebenen Guard-Lücken. Sie schützen unersetzliche Arbeit und sind präzise beschrieben.

---

## 1. Was Session 48 gebaut hat

Drei Commits, in dieser Reihenfolge.

### `d1c04da` — die Oberflächen, die niemand gesehen hatte

Der Auftrag war Feinschliff an zwei bekannten Schwächen. Davor lag ein **ausgelieferter Ship-Blocker**.

**Eine fehlende schließende Klammer** in `src/editor/style.css:801`, eingeführt von `ba291d0` — dem letzten Commit der Vorsession. CSS-Nesting ist kein Fehler: Chromium las die restlichen 1554 Zeilen — **219 Regeln, 66 % der Datei** — als Regeln *innerhalb* des Spacers und schloss den Block am Dateiende selbst. Aus `.footnote-popup` wurde still `.pw-is-spacer .footnote-popup`. Gemessen gegen das gebaute Bundle: **109 statt 328 Top-Level-Regeln.** Jedes Feld-Popup bekam `position: static`, keinen z-index, keine Breite, und landete außerhalb eines Viewports, dessen `body` `overflow: hidden` hat. Popups, Slash-Menü, Zitat-Badges, Makro-Karten, Magazin-Knoten und das Tabellen-Zahnrad waren ungestylt und unerreichbar.

Belegt mit drei unabhängigen Methoden: Klammerbilanz, `git`-Bisect über fünf Commits, PostCSS (`Unclosed block`, 801). **Kein Test konnte es sehen** — keine Suite las CSS.

Dazu die beiden eigentlichen Aufträge:

- **Der Datei-Picker** schrieb den Pfad relativ zum *Kapitel*. Typst löst ihn relativ zu der Datei auf, in der der `image()`-Aufruf **lexikalisch steht** — bei einem Makroargument also dessen Definitionsdatei. Der Fehler war kein Vertipper, sondern `path "…" would escape the project root`: das Dokument baute nicht mehr. Der Fix sitzt in der geteilten `buildMacroCall`, wirkt also in Slash-Menü, ＋-Dropdown und MCP gleichzeitig. `ProjectMacro.resolvesPathsHere` sagt dazu, ob das Makro den Pfad selbst konsumiert oder nur weiterreicht — im zweiten Fall behauptet das Formular keine Basis, die es nicht belegen kann.
- **Alle fünf Popups auf einen Mechanismus.** `shared/popupPlacement.ts` (rein, testbar) plus `editor/lib/popupAnchor.ts` (die DOM-Hälfte) ersetzen fünf Kopien von `top = rect.bottom + 4`. Klemmung mit echtem `max-height`, Nachführen bei Scroll/Resize/Zoom, Hysterese gegen Flackern. **Die beiden Vollbild-Backdrops sind weg**: `position: fixed; inset: 0` macht sich selbst zum Rad-Ziel, und die Scroll-Kette endet an `overflow: hidden` — gemessen 480 px → 0 px. Solange irgendein Popup offen war, ließ sich der Editor **gar nicht** scrollen.

### `9542ec1` — der Lizenzumbau

Aus einer parallelen Sitzung, entschieden und dokumentiert in [release-strategy.md](release-strategy.md). Testphase, `LicenseGate` und die MCP-Startsperre entfallen; `UsageDialog` neu; `getEntitlement()` liefert `personal`/`commercial`. **Nichts wird je gesperrt** — die Unterscheidung ist *wer*, nicht *was*.

### `d99d276` — der Guard, und was er zu lesen bekommt

Ein Audit über **jeden** Schreibpfad auf `style.typ` fand 25 Lücken, fünf davon hoch — alle an Kopien der echten Marketing-Projekte reproduziert, mit gebautem MCP-Server über stdio.

**Die gute Nachricht zuerst:** der Guard selbst ist korrekt, hält BOM/CRLF/führende Leerzeichen aus, und sieben von acht MCP-Design-Werkzeugen verweigern sauber — `style.typ` byte-identisch, Hash vorher wie nachher.

**Die Diagnose:** er wurde an der falschen Stelle gefragt. `planStyleWrites` fragte die Datei, die *gerade offen ist*. Weil die Wurzeln `Angebot.typ` heißen, findet die Namenssuche nichts, die zweite Stufe entscheidet — und die gibt eine nicht eingebundene `.typ` **als sich selbst** zurück. Vier alltägliche Wege zeigten damit auf ein Verzeichnis ohne `style.typ`: verwaiste Kapiteldatei, „Markdown importieren", „Speichern unter…", ↑-Knopf. Es entstand ein zweites Designsystem neben dem echten, und die dabei angelegte `style.json` kippte drei Exportpfade auf Penwright-Defaults.

Drei Wurzeln geschlossen:

- **(A)** Der Guard fragt das **Projekt** (`findStyleTypFiles`, Tiefe 1) und schreibt in die geprüfte Datei. Tiefe 1 mit Absicht: ein tieferer Scan ließ *jede* Datei dieses Namens die Designoberfläche einfrieren — auch eine, die die KI selbst anlegen kann.
- **(B)** Web-, Druck- und MCP-Druckexport verzweigen auf `isDesignAdopted` statt auf „existiert eine `style.json`". Der Check sitzt **in** `prepareWebDesign`, nicht im Aufrufer: die Funktion las die `style.json` sonst selbst wieder ein, und `web-export-proof.mts` ruft sie ganz ohne Override auf.
- **(C)** `guardWrite` lehnt eine handgeschriebene `style.typ` ab — `write_file` und `update_document` ersetzten vorher ganze Designsysteme und meldeten Erfolg. Mit **einer benannten Ausnahme** `restoring` für den Undo-Pfad; ohne sie schließt der Guard die eigene Rettungsleine (§4).

**Und die Inferenz, die diese Projekte liest.** `styleInference` speist den Web-Export für Projekte ohne `style.json` — also genau diese vier. Drei Lesefehler, gemessen: Überschriften kamen **um Faktor ~2 zu groß** zurück (54/26, 58/27, 54/26), weil eine Überschriftenregel mehrere `text(…)`-Aufrufe enthält und der erste die dekorative Kapitelnummer ist; die Grundschrift ging an einem Tupel-Binding verloren; und ein inline `#text(…)` konnte die Dokumentschrift definieren, weil die Heuristik die längste Argumentliste nimmt.

---

## 2. Neu im Repo, und warum es dort steht

| | |
|---|---|
| `src/shared/popupPlacement.ts` | Wo ein Popup landet. Rein und in `shared/` aus demselben Grund wie `macroFormFields`: ein Import aus `src/editor/lib/` zieht die i18n-Rune-Store mit, und `$state` existiert außerhalb des Svelte-Compilers nicht. |
| `src/editor/lib/popupAnchor.ts` | Die DOM-Hälfte: messen, lauschen, und erkennen, wann der Anker keine Box mehr hat. **Ein Mechanismus für fünf Popups** — dieselbe Sorte Streuung, die `deserializer.ts` sieben Klammer-Scanner gekostet hat. |
| `scripts/css-integrity-test.mts` | Dass `style.css` noch so parst, wie es geschrieben ist. Fängt **vier** Bruchformen, nicht eine — eine reine Klammerbilanz erkennt nur die erste. |
| `scripts/popup-dom-test.mts` | **Die erste Suite, die das DOM erreicht.** Siehe §3. |

---

## 3. Der blinde Fleck hat sich verschoben

Das letzte Handover sagte: *kein Test erreicht einen ProseMirror-Node-View.* Das gilt weiterhin — aber die Schicht darunter ist jetzt abgedeckt. (Nebenbei, weil es ein Muster ist: das letzte Handover behauptete, diese Lehre stehe in `CLAUDE.md`. Sie stand nie dort — die Datei nennt nur die *Folge* daraus, dass reine Logik nach `shared/` gehört, damit ein Test sie fahren kann. Eine Lehre, die man für aufgeschrieben hält, ist nicht aufgeschrieben.)

**Warum es sie brauchte:** die schwerste Regression dieser Session saß genau dort. `Math.max(rect.height, scrollHeight)` gibt für ein Element mit CSS-`max-height` die *Inhaltshöhe* — beim Slash-Menü 586 statt der gerenderten 320. `clampPopup` schloss daraus „passt nirgends" und klemmte an den oberen Fensterrand. Ein `/` mitten im Dokument öffnete die Befehlsliste **über der Zeile, in die gerade getippt wurde**, an derselben Stelle egal wo der Cursor stand. Die Geometrie war die ganze Zeit korrekt; die falsche Zahl kam bei ihr an.

`scripts/popup-dom-test.mts` fährt das **echte** `popupAnchor.ts` gegen die **echte** `style.css` in einem headless Chromium und fällt das Urteil in Node. Gegen alle fünf realen Defekte rot geprüft. **Bewusst nicht flakey:** jede Zusicherung ist synchron, Platzierung wird mit `update()` erzwungen statt abgewartet, Events werden dispatcht statt provoziert, und nichts hängt an `requestAnimationFrame` — das ein verstecktes Fenster nicht garantiert.

Zwei Betriebsdetails, die je einen Fehlstart gekostet haben: der Harness braucht eine `package.json` mit `main` (sonst sucht Electron `index.js` und hängt ohne Ausgabe), und die Kindprozess-Umgebung muss `ELECTRON_RUN_AS_NODE` **löschen** — aus einem VS-Code-Terminal wird Electron sonst zu Node und öffnet nie ein Fenster.

**Was weiterhin unbewiesen ist:** ob eine Karte für einen bestimmten Block *erscheint*. Das ist Node-View-Verhalten. Dafür gibt es nur den App-Start.

---

## 4. Was die Reviews gefunden haben — und was das heißt

Vier adversarische Runden über diese Session. Jede fand echte Defekte **in Code, der unmittelbar vorher geschrieben worden war**:

| Runde | roh → bestätigt | worin |
|---|---|---|
| Popup-Fixes | 39 → 20 | alle 20 im eigenen Diff |
| Popup-Migration | 24 → 9 | einer hoch: das Slash-Menü stand nicht mehr am Cursor |
| Korrekturen daran | 9 → 3 real | Kappung vor der Messung, verlorene Design-Absicht |
| Guard-Fixes | 36 → 13 | **zwei Regressionen**, darunter eine zugemachte Rettungsleine |

**Der lehrreichste Befund:** der Guard-Fix schloss `undo_last_edit` aus. `guardWrite` liest die **Platte** — hatte etwas anderes die `style.typ` bereits beschädigt, trug sie keinen Marker mehr, galt als handgeschrieben, und die Wiederherstellung wurde verweigert. Genau die, die der Kommentar daneben „the only way back" nennt. Behoben mit einer Ausnahme an **einer** Aufrufstelle — kein allgemeines `force`.

**Und dreimal war ein neuer Test grün aus dem falschen Grund** — die „green by absence"-Falle, jedes Mal anders:

1. Ein Fixture nannte die Wurzel `main.typ`. Damit fand die Namenssuche sie, die Auflösung wanderte gar nicht, und der Fall bewies nichts.
2. Ein Test suchte nach einem Wort, das im Fixture nicht vorkam. Es passierte kein Schaden, also hatte die Wiederherstellung nichts zu tun — und der Hash stimmte aus dem falschen Grund.
3. Eine Zusicherung rechnete die Bedingung **im Test nach**, statt den Produktionscode zu fahren. Genau die Quelltext-Assertion, die `CLAUDE.md` verbietet — und sie blieb grün, während der Export das Gegenteil tat.

> **Die Regel, die alle drei gefunden hat, ist dieselbe:** jeden Fix einzeln zurücknehmen und sehen, ob der Test rot wird. Nicht als Formalität — als der eigentliche Test des Tests.

---

## 5. Was offen ist

### Verbliebene Guard-Lücken — aus dem Audit, präzise beschrieben

- **Der Guard erkennt einen Dateinamen, keine Handschrift.** Liegt das handgeschriebene Design in `design.typ` statt `style.typ`, meldet er „adoptiert" — gemessen: `update_style` legt eine generierte `style.typ` an, schiebt `#import` + `#show: apply-style` über die Regel des Autors, es kompiliert, safe-apply committet, und Seite 1 sieht danach anders aus.
- **Der Marker gilt nur für Zeile 1.** Eine von Penwright erzeugte `style.typ`, der jemand Makros angehängt hat, wird beim nächsten Reglerzug kommentarlos regeneriert; `extractCustomBlock` rettet nur den eingezäunten Bereich.
- **`project:applyBackup`** schreibt beim Wiederherstellen jede Datei zurück, ohne Undo-Eintrag für den aktuellen Stand.
- **Projektweites Ersetzen** fasst `style.typ` mit an. Nutzergesteuert und mit Bestätigungsdialog — und der Undo-Test sichert inzwischen ausdrücklich zu, dass der Weg zurück offen bleibt.

### Ungeprüft im laufenden Programm

Document-Settings (schreibt die Wurzel), Kapitel hinzufügen, Bild-Drag-and-Drop, Verlaufs-Hub, **Attached Lists** (`typstListAttach.ts` — was macht ProseMirror beim Teilen einer Liste?), und dass Termlisten und Titelseiten Raw-Blocks sind.

### Bewusst nicht gebaut

- **Rumpf-Karte:** eine Karte mit *einem* Feld für Blöcke, deren `[…]` echten Fließtext trägt. Reichweite ~30 Blöcke. Ein Juroren-Panel hat „alle Blöcke werden Karten" viermal abgelehnt — 86 % der Argumente eines Projekt-Makros sind Fließtext, bei eingebauten Typst-Aufrufen sind 79 % Code.
- **Design-Angleichung Editor ↔ Vorschau.** Untersucht, von René gestrichen. Die Maschine dafür existiert (`styleToCss`, `styleInference`, das Protokoll `penwright-font://`), und die Farbe wäre ein Variablenwechsel — `--pw-mag-accent: #a8503a` in `style.css` ist hartverdrahtet, der grüne Initial im PDF ist `style-colors.accent`. Aber: `.editor` ist auf 680 px genagelt, LANGSAMs Satzspiegel ist ~469 px, die Interviewspalte ~289 px. **Sobald Schrift und Größe stimmen, bricht jede Zeile woanders als im PDF** — und der Nutzer korrigiert Umbrüche gegen eine Vorschau, die lügt. Die sichtbare Verschiedenheit ist heute der Schutz.
- **Vier Vollbild-Backdrops** (Modals, Toolbar-Dropdowns) auf einer begründeten Allowlist in `popup-dom-test.mts`. Die Trennlinie ist, **wo das Ding verankert ist**: ein Modal darf den Editor abdecken, ein Popup im Dokument nicht.

### Älteres, unverändert

- **Windows** — der einzige technische Launch-Blocker. `extraResources` filtert auf `typst-*` und kopiert **jede** vorhandene Binary in **jeden** Build; zusammen mit der Geräte-Verifikation anfassen. Signaturschiene ungeklärt (release-strategy §5).
- **codly 1.3.0** referenziert den in Typst 0.15 entfernten `pattern`-Typ. Nichts, was wir ausliefern, erreicht diese Zweige. Auf 1.4 warten.
- **`paper-preprint` / `thesis-classic`** fordern *New Computer Modern* in Semibold — Typsts eingebaute Schrift hat 400/700. Durch Bündeln nicht lösbar.
- **Verschachtelte Blockkommentare** erscheinen im Editor als bearbeitbarer Inhalt. PDF identisch, also Editor-Integrität, kein Datenverlust.
- **Branch `feat/web-export`** existiert noch, ist aber **vollständig in `main` enthalten** (`git log main..feat/web-export` ist leer). Die Notiz „nicht gemergt" stand seit v0.10.0 falsch in den Dokumenten — kann gelöscht werden.

---

## 6. Betriebswissen vor dem ersten Commit

- **`npm test`** = `check:mcp` → `typecheck` → `test:unit` → **`test:dom`** → `test:corpus` → `test:compile:corpus` → `test:mcp`. Läuft in `package:*`.
- **`test:dom` braucht Electron** und startet ein headless Fenster. Ohne Electron: Exit 1, **kein stiller Skip** — `--allow-skip`, wenn das wirklich gemeint ist.
- **`penwright.corpus.json`** (git-ignoriert) zeigt auf `~/Desktop/LANGSAM` und die beiden Marketing-Ordner. **Wenn René diese Dokumente bearbeitet, kann `npm test` rot werden** — das ist das Gate, kein Fehler. LANGSAM hat bewusst **kein `.git`** und testet damit den Pfad, bei dem die erste Version das Repo anlegt.
- **`MCP_SETUP_VERSION` = 0.41.0.** `ensureInstalledBinary` kopiert bei jedem App-Start bedingungslos aus `dist/mcp/bin/`. Nach jeder Änderung an `server.ts` **oder an geteiltem Code, der in der Binary landet** (Deserializer, `styleWrite`, `macroCall`, `designElements`, `skillTemplates`): bumpen **und** `npm run build:mcp-binary:all`.
- **`npm run fetch:typst`** ist die einzige Wahrheit für die Typst-Version (`TYPST_VERSION` im Skript). `--check` verifiziert ohne Download.
- **`grep` hält `src/main/projectMacros.ts` für binär** — die Datei nutzt NUL-Bytes als Trennzeichen in zusammengesetzten Map-Schlüsseln. `grep -a` benutzen, sonst kommen stillschweigend null Treffer.

---

## 7. Arbeitsweise, die sich bewährt hat

- **Den Compiler fragen, nicht schließen.** Die Pfadbasis war in zwanzig Sekunden entschieden: zwei Wegwerf-`.typ`, `resources/bin/typst-*`, fertig. Der Fehler zeigt sogar auf die richtige Datei.
- **Jeden Fix einzeln zurücknehmen.** Dreimal in dieser Session war ein neuer Test aus dem falschen Grund grün. Ohne diese Probe wären alle drei so geblieben.
- **Den Review VOR den Commit legen.** Vier Runden, jede fand echte Defekte in gerade geschriebenem Code. Die Trefferquote fällt (20 → 9 → 3), sie wird nicht null.
- **Ein Gate, das zufällig rot wird, ist ausgeschaltet.** Deshalb ist in `popup-dom-test` jede Zusicherung synchron und nichts hängt an `requestAnimationFrame`.
- **Eine Zusicherung, die nicht failen kann, ist Rauschen.** Drei arithmetisch implizierte sind in dieser Session wieder rausgeflogen.
- **Wo Nutzerarbeit unersetzlich ist, ist die Frage nicht „ist der Guard richtig geschrieben", sondern „wird er überall gefragt".** 25 Lücken, und keine einzige lag in der Guard-Funktion selbst.
