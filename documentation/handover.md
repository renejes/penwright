# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-30, Ende Session 46 · Branch `main`, alles committet · App **0.12.0** · `MCP_SETUP_VERSION` **0.26.0** (Binaries neu gebaut) · Typst gebündelt: **0.15.1** · MCP: **65 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md` → „Commands" (Testabschnitt) und „App ↔ MCP parity".** Was passiert ist, steht im Git-Log; dieses Dokument beschreibt **den Ist-Zustand und was als Nächstes zu tun ist**.

---

## 0. Wo wir stehen — in einem Absatz

Der Round-Trip war das offene Kernproblem und ist es nicht mehr: Baseline **22 → 0**, und es gibt ein **Pixel-Gate** (`compile-corpus-test`), das jedes Korpus-**Projekt** vor und nach dem Round-Trip kompiliert und die Seiten vergleicht — inklusive Renés vier Kundendokumente, die dabei alle als korrumpiert auffielen und jetzt pixelgleich sind. Danach ist **Typst auf 0.15.1** gezogen: kein einziger Compile-Fehler über 39 Projekte, keine neue Warnung, keine geänderte Seitenzahl, alle Gates grün. Was dabei nebenbei herauskam, war wichtiger als das Update selbst — 36 von 37 Presets forderten Schriftschnitte, die wir nicht bündelten; das ist mit dem Umstieg auf **Variable Fonts** erledigt (§1b). Ebenso beantwortet: **`typst-syntax` bauen wir nicht** (§4), und die Bewertung hat dabei drei weitere aktive Round-Trip-Fehler ans Licht gebracht, die jetzt behoben sind. Offen bleibt **der manuelle Durchgang durch die App** (§1/§2) — nach sechs Sessions die größte Unsicherheit im Projekt.

---

## 1. Was jetzt dran ist — der manuelle Durchgang durch die App

Nach sechs Sessions ohne einen einzigen App-Start ist das die größte offene Unsicherheit im Projekt. Alles unten in §2 gilt unverändert und ist jetzt der **erste** Punkt, nicht der zweite.

Die Schriften-Sache aus dem letzten Handover ist erledigt (siehe §1b), die `typst-syntax`-Frage ist bewertet (§4).

---

## 1b. Erledigt: Variable Fonts

6 von 7 Familien liegen jetzt als Variable Font vor (Inter, IBM Plex Sans/Serif/Mono, JetBrains Mono, Crimson Pro), eine Datei pro Schnitt über den ganzen `wght`-Bereich. **Spectral ist die Ausnahme** — es gibt upstream keine variable Version — und hat dafür die fehlenden statischen Schnitte bekommen (Medium, SemiBold + Kursive).

Damit rendert `semibold` endlich als Semibold statt als Bold, und `medium` als Medium statt als Regular. Betraf die Default-Überschriften *jedes* neuen Projekts (h2–h4 sind `semibold`) und 213 Stellen in den Presets. Bundle: 6,6 → 7,0 MB — es **wächst** leicht, entgegen der Behauptung im letzten Handover.

`webFonts.ts` liest jetzt die `fvar`-Tabelle und schreibt `font-weight: <min> <max>` ins CSS; eine Web-Seite trägt dadurch 6 statt 12 Font-Dateien.

**Nicht lösbar durch Bündeln:** `paper-preprint` und `thesis-classic` fordern *New Computer Modern* in Semibold. Das ist Typsts **eingebaute** Schrift und hat nur 400/700 — die sechs Stellen rendern bold. Die Quelle auf `bold` zu ändern wäre eine Design-Änderung an ausgelieferten Presets ohne sichtbare Wirkung; bewusst offen gelassen.

---

## 1a. Was das Typst-Update ergab — als Referenz, nicht als offene Aufgabe

Gebündelt ist jetzt **0.15.1**, geholt und gepinnt von `npm run fetch:typst`.

**Messung (39 Projekte, 265 Seiten, isoliert von System-Fonts):** 217 Seiten identisch, 9 nur Antialiasing, **39 kleine lokale Shifts, 0 Reflow, 0 geänderte Seitenzahl, 0 Compile-Fehler, 0 neue Warnungen.** Die Shifts sind die dokumentierte Baseline-Korrektur in Boxen mit Inset — René's „inbound boxes" ist real und arbeitet schon in unseren eigenen Presets (`newsletter-*` p1 ist das klarste Beispiel: Box gleich, Text darin 3 px korrekt nachjustiert).

**Behoben, weil 0.15 es zum Hard Error macht:** ein Backslash in einem Pfad. `markdownImporter` und 9 Design-Elemente interpolierten einen berechneten Pfad ungeprüft in `#image("…")` — auf Windows also Backslashes, und 0.15 bricht dann mit `path must not contain a backslash` beim Parsen ab, nicht nur beim Bild. Normalisiert; Tests verifiziert rot ohne den Fix.

**Bekannt und bewusst offen:** gebündeltes **codly 1.3.0** referenziert an drei Stellen den entfernten `pattern`-Typ, und 1.3.0 ist die neueste Veröffentlichung. Nichts, was wir ausliefern, erreicht diese Zweige; ein Nutzer, der codly ein `lang-fill: gradient` oder einen Zeilen-Highlight mit Tiling gibt, bekommt `unknown variable: pattern`. **Auf codly 1.4 warten**, dann `fetch:typst-packages` nachziehen.

**Nicht gebrochen, obwohl es so aussah:** die umbenannten Zitierstile. `vancouver` & Co. kompilieren weiter mit Deprecation-Warnung, kein gespeichertes Dokument bricht. `NUMERIC_BIB_STYLES` kennt jetzt beide Schreibweisen.

---

## 2. Der manuelle Durchgang durch die App — steht weiterhin aus

Der Assistent hat sie in vier Sessions nie gestartet; alles ist durch Tests und Quelltext belegt. Das ist die größte verbleibende Unsicherheit im Projekt.

Besonders zu prüfen, weil sie **in andere Dateien schreiben als früher**: Document-Settings-Dialog (schreibt jetzt die Wurzel), „Kapitel hinzufügen" (`#include` in die Wurzel), Bild-Drag-and-Drop (Ablage + eingefügter Pfad geändert). Dazu: Design-Panel → „Bausteine", Verlaufs-Hub (projektweit), KI-Anzeige in der Statusleiste.

**Neu dazugekommen und ungeprüft im laufenden Editor:**
- **Attached Lists.** Eine Liste direkt unter ihrer Einleitungszeile trägt jetzt ein `attached`-Attribut (`typstListAttach.ts`). Im Editor ist das unsichtbar — aber wenn der Nutzer eine Liste *neu* anlegt oder eine bestehende teilt, entscheidet ProseMirror über den Default (`false`). Zu prüfen: Enter/Backspace an der Grenze Absatz↔Liste, und ob `serializeTypstCached` (der Editor-Pfad, nicht der Test-Pfad) dieselben Bytes schreibt wie `serializeTypst`.
- **Termlisten und Titelseiten sind jetzt Raw-Blocks.** Das ist die richtige Entscheidung (siehe CLAUDE.md „The round-trip rule"), aber es heißt: eine Titelseite, die vorher als editierbare Überschrift erschien, ist heute ein Typst-Code-Block. Anschauen und entscheiden, ob das UX-seitig genügt oder ob echte Nodes gebaut werden sollen (§4).

---

## 3. Was am Testaufbau noch fehlt

1. **`scripts/run-all.mts` — eine Bilanz statt zwölf.** Zwölf Skripte, jedes mit eigenem `check()`, eigener Zählung, eigenem Exit-Code. Das ist bewusst so gewachsen und funktioniert — **kein Framework einführen.** Was fehlt, ist Zusammenfassung: ein Skript, das die Suiten startet, Ergebnisse einsammelt und **eine** Bilanz druckt, damit ein Fehlschlag in der Mitte nicht in 600 Zeilen Ausgabe untergeht. ~2 h.

2. **Das Korpus hat keinen Zeugen für „attached list".** Genau null der 208 Dateien enthält eine Liste direkt unter ihrem Einleitungssatz — der einzige Fall (`+ creditLabel` im Sample-Projekt) war ein Tippfehler und ist behoben. Der Unit-Test deckt es ab (verifiziert rot ohne den Fix), aber das Pixel-Gate kann es nicht sehen. Überlegen, ob das Sample-Projekt einen zeigen *soll* — es ist die Vitrine, und die idiomatische Typst-Form fehlt darin.

3. **Der eine offen gelassene Round-Trip-Verlust** (kein Korpus-Zeuge, deshalb nicht gefixt — ein Unit-Test wäre der erste Schritt): **`1. ` Enums mitten im Block.** Wird weder als Enum erkannt noch faithful escaped; beide Richtungen verlieren die Nummerierung, keine ist klar besser. (Die unbalancierte Klammer nach einem Inline-Makro stand hier bis Session 46 und ist behoben — `e23168f`.)

---

## 3a. Zwei Messfallen im Pixel-Gate, die beide falschen Alarm produziert haben

Beide sind behoben, beide sind als Regel in CLAUDE.md — hier, weil sie sich beim nächsten Compiler-Wechsel sofort wieder stellen:

- **Pixel hashen, nicht die Datei.** 0.15 liefert „space-optimized output by default": dieselbe Seite von 397 KB auf 181 KB neu kodiert, **byte-identische Pixel**. Ein Datei-Hash meldete daraufhin alle 39 Projekte auf jeder Seite als geändert — 100 % Fehlalarm, und genau die Sorte, die den nächsten echten Befund abwinken lässt. `typstRender.pngPixelHash` inflatet das IDAT und macht die PNG-Zeilenfilter rückgängig (nur Node-`zlib`), gegen `sips` gegengeprüft.
- **System-Fonts ignorieren, sonst misst man den eigenen Font-Ordner.** Derselbe Vergleich meldete sechs Seiten „Reflow", die vollständig lokal waren: in `~/Library/Fonts` liegt eine Crimson-Pro-**Variable**-Font, 0.15 instanziiert sie bei `weight: "medium"`, 0.14.2 konnte das nicht. Isoliert sind die Seiten zwischen beiden Compilern identisch. Die App ignoriert System-Fonts bewusst *nicht* — ein Test muss.

---

## 4. `typst-syntax` — bewertet. Empfehlung: **nicht bauen**, aber aus einem anderen Grund als bisher

Die Bewertung ist gemacht (Session 46), mit einer echten WASM-Probe statt Vermutungen. **Die Machbarkeit ist deutlich besser als angenommen, der Nutzen deutlich kleiner.**

**Was sich als falsch herausgestellt hat (alte Annahmen im Handover):**
- „Realistisch einige Tage, ~1–3 MB WASM." → typst-syntax 0.15.1 nach `wasm32` gebaut: **214 KB** (opt-level=z), 89 KB gzip. `wasm-bindgen`/`wasm-pack` sind **nicht** nötig — ein rohes `extern "C"`-ABI genügt, also nur `rustup target add wasm32-unknown-unknown` + ein `cargo build`.
- „Die Versionen passen nicht zusammen." → Crate 0.15.1 = gebündelter Compiler 0.15.1. **Erledigt.**
- „In beide Prozesse bündeln." → Es sind **fünf** Bundling-Pfade, nicht zwei. Aber: Bun `--compile` bettet die `.wasm` nachweislich ein (auch beim Windows-Cross-Compile), synchrone Init in 2,29 ms, also **kein async-Refactor** der Aufrufer nötig.
- Gemessen an Renés echtem Korpus: 64 Dateien, verlustfrei geparst, kompletter WASM↔JS-Round-Trip für 66.902 Knoten in **55 ms**.

**Der einzige echte Blocker, und er ist ein Token:** WebAssembly ist im Renderer heute durch die eigene CSP komplett gesperrt (`script-src 'self'` in `index.html:6`) — alle vier Ladewege scheitern. `'wasm-unsafe-eval'` ergänzen behebt es, verifiziert in einer echten Electron-Instanz.

**Warum trotzdem nicht:** die Fehlerhistorie trägt es nicht. Über die letzten Sessions: **40 Defekte, davon 30 Round-Trip. Davon nur 10 lexikalisch** — die ein echter Parser verhindert. 3 hybrid, **17 reine Interpretations- oder Emissionsfehler**. Die teuersten Familien waren *keine* Parse-Fehler: die Titelseiten erkannte der alte Code korrekt und warf die Information dann absichtlich weg; das eingefrorene Datum wurde per Regex erkannt und dann durch einen `new Date()`-Aufruf ersetzt; die 11 Escaping-Fehler liegen auf dem TipTap→Typst-Pfad, wo gar kein Typst-Parser beteiligt ist. **Ein Drittel, bestenfalls.**

Dazu: die verbleibenden lexikalischen Lücken sind seit der Bewertung **fast alle geschlossen** (siehe unten). Was bleibt, ist ein einziger Fall.

**Der Auslöser, der die Antwort ändern würde:** wenn wir anfangen, Typst-Konstrukte zu *verstehen* statt zu erkennen — echte Term-Listen-Nodes, echte Magazin-Makro-Argumente, ein Design-Panel, das beliebiges Typst introspiziert. Dann ist der CST die richtige Grundlage. Solange wir Blöcke klassifizieren und den Rest verbatim durchreichen, ist er Versicherung gegen eine Fehlerklasse, die gerade leer ist.

**Was die Bewertung nebenbei fand und was davon behoben ist:**
- ✅ Unbalancierte Klammer **nach** einem Inline-Makro — breiter als notiert (`(`, `[`, `{`, nach jedem Makro, idempotent zerstörend). Behoben in `e23168f`.
- ✅ Block-Kommentar `/* */` in Prosa → **Dokument kompilierte nach dem Speichern nicht mehr**. Behoben in `da31d87`.
- ✅ Mid-line `//`-Kommentar → wurde sichtbarer Text. Behoben in `da31d87`.
- ❌ **Kein Defekt:** ein Label auf einem Prosa-Absatz. Typst kann das ohnehin nicht referenzieren — das Original kompiliert genauso wenig.
- ⏳ **Offen, der letzte bekannte Parser-Fall:** verschachtelte Block-Kommentare. `/* a /* b */ c */` ist legales Typst; unser Scanner schließt beim ersten `*/`. Heute unschädlich, weil der ganze Block ohnehin verbatim bleibt — relevant erst, wenn jemand die Tiefenzähler wieder darauf verlässt.

---

## 4a. Schriften — Roster ist ausreichend, eine Lücke

Nach dem Umstieg auf Variable Fonts: **7 Familien, alle OFL-1.1**, 7,0 MB. Rollen: Body-Serif ×3, Body-Sans ×2, Mono ×2 (plus Typsts DejaVu), **Mathe ist durch Typsts eingebaute New Computer Modern Math abgedeckt** — da muss nichts gebündelt werden.

**Kein Preset nennt eine Familie, die wir nicht bündeln** (geprüft über alle 33). Null Drift.

**Sprachabdeckung ist vollständig** für europäische Sprachen — direkt aus den `cmap`-Tabellen gelesen, nicht aus einem Compile geschlossen (Typst fällt still zurück und warnt nicht): Deutsch, Polnisch, Tschechisch, Ungarisch, Türkisch, Rumänisch, Kroatisch, Baltisch, dazu deutsche Anführungszeichen und Guillemets. Griechisch/Kyrillisch sind lückenhaft, für dieses Produkt aber egal.

**Die eine echte Lücke: eine Display-/Headline-Schrift.** Jedes Preset setzt seine Schlagzeile in einer hochskalierten Body-Schrift — auch die Magazin-Cover bei 46 pt und `doc-poster` bei 46 pt.
- **Empfehlung, falls überhaupt: Fraunces** (OFL-1.1, variabel `wght 100–900` + `opsz 9–144pt` + SOFT/WONK-Achsen, 352 KB aufrecht / 758 KB mit Kursiv). Die `opsz`-Achse deckt genau die 46–54-pt-Größen ab.
- **Bedingung:** nur zusammen mit mindestens einem Theme/Preset, das sie tatsächlich verwendet. Größe ist nicht die Beschränkung (+758 KB sind <1 % der App) — eine Roster-Zeile, die niemand auswählt, ist schlimmer als keine.
- **Condensed NICHT hinzufügen**, obwohl die Rolle unbesetzt ist: `ProjectStyle.fonts` hat nur `body`/`heading`/`code` und **kein** Breiten-Feld, kein Preset nutzt `stretch:`. Eine schmale Schrift wäre aus dem Design-Panel gar nicht wählbar.

---

## 4b. Der handgeschriebene Parser — Ausgangslage (historisch)

**Die billige Hälfte ist erledigt** (`c3ba300`): `splitIntoBlocks` kennt jetzt Strings, Kommentare, Escapes und den Unterschied zwischen Code- und Markup-Modus. Das war die Empfehlung der letzten Session und sie hat die Fehlerklasse erledigt, die dahinterstand.

**Was übrig bleibt, ist kleiner geworden** — siehe §3 Punkt 3. Dazu die sieben unabhängigen Klammer-Scanner (`matchBracket`, `matchParen`, `matchParenArgs`, `extractBracketContent`, `extractInlineBrackets`, `findClosingDelim`, `matchTypstParens`) und die Tiefenzähler-Schleifen in derselben Datei: die sind jetzt nicht mehr die Hauptfehlerquelle, aber immer noch sieben Kopien derselben Idee.

**Der Befund zu `typst-syntax` (Renés Recherche, Stand 2026-07, zu verifizieren):** Parser-Modul des Typst-Compilers selbst, eigenständige Rust-Crate, Version **0.15.1**, **Apache-2.0**, ~309k Downloads/Monat, ohne den vollen Compiler nutzbar. **Die Versionsfrage ist damit erledigt: gebündelt ist jetzt ebenfalls 0.15.1**, Crate und Compiler passen zusammen. Der CST ist **verlustfrei** („an in-order tree traversal will recreate the text of the source file exactly") und reparst inkrementell (`Source::edit`).

**Der ehrliche Preis:** kein fertiges npm-/WASM-Paket. Wir müssten selbst eine `wasm-bindgen`-Crate bauen, zu WASM kompilieren und **in beide Prozesse bündeln** (der Deserializer läuft in App *und* MCP-Binary). Realistisch einige Tage. Die Versionskopplung, die das früher an das Typst-Update hängte, ist aufgelöst (beide 0.15.1).

**Empfehlung: weiterhin nicht bauen.** Der Nutzen ist seit `c3ba300` deutlich kleiner und das Pixel-Gate fängt die Klasse jetzt ab. `typst-syntax` ist der saubere **Endzustand**, nicht der nächste Schritt.

---

## 5. Was sonst noch offen ist

- **Renés echte Projekte sind jetzt im Korpus** — `penwright.corpus.json` (git-ignoriert) zeigt auf `~/Desktop/LANGSAM`, `~/Desktop/Marketing/FMM`, `~/Desktop/Marketing/Ludwig Maier Mastering`. **Konsequenz, die man wissen muss:** wenn René diese Dokumente bearbeitet, kann `npm test` in *diesem* Repo rot werden. Das ist das Gate, das arbeitet, kein Fehler. Auf einem frischen Klon fehlt die Datei und nur `resources/` wird geprüft.
- **Nur die Host-Binary ist committet** (`typst-arm64-darwin`, ~45 MB). `package:{mac,win,linux}` holen die Zielplattform über `fetch:typst`. Zwei Dinge sind dabei ungelöst und für den Windows-Launch relevant: (a) `extraResources` filtert auf `typst-*`, kopiert also **jede** vorhandene Binary in **jeden** Build — wer für Windows packt, während die Darwin-Binary daliegt, verschenkt 45 MB im Installer; (b) `package:win` / `package:linux` sind ohnehin noch nie auf einem echten Gerät verifiziert worden. Beides zusammen anfassen, nicht einzeln.
- **Der Web-Export-Branch `feat/web-export`** ist unverändert und **nicht** nach `main` gemergt.
- **Launch-Blocker:** `penwright.online` registrieren · QA auf realer 100-Seiten-Thesis + Design-Use-Cases · Windows als Fast-Follow.
- **Ungetrackt, nicht anfassen:** `resources/*/manifest.json`-Timestamps (Renés eigene Arbeit).

---

## 6. Was man vor dem ersten Commit wissen muss

- **`npm test` vor jedem Commit.** Es enthält jetzt `test:compile:corpus` (~10 s) und läuft auf Renés Maschine über die Kundendokumente.
- **`MCP_SETUP_VERSION` = 0.24.0.** `ensureInstalledBinary` kopiert bei **jedem App-Start bedingungslos** aus `dist/mcp/bin/` — die installierte Binary trackt den letzten *Build*, nicht den Quellstand. Nach jeder `server.ts`-Änderung: bumpen **und** `npm run build:mcp-binary:all`.
- **Serializer/Deserializer stecken in der MCP-Binary** (über `shared/`-Exporte und die Export-Pfade). Diese Session hat beide geändert, ohne `MCP_SETUP_VERSION` zu bumpen, weil kein MCP-*Tool* betroffen ist — aber wer die Binary neu baut, transportiert die Fixes mit. **Vor dem nächsten Release: `npm run build:mcp-binary:all`**, damit die Round-Trip-Fixes auch im MCP-Pfad landen.
- **`tsconfig` hat `paths`.** Die alte Regel „in `.ts`-Dateien nur relative Imports, nie `@shared`" ist nicht mehr tragend. In `.svelte`-Dateien gilt weiterhin: relative Imports für geteilten Code, `@shared/i18n/store.svelte` nur für den i18n-Store.

---

## 7. Arbeitsweise, die sich bewährt hat

- **Echte Dokumente schlagen ausgedachte Snippets, und ein Rendering schlägt einen Textvergleich.** 145 Unit-Round-Trips fanden keinen der Verluste in Renés Kundendokumenten. Der Textvergleich über 208 echte Dateien fand einige. Das Pixel-Gate fand die, die der Textvergleich *strukturell nicht sehen konnte* — und war beim ersten Lauf sofort rot.
- **Jeder Fix bekommt einen Test, der ihn ohne den Fix rot sieht — und das wird ausprobiert.** Zweimal in dieser Session war ein Test grün gegen den zurückgepatchten Code; beide Male prüfte er etwas anderes als gedacht.
- **Erst beweisen, dann normalisieren.** Zwölf Baseline-Einträge sahen nach harmloser Formatierung aus. Sie waren es — aber `#align(center + horizon)` sah genauso harmlos aus und war es nicht. Erst als das Pixel-Gate identische Seiten zeigte, durfte `relaxForm` sie schlucken.
- **Ein Gate, das zufällig rot wird, ist ausgeschaltet.** Auf die Ereignisse warten, die man erwartet, nicht auf eine Millisekundenzahl.
- **Gemeinsamer Planer statt synchron gehaltener Kopien.** Reines Planen (`plan*` gibt Writes zurück), der Aufrufer wendet an. Dreizehn solche Module in `src/shared/`; dazu jetzt `scripts/typstRender.mts` für die eine Typst-Auflösungsregel und `scripts/corpusConfig.mts` für die eine Korpus-Definition.
