# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-30, Ende Session 44 · Branch `main`, alles committet · App **0.12.0** · `MCP_SETUP_VERSION` **0.24.0** · Typst gebündelt: **0.14.2** · MCP: **65 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md` → „Commands" (Testabschnitt) und „App ↔ MCP parity".** Was passiert ist, steht im Git-Log (`2c2ebea` … `c3ba300`); dieses Dokument beschreibt **den Ist-Zustand und was als Nächstes zu tun ist**.

---

## 0. Wo wir stehen — in einem Absatz

Der Round-Trip war das offene Kernproblem, und er ist es nicht mehr. Die Baseline ist von **22 auf 0** gefallen, aber das ist nicht die eigentliche Nachricht. Die eigentliche Nachricht ist, dass es jetzt ein **Pixel-Gate** gibt (`compile-corpus-test`), das jedes Korpus-**Projekt** vor und nach dem Round-Trip kompiliert und die gerenderten Seiten vergleicht — und dass es auf Renés echte Kundendokumente zeigt. Beim ersten Lauf sagte es: **alle vier Marketing-Dokumente rendern nach einem einzigen Öffnen-und-Speichern anders**, bei einem Sichtbarkeitskonzept 19 von 47 Seiten. Die Ursachen sind gefunden und behoben; alle 39 Projekte sind jetzt pixelgleich. Der nächste Schritt liegt woanders: **§1 Typst-Update, §2 der manuelle Durchgang durch die App.**

---

## 1. Was jetzt dran ist — Typst 0.14.2 ist nicht die neueste Version

Unverändert offen aus der letzten Session, und jetzt der beste nächste Schritt, weil **das Werkzeug dafür fertig ist**: `compile-corpus-test` ist genau der Gradmesser für einen Compiler-Wechsel. Ein Update, das 39 Projekte pixelgleich lässt, ist sicher; eines, das es nicht tut, sagt sofort wo und auf welcher Seite.

**Warum das mehr ist als Versionspflege:** Renés Hinweis auf **„inbound boxes"** (Rahmen/Boxen, die im Textfluss mitlaufen statt zu überlagern) — wenn die neue Version das kann, ersetzt sie eine Klasse handgebauter `#block`/`#place`-Konstrukte in `designElements.ts` und den Magazin-Makros. Das ist Design-Fähigkeit, nicht Wartung.

**Zu tun, in dieser Reihenfolge:**
1. Changelog der neuen Version lesen. **Was genau heißt „inbound boxes" dort**, und was können wir damit, was heute Handarbeit ist?
2. `resources/bin/typst-{arch}-{platform}` auf die neue Version ziehen, **beide Architekturen**. Achtung: nur `typst-arm64-darwin` ist committet — auf anderen Hosts fällt der Test auf PATH zurück.
3. **`npm run test:compile:corpus` ist der Beweis.** Danach `test:compile` (LANGSAM, braucht `LANGSAM_DIR`).
4. Die 24 gebündelten Typst-Packages gegen die neue Version prüfen (`audit:packages` deckt Lizenzen ab, nicht Kompatibilität).
5. Erst dann §4 entscheiden — eine Parser-Crate-Version muss zum Compiler passen.

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

## 4. Der handgeschriebene Parser und `typst-syntax` — bewerten, nicht bauen

**Die billige Hälfte ist erledigt** (`c3ba300`): `splitIntoBlocks` kennt jetzt Strings, Kommentare, Escapes und den Unterschied zwischen Code- und Markup-Modus. Das war die Empfehlung der letzten Session und sie hat die Fehlerklasse erledigt, die dahinterstand.

**Was übrig bleibt, ist kleiner geworden** — siehe §3 Punkt 3. Dazu die sieben unabhängigen Klammer-Scanner (`matchBracket`, `matchParen`, `matchParenArgs`, `extractBracketContent`, `extractInlineBrackets`, `findClosingDelim`, `matchTypstParens`) und die Tiefenzähler-Schleifen in derselben Datei: die sind jetzt nicht mehr die Hauptfehlerquelle, aber immer noch sieben Kopien derselben Idee.

**Der Befund zu `typst-syntax` (Renés Recherche, Stand 2026-07, zu verifizieren):** Parser-Modul des Typst-Compilers selbst, eigenständige Rust-Crate, Version **0.15.1**, **Apache-2.0**, ~309k Downloads/Monat, ohne den vollen Compiler nutzbar. Der CST ist **verlustfrei** („an in-order tree traversal will recreate the text of the source file exactly") und reparst inkrementell (`Source::edit`).

**Der ehrliche Preis:** kein fertiges npm-/WASM-Paket. Wir müssten selbst eine `wasm-bindgen`-Crate bauen, zu WASM kompilieren und **in beide Prozesse bündeln** (der Deserializer läuft in App *und* MCP-Binary). Realistisch einige Tage. Dazu: Crate 0.15.1 gegen gebündelten Compiler 0.14.2 — **die Versionen passen aktuell nicht zusammen**, was §4 an §1 koppelt.

**Empfehlung: weiterhin nicht bauen.** Der Nutzen ist seit `c3ba300` deutlich kleiner, das Pixel-Gate fängt die Klasse jetzt ab, und `typst-syntax` ist der saubere **Endzustand**, nicht der nächste Schritt. Wenn doch: **erst §1**, sonst bewertet man gegen ein Ziel, das sich bewegt.

---

## 5. Was sonst noch offen ist

- **Renés echte Projekte sind jetzt im Korpus** — `penwright.corpus.json` (git-ignoriert) zeigt auf `~/Desktop/LANGSAM`, `~/Desktop/Marketing/FMM`, `~/Desktop/Marketing/Ludwig Maier Mastering`. **Konsequenz, die man wissen muss:** wenn René diese Dokumente bearbeitet, kann `npm test` in *diesem* Repo rot werden. Das ist das Gate, das arbeitet, kein Fehler. Auf einem frischen Klon fehlt die Datei und nur `resources/` wird geprüft.
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
