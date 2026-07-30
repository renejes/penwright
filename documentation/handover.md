# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-30, Ende Session 45 · Branch `main`, alles committet · App **0.12.0** · `MCP_SETUP_VERSION` **0.25.0** (Binaries neu gebaut) · Typst gebündelt: **0.15.1** · MCP: **65 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md` → „Commands" (Testabschnitt) und „App ↔ MCP parity".** Was passiert ist, steht im Git-Log; dieses Dokument beschreibt **den Ist-Zustand und was als Nächstes zu tun ist**.

---

## 0. Wo wir stehen — in einem Absatz

Der Round-Trip war das offene Kernproblem und ist es nicht mehr: Baseline **22 → 0**, und es gibt ein **Pixel-Gate** (`compile-corpus-test`), das jedes Korpus-**Projekt** vor und nach dem Round-Trip kompiliert und die Seiten vergleicht — inklusive Renés vier Kundendokumente, die dabei alle als korrumpiert auffielen und jetzt pixelgleich sind. Danach ist **Typst auf 0.15.1** gezogen: kein einziger Compile-Fehler über 39 Projekte, keine neue Warnung, keine geänderte Seitenzahl, alle Gates grün. Was dabei nebenbei herauskam, ist wichtiger als das Update selbst: **36 von 37 Presets fordern Schriftschnitte, die wir nicht bündeln** (§1). Danach steht weiterhin **der manuelle Durchgang durch die App** (§2) — nach fünf Sessions die größte offene Unsicherheit.

---

## 1. Was jetzt dran ist — 36 von 37 Presets sehen beim Kunden anders aus

**Der Befund.** Unsere Presets fordern `weight: "semibold"` (173×) und `weight: "medium"` (40×). Gebündelt ist pro Familie nur **Regular (400) und Bold (700)**. Auf einem sauberen Kundenrechner kollabiert die vierstufige Gewichtsrampe damit auf zwei: **`medium` rendert als Regular, `semibold` als Bold.** Auf Renés Rechner sieht ein Teil davon richtig aus, weil in `~/Library/Fonts` Variable Fonts liegen — der Kunde hat die nicht. Betroffen sind 36 von 37 Projekten, inklusive Sample-Projekt.

**Warum es jetzt lösbar ist.** `scripts/fetch-typst-fonts.mjs` sagt im eigenen Docstring, warum static-only gebündelt wurde: *„Typst 0.14.2 warns ('variable fonts are not currently supported and may render incorrectly') … We bundle the static weights to keep the compiler logs clean."* Das war ein Workaround **für genau die Version, die wir gerade ersetzt haben**. Verifiziert: 0.14.2 warnt, **0.15.1 nicht** — und rendert aus *einer* Variable-Datei vier klar unterschiedene Schnitte.

**Zu tun:**
1. `fetch-typst-fonts.mjs` auf die Variable-Varianten der sieben Familien umstellen (Inter, Spectral, Crimson Pro, IBM Plex Sans/Serif/Mono, JetBrains Mono). Das **verkleinert** das Bundle: eine Datei statt vier pro Familie, Gewichte 200–900.
2. Den Docstring-Grund dort korrigieren, sonst baut ihn jemand wieder zurück.
3. `npm run test:compile:corpus` — es wird **rot**, und zwar richtig: die Presets rendern dann erstmals wie entworfen. Die Renderings vor/nach vergleichen (`--keep`), bestätigen, dass es besser aussieht, dann weiter.
4. Prüfen, ob `webFonts.ts` (das @font-face-Embedding im Web-Export) Variable-Dateien korrekt auf Gewichte abbildet — es matcht heute Dateinamen auf Familien/Gewichte.
5. `MCP_SETUP_VERSION` bumpen (Fonts stecken nicht in der Binary, aber `--font-path` zeigt in die App-Resources).

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

3. **Offen gelassene Round-Trip-Verluste** (kein Korpus-Zeuge, deshalb nicht gefixt — jeweils ein Unit-Test wäre der erste Schritt):
   - **`1. ` Enums und `/ ` als eigener Absatz.** Ein `1. ` mitten im Block wird weder als Enum erkannt noch faithful escaped. Beide Richtungen verlieren die Nummerierung; keine ist klar besser, deshalb unverändert gelassen.
   - **Unbalancierte Klammer NACH einem Inline-Makro auf derselben Zeile.** `Text #emph[x] und (unschön` zählt die Klammer weiterhin, weil ab dem `#` Code-Modus angenommen wird. Ohne Grammatik echt ambig — das ist der Rest, den §4 lösen würde.

---

## 3a. Zwei Messfallen im Pixel-Gate, die beide falschen Alarm produziert haben

Beide sind behoben, beide sind als Regel in CLAUDE.md — hier, weil sie sich beim nächsten Compiler-Wechsel sofort wieder stellen:

- **Pixel hashen, nicht die Datei.** 0.15 liefert „space-optimized output by default": dieselbe Seite von 397 KB auf 181 KB neu kodiert, **byte-identische Pixel**. Ein Datei-Hash meldete daraufhin alle 39 Projekte auf jeder Seite als geändert — 100 % Fehlalarm, und genau die Sorte, die den nächsten echten Befund abwinken lässt. `typstRender.pngPixelHash` inflatet das IDAT und macht die PNG-Zeilenfilter rückgängig (nur Node-`zlib`), gegen `sips` gegengeprüft.
- **System-Fonts ignorieren, sonst misst man den eigenen Font-Ordner.** Derselbe Vergleich meldete sechs Seiten „Reflow", die vollständig lokal waren: in `~/Library/Fonts` liegt eine Crimson-Pro-**Variable**-Font, 0.15 instanziiert sie bei `weight: "medium"`, 0.14.2 konnte das nicht. Isoliert sind die Seiten zwischen beiden Compilern identisch. Die App ignoriert System-Fonts bewusst *nicht* — ein Test muss.

---

## 4. Der handgeschriebene Parser und `typst-syntax` — bewerten, nicht bauen

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
