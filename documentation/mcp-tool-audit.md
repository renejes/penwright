# MCP-Tool-Audit — Bestandsaufnahme

> Stand: 2026-07-28 · Grundlage: `src/mcp/server.ts` (2.980 Zeilen, Commit `88dfc3a`), MCP-SDK 1.28.0, gemessenes `tools/list` der gebauten Binary.
> Entscheidungsdokument mit Handlungsoptionen: [mcp-tool-consolidation.md](mcp-tool-consolidation.md)

---

## Kurzfassung

**Penwright exportiert 60 MCP-Tools und 5 Skill-Prompts.** Die Frage war, ob das zu viele sind. Die Messung sagt:

1. **Ein Token-Problem gibt es nicht.** Das komplette Manifest sind **~9.500 Token** — **0,86 %** eines 1-M-Kontextfensters, bei Prompt-Cache-Read **~$0,004 pro Request**. Wer allein Token sparen will, kürzt Beschreibungen (−37 %) und fasst kein einziges Tool an.
2. **Ein Verwechslungsproblem gibt es sehr wohl.** 10 Tools heißen `list_*`, fünf Tools schreiben konkurrierend in dieselbe `style.json`, drei Tools heißen sinngemäß „lies die Datei", zwei Tools committen. Das ist ein Problem der **Tool-Grenzen und Namen**, nicht der Anzahl.
3. **Es gibt eine unsichtbare Zustandsmaschine.** 41 der 60 Tools hängen still an `state.currentFile` bzw. `state.projectDir`. Kein Schema zeigt das an. Der schärfste Fall: `read_file(A)` → ändern → `update_document` schreibt nach **B**.
4. **`state.projectDir` fällt auf `process.cwd()` zurück** (`server.ts:287`) — und **kein ausgelieferter Host setzt ein Projektverzeichnis**. In Claude Desktop und Claude Code ist das ein beliebiges Verzeichnis. Der einzige Schutz ist, dass der Agent `penwright_set_project` freiwillig zuerst ruft.
5. **Kein einziger schreibender MCP-Pfad hat Verify/Rollback.** Die App-Invariante `safeApplyDesign` (stage → `TypstCompiler.verify()` → commit oder rollback) existiert im MCP-Server nicht, die AI-Snapshot-Maschinerie greift dort ebenfalls nicht.
6. **Die Tool-Liste existiert sechsfach handgepflegt und driftet bereits** — `server.ts` 60, `mcp-server.md` 59, `handbook.md`/`handbuch.md` 59, `CLAUDE.md` 59, `manifest.template.json` 53.

Die belastbare Schlussfolgerung: **Die Zahl 60 ist nicht der Schaden.** Der Schaden sind ~15 verifizierte Defekte, die fehlende Absicherung der Schreibpfade, und ein Dutzend Namenskollisionen — allesamt behebbar, **ohne einen einzigen Tool-Namen zu ändern**.

---

## Methode

| Baustein | Vorgehen |
|---|---|
| Inventar | 6 Agenten lasen je eine Tool-Gruppe im Quelltext und dokumentierten Signatur, Delegation, Seiteneffekt, App-Zwilling, Redundanz, Verwechslungsrisiko |
| Manifest-Messung | gebaute Binary (`dist/mcp/bin/penwright-mcp`) über stdio gestartet, MCP-Handshake, `tools/list` + `prompts/list` **am Draht abgegriffen** — nicht aus dem Zod-Quelltext geschätzt |
| SDK-Machbarkeit | Quelltext-Analyse von `node_modules/@modelcontextprotocol/sdk` **und** des installierten Claude-Code-Bundles (welche Capabilities der Client wirklich deklariert) |
| Kopplung | Repo-weiter Abgleich aller Stellen, die Tool-Namen im Klartext nennen |
| Außenwelt | Recherche zu MCP-Tool-Design, Tool Search, Toolsets, `action`-Multiplexern, mit Quellenbelegen und Kennzeichnung von Vendor-Behauptung vs. Messung |
| Prüfung | Alle tragenden Einzelbefunde wurden gegen den Quelltext nachverifiziert |

Belegstärke im Text: **[V]** = Vendor-Angabe, **[M]** = Messung, **[P]** = Praxisbericht.

---

## 1. Das Inventar — 60 Tools

Spalte **E** = Effekt: `R` lesend · `W` schreibend · `W+C` schreibend mit Kompilieren · `P` Prozess · `S` reiner Zustandssetzer.
Spalte **Red.** = Redundanzklasse: **einzig** (trägt Domänenwissen, das sonst nirgends existiert) · **überl.** (überlappend, aber mit echter Zusatzleistung) · **Dubl.** (Dublette) · **ersetzb.** (durch ein generisches Tool ohne Wissensverlust ersetzbar).

### Projekt & Dateien (5)

| Tool `penwright_…` | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `set_project` | S | 1 | 190 | einzig | Einziger Setter der Sandbox-Wurzel. Wird er übersprungen, arbeitet alles still im `cwd`-Fallback weiter — **ohne Fehler**. |
| `list_files` | R | 0 | 93 | ersetzb. | Extension-Whitelist + Ignore-Liste, sonst nichts. Konkurriert in Claude Code direkt mit Glob/Bash. In Claude Desktop dagegen die einzige Orientierung. |
| `read_file` | R | 1 | 140 | ersetzb. | Generisches Lesen. **Identisches Schema wie `open_file`, völlig andere Wirkung.** Verschiebt `currentFile` *nicht* — Kern der Schreibfalle. |
| `write_file` | W | 2 | 148 | ersetzb. | Universalschlüssel. Kann `style.json`/`style.typ`/Root direkt überschreiben und damit **jedes** spezialisierte Tool umgehen — ohne Regenerierung, ohne Verify. |
| `create_project` | W | 3 | 98 | überl. | Strikt schwächere Kopie des App-Pfads: **kein** `git init`, kein `.gitignore`, kein `.penwright/`, **kein `.claude/skills`** — obwohl die Prompt-Fehlermeldung (`server.ts:405`) genau dieses Tool empfiehlt. |

### Presets (2)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `list_presets` | R | 1 | **338** | einzig | Findet die gebündelte Preset-Bibliothek über Env-Vars, die kein Host-Agent kennt. Aber: die 338-Zeichen-Beschreibung zählt exakt das auf, was der Rückgabewert liefert — reine Dopplung im Manifest. |
| `create_from_preset` | W | 3 | **367** | einzig | Kopiert einen Preset-Ordner mit den Ausschlüssen, die WYSIWYG-Parität zur Galerie garantieren. Konkurriert frontal mit `create_project` — nur diese Seite trägt den „prefer this"-Hinweis. |

### Dokument-Operationen (4)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `get_document` | R | 0 | 143 | überl. | Verspricht „das Dokument", liefert **nur die eine Datei** — auf einem Root mit `#include` sieht der Agent bloß die Include-Liste und hält sie für den Text. Kein Cap: kann den Kontext unbegrenzt fluten. |
| `open_file` | S | 1 | 112 | überl. | Reiner Zustandssetzer, liefert nur eine Wortzahl. Prüft nicht einmal auf `.typ`. Mindestens 8 Tools hängen still daran. |
| `update_document` | W | 1 | 186 | **ersetzb.** | = `write_file(currentFile, …)` **minus Sandbox, minus mkdir**. „update" suggeriert Patch, ist aber destruktives Full-Replace. |
| `compile` | P | 0 | 205 | einzig | `parseCompileDiagnostics` ist echtes Wissen (Typsts mehrzeiliges stderr → `file`+`line`+`hint`) und die Grundlage jeder Selbstkorrektur. Schreibt sein Wegwerf-PDF aber **neben das Root-File**, im vom App-Watcher überwachten Ordner. |

### Settings (2)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `get_settings` | R | 0 | 185 | überl. | **Die Beschreibung ist nachweislich falsch:** sie verspricht font, size, margins, page format, paragraph settings und heading numbering — `DocumentSettings` hat seit Phase A genau zwei Felder (`lang`, `bibliographyStyle`). |
| `update_settings` | W | 1 | 162 | einzig | `applySettings` setzt `#set`-Blöcke idempotent an die richtige Preamble-Stelle. Aber `z.record(z.string())` zeigt dem Agenten nicht, dass nur zwei Keys akzeptiert werden — unbekannte verschwinden **still**, mit Erfolgsmeldung. |

### Design (16) — 28 % des Manifests

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `list_styles` | R | 0 | 159 | überl. | Dump von 6 Theme-Presets. Der riskanteste Name des Servers: auf „wie sieht das Dokument aus?" liefert er 6 Vorlagen, die mit dem Projekt nichts zu tun haben. |
| `apply_style` | W | 1 | 141 | einzig | Trägt die **Preserve-Liste** (`sections`, `custom.preamble`, 4 Druckfelder) — echtes Wissen, das ein generischer Schreibpfad zerstört. |
| `get_style` | R | 0 | 130 | überl. | Pflicht-Lesezugriff vor `update_style`; liefert auf Projekten ohne `style.json` still die Defaults (praktisch, aber ununterscheidbar von „ist gesetzt"). |
| `get_selection` | R | 0 | **412** | überl. | Mechanisch ein `read_file` von `.penwright/selection.json`. **Längste Beschreibung im ganzen Manifest bei null Parametern** — der Protokolltext macht die ganze Arbeit. Der Name steht wörtlich im nutzersichtbaren „Starter-Prompt" der App. |
| `update_style` | W | 1 | 144 | einzig | Der einzige feingranulare Design-Schreibpfad; Deep-Merge pro Heading-Ebene und pro Element. **`patch.sections` wird still verschluckt** (fehlt in der Override-Tabelle von `deepMergeStyle`). |
| `list_fonts` | R | 0 | 162 | ersetzb. | Liest ein JSON, mappt drei Felder. Das gesamte „Wissen" sind 7 Familiennamen — ein `z.enum` oder ein Satz im Skill leistet dasselbe. |
| `apply_palette` | W | 6 | 121 | **Dubl.** | Der Per-Slot-Zweig **ist** `update_style({colors:…})` — gleiche Merge, gleicher Sanitizer, gleicher Schreibpfad; er kostet 5 der 6 Parameter. Leerruf meldet **Erfolg ohne zu schreiben**. |
| `list_layouts` | R | 0 | 148 | überl. | Projiziert paper/orientation/columns/baseSize, verschweigt aber die Druckfelder — wer Bleed sucht, findet hier nichts. |
| `apply_layout` | W | 1 | 122 | überl. | Ersetzt `layout` **im Ganzen** statt zu mergen und **löscht dabei still `bleed`/`cropMarks`/`facingPages`/`binding`** — genau die Felder, die `apply_style` ausdrücklich bewahrt. |
| `list_design_elements` | R | 0 | 238 | überl. | Katalog liegt in der Binary, ist also nicht per `read_file` erreichbar. **Behauptet 19 Elemente, real sind es 24** — u. a. `spread-image`, `full-bleed-image`, `margin-note` werden verschwiegen und deshalb nie benutzt. Dump ~19 k Zeichen. |
| `insert_design_element` | W | 4 | 140 | einzig | 24 parametrische Templates mit Auto-Theming über `style-colors`/`style-fonts`. Schreibt aber in `state.currentFile` **ohne Root-Prüfung** — bei offenem Kapitel kompiliert das Ergebnis nicht. |
| `generate_layout` | W | 3 | 156 | überl. | **Schwerster Namensfall des Servers:** heißt „layout", überschreibt aber Theme, Farben, Fonts, Headings *und* setzt einen Hero ein — direkt neben `apply_layout`, das ausdrücklich nur Geometrie tauscht. Bewahrt die Druckfelder nicht. |
| `list_section_styles` | R | 0 | 309 | einzig | Drei Dinge in einem Call (Preset-Katalog + definierte Varianten + Kapitel-Zuordnung), von denen nur eines anders erreichbar wäre. Name kollidiert mit `list_styles`. |
| `define_section_style` | W+C | **13** | 262 | einzig | **Teuerstes Tool im Manifest (1.752 Zeichen).** Einziger Schreibpfad für `ProjectStyle.sections`, weil `update_style` genau dort einen Bug hat. 13 flache Parameter neben einem freien Patch-Objekt. |
| `apply_section_style` | W | 2 | 200 | **Dubl.** | Prozessbedingte Doppelung des IPC-Handlers `section:apply` (unvermeidbar, entkoppelte Binary). Name unterscheidet sich von `apply_style` um **ein Wort**, Scope ist ein Kapitel vs. das ganze Dokument. |
| `clear_section_style` | W | 1 | 145 | überl. | ~14 Zeilen Handler, exakte Umkehroperation von `apply_section_style`. Einziges „Reset"-Tool im gesamten Design-Block. |

### Kapitel & Struktur (6)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `get_chapters` | R | 0 | 142 | überl. | Liest `state.currentFile` statt der Wurzel — **wer zuletzt ein Kapitel geöffnet hat, bekommt „keine Kapitel"**. Öffnet jede Kapiteldatei und meldet `exists`. |
| `add_chapter` | W | 2 | 139 | überl. | Leitet das `chapters/`-Verzeichnis aus der **offenen** Datei ab → erzeugt `chapters/chapters/` und schreibt die `#include`-Zeile ins Kapitel. Slug ohne `NN-`-Präfix, sortiert nicht mit `split_document` zusammen. |
| `remove_chapter` | W | 1 | 97 | **ersetzb.** | Löscht **jede** Zeile, die den Pfad enthält (auch Kommentar, `#image`, `#import`) — breiter als die Beschreibung. Keine Pfadvalidierung. |
| `reorder_chapters` | W | 1 | 179 | überl. | Echter Regressionsschutz (nicht genannte Kapitel werden angehängt statt gelöscht), aber schreibt ebenfalls nach `currentFile`. |
| `merge_document` | R | 0 | 150 | überl. | Trägt die Marker-Konvention, auf der DOCX- und Web-Export aufsetzen. Name kollidiert mit dem **destruktiven** App-Menüpunkt „Document ▸ Merge". |
| `split_document` | W | 0 | 194 | überl. | **Null Parameter, destruktiv, aus MCP-Sicht unumkehrbar** (kein Snapshot, kein Verify). Zerlegt bei offenem Kapitel das Kapitel. |

### Bibliographie (3)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `get_citations` | R | 0 | 139 | überl. | Getesteter BibTeX-Parser. Scannt aber **nur den Projekt-Root, nicht rekursiv** — eine `.bib` unter `bib/` oder `sources/` existiert für den Agenten nicht. |
| `add_citation` | W | 2 | 154 | überl. | **Größte Namensfalle des Servers:** „add citation" heißt für jeden Autor „setz `@key` in den Text". Das Tool fasst Prosa nie an. Ein Agent kann dreimal „zitieren" und ein unzitiertes Manuskript hinterlassen. |
| `ensure_bibliography` | W | 0 | 131 | **Dubl.** | Vollständige Teilmenge von `add_citation` (gleicher Header, gleiche `#bibliography`-Zeile). Liest sich wie ein Pflicht-Setup-Schritt → Agenten rufen beide und verbrennen einen Turn. |

### Cross-Refs & Footnotes (3)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `list_labels` | R | 1 | 175 | einzig | Caption-Heuristik + Präfix-Klassifikation sind echtes Domänenwissen; Nachschlagewerk vor jedem `insert_reference`. Einer von **10** `list_*`-Namen. |
| `insert_reference` | W | 4 | 198 | überl. | Validiert das Label gegen `projectLabels` — der Agent kann kein totes `@ref` setzen. Nimmt aber **nur Labels, keine Citekeys**: für „zitiere @chen2021 im dritten Absatz" existiert im ganzen Server kein Tool. |
| `add_footnote` | W | 4 | 131 | **ersetzb.** | Ein `slice`-Splice plus Klammerbilanz. Semantisch mehrdeutig zu `add_comment`: „füge eine Anmerkung hinzu" ist ein Münzwurf zwischen gedruckter Fußnote und redaktionellem Kommentar. |

### Comments (4)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `list_comments` | R | 2 | 185 | einzig | Re-Anchoring gegen den aktuellen Dateiinhalt + `orphaned`-Flag — per `read_file` nicht reproduzierbar. **Einziges Listen-Tool ganz ohne Cap.** |
| `add_comment` | W | 5 | 148 | einzig | Kodiert das komplette Kommentar-Dateiformat plus Anker→Offset-Auflösung. Teil des Anker-Clusters (siehe §3). |
| `resolve_comment` | W | 2 | 160 | überl. | Exponiert von `comments:update` genau **ein** Feld. Ein Agent, der auf einen Kommentar antworten soll, findet kein Tool und weicht auf rohes YAML-Editieren aus. |
| `delete_comment` | W | 1 | 135 | überl. | Faktisch `rm comments/<id>.md`. Bewusst getrennt von `resolve` — das ist genau die `destructiveHint`-Grenze, die ein Client auswerten können muss. |

### Discovery (3)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `search_project` | R | 5 | 200 | überl. | Der Lookaround statt `\b` ist echtes Wissen (`@citekey` findet man mit `\b` nicht). Unter Claude Code aber faktisch ein ripgrep-Duplikat, unter Claude Desktop unverzichtbar. |
| `replace_in_project` | W | 6 | 150 | überl. | **Byte-identisches Parameter-Präfix zu `search_project`**, einziger Unterschied ist `replacement`. Kein Dry-Run, keine Vorschau, keine erzwungene Version — auf einem Projekt ohne `.git` unwiderruflich. |
| `find_source_for_citation` | R | 1 | 147 | **ersetzb.** | Ein `readdirSync` plus Stem-Vergleich. „Finde die Quelle zu @x" ist außerdem dreideutig (Textstellen / PDF / Bib-Eintrag) und trifft drei verschiedene Tools. |

### Export (3)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `export_pdf` | W+C | 1 | 123 | überl. | Identische Kompilierung wie `compile`, nur bleibt das Artefakt. Im Typst-Sprachgebrauch **ist** `compile` der Befehl, der die PDF schreibt — die Verwechslung geht in beide Richtungen. |
| `export_docx` | W+C | 1 | 195 | einzig | Nichts sonst erzeugt DOCX; `serializeDocx` ist tausende Zeilen Typst→Word-Semantik. |
| `export_print` | W+C | 5 | 285 | überl. | Trägt die Bleed-/Schnittmarken-Geometrie, ist aber eine **unvollständige Kopie** des App-Pfads: bei Projekten ohne `style.json` ersetzt es das komplette Autorendesign durch Penwright-Defaults. |

### Import & Assets (2)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `import_markdown` | W | 4 | 159 | überl. | `markdownToTypst` ist echte Konversionslogik. **Größte Falle:** die importierte Datei ist nicht Teil des Dokuments — der Agent nimmt an, sie erscheine im PDF. Schreibt zudem ohne die Präambel, die der App-Pfad setzt. |
| `add_image` | W | **8** | 177 | überl. | Inhalts-Hash-Dedup + `#figure`-Wrapping + Escaping. Zwei **versteckte Pflichtregeln** (`label` ohne `caption` → Laufzeitfehler; `file` ohne `afterText` → Laufzeitfehler) stehen nur im Fließtext, nicht im Schema. |

### Versionen (4)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `save_version` | W | 2 | 126 | einzig | Einziger Pfad, der ein repo-loses Projekt lazy `git init`t, `.gitignore` schreibt und die Repo-lokale Committer-Identität setzt — der dokumentierte Magazin-Pipeline-Normalfall. |
| `list_versions` | R | 0 | 127 | einzig | Einzige Quelle der `sha`-Werte, die `show_version`/`restore_version` brauchen. Die Reihenfolge steht nur im `describe()`-Text. |
| `show_version` | R | 1 | 194 | einzig | Strukturierter Per-Datei-Diff. **Ohne Cap** — beim Initial-Commit landet das komplette Projekt in einem Tool-Result. |
| `restore_version` | W | 2 | 119 | einzig | Einziger Rollback-Pfad. **`files` ist optional, und Weglassen stellt ALLES aus dem Commit wieder her** — „mach die Änderung an Kapitel 3 rückgängig" ohne `files` setzt das ganze Projekt zurück. |

### Git Low-Level (3)

| Tool | E | Par | desc | Red. | Befund |
|---|---|---:|---:|---|---|
| `git_status` | R | 0 | 95 | überl. | Einziger Melder unkommittierter Änderungen. **Kein Projekt-Guard** — greift auf `state.projectDir`, das im Zweifel `process.cwd()` ist. |
| `git_commit` | W | 2 | 67 | **Dubl.** | Strikte Teilmenge von `save_version` und die **schlechtere** Variante: kein Auto-Init, keine `.gitignore`, keine No-Change-Erkennung. Sein einziges Alleinstellungsmerkmal (`stageAll:false`) ist funktionslos, weil es kein `git_add` gibt. Agenten mit Git-Vokabular greifen bevorzugt hierhin. |
| `git_push` | P | 0 | 50 | einzig | **Einziges Tool im ganzen Server mit Netzwerkwirkung** — und es widerspricht dem eigenen Blockkommentar 220 Zeilen darüber („All operations are local; nothing is ever pushed to a remote"). Kein Remote-Setter per MCP vorhanden, kein Projekt-Guard. |

### Verteilung

| Redundanzklasse | Anzahl |
|---|---:|
| einzigartig | 19 |
| überlappend | 29 |
| Dublette | 4 (`apply_palette`, `apply_section_style`, `ensure_bibliography`, `git_commit`) |
| trivial ersetzbar | 8 (`update_document`, `list_files`, `read_file`, `write_file`, `list_fonts`, `remove_chapter`, `add_footnote`, `find_source_for_citation`) |

**„Überlappend" heißt nicht „streichbar".** In Claude Desktop ohne Dateisystem-Server sind `read_file`/`write_file`/`list_files` die einzige Möglichkeit, überhaupt an eine `.bib` oder `style.typ` zu kommen. Die Redundanz ist hostabhängig.

---

## 2. Was das Manifest wirklich kostet

Gemessen am Draht, nicht geschätzt: die gebaute Binary gestartet, MCP-Handshake, `tools/list` abgeholt.

| Auslieferungsform | Zeichen | Token (~3,7 Z/T) |
|---|---:|---:|
| rohes `tools/list`-Result | 35.222 | **~9.500** |
| Anthropic-`tools[]`-Form (Client entfernt `$schema`/`execution`) | 30.688 | ~8.300 |
| + `prompts/list` (5 Skill-Prompts) | 1.284 | ~350 |

**Wohin die 35 KB gehen:**

| Komponente | Zeichen | Anteil |
|---|---:|---:|
| Tool-Beschreibungen | 10.027 | 28,5 % |
| Parameter-`.describe()`-Texte | 6.883 | 19,6 % |
| Tool- und Parameternamen | 2.183 | 6,2 % |
| **— semantischer Inhalt** | **19.196** | **54,6 %** |
| `$schema` + `execution` (SDK-Transport-Metadaten) | 4.662 | 13,3 % |
| übriges JSON-Gerüst | 11.293 | 32,1 % |
| **— Gerüst** | **15.955** | **45,4 %** |

**45 % des Manifests ist Struktur, keine Bedeutung.** Der Wrapper-Overhead beträgt konstant ~85 Zeichen pro Tool, unabhängig von der Größe — viele kleine Tools kosten strukturell mehr als wenige große.

### Verhältnismäßigkeit

| Kontextfenster | Manifest-Anteil |
|---|---:|
| 1 M (Opus 5 / Sonnet 5) | **0,86 %** |
| 200 K (Haiku 4.5) | 4,3 % |
| 32 K praktisches Arbeitsbudget | 27 % |

Kosten bei Opus 5: kalt ~$0,043/Request, **bei Cache-Read ~$0,0043**. Tool-Definitionen stehen an Position 0 des Prompts — genau dort, wo Caching am besten greift. Kehrseite: **jede Änderung am Tool-Set invalidiert bei allen laufenden Nutzern den kompletten Cache** (Tools + System + Messages).

### Wo die Hebel wirklich liegen

| Maßnahme | Manifest danach | Δ |
|---|---:|---:|
| Baseline | 35.222 | — |
| Beschreibungen auf 100 Zeichen kappen | 26.461 | −24,9 % |
| + alle `.describe()`-Texte entfernen | 17.539 | **−50,2 %** |
| alle 16 Design-Tools entfernen | 25.364 | −28,0 % |
| die 3 Low-Level-Git-Tools entfernen | 34.342 | **−2,5 %** |

**Text kürzen schlägt Tools streichen um Größenordnungen.** Und weil ~200 Zeichen konstanter Rahmen pro Tool anfallen, ist alles, was Tool-Streichen überhaupt einsparen kann, gedeckelt: 60 → 37 Tools spart strukturell **−13 %**, 60 → 13 Tools spart **−27 %**.

### Die teuersten und die billigsten

| Teuerste 5 | Zeichen | | Billigste 5 | Zeichen |
|---|---:|---|---|---:|
| `define_section_style` | 1.752 | | `git_push` | 184 |
| `add_image` | 1.385 | | `list_files` | 229 |
| `export_print` | 1.191 | | `git_status` | 231 |
| `insert_design_element` | 1.071 | | `get_style` | 265 |
| `add_comment` | 1.036 | | `list_versions` | 266 |

Spreizung 9,5 : 1. Die Top-15 tragen 43 % des Manifests.

---

## 3. Die eigentlichen Verwechslungs-Cluster

Nicht die Anzahl macht Ärger, sondern diese zwölf Paare. Sie sind der belegbare Kern der Ausgangsfrage.

**A — Fünf konkurrierende Schreibpfade auf `.penwright/style.json`**
`apply_style` · `apply_layout` · `apply_palette` · `update_style` · `generate_layout`
Unterschieden nur durch den Umfang. „Mach daraus ein Magazin" hat vier plausible Aufrufe mit vier verschiedenen Ergebnissen. Verschärfend: `apply_style` überschreibt `layout` mit, `apply_layout` löscht die Druckfelder, `generate_layout` heißt „layout" und tauscht das Theme.

**B — Zehn `list_*`-Tools**
`list_files` · `list_styles` · `list_fonts` · `list_layouts` · `list_design_elements` · `list_section_styles` · `list_presets` · `list_labels` · `list_versions` · `list_comments`
Vier davon sind reine Konstanten-Dumps mit identischer Rückgabeform. Auf „welche Vorlagen gibt es?" passen vier Namen.

**C — Drei Wege, eine Datei zu lesen** — `get_document` · `read_file` · `merge_document`
Nur einer liefert den gemergten Text, und er heißt ausgerechnet `merge_document`.

**D — Zwei Wege zu committen** — `save_version` · `git_commit`
Die schlechtere Variante trägt das vertrautere Wort.

**E — Das Anker-Quartett** — `insert_reference` · `add_footnote` · `add_comment` · `add_image`
Alle nehmen `file` + `afterText` + `occurrence` und unterscheiden sich nur in der Nutzlast. „Füge eine Anmerkung zu diesem Satz hinzu" trifft Fußnote *oder* Kommentar — ein Münzwurf.

**F — `compile` vs. `export_pdf`** — identische Typst-Argumente, identische Wurzel; nur bleibt beim einen das Artefakt.

**G — `apply_style` vs. `apply_section_style`** — ein Wort Unterschied, ein Kapitel vs. das ganze Dokument.

**H — „Finde die Quelle zu @x"** — trifft `search_project`, `find_source_for_citation` und `get_citations`, alle drei plausibel, alle drei mit anderer Antwort.

### Die unsichtbare Zustandsmaschine

**41 der 60 Tools setzen `state.projectDir` oder `state.currentFile` still voraus.** Kein Schema zeigt das. Zwei konkrete Folgen:

1. **Die Schreibfalle.** `read_file(A)` verschiebt `currentFile` nicht. `read_file(A)` → ändern → `update_document(neu)` schreibt nach **B**. Kein Fehler, kein Hinweis.
2. **Der `cwd`-Fallback.** `server.ts:287` erklärt `process.cwd()` zum Projekt, wenn nichts anderes gesetzt ist. Verifiziert: **weder `mcpSetup.ts` noch `mcpRegistration.ts` schreiben `PENWRIGHT_PROJECT_DIR` oder ein `cwd`** — geschrieben werden nur Lizenz/Trial und die drei Typst-Pfade. In Claude Desktop ist das das Arbeitsverzeichnis der .app, in Claude Code das Terminal-cwd. Alles, was danach ohne eigenen Guard läuft (u. a. alle drei Git-Tools), operiert auf einem Zufallsverzeichnis.

---

## 4. Wie die Tools mit der Anwendung interagieren

```
Claude Desktop / Claude Code / Meta-MCP
        │  stdio (JSON-RPC)
        ▼
penwright-mcp  (Bun-Binary, ~64 MB, ENTKOPPELT von der laufenden App)
        │
        ├── liest/schreibt direkt im Projektordner  ← kein IPC, kein Electron
        ├── kompiliert via TYPST_BIN aus dem App-Bundle
        └── importiert dieselben shared/-Module wie die App
                (styleParser, styleTypes, bibParser, mergeDocument,
                 designElements, themePresets, layoutPresets, …)
                + zwei main/-Module (commentManager, projectLabels)
```

Vier Konsequenzen, die jeden Konsolidierungsplan binden:

1. **Es gibt keinen Rückkanal in die laufende App.** Ein per MCP angelegter Kommentar taucht im offenen Penwright erst beim nächsten Refresh auf. Die MCP-Tools sind Zwillinge der IPC-Handler, keine Fernsteuerung.
2. **`safeApplyDesign` existiert nur in der App.** Die in `CLAUDE.md` als Invariante formulierte Kette stage → `TypstCompiler.verify()` → commit/rollback + Undo-Eintrag läuft für **keinen** MCP-Schreibpfad. Die AI-Snapshot-Ringbuffer greifen ebenfalls nicht (`.penwright/**` ist watcher-ignoriert). **Ein fehlgeschlagener MCP-Design-Schreibvorgang hinterlässt ein nicht kompilierendes Projekt ohne Rollback.**
3. **Die fünf Skill-Prompts werden zur Laufzeit aus dem Projekt gelesen** (`server.ts:400` → `<projekt>/.claude/skills/<slug>/SKILL.md`). Die Binary enthält den Skill-Text **nicht**. Was auf der Platte liegt, ist die Wahrheit.
4. **Mehrere MCP-Tools sind schwächere Kopien ihrer App-Zwillinge** — `create_project` (ohne git/Infrastruktur/Skills), `export_print` (ohne die Bahn für Projekte ohne `style.json`), `import_markdown` (ohne Präambel), `apply_section_style` (anderer `style.typ`-Pfad in verschachtelten Projekten).

---

## 5. Verifizierte Defekte

Gefunden im Audit, gegen den Quelltext geprüft. **Keiner davon erfordert eine Umbenennung.**

| # | Defekt | Ort | Wirkung |
|---|---|---|---|
| 1 | `process.cwd()` wird ungeprüft zum Projekt erklärt | `server.ts:287` | jedes Tool ohne eigenen Guard arbeitet auf einem Zufallsverzeichnis |
| 2 | Git-Tools ohne Projekt-Guard | `git_status`/`git_commit`/`git_push` | s. 1, mit Schreib- bzw. Netzwerkwirkung |
| 3 | `apply_layout` + `generate_layout` löschen `bleed`/`cropMarks`/`facingPages`/`binding` | Design | Druckvorstufe verschwindet still; `CLAUDE.md` behauptet das Gegenteil |
| 4 | `patch.sections` wird von `deepMergeStyle` verschluckt | `update_style` | Section-Styles nur über das 13-Parameter-Tool erreichbar; h2–h6 per MCP unerreichbar |
| 5 | sechs Tools zielen auf `currentFile` statt auf die Wurzel | `get_chapters`, `add_chapter`, `reorder_chapters`, `remove_chapter`, `split_document`, `add_citation` | `chapters/chapters/`, `#bibliography` im Kapitel, „keine Kapitel", Split zerlegt ein Kapitel |
| 6 | `export_print` ersetzt bei Projekten ohne `style.json` das Autorendesign | Export | Magazin-Pipeline-Projekte verlieren ihr Layout |
| 7 | Wegwerf-PDF von `compile` liegt neben dem Root-File | `server.ts:530` | Kollision bei Parallelaufrufen; der App-Watcher sieht die Datei |
| 8 | `.bib`-Scan nicht rekursiv | `get_citations` | `.bib` unter `bib/`/`sources/` existiert für den Agenten nicht |
| 9 | „19 design elements" statt 24 | zwei Beschreibungen | 5 Elemente werden nie benutzt |
| 10 | `get_settings`-Beschreibung verspricht 8 Felder, liefert 2 | Settings | Agent glaubt, Papierformat hier lesen zu können |
| 11 | `restore_version` ohne `files` stellt **alles** wieder her | Versionen | „undo Kapitel 3" setzt das ganze Projekt zurück |
| 12 | `replace_in_project` ohne Dry-Run | Discovery | unwiderruflich auf Projekten ohne `.git` |
| 13 | fehlende Caps | `list_comments`, `show_version`, `list_design_elements`, `get_document` | Kontext-Flutung |
| 14 | `update_settings` filtert unbekannte Keys still und meldet Erfolg | Settings | stille Wirkungslosigkeit |
| 15 | **Es gibt kein Tool, das ein `@citekey` in den Text setzt** | Cross-Refs | „zitiere @chen2021 im dritten Absatz" ist nicht bedienbar |

---

## 6. Kopplung: was ein Rename anfassen müsste

**Sechs handgepflegte Tool-Listen, bereits heute in vier Zuständen:**

| Quelle | behauptet | ist | Delta |
|---|---|---|---|
| `src/mcp/server.ts` | — | **60** | Wahrheit |
| `documentation/mcp-server.md:81` | 59 | 59 Zeilen | `export_print` fehlt |
| `documentation/handbook.md` / `handbuch.md:863` | 59 | 59 Bullets | `export_print` fehlt |
| `CLAUDE.md:215` | 59 | — | `export_print` fehlt |
| `src/mcp/manifest.template.json` | „52" | **53** | 7 Tools fehlen |

Dazu ein toter Name: `src/shared/themePresets.ts:11` verweist auf `penwright_apply_theme` — **das Tool gab es nie**.

**Die stärkste Kopplung sind die Skills.** `src/shared/skillTemplates.ts` nennt auf **123 Zeilen 39 der 60 Tools** — darunter eine Aufgabe→Tool-Routing-Tabelle (`:516–537`), fünf durchnummerierte Rezept-Sequenzen (`:589–650`) und ~25 Call-Beispiele mit vollständiger Argumentform. Ein Rename-`sed` repariert die Beispiele **nicht**; ein Merge ändert die Signaturen.

**Und dieser Migrationspfad ist heute defekt:**

- `ensureClaudeSkills` schreibt `SKILL.md` **nur, wenn die Datei fehlt** — und hat genau **zwei** Aufrufer (`projectManager.ts:195` beim Anlegen aus einem Template, `importExport.ts:721` nach Markdown-Import).
- **`openProject()` ruft es nicht.** `ensureProjectInfrastructure()` auch nicht. `openSampleProject()`, `presetManager` und das MCP-Tool `create_project` ebenfalls nicht.
- Die Skills haben **kein `version:`-Frontmatter** — Staleness ist nicht einmal erkennbar.
- **Die Doku behauptet das Gegenteil.** `mcp-server.md:477` („bei bestehenden Projekten on-demand bei Open") und `:479` („beim nächsten Open wird sie aus dem Master neu geschrieben") sind **faktisch falsch**. Wer der Doku folgt und die `SKILL.md` löscht, bekommt sie nie zurück — der Server liefert dann den Fallback-String.

**Folge:** Nach einer Umbenennung liest der Agent aus jedem bestehenden Projekt eine Routing-Tabelle voller nicht-existenter Tools. Der Failure-Mode ist kein Fehler, sondern **stiller Qualitätsverlust**: Rückfall auf `penwright_write_file`, also Umgehung genau der Validierungen, für die die Tools existieren.

**Weitere Zwangspunkte:**
- `src/shared/i18n/{en,de}/designAi.ts:4` — der nutzersichtbare „Copy starter prompt" nennt `penwright_get_selection` wörtlich. Der Nutzer pastet ihn selbst nach Claude. Wird der Name geändert, verschickt die App aktiv einen kaputten Prompt.
- `MCP_SETUP_VERSION` (`mcpSetup.ts:38`) muss bei jeder Binary-Änderung hoch — der Wizard poppt dann bei **jedem** bestehenden Nutzer wieder auf. Wer wegklickt (`mcp:skipSetup` stasht die Version), **bleibt auf der alten Binary**. Neue Doku, alte Tool-Namen.
- `handbook.md`/`handbuch.md` werden per `?raw` in den Renderer gebacken (`HandbookViewer.svelte:7–8`) — die Tool-Liste ist **in-app sichtbar**.

---

## 7. Was das SDK hergibt (MCP 1.28.0)

**Tragfähig:**

| Mechanismus | Status |
|---|---|
| Statisches Profil **vor** `connect()` (Tools je nach Env/Flag gar nicht erst registrieren) | ✅ wirkt in **jedem** Host garantiert |
| Echte Tool-Fusion (N Tools → 1 mit `z.enum`-Diskriminator) | ✅ hostunabhängig |
| `registerTool()` statt `server.tool()` → `title`, `annotations`, `_meta` | ✅ **die Alt-API kann keins davon** — `server.tool()` setzt `outputSchema` nie und `title` nie; alle Overloads sind `@deprecated` |
| `server.instructions` (≤ 2 KB) | ✅ **vorhanden, dokumentiert, ungenutzt** — `server.ts:360` ruft `new McpServer({name, version})` ohne Options-Objekt |
| `_meta['anthropic/alwaysLoad']` für Einstiegstools | ✅ Claude-Code-spezifisch, verhindert Deferral |
| Elicitation (fehlenden Parameter interaktiv nachfragen) | ✅ Claude Code deklariert `elicitation:{}` und hat echte UI |

**Nicht tragfähig:**

| Idee | Warum nicht |
|---|---|
| Lese-Tools als **Resources** ausliefern | In Claude Code sind Resources **User-`@`-Mentions**. Es gibt keinen Pfad, über den das Modell selbst eine Resource zieht. Ein `get_document` als Resource wäre für Claude weg. |
| **Prompts** als Discovery-Ersatz | Werden zu Slash-Commands — user-invoked, vom Modell nie gelesen. |
| **Laufzeit**-Toggle als Reduktionsmechanismus | Claude Code deklariert `listChanged` **nicht** und zieht Tools genau einmal nach Connect. Ein dynamischer Toolset ist innerhalb einer Session unsichtbar. |
| `tools/list`-**Pagination** | `McpServer` gibt immer alle Tools ohne `nextCursor` zurück. |
| **Sampling** | Claude Code deklariert die Capability nicht. |

**Code-Fallen, die in jedem Plan stehen müssen:**
- **`RegisteredTool.update({name})` ist kaputt** — die Closure fängt den ursprünglichen Namen und weist ihn nie neu zu (`mcp.js:622-628`). Nie umbenennen; nur `enable()`/`disable()` oder `remove()` + Neuregistrierung.
- **`outputSchema` erzwingt `structuredContent` in *jedem* Nicht-Fehler-Return** (`mcp.js:197`). Penwright gibt heute überall nur `content:[{type:'text'}]` zurück → eine `outputSchema`-Migration ist **pro Tool** Arbeit, kein Sammel-Refactor.
- Resources/Completions müssen **vor** `connect()` registriert sein, sonst `Cannot register capabilities after connecting to transport`.

---

## 8. Was die Außenwelt sagt

**Es gibt keine normative Obergrenze** — weder in der MCP-Spec noch bei Anthropic. Was es gibt:

- **Anthropic, „Writing effective tools for agents" (11.09.2025) [V]:** „More tools don't always lead to better outcomes" — aber die Beispiele sind **Workflow-Konsolidierung** (`list_users`+`list_events`+`create_event` → `schedule_event`), **nicht** CRUD-Multiplexing (`resource_action(op=…)`). Das ist die am häufigsten falsch gelesene Stelle der Guidance.
- **Anthropic, `mcp-builder`-Skill [V]** — das Gegengewicht: *„When uncertain, prioritize comprehensive API coverage."*
- **Tool-Search-Doku [V]:** „Tool selection accuracy degrades once you exceed **30–50** available tools" — Behauptung **ohne veröffentlichte Kurve**.
- **Tool Search ist in Claude Code Default-an**, MCP-Tools sind grundsätzlich deferred; `ENABLE_TOOL_SEARCH=auto` heißt „upfront laden, solange alle Definitionen < 10 % des Kontextfensters". Bei Opus 5 sind 10 % = 100.000 Token, Penwright liegt bei 9.500 — **also vermutlich upfront geladen und gar nicht deferred**. Das ist **ungemessen** und entscheidungsrelevant (siehe Konsolidierungsdokument).
- **Der Hebel unter Tool Search ist Findbarkeit, nicht Sparsamkeit.** Die Suche indiziert Name, Description **und Argument-Namen**. Ein `op`-Enum-Wert ist ein schwächeres Signal als ein Tool-Name. Und: **Claude Code kürzt Tool-Descriptions und Server-Instructions bei je 2 KB.**
- **Toolsets (GitHub-Muster)** sind die einzige clientunabhängige Technik: `--toolsets repos,issues` bzw. `GITHUB_TOOLSETS`, Default-Set + `all`, `--read-only` hat Vorrang. Kostet null Fähigkeit, verschiebt die Auswahl vom Modell zur Konfiguration.
- **Harte Caps existieren clientseitig:** VS Code/Copilot **128 Tools**, ChatGPT verlangt `search`+`fetch`, Claude Code hat keinen Cap („the practical limit is your context window budget").
- **Was ich nicht belegen konnte:** eine publizierte Accuracy-über-N-Kurve für MCP; **irgendeine** Head-to-Head-Messung Multiplex vs. granular; die kursierende „9,5 %"-Zahl aus MCPGauge. Die drei meistzitierten Zahlen (30–50, 85 %, 24 Punkte) sind eine Vendor-Angabe, eine Vendor-Messung und ein Blogpost — nicht drei unabhängige Befunde.

Gegen `action`-Multiplexer sprechen sechs **mechanische** Gründe, keine Geschmacksfragen: Annotations werden bedeutungslos (ein Tool kann nicht `readOnlyHint` **und** `destructiveHint` sein), Per-Tool-Permissions und Hook-Matcher in Claude Code kollabieren auf eine Regel, `_meta` wird All-or-Nothing, Tool Search verliert Retrieval-Signal, `oneOf` ist im Strict Mode schwach, und Fehlermeldungen werden generisch.

---

## Quellen im Repo

| Was | Wo |
|---|---|
| Tool-Registrierung | [src/mcp/server.ts](../src/mcp/server.ts) |
| Skill-Texte (39 Tool-Namen) | [src/shared/skillTemplates.ts](../src/shared/skillTemplates.ts) |
| Setup / Version-Gate | [src/main/mcpSetup.ts](../src/main/mcpSetup.ts), [src/main/mcpRegistration.ts](../src/main/mcpRegistration.ts) |
| Skill-Deploy | [src/main/projectManager.ts](../src/main/projectManager.ts) `ensureClaudeSkills` |
| Nutzersichtbarer Tool-Name | [src/shared/i18n/en/designAi.ts](../src/shared/i18n/en/designAi.ts), [de/designAi.ts](../src/shared/i18n/de/designAi.ts) |
| Tool-Referenz (59, veraltet) | [documentation/mcp-server.md](mcp-server.md) |
