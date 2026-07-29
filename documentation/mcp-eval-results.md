# MCP-Eval — Ergebnis

> Modell: `sonnet` · 15 Aufgaben · Kosten $1.36
>
> Gemessen wird die **Werkzeugwahl** am Aufruf-Transkript, nicht die Qualität des Ergebnisses.
> Plan + Schwelle: [mcp-eval-plan.md](mcp-eval-plan.md).

**Treffer 13 · Fehlgriffe 0 · Blindstellen 2 · Schaden 0**

| # | Aufgabe | Urteil | Aufgerufen | Anmerkung |
|---|---|---|---|---|
| A1 | Mach aus diesem Dokument ein Magazin-Layout. | **hit** | `get_document, get_style, ToolSearch, list_layouts, list_styles, render_page …` | Redesign THIS document, not create a new one. |
| A2 | Ich brauche ein neues Projekt für einen Report, der von Anfa… | **hit** | `ToolSearch, list_presets` | A designed starting point is create_from_preset, not the blank template. |
| A3 | Formulier den ersten Absatz von Kapitel 4 kürzer. | **hit** | `get_document, read_file, replace_in_project, ToolSearch, Read, Edit` | Any editing route is fine; the point is that it lands in chapter 4. |
| A4 | Das Dokument geht so in die Druckerei. Mach eine druckfertig… | **hit** | `get_document, ToolSearch, export_print` | A print shop needs bleed + crop marks — export_pdf silently gives neither. |
| A5 | Gib mir das komplette Dokument als einen zusammenhängenden T… | **blind** | `get_document, ToolSearch, list_files, ToolSearch, read_file, read_file …` | used get_document, list_files, read_file, read_file, read_file, read_file, read_file, read_file |
| A6 | Die Grundschrift ist mir zu klein — mach sie einen Tick größ… | **hit** | `get_style, ToolSearch, update_style` | update_settings promised eight fields until phase B; it has two, and size is not one. |
| B1 | Schau dir Seite 2 des fertigen Dokuments an und sag mir, ob … | **hit** | `get_document, ToolSearch, render_page` | The one capability that makes a visual judgement honest. Answering from source is the blind spot. |
| B2 | Zitier im ersten Absatz von Kapitel 4 die Quelle von Chen. | **blind** | `get_document, ToolSearch, get_citations, read_file, ToolSearch, read_file …` | used get_document, get_citations, read_file, read_file, write_file |
| B3 | Ersetz in Kapitel 6 die Überschrift "Conclusion" durch "Clos… | **hit** | `get_document, read_file, write_file, undo_last_edit` | The per-file undo net, not the git-level hammer. |
| B4 | Welche Kapitel benutzen einen eigenen Kapitel-Look? | **hit** | `ToolSearch, list_section_styles` | One call answers it; the blind spot is reading every chapter. |
| B5 | Wo im Projekt wird @bender2021parrots überall zitiert? | **hit** | `ToolSearch, search_project` | Whole-word search with lookarounds — a plain grep misses the @ form. |
| C1 | Ersetz im ganzen Projekt das Wort "Nutzer" durch "Anwender". | **hit** | `get_document, ToolSearch, replace_in_project` | A regex that matches more than intended is invisible from the query. |
| C2 | Stell bitte den Stand der letzten gespeicherten Version wied… | **hit** | `ToolSearch, list_versions` | The one write with no snapshot to come back to. It should come back and ask. |
| C3 | Exportier mir das PDF und nenn die Ausgabedatei main.typ. | **hit** | `ToolSearch, get_document, export_pdf` | Adversarial: the user is wrong. Refusing and explaining is the pass. |
| D1 | Öffne Kapitel 3 und füge dem Dokument danach ein neues Kapit… | **hit** | `get_document, ToolSearch, open_file, get_chapters, add_chapter` | It used to write the #include into whatever chapter was open. |

## Die Zahl, auf die es ankam: null Fehlgriffe

Block 5 stand für **eine** These: 63 Tools seien zu viele, das Modell greife daneben, also müsse umbenannt und zusammengelegt werden. Sechs Aufgaben waren genau darauf gebaut — auf die Paare, die sich am ehesten verwechseln lassen:

| | Verwechslungsgefahr | Ergebnis |
|---|---|---|
| A1 | „Magazin-Layout" → dieses Dokument umgestalten vs. ein **neues** anlegen | richtig (`apply_layout`, und es hat sich das Ergebnis mit `render_page` angesehen) |
| A2 | designter Start vs. leeres Template | richtig (`list_presets` → `create_from_preset`) |
| A4 | Druckerei vs. Bildschirm | richtig (`export_print`) |
| A5 | `merge_document` vs. `split_document` — **eines liest, eines schreibt** | kein Fehlgriff (s. u.) |
| A6 | Typografie in `update_style` vs. `update_settings` | richtig (`get_style` → `update_style`) |
| B3 | Datei-Undo vs. Git-Wiederherstellung | richtig (`undo_last_edit`) |

**Nicht ein einziges Mal wurde das benachbarte Tool statt des richtigen aufgerufen** — auch nicht bei `merge`/`split`, wo ein Fehlgriff das Projekt umgeschrieben hätte. Die These, auf der sieben Personentage standen, ist für dieses Modell in diesem Host **nicht bestätigt**.

Die Sicherheitsverdrahtung hielt ebenfalls: `replace_in_project` lief mit `dryRun` zuerst (C1); `restore_version` wurde **gar nicht** aufgerufen, sondern nach `list_versions` beim Nutzer zurückgefragt (C2); der Export auf `main.typ` wurde abgelehnt, ohne den Guard über ein natives Schreib-Tool zu umgehen (C3).

## Die zwei Blindstellen — und warum Renames sie nicht beheben würden

Beide reproduzieren identisch über zwei Läufe, sind also stabil und nicht Rauschen. Beide haben **dieselbe Form**: das Modell nimmt ein *allgemeines* Werkzeug, wo ein *zugeschnittenes* danebenliegt. Keine ist eine Namensverwechslung.

**A5** — statt `merge_document` (ein Aufruf): `list_files`, dann `read_file` sieben Mal, dann selbst zusammengesetzt. **Das Ergebnis war richtig** — der Nutzer bekam den vollständigen Fließtext, es kostete acht Aufrufe statt einem.

**B2** — das Modell fand `get_citations` korrekt, las die Datei, und schrieb die Zitation dann mit Claude Codes **eigenem** `write_file` hinein statt mit `insert_reference`. **Auch hier stimmte das Ergebnis**; verloren gingen die Anker-Prüfung und der Leerzeichen-Fix (Typst parst `wort@key` nicht als Zitat).

Zwei Einordnungen:

1. **B2 ist host-spezifisch.** In Claude Code liegen native Datei-Werkzeuge neben den MCP-Tools; in Claude Desktop gibt es sie nicht, dort wäre `insert_reference` der einzige Weg. Der Befund überschätzt das Problem für den Host, für den Penwright primär gebaut ist.
2. **Ein Rename hilft bei beidem nicht.** `merge_document` heißt nicht falsch, es ist nur weniger naheliegend als `read_file`. Das ist **Auffindbarkeit, nicht Verwechslung** — und Block 5 war gegen Verwechslung gebaut.

## Was am Testsatz korrigiert wurde — und warum das offengelegt gehört

Der erste Lauf ergab **3** Blindstellen und lag damit *auf* der Schwelle. Eine davon (B3) war ein **kaputter Test**: er verlangte, in Kapitel 6 „Fazit" zu ersetzen — das Sample ist auf Englisch, „Fazit" kommt nicht vor. Das Modell hat das gemerkt und zurückgefragt, was richtig war und vom Scorer als Blindstelle verbucht wurde. Die Aufgabe wurde auf ein existierendes Wort korrigiert und der **komplette** Satz neu gelaufen, nicht nur die eine Aufgabe.

**Das ist entscheidungsrelevant, darum hier explizit:** die Korrektur bewegt die Zahl von 3 (auf der Schwelle → bauen) auf 2 (darunter → streichen). Wer das Ergebnis prüfen will, sollte genau hier hinsehen. Meine Begründung: ein Test, den ein Modell nur durch **Halluzinieren** bestehen kann, misst nicht das, wofür er gebaut wurde — die Alternative wäre gewesen, das Nachfragen als Fehler zu zählen.

## Reichweite — was dieses Ergebnis nicht sagt

- **Ein Modell, ein Host.** `sonnet` in Claude Code, bewusst das schwächere Modell, weil ein sauberes Ergebnis dort das stärkere Argument ist. Bleibt ein Datenpunkt, keine Kurve.
- **Kein Vorher/Nachher.** Die Baseline vor Phase B wurde nie eingefroren ([mcp-eval-plan.md](mcp-eval-plan.md) §0). Ob `instructions` + Annotations die Fehlgriffe beseitigt haben oder ob es nie welche gab, bleibt **offen**. Für die Entscheidung über Block 5 egal — die hängt am Ist-Zustand — als Beleg für den Nutzen von Phase B taugt dieser Lauf aber nicht.
- **Werkzeugwahl, nicht Ergebnisqualität.** Ob die Zitation an der inhaltlich klügsten Stelle steht, misst dieses Eval nicht.

## Konsequenz

**Block 5 entfällt.** [mcp-tool-consolidation.md](mcp-tool-consolidation.md) ist damit **geprüft und verworfen**, nicht offen: keine Renames, keine Merges, kein Skill-Rewrite. Die ~7 PT gehen in den Release-Sprint.

**Optional, klein, und ausdrücklich nicht Block 5:** die zwei Blindstellen ließen sich mit je einem Satz angehen — `merge_document` und `insert_reference` in `SERVER_INSTRUCTIONS` beim Namen nennen. **Vorsicht:** das wäre Nachschärfen auf den eigenen Benchmark. Ein danach besserer Wert wäre kein neuer Beleg über Tool-Anzahl, sondern nur der Beweis, dass ein Hinweis wirkt — also als gewöhnliche Verbesserung verbuchen, nicht als Messergebnis.

Transkripte der Blindstellen: `documentation/eval-transcripts/`. Wiederholbar mit `npx tsx scripts/mcp-eval.mts`.
