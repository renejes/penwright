# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-07-29, Ende der zweiten Paritäts-Session (Session 42) · Branch `main` · App-Version **0.12.0** · `MCP_SETUP_VERSION` **0.20.0** (gebumpt, Binaries neu gebaut)
>
> **Lies zuerst diese Datei, dann `CLAUDE.md` → „App ↔ MCP parity", dann leg los.** Referenzdokumente: [app-mcp-parity.md](app-mcp-parity.md) (Ist-Zustand + Restliste), [mcp-rebuild-plan.md](mcp-rebuild-plan.md) (der MCP-Umbau, Rest in die Paritätssequenz einsortiert), [mcp-tool-audit.md](mcp-tool-audit.md) + [mcp-tool-consolidation.md](mcp-tool-consolidation.md) (warum wir die Tool-Zahl **nicht** reduzieren).

---

## 0. Das Ziel — unverändert

> **Das Paritätsprinzip:** Die KI (über den MCP-Server) sieht, was der Mensch sieht, und beide beschreiben dieselben Dateien. Beide arbeiten mit demselben Wissen und haben denselben Zugriff.

Vier prüfbare Forderungen. Stand **nach** dieser Session:

| | | Vorher | Jetzt |
|---|---|---|---|
| **P1 Schreiben** | Derselbe Vorgang trifft von beiden Seiten dieselbe Datei mit denselben Bytes und denselben Nebenwirkungen. | teilweise | **erfüllt** für alles, was ein gemeinsamer Planer abdeckt |
| **P2 Lesen** | Jede Seite kann vollständig lesen, was die andere erzeugt. | teilweise | **die KI kann das Dokument jetzt sehen** (`render_page`); Backups bleiben offen |
| **P3 Wissen** | Beide kennen denselben Zustand. | schwächste Achse | **beidseitig**, bewusst schmal gehalten |
| **P4 Schutz** | Was auf einer Seite abgesichert ist, ist es auf der anderen auch. | **nicht erfüllt** | **erfüllt** |

**Der Satz von letzter Session** — *„Auf der Ebene der Dateien weitgehend eingelöst, auf der Ebene des Zustands noch nicht"* — **gilt nicht mehr.** Die beiden Prozesse teilen jetzt auch eine Gegenwart: welche Datei, ungespeichert oder nicht, kompiliert das Dokument, und woran die KI gerade arbeitet.

---

## 1. Was diese Session gebaut hat

### Drei neue gemeinsame Module in `src/shared/` — jetzt zwölf

| Modul | Löst |
|---|---|
| **`safeApply.ts`** | Staging → Verify → commit/rollback, Verifier + IO injiziert. **Die App verifizierte Design-Änderungen seit Session 23, der MCP schrieb dieselben Dateien ungeprüft.** |
| **`projectScaffold.ts`** | EIN `scaffoldProject()` für alle vier Anlagewege. Enthält `planGitignore`, `ensureSkills`, `ensureStyleFiles`. |
| **`assetPlacement.ts`** | EINE Ablageregel für Bilder. Es gab vier, **zwei davon haben ein gleichnamiges Bild still zerstört**. |

### Die Befunde, die dabei behoben wurden

1. **Ein einziger MCP-Tool-Call konnte das Dokument unkompilierbar hinterlassen, ohne Rückweg** — und meldete Erfolg, weil der *Schreibvorgang* gelungen war. Jetzt: stagen, testkompilieren, bei Bruch **den ganzen Satz** zurückrollen und die Typst-Meldung mitliefern. E2E belegt (`parity-guards-test`), und **gegengeprüft**: ohne den Fix wird der Test rot.
2. **`apply_section_style` schrieb die Variantendefinition und den Kapitel-Opt-in getrennt** — genau die Aufteilung, die `561c22e` auf der App-Seite behoben hatte. Jetzt eine Transaktion.
3. **`define_section_style` meldete eine vom Sanitizer abgelehnte ID als Fehler, nachdem `style.json` + `style.typ` schon regeneriert waren.** Der „Fehler" hinterließ das Projekt verändert. Jetzt wird vor dem ersten Write geprüft.
4. **Das Undo-Netz war unlesbar.** Die App hielt einen In-Memory-Ringpuffer neben `.penwright/ai-snapshots/`, der nur ihre *eigenen* Snapshots enthielt — alles, was die KI gerettet hatte, war in der einen UI unsichtbar, die dafür gebaut wurde (`listSnapshots` hatte null Produktivaufrufer). Jetzt ist der Ordner die einzige Wahrheit, für beide, projektweit statt nur für die offene Datei.
5. **Zwei Aufbewahrungsgrenzen** (App 20 konfigurierbar, MCP hart 40): wer zuletzt schrieb, setzte seine durch, und die Einstellung des Nutzers bedeutete nichts. Jetzt publiziert die App ihre Zahl ins Projekt, beide lesen sie.
6. **Die „ungespeicherte Änderungen"-Warnung hing an 3 von 28 schreibenden Tools.** Die anderen 25 überschrieben sichtbare, ungespeicherte Arbeit schweigend. Jetzt hängt sie am Schreib-Guard und an **einer** Stelle im Tool-Wrapper.
7. **`penwright_create_project` erzeugte drei Dateien**, die App zwölf plus Git, `.gitignore`, `sources/`, Skills, `style.typ`. Kein Repo hieß: „Version speichern" hatte nichts zum Wiederherstellen, ausgerechnet in Projekten, in die eine KI gerade viel Text geschrieben hatte. **0 von 35 Presets** hatten `.claude/skills`.
8. **Die App überschrieb still ein gleichnamiges Bild** (`copyFileSync` ohne Existenzprüfung, an zwei von drei Eingängen), und zwei Eingänge legten `assets/` neben die *offene Datei* statt ins Projekt.
9. **`get_style` zeigte Defaults, die wie Tatsachen aussahen.** Jetzt `initialized` / `adopted` / `rootFile` — die KI weiß, ob sie gegen eine Fiktion designt oder gegen eine handgeschriebene `style.typ` laufen wird.
10. **Die KI hatte das Dokument nie gesehen.** `penwright_render_page` liefert eine gerenderte Seite als Bild.

### Was beim Selbst-Review noch gefunden wurde (vor dem ersten Testlauf grün)

- `ensureProjectInfrastructure` ist von **„Version speichern"** erreichbar. Der erste Wurf legte dort `assets/`, `sources/` und `.claude/` an — ein Speichern hätte den Ordner des Nutzers umstrukturiert. Jetzt sind das explizite Opt-ins der Anlagewege; ein Test hält das fest.
- `ensureSkills(dir, [])` legte trotzdem ein leeres `.claude/skills/` an.
- `fsIO.read` gab bei einer *unlesbaren* Datei `null` zurück — und `null` heißt „existierte nicht", was ein Rollback **löscht**. Aus einem Rechteproblem wäre „deine `style.typ` ist weg" geworden. Wirft jetzt.
- `agent-activity.json` stand nicht in der Watcher-Ignore-Liste: jeder MCP-Schreibvorgang hätte ein Dateisystem-Ereignis auf den kritischen Pfad der App gelegt.
- Der Tool-Wrapper hatte die Zod-Schema-Inferenz aller 62 Handler gekillt (60 `any`-Fehler). Als `typeof server.tool` typisiert bleiben alle vier Overloads erhalten.

### Ein Muster, das ab jetzt gilt

**Alle Tools werden über den lokalen `tool(...)`-Wrapper registriert, nicht über `server.tool(...)`.** Dort hängen die Hinweise, die der Server dem Agenten schuldet — an **einer** Stelle statt an siebenundzwanzig. Neue querschnittliche Hinweise gehören dorthin. (Das ist außerdem die Stelle, an der Block 2 des Umbauplans auf `registerTool()` + Annotations umstellen wird — ein Ort statt sechzig.)

### Tests

Neu: **`scripts/parity-guards-test.mts`** — 55 Checks, davon acht E2E über stdio gegen die gebaute Binary mit echtem Typst. Deckt: Rollback beidseitig, Vorher-schon-kaputt-Fall, Undo-Netz, eine Aufbewahrungsgrenze, Scaffold-Parität, „Save Version strukturiert nichts um", Asset-Ablage, die beiden Hinweise, `get_style`-Ehrlichkeit, `render_page`.

Alle bestehenden Suiten grün: `style-guard` · `write-provenance` · `watch-ignore` · `bibliography` · `print-export` · `session-handoff` · `roundtrip` (76) · `html-export` (230) · `docx-magazine` (19) · `compile-stability` (30, pixel-identisch).

**Eine bestehende Prüfung wurde ersetzt**, nicht gelöscht: `style-guard` verglich den *Quelltext* von `ensureStyleFile` per Regex. Die Funktion ist nach `shared/projectScaffold` gezogen, und eine Regex über die alte Datei wäre **grün durch Abwesenheit** geworden. Ersetzt durch einen Verhaltenstest gegen die echte Funktion.

---

## 2. Was jetzt verlässlich geht — und was nicht

**Geht:** Design von beiden Seiten mit Verify und Rollback · Design-Tokens byte-identisch mit demselben Guard · KI-Änderungen an **beliebig vielen** Dateien zurücknehmen, aus der App **und** aus dem Chat · die KI eine gerenderte Seite ansehen lassen · Projekte anlegen, die von beiden Seiten gleich aussehen und Skills mitbringen · Bilder importieren, ohne vorhandene zu zerstören · die KI weiß, ob das Dokument schon kaputt war · die App zeigt an, woran die KI arbeitet.

**Geht nicht:**
- **Auto-Backups sind für die KI immer noch unlesbar** (aber ungeschützt beschreibbar) — `history/VER-03`.
- **Der Mensch hat keine Oberfläche für die 24 Design-Elemente**, die die KI einfügen kann.
- **`insert_reference` nimmt keine Citekeys** — „zitiere @chen2021 im dritten Absatz" ist im ganzen Server nicht bedienbar. Das ist die **einzige verbliebene echte Fähigkeitslücke**.
- **Echte Gleichzeitigkeit auf derselben Datei bleibt Last-Writer-Wins** (sichtbar und sicherbar, nicht auflösbar).
- **Nicht-atomare Writes** — weder App noch MCP schreiben über temp+rename. Nicht beobachtet, aber ungeschützt. `awaitWriteFinish` + ein gemeinsames `writeFileAtomic` kosten zusammen unter vier Stunden.

---

## 3. Nächste Session — der Fahrplan

Die Paritätsliste (Block 1) ist **abgearbeitet**. Der Rest ist der revidierte Umbauplan:

| Block | Inhalt | PT |
|---|---|---:|
| ~~1~~ | ~~Parität fertig~~ | ✅ |
| **2** | **Phase B allein — jetzt dran.** `server.instructions` (vorhanden, dokumentiert und **ungenutzt**: `server.ts` übergibt kein Options-Objekt — laut Audit der größte Einzelhebel, ein halber Tag), `registerTool()` + Annotations (`readOnlyHint` → Auto-Approve für die Leser in Claude Code; **ändert keinen einzigen Tool-Namen**), Beschreibungs-Chirurgie. Dazu A2 (Wächterskript gegen die sechs driftenden Tool-Listen) und die drei A3-Reste: Git-Tools ohne Projekt-Guard, Compile-Temp-PDF liegt neben dem Root, **kein Extension-Guard beim Export (`outputPath: "main.typ"` überschreibt heute die Quelldatei mit einem PDF)**. | 2 |
| **3** | Phase C-Rest — Kapitel-Tools auf die Wurzel, `restore_version` verlangt Bestätigung, `replace_in_project` bekommt Dry-Run, Caps gegen Kontext-Flutung, **`insert_reference` nimmt auch Citekeys**. | 1,5 |
| **4** | Eval — 10–15 nachprüfbare Autorenaufgaben, einmal vor und einmal nach Block 2. | 1 |
| **5** | Phase E + F (Renames, Streichungen, Merges, Skill-Rewrite). **Nur wenn das Eval Fehlgriffe zeigt.** | 7 |

**Warum Block 2 zuerst:** kein Aufruf, der heute funktioniert, funktioniert danach nicht. Reiner Gewinn.

**Warum Block 5 an einer Messung hängt:** der teuerste Posten ist `skillTemplates.ts` (39 Tool-Namen, Routing-Tabelle, ~25 Call-Beispiele) — inhaltliche Arbeit, ~2 Tage, und sie **darf genau einmal passieren**. Ob die Renames überhaupt nötig sind, ist unbelegt. Wenn `instructions` + geschärfte Beschreibungen die Fehlgriffe beseitigen, ist die Frage erledigt. Das halte ich weiterhin für das wahrscheinlichste Ergebnis.

**Kleinere offene Paritätspunkte** (nicht blockierend, aus [app-mcp-parity.md](app-mcp-parity.md) Klasse 1/2): `insert_design_element` bekommt `file` (2 h) · Backup-Tools für die KI (VER-03) · Design-Elemente für den Menschen · Magazin-Makros ins Skill · User-Presets für die KI sichtbar · Handbuch als MCP-Resource.

---

## 4. Was bewusst asymmetrisch bleibt — nicht „fixen"

Unverändert, jetzt auch in `CLAUDE.md` festgehalten: engere Export-Sandbox der KI · einseitiger Zustandskanal (der Rückkanal ist rein informativ — die App zeigt ihn und gehorcht ihm nicht) · echte Fremd-Locks bleiben harte Ablehnung · **kein Compile-Verify vor gewöhnlichen Textänderungen, auf beiden Seiten** · zwei Undo-Systeme dürfen bestehen bleiben, müssen nur beidseitig sichtbar sein (das sind sie jetzt) · Web-Export ohne MCP-Tool.

---

## 5. Offene Punkte, die man vor dem Weiterarbeiten wissen muss

- **`MCP_SETUP_VERSION` steht auf `0.20.0`, ist gebumpt, und `npm run build:mcp-binary:all` ist gelaufen.** Achtung: `ensureInstalledBinary` (`mcpSetup.ts`) kopiert bei **jedem App-Start bedingungslos** aus `dist/mcp/bin/` — die installierte Binary trackt den letzten Build, nicht den Quellstand.
- **Neu und wichtig: die Skill-TEXTE stecken jetzt in der Binary.** `create_project` / `create_from_preset` deployen sie. Eine Änderung an `skillTemplates.ts` braucht also einen Binary-Rebuild, um die MCP-Anlagewege zu erreichen (der Prompt-Pfad liest weiterhin von der Platte, da genügt das Löschen der veralteten SKILL.md).
- **Die App wurde in dieser Session nie vom Assistenten gestartet.** Alle Verifikation ist Unit-/Integrations-/E2E-Test plus `tsc` + `svelte-check`. **Ein manueller Durchgang steht aus**, besonders: Design-Panel + Kapitel-Look (safeApplyDesign wurde umgebaut), der Verlaufs-Hub (AI-Liste ist jetzt projektweit und zeigt Dateinamen), Bild-Import per Drag-and-Drop (Ablage und eingefügter Pfad haben sich geändert), und die neue KI-Anzeige in der Statusleiste.
- **Renés echte Projekte bleiben der Härtefall.** `~/Desktop/Marketing/FMM/*` und `~/Desktop/Marketing/Ludwig Maier Mastering/*`: kein Git, keine `.penwright/style.json`, keine `.claude/skills`, handgeschriebene `style.typ`, **keine `main.typ`** (Wurzeln heißen `Angebot.typ` / `Sichtbarkeitskonzept.typ`). Jeder Root-Resolver muss zweistufig sein und bei `null` **hart fehlschlagen**. Der neue Scaffold rührt solche Projekte nicht an — dafür gibt es zwei Tests.
- **Ungetrackt im Working-Tree** (Renés eigene Arbeit, nicht anfassen): `resources/*/manifest.json`-Timestamps.
- **Der Web-Export-Branch `feat/web-export`** ist unverändert und **nicht** nach `main` gemergt.
- **Launch-Blocker unverändert:** `penwright.online` registrieren · finales QA auf realer 100-Seiten-Thesis + Design-Use-Cases · Windows als Fast-Follow.

---

## 6. Arbeitsweise, die sich bewährt hat

- **Erst prüfen, ob die eigenen Fixes halten, dann nach neuen Lücken suchen.** Diesmal fand der Selbst-Review fünf Defekte im eigenen frischen Code, darunter zwei, die Nutzerdaten betroffen hätten.
- **Gemeinsamer Planer statt synchron gehaltener Kopien.** Reines Planen, der Aufrufer wendet an. Testbar ohne Electron.
- **Jeder Fix bekommt einen Test, der ihn ohne den Fix rot sieht.** Beim MCP-Rollback explizit gegengeprüft (Fix rausgepatcht → rot → wieder rein → grün).
- **Verhaltenstests schlagen Quelltext-Assertions.** Eine Regex über eine Datei, aus der die Funktion weggezogen wurde, wird grün durch Abwesenheit.
- **E2E über stdio gegen die gebaute Binary** ist die härteste verfügbare Evidenz und kostet wenig. **Aber `npm run build:mcp` vorher** — sonst testet man den Vorgängerstand.
- **Beim Testen den häufigsten Fall zuerst.** (Der Lock-Test war grün und die Funktion kaputt, weil er nur den Dropbox-Kollegen prüfte.)
