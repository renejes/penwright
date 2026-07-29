# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-29, Ende Session 43 · Branch `main`, alles committet · App **0.12.0** · `MCP_SETUP_VERSION` **0.24.0** (Binaries neu) · Typst gebündelt: **0.14.2** · MCP: **65 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md` → „App ↔ MCP parity".** Was in dieser Session passiert ist, steht im Git-Log (`b5ae021` … `4ca47b8`) und in [app-mcp-parity.md](app-mcp-parity.md); dieses Dokument beschreibt **den Ist-Zustand und was als Nächstes zu tun ist**, nicht die Historie.

---

## 0. Wo wir stehen — in einem Absatz

Der MCP-Umbau ist abgeschlossen, das Paritätsprinzip ist auf allen vier Achsen eingelöst, und das adversariale Nach-Audit ist abgearbeitet. **Der offene Kern liegt jetzt woanders: im Round-Trip.** Der Editor schreibt beim Öffnen-und-Speichern Dinge um, die er nicht umschreiben dürfte — vier solcher Fälle wurden gestern gefunden und behoben, **zweiundzwanzig weitere sind belegt und stehen noch offen**. Das ist kein Randthema: es ist die Kernschleife des Produkts, und die Fehler landen unsichtbar in echten Kundendokumenten.

Der zweite offene Punkt ist eine Strukturentscheidung, keine Bugliste: unser Typst-Parser ist von Hand gebaut und zählt Klammern. Es gibt den echten Parser als Bibliothek. Ob und wie wir den nehmen, ist zu **bewerten** (§3) — nicht heute zu bauen.

---

## 1. Problem 1 — der Round-Trip verliert Inhalt (22 Fälle, 17 Dateien)

### Worum es geht

Öffnen in Penwright heißt: Typst → TipTap-AST → Typst. Jeder Verlust dabei landet beim nächsten Speichern auf der Platte, kompiliert weiterhin, und ist im PDF sichtbar, ohne dass irgendwo ein Fehler auftaucht. Genau so lagen zwei Fehler monatelang in `05-konditionen.typ` beider Kundenangebote.

### Was gestern behoben wurde (als Muster für den Rest)

| | Was passierte |
|---|---|
| `~` | Typsts **geschütztes Leerzeichen** wurde zu `\~` escaped = sichtbare Tilde. „Zahlbar bis 24.~August" im Zahlungsziel. Ursache: Deserializer bildete `~` und `\~` auf **dasselbe Zeichen** ab. Jetzt: `~`→U+00A0, `\~`→Tilde, und zurück. |
| `#pagebreak(weak: true)` | `startsWith('#pagebreak')` schluckte jedes Argument → erzwungener statt kollabierender Umbruch, evtl. Leerseite. Auch `to: "even"` (Ausrichtung der Doppelseite). Jetzt Attribut. |
| `#align(center + horizon)` | wurde `#align(center)` — vertikale Zentrierung weg, in drei ausgelieferten Titelseiten. |
| `  == Überschrift` in `#columns[…]` | verschmolz mit dem Folgeabsatz → Typst rendert **den ganzen Absatz als Überschrift**. Zwei Löcher: Block-Trennung auf Spalte 0 verankert, während Magazin-Container ihre Rümpfe *eingerückt* neu parsen; und `escapeLeadingBlockMarker` escapte nur ein einzelnes `=`. |

### Was noch offen ist

`scripts/roundtrip-corpus-baseline.json` — **22 Einträge, 17 Dateien**, alle in Dateien, die wir ausliefern. Grob drei Gruppen:

1. **`#opener(…)` mehrzeilig → einzeilig** (10×, `magazine-*/chapters/02-feature.typ` + `03-interview.typ`). Vermutlich harmlose Normalisierung, **aber ungeprüft** — genau die Annahme, die bei `center + horizon` falsch war.
2. **Titelseiten der `book-*`-Presets** (3× je zwei Checks). Der Token-Vergleich meldet `#v(0.3em)` → `#align(center)`: ein vertikaler Abstand wird zu einem Align-Wrapper. Das ist ein **echter** Strukturwechsel, kein Whitespace.
3. **Sample-Projekt** (4×), darunter `#raw("`code`")` → `` ``code`` `` in `07-design-showcase.typ` — das ändert die Ausgabe, und diese Datei ist zusätzlich **nicht idempotent** (zweiter Durchlauf ändert nochmal etwas). Nicht-Idempotenz ist die schlimmste Sorte: das Dokument driftet über eine Woche Bearbeitung immer weiter.

### Wie man das angeht

**Ein Fall nach dem anderen, in dieser Reihenfolge — nicht in Bündeln.**

1. Fall isolieren: `npx tsx scripts/roundtrip-corpus-test.mts` nennt Datei und erste abweichende Zeile. Daraus ein **minimales** Snippet bauen (drei bis fünf Zeilen), das den Verlust zeigt.
2. Das Snippet als Assertion in `scripts/roundtrip-test.mts` ablegen — **erst rot sehen.**
3. Fixen. Fast immer im Deserializer (Information geht beim *Einlesen* verloren, nicht beim Schreiben) oder als fehlendes Attribut auf dem Node.
4. `npx tsx scripts/roundtrip-corpus-test.mts --write-baseline` **nicht** blind laufen lassen — der Test meldet von selbst, wenn ein Baseline-Eintrag jetzt besteht, und verlangt, ihn zu streichen.
5. `npm test`.

**Die Ratsche versteht man beim ersten Mal falsch:** die Baseline ist keine Ausredenliste. Neue Verluste werden rot, *und* ein Eintrag, der anfängt zu bestehen, wird auch rot. Sie kann nur schrumpfen. Wer sie erweitert, um grün zu werden, hat den Test abgeschaltet.

**Die Vermutung, die zuerst zu prüfen ist:** alle drei Gruppen riechen nach *derselben* Ursache — Rümpfe von Makro-Aufrufen (`#opener(…)`, `#align(…)[…]`, `#columns[…]`), die zeichenweise zerlegt werden. Wenn das stimmt, sind es nicht 22 Fixes, sondern zwei oder drei. Das ist auch die Brücke zu §3.

---

## 2. Problem 2 — die Tests, und was an ihnen umzubauen ist

### Was gestern schon geradegezogen wurde

- **`npm test` existiert** und kettet: `check:mcp` → `typecheck` → `test:unit` → `test:corpus` → `test:mcp`. `package:{mac,win,linux}` führen es aus. Vorher lief beim Packaging **weder** Round-Trip noch Compile-Stability.
- **`npm run typecheck`** = `tsc --noEmit` + `svelte-check`. Der Grund, warum es das nie gab, war behebbar: `svelte-check` meldete 46 Fehler, **43 davon Phantome**, weil `tsconfig` kein `paths` für `@shared` hatte. Mit `paths` + einer `*.md?raw`-Deklaration steht der Baum bei **0 Fehlern**.
- **`compile-stability-test.mts` meldet nicht mehr falsch grün.** Es beendete sich mit Exit 0, wenn `~/Desktop/LANGSAM` fehlte — der stärkste Test im Repo meldete also auf **jeder** Maschine außer einer „bestanden", ohne etwas verglichen zu haben. Jetzt Exit 1, `--allow-skip` nur bewusst.
- **`tsx` und `svelte-check` sind jetzt Dependencies.** Sie waren keine — jede Suite lief über npx-Downloads.
- **Neu: `scripts/roundtrip-corpus-test.mts`** über 153 echte Dateien. Es hat alle vier Fehler von gestern gefunden; die 85 Unit-Round-Trips keinen einzigen.

### Was am Testaufbau noch fehlt — das ist der Auftrag

1. **Der Korpus muss die echten Projekte erreichen können, ohne sie ins Repo zu ziehen.**
   Der Test nimmt schon Pfade entgegen (`npx tsx scripts/roundtrip-corpus-test.mts ~/Desktop/Marketing/FMM`). Was fehlt: eine **`penwright.corpus.json`** (git-ignoriert) mit den lokalen Pfaden, die der Test automatisch liest. Dann läuft `npm test` auf Renés Maschine über die Kundenangebote — und genau dort lagen die Fehler. ~1 h.

2. **`compile-stability` braucht ein Korpus, das im Repo liegt.**
   Es hängt an einem privaten Ordner, ist also auf jeder anderen Maschine ein `--allow-skip`. Der stärkste verfügbare Beweis (ORIGINAL vs. ROUND-TRIP **pixelidentisch** gerendert) sollte über die **gebündelten Presets** laufen, nicht nur über LANGSAM. 35 Presets × ~2 s Kompilat ist zu langsam für jeden Lauf — also: eine feste Auswahl von 5–6 Presets, die die Konstruktklassen abdecken (Magazin, Buch-Titelseite, Report, Zwei-Spalter, Bilderbuch), als `test:compile:corpus`, in `package:*` statt in `npm test`. ~3 h. **Das ersetzt die 22 Baseline-Einträge nicht** — es ergänzt sie um „und sieht auch gleich aus", was die Textprüfung nicht kann.

3. **Die Testnamen sind Fließtext, die Suiten sind Skripte.**
   Elf Skripte, jedes mit eigenem `check()`, eigener Zählung, eigenem Exit-Code. Das ist bewusst so gewachsen und hat funktioniert — **kein Framework einführen**, nur weil es üblich wäre. Was fehlt, ist Zusammenfassung: ein `scripts/run-all.mts`, das die Suiten startet, Ergebnisse einsammelt und **eine** Bilanz druckt, statt elf. Vor allem, damit ein Fehlschlag in der Mitte nicht in 400 Zeilen Ausgabe untergeht. ~2 h.

4. **Zwei Testfallen, die uns schon zweimal erwischt haben — als Regel aufschreiben, nicht nur wissen:**
   - **Grün durch Abwesenheit.** Der erste F4-Test war grün *auch gegen den zurückgepatchten Code*: er startete pro Aufruf einen frischen Prozess, und die Veraltung existiert nur *innerhalb* einer Sitzung. **Jeder neue Test wird einmal gegen den entfernten Fix laufen gelassen.** Wenn er dann nicht rot wird, prüft er etwas anderes als gedacht.
   - **Quelltext-Assertions.** `style-guard` verglich per Regex den *Quelltext* einer Funktion. Die zog nach `shared/` um — die Regex wäre grün geworden, weil sie nichts mehr fand. Verhaltenstests statt Textsuche.

5. **Was ausdrücklich NICHT gebaut wird:** kein `.github/`, keine CI. Ein Ein-Personen-Projekt mit lokalem Signieren und manuellem Release braucht kein CI, solange `package:*` die Gates ausführt — und das tut es jetzt. Wenn das später kommt, dann als Job, der `npm test` aufruft, nicht als zweite Testdefinition.

---

## 3. Problem 3 — der handgeschriebene Parser, und `typst-syntax`

### Der Befund

`splitIntoBlocks` (deserializer.ts) zerlegt Typst, indem es `{}`/`[]`/`()` zählt und bei jedem `$` den Mathe-Modus umschaltet — **ohne Strings, Kommentare oder Escapes zu kennen**. Dazu kommen sieben unabhängige Klammer-Scanner (`matchBracket`, `matchParen`, `matchParenArgs`, `extractBracketContent`, `extractInlineBrackets`, `findClosingDelim`, `matchTypstParens`) und rund 17 Tiefenzähler-Schleifen allein in dieser Datei. Die 22 offenen Korpus-Verluste sitzen mit hoher Wahrscheinlichkeit genau dort.

### Was `typst-syntax` ist — zu verifizieren, nicht zu glauben

Das Parser-Modul **des Typst-Compilers selbst**, vom Typst-Team als eigenständige Rust-Crate veröffentlicht. Nach Renés Recherche (Stand 2026-07): Version **0.15.1** (17.07.2026), **Apache-2.0**, ~309k Downloads/Monat, 233 nutzende Projekte (u.a. tinymist), **ohne den vollen Compiler nutzbar**.

Zwei Eigenschaften sind die relevanten:

- **Der CST ist verlustfrei.** Aus der Parser-Doku: *„concrete because an in-order tree traversal will recreate the text of the source file exactly."* Jedes Leerzeichen, jeder Kommentar, jede Klammer ist ein Knoten. Das ist exakt die Eigenschaft, die unser Zeichenzählen approximiert.
- **Inkrementelles Reparsen.** `Source::edit(range, text)` parst nur den betroffenen Bereich; `Source::replace(newText)` macht intern einen Prefix/Suffix-Diff. Derselbe Mechanismus, mit dem tinymist pro Tastendruck live bleibt.

**Was es ersetzen würde:** das *Zerlegen* — `splitIntoBlocks`, den `$`-Toggle, die sieben Scanner, die 17 Zählschleifen. **Was bliebe:** unsere Interpretation — „ist dieser Block Prosa oder Raw", die Magazin-Knoten, die Node-Erzeugung. Und: **die vier Fehler von gestern wären damit nicht automatisch weg**, die saßen im Serializer.

**Der ehrliche Preis:** kein fertiges npm-/WASM-Paket. Das einzige Typst-WASM-Paket auf npm (`@brief-jetzt/wasm-typst`) *rendert*, es parst nicht, und steht auf 0.13.1. Wir müssten selbst eine `wasm-bindgen`-Crate bauen, die `parse()` aufruft und den Baum als JSON herausgibt, zu WASM kompilieren, **und in beide Prozesse bündeln** — der Deserializer läuft in App *und* MCP-Binary. Realistisch **einige Tage**. Dazu: die Crate ist mit Typst versioniert und müsste an unseren gebündelten Compiler gebunden werden (heute 0.14.2, Crate 0.15.1 — **die Versionen passen aktuell nicht zusammen**).

### Der Auftrag für die nächste Session: bewerten, nicht bauen

Konkret zu klären, in dieser Reihenfolge:

1. **Verifizieren.** Crate, Version, Lizenz (Apache-2.0 ist für uns unproblematisch — anders als das LGPL-3.0 von cetz), API-Oberfläche. Ist `parse()` wirklich ohne die Compiler-Crates nutzbar?
2. **Die Versionsfrage.** Crate 0.15.x gegen gebündelten Compiler 0.14.2 — brauchen wir Gleichstand? (Vermutlich ja: ein Parser, der eine andere Sprachversion liest als der Compiler, ist schlimmer als ein ungenauer.) Das koppelt §3 an §4.
3. **Zuschnitt.** Voller Ersatz des Zerlegens, oder nur `splitIntoBlocks`? Der kleinste sinnvolle Schnitt ist wahrscheinlich: *Blockgrenzen und Klammerbalance* vom echten Parser, alles andere bleibt.
4. **Kosten gegen Nutzen.** Zwei Prozesse, zwei Bundles, eine Rust-Toolchain in der Build-Kette, WASM-Ladezeit im Renderer. Gegen: eine ganze Fehlerklasse strukturell weg.

**Empfehlung für jetzt: nicht bauen.** Der billigere Schritt mit fast demselben Effekt ist, `splitIntoBlocks` **string-, kommentar- und escape-aware** zu machen — drei korrekte Scanner dafür stehen bereits in derselben Datei (`scanLinkCall`, `matchTypstParens`, `splitTopLevelArgs`). Ein Nachmittag, dieselbe Fehlerklasse. `typst-syntax` ist der saubere **Endzustand**, nicht der nächste Schritt. Die Bewertung soll das belegen oder widerlegen — nicht die Entscheidung vorwegnehmen.

---

## 4. Problem 4 — Typst 0.14.2 ist nicht die neueste Version

Gebündelt ist **0.14.2** (`resources/bin/typst-{arch}-{platform}`, geprüft per `--version`). Es gibt eine neuere.

**Warum das mehr ist als Versionspflege:** Renés Hinweis auf **„inbound boxes"** (Rahmen/Boxen, die im Textfluss mitlaufen statt zu überlagern) — wenn die neue Version das kann, ersetzt sie eine Klasse handgebauter `#block`/`#place`-Konstrukte in unseren Design-Elementen und Magazin-Makros. Das ist Design-Fähigkeit, nicht Wartung.

**Zu tun:**
1. Changelog der neuen Version lesen. **Was genau heißt „inbound boxes" dort**, und was können wir damit, was heute Handarbeit ist?
2. `scripts/fetch-typst-packages.mjs` / die Binary-Beschaffung auf die neue Version ziehen, **beide Architekturen**.
3. **`compile-stability-test` ist hier der Gradmesser** — ein Compiler-Wechsel, der die Presets pixelidentisch lässt, ist sicher. Einer, der es nicht tut, sagt sofort wo.
4. Die 24 gebündelten Typst-Packages gegen die neue Version prüfen (`audit:packages` deckt Lizenzen ab, nicht Kompatibilität).
5. Erst dann §3 Punkt 2 entscheiden — die Parser-Crate-Version muss zum Compiler passen.

**Reihenfolge:** Typst-Update **vor** der `typst-syntax`-Bewertung. Sonst bewertet man gegen ein Ziel, das sich gleich bewegt.

---

## 5. Was sonst noch offen ist

- **Manueller Durchgang durch die App steht weiterhin aus.** Der Assistent hat sie in drei Sessions nie gestartet; alles ist durch Tests und Quelltext belegt. Besonders zu prüfen, weil sie **heute in andere Dateien schreiben als vorher**: Document-Settings-Dialog (schreibt jetzt die Wurzel), „Kapitel hinzufügen" (`#include` in die Wurzel), Bild-Drag-and-Drop (Ablage + eingefügter Pfad geändert). Dazu neu: Design-Panel → „Bausteine", Verlaufs-Hub (projektweit), KI-Anzeige in der Statusleiste.
- **Renés echte Projekte bleiben der Härtefall.** `~/Desktop/Marketing/FMM/*`, `~/Desktop/Marketing/Ludwig Maier Mastering/*`: kein Git, keine `style.json`, keine Skills, handgeschriebene `style.typ`, **keine `main.typ`** (Wurzeln `Angebot.typ` / `Sichtbarkeitskonzept.typ`). Jeder Root-Resolver zweistufig, bei `null` **hart fehlschlagen**.
- **Der Web-Export-Branch `feat/web-export`** ist unverändert und **nicht** nach `main` gemergt.
- **Launch-Blocker:** `penwright.online` registrieren · QA auf realer 100-Seiten-Thesis + Design-Use-Cases · Windows als Fast-Follow.
- **Ungetrackt, nicht anfassen:** `resources/*/manifest.json`-Timestamps (Renés eigene Arbeit).

---

## 6. Was man vor dem ersten Commit wissen muss

- **`MCP_SETUP_VERSION` = 0.24.0**, Binaries sind gebaut. `ensureInstalledBinary` kopiert bei **jedem App-Start bedingungslos** aus `dist/mcp/bin/` — die installierte Binary trackt den letzten *Build*, nicht den Quellstand. Nach jeder `server.ts`-Änderung: bumpen **und** `npm run build:mcp-binary:all`.
- **Die Skill-TEXTE stecken in der Binary** (die MCP-Anlagewege deployen sie). Eine `skillTemplates.ts`-Änderung braucht einen Binary-Rebuild.
- **`npm test` vor jedem Commit.** Es ist schnell genug (~2 min ohne Compile-Stability) und deckt Doku-Drift, Typen, Round-Trip, Korpus und MCP ab.
- **`tsconfig` hat jetzt `paths`.** Die alte CLAUDE.md-Regel „in `.ts`-Dateien nur relative Imports, nie `@shared`" ist damit **nicht mehr tragend** — sie schadet nicht, ist aber kein Zwang mehr. In `.svelte`-Dateien gilt weiterhin: relative Imports für geteilten Code, `@shared/i18n/store.svelte` nur für den i18n-Store.

---

## 7. Arbeitsweise, die sich bewährt hat

- **Erst prüfen, ob die eigenen Fixes halten, dann nach neuen Lücken suchen.** Der Selbst-Review fand fünf Defekte im eigenen frischen Code; das Nach-Audit fand zwei Regressionen aus derselben Session.
- **Gemeinsamer Planer statt synchron gehaltener Kopien.** Reines Planen (`plan*` gibt Writes zurück), der Aufrufer wendet an. Dreizehn solche Module in `src/shared/`.
- **Jeder Fix bekommt einen Test, der ihn ohne den Fix rot sieht** — und das wird *ausprobiert*, nicht angenommen.
- **Echte Dokumente schlagen ausgedachte Snippets.** 85 handgeschriebene Round-Trips fanden null der vier Korruptionen; ein Lauf über 153 echte Dateien fand alle vier.
- **E2E über stdio gegen die gebaute Binary** ist die härteste verfügbare Evidenz — aber `npm run build:mcp` vorher, sonst testet man den Vorgängerstand.
- **Eine Messung schlägt eine Schätzung.** Block 5 des MCP-Umbaus (7 Personentage) wurde durch ein Eval für $1,36 erledigt.
