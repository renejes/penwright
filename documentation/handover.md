# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-30, Ende Session 46 · Branch `main`, alles committet · App **0.12.0** · `MCP_SETUP_VERSION` **0.26.0** (Binaries neu gebaut) · Typst gebündelt: **0.15.1** · MCP: **65 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md`.** Das Fundament ist gebaut; ab hier geht es um eine Produktfrage, nicht mehr um Reparatur.

---

## 0. Die Aufgabe

**Penwright soll von jemandem benutzbar sein, der kein Typst schreiben kann.**

Das gilt für alles drei — Text, Struktur, Design — und ausdrücklich auch für das, was die **KI erzeugt**: Wenn Claude für ein Magazin einen eigenen Design-Baustein baut, darf das Ergebnis für den Nutzer kein Code-Block sein, den er nur anschauen kann.

Zu klären ist, **wie das mit dem bestehenden Code am besten geht** — unter dem Paritätsprinzip, und mit einer belastbaren Antwort darauf, **ob und in welchem Umfang wir `typst-syntax` dafür brauchen**.

Das Fundament dafür steht: der Round-Trip ist vertrauenswürdig (Baseline 0, Pixel-Gate über 39 Projekte inkl. der echten Kundendokumente), das Paritätsprinzip ist auf allen vier Achsen eingelöst, Typst ist auf 0.15.1. Das ist erledigt und taucht ab hier nur noch als Betriebswissen auf (§6–§8).

---

## 1. Das Problem, gemessen

**62,5 %** aller Blöcke in den ausgelieferten Presets und **42,4 %** in Renés echten Dokumenten sind `typstRawBlock` — für den Editor undurchsichtig, nur als Code anzuschauen.

Die Zahl allein führt aber in die Irre. Sie zerfällt in **vier Eimer mit völlig verschiedenen Kosten**, und nur der letzte braucht überhaupt einen Parser:

| Eimer | Menge (Presets / echt) | Was drin ist | Was zu tun ist |
|---|---|---|---|
| **1. Infrastruktur** | ~60 % der undurchsichtigen Masse | `#let` (443/84), `#import` (92/50), `#set`, Kommentare (358/104) | **Nichts.** Das ist `style.typ` / `macros.typ`. Ein Nicht-Typst-Nutzer soll das *nicht* von Hand bearbeiten — dafür gibt es den Design-Tab. Undurchsichtig ist hier die richtige Antwort. |
| **2. Trivial** | `#v` (67/47), `#pagebreak` (43/12) | Abstände, Umbrüche | Billige Nodes, falls überhaupt gewollt. Ein Abstandshalter als Code-Block ist Lärm, kein Verlust. |
| **3. Erkannt, aber aufgegeben** | `#table` (16), `#figure` (16), `#align` (13), `#text` (18) | Konstrukte, für die ein Parser existiert, der aussteigt | **Begrenzte Arbeit, kein CST.** Siehe §2 — hier liegt der größte Gewinn pro Aufwand. |
| **4. Nutzer-/KI-Makros** | `#note` (18), `#insight` (16), `#modul` (12), `#herohead` (8), `#callout` (7), `#band` (6), `#box-choice` (6), `#sumrow` (5), `#grid` (18/13), `#block` (10) | Handgeschriebene und KI-erfundene Bausteine | **Hier und nur hier** stellt sich die `typst-syntax`-Frage. §3. |

Gemessen über 153 ausgelieferte und 55 echte Dateien: `deserializeTypst` über den Korpus laufen lassen und die Top-Level-Knotentypen zählen. Leicht zu wiederholen, wenn sich etwas ändert.

---

## 2. Der größte Gewinn pro Aufwand: **Tabellen**

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

## 3. Die `typst-syntax`-Frage — beantwortet, aber neu zu stellen

Die technische Bewertung ist gemacht (Session 46, mit echter WASM-Probe); die Zahlen stehen in §9.

Die **damalige** Frage war: *„verhindert es unsere Round-Trip-Fehler?"* Antwort: ein Drittel, und die restlichen zwei Drittel lagen auf der Ausgabeseite. Deshalb: nicht bauen.

Die **neue** Frage ist eine andere — *„brauchen wir es, damit Nutzer und KI im Design arbeiten können?"* — und da ist die Antwort offen. Was sich sagen lässt:

- Für Eimer 1–3 (§1): **nein.** Das geht mit dem, was da ist.
- Für Eimer 4: **kommt darauf an, welchen Weg wir gehen.**

### Weg A — die KI deklariert, was sie gebaut hat

Beim Schreiben eines eigenen Bausteins schreibt die KI sein Interface mit:

```typst
// penwright:block name="Zitatkasten" fields=(accent: color, kicker: text)
#block(fill: accent.lighten(85%), inset: 1em, radius: 4pt)[…]
```

Penwright zeigt eine Karte mit genau diesen Feldern. **Kein Parser.** Der Marker-Mechanismus existiert bereits (`// penwright:node=…`, in `parseMagazineMacro`).

*Stärken:* billig, vollständig in unserer Hand, macht die KI zur Teilnehmerin am Design-System statt zum Code-Generator. Und der Marker trägt den **Namen** — „Zitatkasten", nicht „block".

*Schwächen:* gilt nur für Code, der mit Marker entsteht. Renés vier Marketing-Projekte und LANGSAMs `macros.typ` bleiben undurchsichtig. Vergisst die KI den Marker, entsteht stillschweigend ein Raw-Block. Und Wiedererkennung per Marker ist fragil, sobald jemand den Block verschiebt oder verschachtelt.

### Weg B — der CST liest, was da ist

Generischer Eigenschaften-Editor über die benannten Argumente **jedes** Aufrufs, ohne Deklaration. Deckt auch rückwirkend alles ab.

*Die ehrliche Grenze:* Der CST liefert bei `#block(fill: …, inset: 1em)` zwei editierbare Argumente, aber **keinen Namen**. Die Karte hieße „block". Dass es ein Zitatkasten ist, weiß nur, wer ihn geschrieben hat.

*Die unterschätzte Stärke:* nicht das Lesen, sondern das **Splicen**. Jeder Knoten hat einen Byte-Bereich; man ersetzt `[a,b)` und lässt alles andere unangetastet — das Dokument wird **nie neu erzeugt**. Von unseren 30 Round-Trip-Fehlern lagen 17 auf der Ausgabeseite; chirurgisches Editieren macht diese Klasse gegenstandslos.

### Die Kombination ist kein Kompromiss, sondern der Zielzustand

A liefert **Bedeutung und Benennung**, B liefert **Abdeckung und robuste Wiedererkennung**. Die Reihenfolge ist die eigentliche Entscheidung.

**Empfehlung: A zuerst — weil A die Spezifikation für B erzeugt.** Nach ein paar Wochen echter Magazin-Arbeit weiß man, welche Felder die KI tatsächlich anbietet und welche der Nutzer tatsächlich anfasst. Das ist der Katalog, den ein generischer Editor abdecken muss und den man sonst raten würde.

### Was vorher zu entscheiden ist

1. **Darf die KI beliebige Feldtypen deklarieren** (Farbe, Länge, Text, Auswahl, Bild), oder halten wir sie auf eine kleine feste Menge fest? Das bestimmt, ob die Karte ein generisches Formular ist oder eine Handvoll bekannter Widgets — und damit den Großteil des Aufwands.
2. **Adressieren oder editieren?** René hat entschieden: **beides.** Byte-Bereiche allein genügen also nicht, es braucht eine UI.
3. **Was passiert, wenn der Nutzer im Block von Hand editiert?** Verpflichtend zu beantworten, sonst baut man die Fehlerklasse dieser Woche neu: beim Öffnen den Baustein aus den Parametern **neu rendern und mit der Platte vergleichen**. Gleich → Karte. Abweichend → Raw-Block plus sichtbarer Hinweis „von Hand angepasst". Nie raten. Dieselbe Philosophie wie `safeApply`.

---

## 4. Worauf sich das stützen kann

Vieles ist da und wird heute nur in eine Richtung benutzt:

- **Die 24 Design-Elemente deklarieren bereits ihre Parameter** (`DesignElementParam`: `name`, `description`, `required`, `defaultValue` in `designElements.ts`). Das *ist* ein Formularschema — es erzeugt heute Typst und liest nie zurück.
- **Es gibt repoweit keine Funktion, die ein eingesetztes Element wieder aus dem Dokument liest.** `DesignElementPicker` füllt die Parameter einmal beim Einfügen und rendert; danach ist es roher Typst. **Auch unsere eigenen 24 Elemente sind nach dem Einfügen nicht mehr editierbar.** Editierbar sind heute nur die *globalen* Element-Stile (Blockquote/Code/Figure/Table) und die Style-Tokens.
- **Der Marker-Mechanismus existiert** (`// penwright:node=…`).
- **Der Präzedenzfall für „Parameter + editierbarer Inhalt" existiert**: die 9 Magazin-Knoten (`typstMagazine.ts`) sind teils `atom: false` mit `content`-Ausdruck — Rumpf inline editierbar, Attribute als Felder. Genau die Form, die eine Baustein-Karte braucht.
- **Das Pixel-Gate ist das Sicherheitsnetz.** `npm run test:compile:corpus` sagt in ~10 s, ob 265 Seiten über 39 Projekte noch identisch rendern. Ohne das wäre ein Umbau der Parse-Schicht fahrlässig; damit ist er messbar. **Das ist der Grund, warum diese Aufgabe jetzt angehbar ist und vor einer Woche nicht.**

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
