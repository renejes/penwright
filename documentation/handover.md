# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-31, Ende Session 47 · Branch `main`, alles committet und gepusht · App **0.12.0** · `MCP_SETUP_VERSION` **0.38.0** (Binaries neu gebaut) · Typst gebündelt: **0.15.1** · MCP: **66 Tools**
>
> **Lies zuerst diese Datei, dann `CLAUDE.md`.**

---

## 0. Die Aufgabe

**Penwright soll von jemandem benutzbar sein, der kein Typst schreiben kann.**

Das gilt für Text, Struktur und Design — und ausdrücklich für das, was die **KI erzeugt**: Wenn Claude für ein Magazin einen eigenen Design-Baustein baut, darf das Ergebnis für den Nutzer kein Code-Block sein, den er nur anschauen kann.

**Die Umsetzungsreihenfolge aus §4a ist vollständig abgearbeitet** (Stufen 0–3). Ein KI-erfundener Baustein ist einfügbar *und* bearbeitbar, Tabellen sind es auch, und jeder verbleibende Code-Block sagt wenigstens, was er ist. **René hat das laufende Programm gesehen und die Karten ausdrücklich gut gefunden** — die Arbeit ist damit aus der „ungeprüft"-Phase heraus.

> ### ▶ Hier anfangen: **UI-Polish** (§0c)
>
> Die Substanz steht und ist belegt. Was fehlt, ist der Feinschliff an den Oberflächen, die diese Session gebaut hat — und die Liste dafür kommt aus einem echten Durchgang durch die App, nicht aus Vermutungen. §0c nennt sie.
>
> **Danach optional die Rumpf-Karte** (§0d): eine Karte mit *einem* Feld für Blöcke wie `#text(size: 0.88em)[…]`, deren `[…]` echten Fließtext trägt. Reichweite ~30 Blöcke im Korpus — bewusst klein, das Urteil eines Juroren-Panels steht in §0d.

---

## 0a. Was Session 47 gebaut hat

Eine lange Session. In der Reihenfolge, in der es entstanden ist:

### Die vier Stufen (der eigentliche Auftrag)

| Stufe | Was | Commit |
|---|---|---|
| **0** | **Modus-Stack im Block-Splitter.** Typst hat zwei Modi; in Markup gruppieren nur `[` `]`. Ein `(` im Makro-Rumpf machte vorher den Rest der Datei zu *einem* Block: 154 von 189 Überschriften in den echten Kundendokumenten. Byte-identisch, aber Struktur weg. | `37643de` |
| **1** | **Katalog projekt-eigener Bausteine.** Aus den `#let`-Definitionen abgeleitet, keine Registrierung nötig, Sichtbarkeit **pro Datei** (ein Wurzel-`#import` erreicht kein `#include`tes Kapitel — am Compiler bewiesen). Slash-Menü, ＋-Dropdown, MCP-Tool `penwright_list_project_macros`. | `1426d06` |
| **2** | **Baustein-Karte mit Formular.** Ein Block, der genau ein Aufruf ist, wird eine Karte; eine Feldänderung spleißt **einen Offset-Bereich**, alles andere überlebt wörtlich. `findMacroForBlock` ist die eine austauschbare Erkennungsfunktion. | `9d84e53` |
| **3** | **Tabellen.** Vorher **0 von 16** editierbar, jetzt 10 von 16. Die Parameterliste (`align`, `fill`, `stroke`) wird wörtlich getragen, die **Zellen** werden editierbar. 6 Ablehnungen sind Absicht. | `aa9b4ac` |

### Was danach kam

- **Tabellen-Feinarbeit** (`969ccd3`, `90a11d8`, `6cde411`, `33f68fb`): Spalten-Parameter wachsen mit; sie verschieben sich **positionsgenau** (der Editor weiß, *wo* eingefügt wurde — der Serializer kann das nie); Zahnrad-Menü fügt auf **beiden Seiten** ein; ein **Dictionary** (`inset: (x: 8pt, y: 4pt)`) wird nie wie ein Spalten-Array skaliert.
- **Die vier ausgelieferten Dokumente überarbeitet** (`f9bd885`): `mcp-server.md` (drei Tools fehlten ganz, „65" statt 66), beide Handbücher (standen auf **0.10.0**, listeten das entfernte Terminal), `project_status.md`. Die Handbücher werden auch als **MCP-Ressource** ausgeliefert — falsche Angaben führen also Mensch *und* KI in die Irre.
- **LANGSAM als Testprojekt umgebaut** (nicht im Repo): Tabelle im Kolophon (Tupel-`columns`, `align`-Array, **Dictionaries** für `inset`/`stroke`, Klammer-Header) plus drei neue Makros für drei Formularvarianten — `#datenzeile` (zwei Textfelder), `#bildnachweis` (**Dateiauswahl**), `#fussnotiz` (Rumpf + optionale Felder). Acht Karten, eine editierbare Tabelle. Dabei zwei Fehler *im Projekt* gefunden: die Kopfzeilen-Regel in `style.typ` war kaputt (nie aufgefallen, es gab keine Tabelle) und ein verirrtes `test` in `main.typ`.
- **Namen für alle Blöcke + `#v` als Lücke** (`00cd33d`, auf Renés Vorschlag nach dem App-Durchgang): `shared/rawBlockDescription.ts` gibt jedem Raw-Block einen menschlichen Namen; ein einzelnes `#v(…)` wird eine schmale Lücke statt eines Kastens.

---

## 0b. Was die Reviews gefunden haben — und was das über die Gates sagt

**Elf echte Defekte, alle aus der Arbeit dieser Session.** Der wichtigste Befund ist nicht einer davon, sondern das Muster:

> **Mehrere dokument-schädigende Fehler waren im Round-Trip byte-identisch.** Der Korpus-Test und das Pixel-Gate waren bei allen grün. Sie zerstören *Struktur* — und genau die vergleicht kein Gate.

Konkret, damit die nächste Session weiß, wo die blinden Flecken sind:

| Gefunden von | Was |
|---|---|
| Pixel-Gate | Zellen verloren `\`-Umbruch und `size:` aus `#text(…)` → **eine zusätzliche Seite** im Kundenangebot |
| Adversarischer Review (30 Agents) | Dictionary-Korruption (`duplicate key`), Escape-Verdopplung bei jedem Öffnen, `//` als Argument gelesen, Kommentar in `#let`-Signatur löschte Parameter, Symlink-Leak aus dem Projekt heraus, Datei-Picker schrieb unquotiert, `npm test` rot ohne Korpus-Datei |
| Mein eigener Verdacht | Dictionary-Fall, Popup-Leak am Spacer, `stopEvent` |
| Ein Panel, das über etwas anderes stritt | Leeres Code-Feld an Pflichtposition → `unexpected comma` |
| **Nichts** | Die **Karte erschien nie** — der Katalog kommt per IPC, die Node-Views waren längst gebaut. Das Feature war in der Praxis unsichtbar, während alle Tests grün waren. |

**Die Lehre, die in `CLAUDE.md` gehört und dort steht:** kein Test erreicht einen ProseMirror-Node-View. Alles, was dort passiert — ob eine Karte erscheint, ob ein Popup aufgeräumt wird, ob ein Klick ankommt — ist unbewiesen. Für die nächste Session heißt das: **UI-Änderungen brauchen einen App-Start, kein grünes `npm test`.**

Und zweimal blieb ein Test von mir **grün gegen den kaputten Code** — die „green by absence"-Falle. Beide Male nur aufgefallen, weil ich jeden Fix einzeln zurückgenommen habe. Das ist keine Formalität.

---

## 0c. ▶ Der nächste Schritt: UI-Polish

Renés Rückmeldung nach dem App-Durchgang war positiv („finde die Karten total sinnvoll und auch schön"). Die offenen Punkte sind Feinschliff, keine Reparatur:

1. **Die Baustein-Karte selbst.** Sie zeigt Label + Werte und öffnet ein Popup. Anzuschauen: Ist das Popup an der richtigen Stelle? Es wird beim Öffnen **einmal positioniert und folgt dem Scrollen nicht** — das ist die bekannteste Schwäche. Reichen die Feldbezeichnungen? Ist „(Vorgabe)" für ein leeres optionales Feld verständlich?
2. **Der Datei-Picker** bei einem `path`-Feld. **Bekannte Schwäche, ungelöst:** er liefert einen Pfad *relativ zum Kapitel* (`../assets/x.png`), aber `image()` steckt oft in `macros.typ` und löst relativ zur **Projektwurzel** auf. In LANGSAM muss `assets/…` stehen. Wenn der Picker `../assets/…` einsetzt, ist das ein echter Fehler — an `#bildnachweis` im Kolophon direkt testbar.
3. **Die Tabellen-Oberfläche.** Sechs Einträge im Zahnrad-Menü (Spalte davor/danach, Zeile darüber/darunter, löschen) — fühlt sich das gut an oder braucht es zwei Gruppen? Die Kolophon-Tabelle in LANGSAM ist dafür gebaut.
4. **Die neuen Namen und die `#v`-Lücke** (`00cd33d`) sind **noch nie im laufenden Programm gesehen worden**. Sieht die gestrichelte Lücke gut aus? Ist sie klickbar, ohne im Weg zu sein? Lassen sich die Namen auf einen Blick unterscheiden?
5. **Nicht vergessen:** die Karte erscheint nur, wenn der Block *genau ein* Aufruf ist. Aufeinanderfolgende Aufrufe ohne Leerzeile sind **ein** Block und bekommen deshalb keine — das ist korrekt, sieht aber wie ein Fehler aus.

---

## 0d. Optional danach: die Rumpf-Karte

Ein Juroren-Panel (vier unabhängige Perspektiven, darunter eine bewusst gegenläufige) hat die Frage „sollen **alle** Typst-Blöcke Karten werden?" beantwortet: **alle vier sagen nein.**

Die Zahl, die das entscheidet: **86 % der Argumente eines Projekt-Makros sind Fließtext in Anführungszeichen**, den der Autor geschrieben hat — bei eingebauten Typst-Aufrufen sind **79 % der Argumente Code**. Eine Umkehrung um den Faktor zehn, bei genau der Eigenschaft, von der die Karte lebt. Eine Karte über `#text(tracking: 0.2em, dx: 4pt)` ist eine Code-Box mit Zwischenschritt.

**Was bleibt** ist eine Karte mit *einem* Feld — dem Rumpf — für Blöcke, deren `[…]` echten Fließtext trägt. Reichweite laut Panel **~30 Blöcke** (nicht 52; `#block`-Rümpfe fangen fast immer mit einem weiteren Aufruf an). Der Bauplan steht in der Panel-Antwort: `findBodyFormForBlock(content)` neben `findMacroForBlock` in `shared/macroCall.ts`, ein zweiter Zweig in `renderCard`, und ein Prosa-Guard (Rumpf beginnt nicht mit `#`, keine Leerzeile, kein Listen-/Überschriftenmarker) — **den einmal entfernen und rot sehen**, sonst prüft er nichts.

Klein, ehrlich, und ausdrücklich die geringste Reichweite der drei Optionen.

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

## 2. Tabellen — ✅ ERLEDIGT (Session 47)

Vorher: **null von sechzehn** Tabellen im Korpus editierbar, auch nicht die Preistabellen in den Kundenangeboten. Der Grund stand in `parseTable`: `columns:` musste eine ganze Zahl sein, jeder andere Parameter führte zum Abbruch. Gemessen schreiben aber **21 von 27** ein Tupel, 17 übergeben `align:`, 16 `fill:`, 9 `stroke:`, 8 nutzen die Klammerform `table.header[A][B]`.

**Jetzt: 10 von 16 sind echte editierbare Tabellen, 6 werden bewusst abgelehnt.**

Der Ansatz ist derselbe wie beim Raw-Block: **wörtlich behalten, was man nicht versteht.** Die komplette führende Parameterliste wird als Quelltext auf dem Knoten getragen (`params`, deklariert von `TableParams` — ein nicht deklariertes Attribut wirft ProseMirror still weg) und unverändert zurückgeschrieben. Editierbar wird, was der Knotengraph zurückgeben kann: die **Zellen**. Genau das will ein Nicht-Typst-Nutzer an einer Preistabelle ändern — den Preis.

Drei Formen werden **gemerkt statt normalisiert**, damit Renés Dateien byte-stabil bleiben: die Header-Schreibweise (Klammer vs. Paren) und pro Zelle, ob sie als `"String"` oder `[Content]` geschrieben war. Das ist nicht kosmetisch — `"*fett*"` rendert die Sternchen wörtlich, `[*fett*]` rendert fett.

### Was hier am meisten wert war

**Das Pixel-Gate hat einen echten Inhaltsverlust gefunden, den der Textvergleich durchgelassen hätte.** `parseInline` bildet nur einen Teil von Typsts Inline-Syntax ab und lässt den Rest still fallen. Sobald die Tabelle beansprucht wurde, lief **jede Zelle** durch `parseInline` — und zwei Kundenangebote verloren einen `\`-Umbruch und das `size:` aus `#text(size: 8.5pt, fill: mute)[…]`. Im PDF war das **eine zusätzliche Seite**.

Die Lösung ist keine Blacklist bekannter Konstrukte (die verrottet), sondern eine **Selbstprüfung**: jede Zelle wird geparst, zurückgeschrieben und verglichen. Was sich nicht reproduziert, lässt die *ganze* Tabelle wörtlich stehen. Die Round-Trip-Regel per Messung statt per Absicht.

**Der Korpus-Vergleicher hatte selbst einen Fehler**: er splittet an Leerzeilen ohne Verschachtelung zu beachten, und eine Tabelle mit Leerzeilen zwischen den Zeilen — im Kundendokument die Normalform — wurde deshalb als „Inhalt verloren" gemeldet, obwohl das Rendering identisch ist. Das widersprach der Block-Semantik aus Stufe 0. Behoben, und **gegengeprüft**: ohne den Zellen-Guard wird der Test weiterhin rot (5 Dateien), er ist also nicht blind geworden.

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
| **MCP liest** | ✅ `listProjectMacros(projectDir?, targetFile?)` nach dem Muster von `listProjectLabels`. MCP-Tool `penwright_list_project_macros`. | `src/main/projectMacros.ts` |
| **UI bietet an** | ✅ Gruppe „Aus diesem Projekt" in `getCommands()` — Slash-Menü **und** ＋-Dropdown aus der einen Quelle. Gefüllt bei jedem Dateiwechsel über `project:listMacros` (Sichtbarkeit ist pro Datei). | `slashCommands.ts`, `projectMacroStore.ts`, `Toolbar.svelte` |
| **Instanz editieren** | ⏳ **Stufe 2, offen.** Formular im **bestehenden** `typstRawBlock`-Node-View. Feldänderung → `spliceArg(content, [start,end), wert)` → `updateAttributes({content})` — derselbe Pfad, den die Textarea heute nutzt. `macroCall.ts` existiert bereits (Bauen); Zerlegen kommt daneben. | `src/shared/macroCall.ts`, `typstRawBlock.ts` |

**Warum kein neuer Node-Typ — gemessen, nicht vermutet.** Ein eigener `projectElement`-Node ohne Mapping in allen fünf Serializern verliert Inhalt: `htmlSerializer` gibt für unbekannte Knoten einen HTML-Kommentar zurück, `docxSerializer` emittiert im `default:`-Zweig nur, wenn `node.content` existiert — ein Baustein ohne Body verschwände ganz. Als Raw-Block greifen dagegen die vorhandenen Unknown-Macro-Rettungen (`renderUnknownCallArgs` u. a.), die genau dafür geschrieben wurden. **Der Raw-Block ist die richtige Antwort, nicht die faule** — und die Round-Trip-Regel ist per Konstruktion erfüllt, weil `serializer.ts` `attrs.content` wörtlich zurückgibt.

### Wo die Parser-Frage danach noch steht

Deutlich enger als vorher. Für die häufige Form `#name(a: 1, b: "x")[body]` reichen die vorhandenen Scanner. Offen bleibt genau eines:

**Verschachtelung in einem Container, den wir nicht kennen.** Der Deserializer parst Top-Level-Blöcke plus die Rümpfe der Container, die er kennt (`#columns`, `#notiz`, `#bildtafel` via `parseBlocks`). Steckt ein Baustein in einem **KI-erfundenen** Container, findet ihn niemand. Das ist der Fall, den René mit „kreativer kombiniert" meint, und **dort und nur dort** ist der CST nicht mehr optional.

**Bauprinzip daraus:** Das Auffinden einer Instanz muss **eine einzige, austauschbare Funktion** sein — heute ein Scanner über Top-Level plus bekannte Container, morgen eine CST-Abfrage. Registry, Karte, Formular, MCP-Tools bleiben beim Tausch unverändert. Wird das Auffinden dagegen über die Codebasis verstreut (wie heute die sieben Klammer-Scanner), ist der Umstieg eine Neuschreibung statt einer Ersetzung.

---

## 3a. STUFE 0 — ✅ ERLEDIGT (Session 47, `37643de`)

Der Modus-Stack steht. Details und die Korrektur an der Schwere-Diagnose: **§0a**.

Was davon dauerhaft gilt und beim nächsten Parser-Umbau wieder zählt:

- **Ein Fix an der Parse-Schicht wird gegen den UNVERÄNDERTEN Korpus gegengeprüft.** Nicht nur „gehen die neuen Tests durch" — sondern: parst irgendeine bestehende Datei jetzt *anders*? Genau so wurden die zwei Regressionen gefunden, die die neuen Tests glatt passiert haben (`#sym.dagger` in einer Tabellenzelle).
- **Die Markup/Code-Asymmetrie wird gemessen, nicht hergeleitet.** `resources/bin/typst-arm64-darwin` steht bereit; drei Testdateien beantworten in zwanzig Sekunden, was eine Stunde Nachdenken falsch beantwortet.
- **Die Falle aus `e23168f` ist weiterhin scharf** und hat jetzt einen Test: die Magazin-Container schließen ihre Argumentliste und öffnen ihren Rumpf in derselben Zeile. Wer den Modus beim `)` verlässt, zerlegt den Rumpf an seiner eigenen Leerzeile.

---

## 4. Worauf sich das stützen kann

Vieles ist da und wird heute nur in eine Richtung benutzt:

- **Die 24 Design-Elemente deklarieren bereits ihre Parameter** (`DesignElementParam`: `name`, `description`, `required`, `defaultValue` in `designElements.ts`). Das *ist* ein Formularschema — es erzeugt heute Typst und liest nie zurück.
- **Es gibt repoweit weiterhin keine Funktion, die ein eingesetztes Element wieder aus dem Dokument liest** — das ist genau Stufe 2. `DesignElementPicker` füllt die Parameter einmal beim Einfügen und rendert; danach ist es roher Typst. **Auch unsere eigenen 24 Elemente sind nach dem Einfügen nicht mehr editierbar**, und die projekt-eigenen aus Stufe 1 ebenso wenig. Editierbar sind heute nur die *globalen* Element-Stile (Blockquote/Code/Figure/Table) und die Style-Tokens. Umgekehrt existiert das Bauen jetzt geteilt (`shared/macroCall.ts`), Zerlegen gehört daneben.
- **Der Präzedenzfall für „Parameter + editierbarer Inhalt" existiert**: die 9 Magazin-Knoten (`typstMagazine.ts`) sind teils `atom: false` mit `content`-Ausdruck — Rumpf inline editierbar, Attribute als Felder. Genau die Form, die eine Baustein-Karte braucht.
- **`styleInference.ts` (379 Zeilen) liest bereits ein handgeschriebenes `style.typ` in Design-Tokens ein** — Farben, Fonts, Leading, Heading-Größen. Aufgerufen wird es nur von `webExport.ts`. Der Design-Tab sperrt sich bei handgeschriebenem `style.typ` aus (`isHandwrittenStyle`, aus gutem Grund: sonst überschreibt er die Makros). Die Maschine zum *Lesen* eines fremden Designs existiert also und ist nicht angeschlossen — eine begrenzte Aufgabe, kein Parser-Projekt.
- **Das Pixel-Gate ist das Sicherheitsnetz.** `npm run test:compile:corpus` sagt in ~10 s, ob 265 Seiten über 39 Projekte noch identisch rendern. Ohne das wäre ein Umbau der Parse-Schicht fahrlässig; damit ist er messbar. **Das ist der Grund, warum diese Aufgabe jetzt angehbar ist und vor einer Woche nicht.**

---

## 4a. Umsetzungsreihenfolge — abgearbeitet

| Stufe | Was | Stand |
|---|---|---|
| **0** | Modus-Stack im Block-Splitter (§3a) | ✅ `37643de` |
| **1** | `listProjectMacros` + `visibleIn` + Picker-Sektion „Aus diesem Projekt" | ✅ `1426d06` |
| **2** | `parseMacroCall` + Splice + Formular im `typstRawBlock`-Node-View | ✅ `9d84e53` |
| **3** | Tabellen (§2) | ✅ Session 47 |
| später | CST, falls Verschachtelung in unbekannten Containern real wird | offen · `findMacroForBlock` ist die auszutauschende Stelle |

### Die Methode, die sich über alle vier Stufen bewährt hat

Sie hat in dieser Session **viermal** einen Fehler gefunden, den Nachdenken nicht gefunden hätte — zweimal in echten Kundendokumenten:

1. **Erst den Korpus messen, dann den Parser schreiben.** Die Häufigkeiten haben jedes Mal das Design bestimmt (170 × `#name[body]` ohne Klammern; 21 × `columns:` als Tupel).
2. **Den Compiler fragen, nicht schließen.** Drei Wegwerf-`.typ` beantworten in zwanzig Sekunden, was eine Stunde Überlegung falsch beantwortet — und *Pixel* vergleichen, nicht „kompiliert es".
3. **Nach dem Umbau den UNVERÄNDERTEN Korpus neu parsen.** So kamen die zwei Regressionen heraus, die die neuen Tests glatt passiert hatten.
4. **Das Pixel-Gate ist der einzige Test, der den Zellen-Verlust gefunden hat.** Der Textvergleich sagte grün.
5. **Ablehnen ist eine gültige Antwort.** Was der Parser nicht ganz versteht, bleibt Raw-Block und exportiert weiterhin wörtlich.

## 5. Was dabei nicht kaputtgehen darf

- **Das Paritätsprinzip** (CLAUDE.md „App ↔ MCP parity"). Was der Mensch sieht, sieht die KI — und umgekehrt. Eine Baustein-Karte, die nur die GUI kennt, verletzt P2/P3. Der Marker gehört ins Dokument, nicht nach `.penwright/`.
- **Die Round-Trip-Regel**: eine Unwrap darf nur beanspruchen, was der Knotengraph zurückgeben kann. Diese Regel ist mit zehn Fehlern in echten Dokumenten bezahlt.
- **Safe-Apply.** Jede Design-Mutation läuft über `safeApply` (staging → verify → commit/rollback), auf **beiden** Seiten. Eine Karte, die direkt schreibt, ist ein Regress.
- **`npm test` vor jedem Commit** — enthält das Pixel-Gate und läuft auf Renés Maschine über die Kundendokumente.

---

## 6. Was sonst noch offen ist

- **Der manuelle Durchgang durch die App steht weiterhin aus — und ist nach Stufe 1+2 dringender als vorher.** Beide Stufen sind zum großen Teil UI-Arbeit: dass die erzeugten Aufrufe *kompilieren* und die Spleiße *byte-genau* sind, ist bewiesen; dass die **Baustein-Karte im Editor gut zu bedienen** ist, ist es nicht. Konkret anzuschauen: taucht die Karte statt des Code-Blocks auf, sind die Feld-Labels verständlich, funktioniert `</>` in beide Richtungen, tut der Datei-Picker bei einem `path`-Feld das Richtige, und stört das Popup beim Scrollen (es wird beim Öffnen einmal positioniert und folgt nicht). Nach sieben Sessions ohne einen einzigen App-Start die größte Unsicherheit im Projekt — und für diese Aufgabenstellung besonders relevant, weil „zugänglich" sich nur am laufenden Programm beurteilen lässt. Besonders: Document-Settings (schreibt jetzt die Wurzel), „Kapitel hinzufügen", Bild-Drag-and-Drop, Design-Panel → „Bausteine", Verlaufs-Hub, KI-Anzeige in der Statusleiste. Neu und ungeprüft: **Attached Lists** (`typstListAttach.ts` — was macht ProseMirror beim Neuanlegen/Teilen einer Liste?), dass **Termlisten und Titelseiten jetzt Raw-Blocks sind** (richtig entschieden, UX-seitig anzuschauen), und aus Session 47 die **Gruppe „Aus diesem Projekt"** in Slash-Menü und ＋-Dropdown: taucht sie auf, sind die Labels lesbar, und ergibt der eingefügte Aufruf im Editor etwas Sinnvolles? Getestet ist, dass er **kompiliert** — nicht, wie er sich anfühlt.
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
- **`MCP_SETUP_VERSION` = 0.30.0.** `ensureInstalledBinary` kopiert bei jedem App-Start bedingungslos aus `dist/mcp/bin/`. Nach jeder Änderung an `server.ts` **oder an geteiltem Code, der in der Binary landet** (Deserializer, `designElements`, `skillTemplates`): bumpen **und** `npm run build:mcp-binary:all`.
- **`npm run fetch:typst`** ist die einzige Wahrheit für die Typst-Version (`TYPST_VERSION` im Skript). `--check` verifiziert ohne Download.

---

## 8. Arbeitsweise, die sich bewährt hat

- **Messen schlägt schätzen, und ein Rendering schlägt einen Textvergleich.** Die „62 % undurchsichtig" wurden erst nützlich, als sie in vier Eimer zerfielen. Die „null von sechzehn Tabellen" ist die konkreteste Aufgabe dieses Handovers und stand in keinem Plan.
- **Jeder Fix bekommt einen Test, der ihn ohne den Fix rot sieht — und das wird ausprobiert.** Mehrfach war ein Test grün gegen den zurückgepatchten Code.
- **Erst beweisen, dann normalisieren.** Zwölf Baseline-Einträge sahen nach harmloser Formatierung aus. Sie waren es — aber `#align(center + horizon)` sah genauso aus und war es nicht.
- **Zwei Messfallen, die falschen Alarm produziert haben** (behoben, als Regel in CLAUDE.md): Pixel hashen statt der PNG-Datei (0.15 komprimiert anders → 39/39 Projekte falsch rot), und System-Fonts ignorieren (sonst misst man den eigenen Font-Ordner).
- **Nach einem Parser-Umbau den UNVERÄNDERTEN Korpus gegenprüfen.** Nicht „gehen die neuen Tests durch", sondern: parst irgendeine bestehende Datei jetzt *anders*? Session 47 hat so zwei Regressionen gefunden, die die neuen Tests glatt passiert hatten — eine davon in einem Kundendokument.
- **Dieselbe Fehlerklasse kommt bei JEDEM neuen Scanner wieder: Delimiter einheitlich zu zählen.** Dreimal bezahlt — Prosa auf oberster Ebene (`c3ba300`), Prosa im Makro-Rumpf (Stufe 0), und der Aufruf-Parser in Stufe 2. Typst hat zwei Modi: in Markup gruppieren nur `[` `]`, in Code alle sechs. Wer einen Scanner schreibt, schreibt den Modus-Stack mit.
- **Der Compiler beantwortet Syntaxfragen billiger als Nachdenken.** Drei Wegwerf-`.typ` und `resources/bin/typst-*` klären in zwanzig Sekunden, ob `(` in Markup gruppiert. Die Regel, die dieser Session am meisten Zeit gespart hat.
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
