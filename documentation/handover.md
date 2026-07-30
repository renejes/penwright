# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-30, Ende Session 46 · Branch `main`, alles committet · App **0.12.0** · `MCP_SETUP_VERSION` **0.26.0** (Binaries neu gebaut) · Typst gebündelt: **0.15.1** · MCP: **65 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md`.** Das Fundament ist gebaut; ab hier geht es um eine Produktfrage, nicht mehr um Reparatur.

---

## 0. Die Aufgabe

**Penwright soll von jemandem benutzbar sein, der kein Typst schreiben kann.**

Das gilt für alles drei — Text, Struktur, Design — und ausdrücklich auch für das, was die **KI erzeugt**: Wenn Claude für ein Magazin einen eigenen Design-Baustein baut, darf das Ergebnis für den Nutzer kein Code-Block sein, den er nur anschauen kann.

Die Architektur dafür ist entschieden (§3), die `typst-syntax`-Frage ist beantwortet und auf einen Fall geschrumpft (§3, Ende). Das Fundament steht: der Round-Trip ist vertrauenswürdig (Baseline 0, Pixel-Gate über 39 Projekte inkl. der echten Kundendokumente), das Paritätsprinzip ist eingelöst, Typst ist auf 0.15.1 — alles ab §6 nur noch Betriebswissen.

> ### ▶ Hier anfangen: **§3a, Stufe 0**
>
> Ein latenter Fehler im Block-Splitter zerstört Überschriften, sobald jemand Prosa in einen Makro-Rumpf tippt. Er fällt heute niemandem auf — **und genau das Feature aus §3 aktiviert ihn.** Er ist deshalb die erste Aufgabe, nicht die dringendste.
>
> Danach §4a (Umsetzungsreihenfolge). **§2 (Tabellen) ist der größte Einzelgewinn, aber unabhängig** — jederzeit machbar, blockiert nichts und wird von nichts blockiert.

---

## 1. Das Problem, gemessen

**62,5 %** aller Blöcke in den ausgelieferten Presets und **42,4 %** in Renés echten Dokumenten sind `typstRawBlock` — für den Editor undurchsichtig, nur als Code anzuschauen.

Die Zahl allein führt aber in die Irre. Sie zerfällt in **vier Eimer mit völlig verschiedenen Kosten**, und nur der letzte braucht überhaupt einen Parser:

| Eimer | Menge (Presets / echt) | Was drin ist | Was zu tun ist |
|---|---|---|---|
| **1. Infrastruktur** | ~60 % der undurchsichtigen Masse | `#let` (443/84), `#import` (92/50), `#set`, Kommentare (358/104) | **Nichts.** Das ist `style.typ` / `macros.typ`. Ein Nicht-Typst-Nutzer soll das *nicht* von Hand bearbeiten — dafür gibt es den Design-Tab. Undurchsichtig ist hier die richtige Antwort. |
| **2. Trivial** | `#v` (67/47), `#pagebreak` (43/12) | Abstände, Umbrüche | Billige Nodes, falls überhaupt gewollt. Ein Abstandshalter als Code-Block ist Lärm, kein Verlust. |
| **3. Erkannt, aber aufgegeben** | `#table` (16), `#figure` (16), `#align` (13), `#text` (18) | Konstrukte, für die ein Parser existiert, der aussteigt | **Begrenzte Arbeit, kein CST.** Siehe §2 — hier liegt der größte Gewinn pro Aufwand. |
| **4. Nutzer-/KI-Makros** | `#note` (18), `#insight` (16), `#modul` (12), `#herohead` (8), `#callout` (7), `#band` (6), `#box-choice` (6), `#sumrow` (5), `#grid` (18/13), `#block` (10) | Von Hand oder **von der KI erfundene Bausteine** | **Der eigentliche Fall.** §3 — und es ist überwiegend *kein* Parser-Problem. |

Gemessen über 153 ausgelieferte und 55 echte Dateien: `deserializeTypst` über den Korpus laufen lassen und die Top-Level-Knotentypen zählen. Leicht zu wiederholen, wenn sich etwas ändert.

> **Zum Verhältnis der Eimer:** Eimer 3 (Tabellen, §2) ist der schnellste sichtbare Gewinn und blockiert nichts. Eimer 4 ist das eigentliche Ziel dieser Aufgabenstellung. Eimer 1 und 2 sind bewusst *nicht* zu bearbeiten.

---

## 2. Der größte Einzelgewinn — **Tabellen** (unabhängig, nicht der Startpunkt)

**Null von sechzehn Tabellen im gesamten Korpus sind editierbar.** Auch nicht die Preistabellen in Renés Kundenangeboten. Jede einzelne ist ein Code-Block.

Der Grund steht in `parseTable` (`deserializer.ts`): es erwartet `#table(columns: N, [cell], …)` mit einer **ganzzahligen** Spaltenzahl. Echte Tabellen schreiben:

```typst
#table(
  columns: (auto, 1fr, auto),
  align: (left + top, left + top, right + top),
  table.header[Phase][Was darin steckt][Preis netto],
  [*Phase 1* \ #text(…)], …
)
```

Ein Tupel statt einer Zahl, ein `align:`-Tupel, `table.header[…][…]` in Klammerform. Der Parser steigt in der ersten Zeile aus.

**Für die Aufgabenstellung ist das der wichtigste einzelne Befund:** Tabellen sind im Geschäftsdokument das häufigste strukturierte Element und komplett unzugänglich. Das zu beheben ist begrenzte Arbeit an einem vorhandenen Parser — **kein CST, kein Rust**. Wer hier anfängt, macht die App für den Zielnutzer spürbar zugänglicher, bevor irgendeine Architekturentscheidung fällt.

Abgeschwächt gilt dasselbe für `#figure`, `#align` und `#text` — alle drei haben Parser, die bei realen Argumenten aussteigen.

> **Achtung, die Regel gilt weiter:** ein Parser darf nur beanspruchen, was der Knotengraph **zurückgeben** kann (CLAUDE.md, „The round-trip rule"). Wenn `parseTable` `align:` liest, muss der Serializer es wieder schreiben — sonst tauscht man Unzugänglichkeit gegen stillen Verlust. Das Pixel-Gate ist der Beweis, nicht die Meinung.

---

## 3. Die Architektur: projekt-eigene Bausteine

**Die Anforderung, gesetzt:** Die KI entwirft ein Design frei — mit Bausteinen, die wir nicht vorhersehen, und kombiniert sie kreativer, als wir es antizipieren können. Der Nutzer muss diese Bausteine per Knopf/Rechtsklick **einfügen** und danach **bearbeiten** können, ohne Typst zu tippen. Flexibilität ist damit keine offene Frage mehr, sondern Randbedingung.

### Die Form in einem Satz

> **Der Katalog der einfügbaren Bausteine wird aus den `#let`-Definitionen des Projekts selbst abgeleitet — keine Registry-Datei, kein Marker. Eingefügte Bausteine bleiben `typstRawBlock`; Bearbeiten ist ein Formular im vorhandenen Node-View, das Byte-Bereiche im Aufruf ersetzt (splict), statt den Aufruf neu zu erzeugen.**

Das ist Weg A und Weg B aus der letzten Fassung zusammengefallen, und zwar nicht als Kompromiss: **die `#let`-Signatur *ist* die Deklaration** (A, ohne Deklarationspflicht), und **Splicen ist der Teil von B, der tatsächlich trägt** — ohne CST, ohne Rust.

### Drei Entscheidungen, die anders ausfielen als gedacht — jeweils mit Begründung

**Kein Marker.** `classifyRawBlock` stuft einen Block, dessen erste Zeile mit `//` beginnt, als `comment` ein — ein marker-geführter, inhaltstragender Block landet damit einen Schritt vom Export-Skip entfernt. Und der Marker ist überflüssig: `parseMagazineMacro` dispatcht ohnehin über den **Makronamen**. Wiedererkennung = erstes Token des Raw-Blocks ist `#<name>`, und `<name>` steht im Katalog.

**Keine Deklarationspflicht für die KI.** Sonst ist der Katalog auf jedem bestehenden Projekt leer. `#modul` und `#box-choice` existieren heute schon, undeklariert, in `FMM - Angebot/style.typ`. Ein vorangestellter `//`-Kommentar wird zum Label, wenn vorhanden — mehr nicht.

**Der Katalog gilt PRO DATEI, nicht pro Projekt.** Mit dem gebündelten Compiler nachgewiesen: ein `#import "macros.typ": *` **in der Wurzel erreicht ein `#include`tes Kapitel nicht** (`error: unknown variable`). In LANGSAM importiert `chapters/00-cover.typ` nur `../style.typ` — ein projektweiter Katalog böte dort alle `macros.typ`-Makros an, und **keines davon würde kompilieren**. Also: `visibleIn(defs, targetFile)` — sichtbar ist, was in dieser Datei definiert oder von ihr importiert wird.

### Die vier Berührungspunkte

| | Wie | Datei |
|---|---|---|
| **KI schreibt** | Nichts Neues. `#let` wie bisher; ein `//`-Kommentar darüber wird zum Label. | — |
| **MCP liest** | `listProjectMacros(projectDir?, targetFile?)` — exakt das Muster von `listProjectLabels` (`src/main/projectLabels.ts`), gleicher Walk, gleiche Skip-Liste. Der MCP-Server importiert bereits direkt aus `src/main/` — der etablierte Paritätsweg. | `src/main/projectMacros.ts` (neu) |
| **UI bietet an** | Sektion „Aus diesem Projekt (N)" über den 24 Built-ins; `getCommands()` bekommt einen Parameter und speist Slash-Menü **und** ＋-Dropdown weiter aus der einen Quelle. | `DesignElementPicker.svelte`, `slashCommands.ts` |
| **Instanz editieren** | Formular im **bestehenden** `typstRawBlock`-Node-View. Feldänderung → `spliceArg(content, [start,end), wert)` → `updateAttributes({content})` — derselbe Pfad, den die Textarea heute nutzt. | `src/shared/macroCall.ts` (neu), `typstRawBlock.ts` |

**Warum kein neuer Node-Typ — gemessen, nicht vermutet.** Ein eigener `projectElement`-Node ohne Mapping in allen fünf Serializern verliert Inhalt: `htmlSerializer` gibt für unbekannte Knoten einen HTML-Kommentar zurück, `docxSerializer` emittiert im `default:`-Zweig nur, wenn `node.content` existiert — ein Baustein ohne Body verschwände ganz. Als Raw-Block greifen dagegen die vorhandenen Unknown-Macro-Rettungen (`renderUnknownCallArgs` u. a.), die genau dafür geschrieben wurden. **Der Raw-Block ist die richtige Antwort, nicht die faule** — und die Round-Trip-Regel ist per Konstruktion erfüllt, weil `serializer.ts` `attrs.content` wörtlich zurückgibt.

### Wo die Parser-Frage danach noch steht

Deutlich enger als vorher. Für die häufige Form `#name(a: 1, b: "x")[body]` reichen die vorhandenen Scanner. Offen bleibt genau eines:

**Verschachtelung in einem Container, den wir nicht kennen.** Der Deserializer parst Top-Level-Blöcke plus die Rümpfe der Container, die er kennt (`#columns`, `#notiz`, `#bildtafel` via `parseBlocks`). Steckt ein Baustein in einem **KI-erfundenen** Container, findet ihn niemand. Das ist der Fall, den René mit „kreativer kombiniert" meint, und **dort und nur dort** ist der CST nicht mehr optional.

**Bauprinzip daraus:** Das Auffinden einer Instanz muss **eine einzige, austauschbare Funktion** sein — heute ein Scanner über Top-Level plus bekannte Container, morgen eine CST-Abfrage. Registry, Karte, Formular, MCP-Tools bleiben beim Tausch unverändert. Wird das Auffinden dagegen über die Codebasis verstreut (wie heute die sieben Klammer-Scanner), ist der Umstieg eine Neuschreibung statt einer Ersetzung.

---

## 3a. STUFE 0 — der Blocker, der vor allem anderen kommt

**Der Block-Splitter zerstört Überschriften, sobald jemand Prosa in einen Makro-Rumpf tippt.** Selbst nachgemessen:

| Eingabe | Ergebnis |
|---|---|
| `#m(title: "Preis (netto")[…]` | ok — Strings werden übersprungen |
| `#m[Preis [netto]` | **Überschrift danach verloren** |
| `#m[Preis \[netto]` | **verloren — Escapen hilft nicht** |
| `#m(title: "x")[ Ein ( Text. ]` | **verloren** |
| `#notiz(title: "T")[ Kosten (ca. 30% mehr. ]` | **verloren** |

Die Ursache steht in einer Zeile in `scanLine` (`deserializer.ts`):

```ts
let code = braceDepth > 0 || bracketDepth > 0 || parenDepth > 0;
```

`bracketDepth > 0` heißt *wir stehen in einem `[…]`-Body*, also in **Markup** — die Zeile geht trotzdem in den Code-Modus, und eine einzelne `(` in der Prosa des Nutzers wird als Klammer gezählt. Es ist dieselbe Fehlerklasse wie `c3ba300` und `e23168f`, nur eine Ebene tiefer: dort für Prosa auf oberster Ebene behoben, hier für Prosa **im Rumpf eines Makros**.

**Warum es heute niemandem auffällt:** der Korpus ist sauber — die KI schreibt balancierten Code, und **noch nie hat jemand in diese Blöcke getippt**. Der Fehler ist latent. **Genau das Feature aus §3 aktiviert ihn**: editierbare Rümpfe heißen, dass Nutzer dort Text mit Klammern schreiben.

**Der Fix:** ein Modus-Stack statt eines `code`-Booleans. Ein `[` öffnet Markup (dort zählen nur `[`/`]`), ein `(`/`{` öffnet Code (dort zählen alle drei), ein `#` innerhalb von Markup öffnet wieder Code. Zusätzlich muss `escaped` auch im Delimiter-Zweig geehrt werden — heute wird es dort nie gelesen, weshalb `\[` nicht hilft.

**Das Ausmaß, gemessen.** Simuliert wurde genau das, was der Nutzer tun wird: `Kosten (ca. 30% mehr. ` in den **ersten** Makro-Rumpf jeder Datei tippen, dann die Überschriften zählen.

- **Echte Kundendokumente: 29 von 50 Dateien verlieren Überschriften.** `02b-leitnarrativ.typ` 8 → 1, `02-umsetzung.typ` 7 → 1, `05-konditionen.typ` 6 → 1.
- Ausgelieferte Presets: 15 von 121, darunter zwei `main.typ` mit 5 → **0**.

**Das ist Stufe 0, nicht ein Nebenpunkt.** Ein Formular, das in einen Rumpf schreiben lässt, dessen Splitter dabei Überschriften frisst, ist schlimmer als kein Formular.

### So wird es gemacht

1. **Test zuerst, und rot sehen.** Die Fälle gehören in `scripts/roundtrip-test.mts`, direkt neben die zwei Geschwister-Abschnitte aus `c3ba300` („a paren in prose is a paren") und `e23168f` („a closed inline call ends code mode") — dieselbe Fehlerklasse, dieselbe Stelle. Muster: Testfall + `TAIL = '\n\n= Überschrift\n\nZweiter Absatz.'`, dann prüfen, ob `heading` im Knotentyp-Array steht.
2. **Fixen** (Modus-Stack, siehe oben).
3. **Gegen den entfernten Fix laufen lassen.** Wenn der Test dann nicht rot wird, prüft er etwas anderes. Das ist in dieser Codebasis mehrfach passiert.
4. **`npx tsx scripts/roundtrip-corpus-test.mts`** (208 Dateien) und **`npx tsx scripts/compile-corpus-test.mts`** (39 Projekte, ~10 s, Pixel). Dann `npm test`.

### Die Falle, in die der Fix garantiert läuft

Bei `e23168f` ist genau das passiert und kostet sonst eine halbe Stunde: sobald man den Code-Modus beim Schließen einer Klammer verlässt, **zerfallen die Magazin-Container**. `#notiz(title: "x")[` schließt mit `)` auf Tiefe 0 — verlässt man dort den Code-Modus, wird das direkt folgende `[` nicht mehr gezählt, und der Container-Rumpf zerfällt an seiner eigenen Leerzeile.

Die Lösung dort war ein **Blick nach vorn**: nach dem schließenden `)` prüfen, ob `[`, `(` oder `.` folgt — dann geht die Aufrufkette weiter und der Code-Modus bleibt. Der Modus-Stack muss dieselbe Eigenschaft behalten. Die Tests für `#notiz` / `#columns` / `#bildtafel` in `roundtrip-test.mts` fangen es ab, wenn man es vergisst.

---

## 4. Worauf sich das stützen kann

Vieles ist da und wird heute nur in eine Richtung benutzt:

- **Die 24 Design-Elemente deklarieren bereits ihre Parameter** (`DesignElementParam`: `name`, `description`, `required`, `defaultValue` in `designElements.ts`). Das *ist* ein Formularschema — es erzeugt heute Typst und liest nie zurück.
- **Es gibt repoweit keine Funktion, die ein eingesetztes Element wieder aus dem Dokument liest.** `DesignElementPicker` füllt die Parameter einmal beim Einfügen und rendert; danach ist es roher Typst. **Auch unsere eigenen 24 Elemente sind nach dem Einfügen nicht mehr editierbar.** Editierbar sind heute nur die *globalen* Element-Stile (Blockquote/Code/Figure/Table) und die Style-Tokens.
- **Der Präzedenzfall für „Parameter + editierbarer Inhalt" existiert**: die 9 Magazin-Knoten (`typstMagazine.ts`) sind teils `atom: false` mit `content`-Ausdruck — Rumpf inline editierbar, Attribute als Felder. Genau die Form, die eine Baustein-Karte braucht.
- **`styleInference.ts` (379 Zeilen) liest bereits ein handgeschriebenes `style.typ` in Design-Tokens ein** — Farben, Fonts, Leading, Heading-Größen. Aufgerufen wird es nur von `webExport.ts`. Der Design-Tab sperrt sich bei handgeschriebenem `style.typ` aus (`isHandwrittenStyle`, aus gutem Grund: sonst überschreibt er die Makros). Die Maschine zum *Lesen* eines fremden Designs existiert also und ist nicht angeschlossen — eine begrenzte Aufgabe, kein Parser-Projekt.
- **Das Pixel-Gate ist das Sicherheitsnetz.** `npm run test:compile:corpus` sagt in ~10 s, ob 265 Seiten über 39 Projekte noch identisch rendern. Ohne das wäre ein Umbau der Parse-Schicht fahrlässig; damit ist er messbar. **Das ist der Grund, warum diese Aufgabe jetzt angehbar ist und vor einer Woche nicht.**

---

## 4a. Umsetzungsreihenfolge

| Stufe | Was | Warum in dieser Reihenfolge |
|---|---|---|
| **0** | Modus-Stack im Block-Splitter (§3a) | Blocker. Ohne ihn frisst das Feature Überschriften. |
| **1** | `listProjectMacros` + `visibleIn` + Picker-Sektion „Aus diesem Projekt" | Erste sichtbare Fähigkeit: ein KI-erfundener Baustein ist überhaupt einfügbar. Heute gar nicht. |
| **2** | `macroCall.ts` (parsen + splicen) + Formular im `typstRawBlock`-Node-View | Bearbeiten. Deckt gleichzeitig die **eigenen 24** Elemente ab, die heute nach dem Einfügen eingefroren sind. |
| **3** | Tabellen (§2) | Unabhängig, jederzeit, größter Einzelgewinn für Nicht-Programmierer. |
| **später** | CST, falls Verschachtelung in unbekannten Containern real wird | Bauprinzip aus §3 beachten: das Auffinden bleibt EINE austauschbare Funktion. |

Stufe 1 und 2 sind der Kern; 0 geht voraus, 3 läuft nebenher.

---

## 5. Was dabei nicht kaputtgehen darf

- **Das Paritätsprinzip** (CLAUDE.md „App ↔ MCP parity"). Was der Mensch sieht, sieht die KI — und umgekehrt. Eine Baustein-Karte, die nur die GUI kennt, verletzt P2/P3. Der Marker gehört ins Dokument, nicht nach `.penwright/`.
- **Die Round-Trip-Regel**: eine Unwrap darf nur beanspruchen, was der Knotengraph zurückgeben kann. Diese Regel ist mit zehn Fehlern in echten Dokumenten bezahlt.
- **Safe-Apply.** Jede Design-Mutation läuft über `safeApply` (staging → verify → commit/rollback), auf **beiden** Seiten. Eine Karte, die direkt schreibt, ist ein Regress.
- **`npm test` vor jedem Commit** — enthält das Pixel-Gate und läuft auf Renés Maschine über die Kundendokumente.

---

## 6. Was sonst noch offen ist

- **Der manuelle Durchgang durch die App steht weiterhin aus.** Nach sechs Sessions ohne einen einzigen App-Start die größte Unsicherheit im Projekt — und für diese Aufgabenstellung besonders relevant, weil „zugänglich" sich nur am laufenden Programm beurteilen lässt. Besonders: Document-Settings (schreibt jetzt die Wurzel), „Kapitel hinzufügen", Bild-Drag-and-Drop, Design-Panel → „Bausteine", Verlaufs-Hub, KI-Anzeige in der Statusleiste. Neu und ungeprüft: **Attached Lists** (`typstListAttach.ts` — was macht ProseMirror beim Neuanlegen/Teilen einer Liste?) und dass **Termlisten und Titelseiten jetzt Raw-Blocks sind** (richtig entschieden, UX-seitig anzuschauen).
- **Windows/Linux-Packaging.** `fetch:typst` holt die Binaries, aber `extraResources` filtert auf `typst-*` und kopiert **jede** vorhandene Binary in **jeden** Build. Zusammen mit der ohnehin ausstehenden Verifikation auf echtem Gerät anfassen.
- **codly 1.3.0** referenziert den in 0.15 entfernten `pattern`-Typ; 1.3.0 ist die neueste Version. Nichts, was wir ausliefern, erreicht diese Zweige. Auf codly 1.4 warten.
- **`paper-preprint` / `thesis-classic`** fordern *New Computer Modern* in Semibold — Typsts eingebaute Schrift hat nur 400/700. Sechs Stellen rendern bold; durch Bündeln nicht lösbar.
- **Verschachtelte Block-Kommentare** — auskommentierter Text erscheint im Editor als bearbeitbarer Inhalt. PDF vorher wie nachher identisch (gemessen), also Editor-Integrität, kein Datenverlust. Letzter bekannter Parser-Fall.
- **Web-Export-Branch `feat/web-export`** unverändert, nicht nach `main` gemergt.
- **Launch-Blocker:** `penwright.online` registrieren · QA auf realer 100-Seiten-Thesis · Windows als Fast-Follow.
- **Ungetrackt, nicht anfassen:** `resources/*/manifest.json`-Timestamps.

---

## 7. Betriebswissen vor dem ersten Commit

- **`npm test`** = `check:mcp` → `typecheck` → `test:unit` → `test:corpus` → `test:compile:corpus` → `test:mcp`. Läuft in `package:*`.
- **`penwright.corpus.json`** (git-ignoriert) zeigt auf `~/Desktop/LANGSAM` und die beiden Marketing-Ordner. **Wenn René diese Dokumente bearbeitet, kann `npm test` hier rot werden** — das ist das Gate, kein Fehler.
- **`MCP_SETUP_VERSION` = 0.26.0.** `ensureInstalledBinary` kopiert bei jedem App-Start bedingungslos aus `dist/mcp/bin/`. Nach jeder Änderung an `server.ts` **oder an geteiltem Code, der in der Binary landet** (Deserializer, `designElements`, `skillTemplates`): bumpen **und** `npm run build:mcp-binary:all`.
- **`npm run fetch:typst`** ist die einzige Wahrheit für die Typst-Version (`TYPST_VERSION` im Skript). `--check` verifiziert ohne Download.

---

## 8. Arbeitsweise, die sich bewährt hat

- **Messen schlägt schätzen, und ein Rendering schlägt einen Textvergleich.** Die „62 % undurchsichtig" wurden erst nützlich, als sie in vier Eimer zerfielen. Die „null von sechzehn Tabellen" ist die konkreteste Aufgabe dieses Handovers und stand in keinem Plan.
- **Jeder Fix bekommt einen Test, der ihn ohne den Fix rot sieht — und das wird ausprobiert.** Mehrfach war ein Test grün gegen den zurückgepatchten Code.
- **Erst beweisen, dann normalisieren.** Zwölf Baseline-Einträge sahen nach harmloser Formatierung aus. Sie waren es — aber `#align(center + horizon)` sah genauso aus und war es nicht.
- **Zwei Messfallen, die falschen Alarm produziert haben** (behoben, als Regel in CLAUDE.md): Pixel hashen statt der PNG-Datei (0.15 komprimiert anders → 39/39 Projekte falsch rot), und System-Fonts ignorieren (sonst misst man den eigenen Font-Ordner).
- **Ein Gate, das zufällig rot wird, ist ausgeschaltet.**

---

## 9. Anhang: die `typst-syntax`-Bewertung im Detail

Falls die Entscheidung in §3 Richtung B geht — hier die belegten Zahlen, damit sie nicht neu erhoben werden müssen.

**Was es ist:** das Parser-Modul des Typst-Compilers als eigenständige Crate. **Apache-2.0**, Version **0.15.1** — exakt unsere Compiler-Version. Standalone bestätigt (49 Crates gesamt, davon nur `typst-timing` und `typst-utils` aus der Typst-Familie), **null I/O**. `parse()` scheitert nie; Fehler sind Knoten *im* Baum.

**Verlustfreier CST:** „an in-order tree traversal will recreate the text of the source file exactly." Über 1.975 `.typ`-Dateien des Repos (17 MB) verifiziert: **1.975/1.975 byte-genau rekonstruiert, 0 Parse-Fehler, 236 ms.** 137 `SyntaxKind`-Varianten mit dedizierten Knoten für `TermItem`, `Shorthand` (das `~`), `Escape`, `LineComment`, `BlockComment` (nativ verschachtelnd), `EnumItem` samt Nummer.

**Machbarkeit — gemessen, nicht geschätzt:**
- Nach `wasm32` gebaut: **214 KB** (opt-level=z), 89 KB gzip. **Kein `wasm-bindgen`, kein `wasm-pack`** — ein rohes `extern "C"`-ABI genügt. Build-Kette: `rustup target add wasm32-unknown-unknown` + ein `cargo build`.
- **Bun `--compile` bettet die `.wasm` ein**, auch beim Windows-Cross-Compile. Synchrone Init in **2,29 ms** → kein async-Refactor der Aufrufer.
- Renderer: Compile+Instantiate in **0,3–0,4 ms**, funktioniert aus `app.asar`.
- Über Renés echten Korpus: 64 Dateien, verlustfrei, kompletter WASM↔JS-Round-Trip für 66.902 Knoten in **55 ms**.
- **Der einzige Blocker:** WebAssembly ist im Renderer durch die eigene CSP gesperrt (`script-src 'self'`, `index.html:6`). `'wasm-unsafe-eval'` ergänzen behebt es — in einer echten Electron-Instanz verifiziert.

**Was es NICHT tut:** keine Semantik. `#opener(title: "x")` und `#figure(…)` ergeben **identisch geformte Bäume**. Kein Import-Auflösen, keine Auswertung, **kein Emitter** — das Zurückschreiben bleibt vollständig unsere Sache.

**Was es ersetzen würde:** ~508 von 1.256 Code-Zeilen des Deserializers (**~40 %**) sind Klammer-, Modus- und Escape-Scannen — darunter **sieben** separate Klammer-Matcher in dieser einen Datei. Was bleibt: `parseMagazineMacro`, `isRawBlock`/`classifyRawBlock`, alle TipTap-Zuordnungen und der komplette Serializer (der **nicht** in der MCP-Binary steckt — dort wird nur deserialisiert).
