# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-06-29, Ende der Web-Export-Session (Session 36). **Die Web-Export-Arbeit liegt auf Branch `feat/web-export`** (Phase-0-Bugfixes auf `fix/prelaunch-export-bugs`, beide ab `main`; `feat/web-export` enthält Fixes + Phase A + B). **Committet, aber NICHT gepusht / nicht nach `main` gemergt.** `main` = v0.9.0 (unverändert). Im neuen Chat auf `feat/web-export` weiterarbeiten.
> **🆕 Strategiewechsel (2026-06-29):** Der **HTML-/Web-Export** („Editorial Web Pack") kommt **VOR dem Launch** — er wird die Launch-Story „**Print UND Web aus einer Quelle**". Der Release-Sprint verschiebt sich dahinter. Vollständige Recherche + Markt-Einordnung + Korrekturen am Ur-Plan + de-riskte Phaseneinteilung (0 → A → B → **C** → D → E): **[web-export-feasibility-and-plan.md](web-export-feasibility-and-plan.md) — PFLICHTLEKTÜRE vor Phase C.**
> **Zuletzt erledigt (Session 36):** (1) **2 Pre-Launch-Korrektheits-Bugs** gefixt (unabhängig vom Web-Export, treffen Thesis/Paper): `#columns` nicht mehr still aus DOCX verschluckt + Heading-`<label>`-Escaping (`= Titel <sec:x>` → `\<sec:x\>`) zerschoss Querverweise. (2) **Web-Export Phase A** (Foundation: `@tiptap/static-renderer@3.20.5` gepinnt, `src/shared/htmlSerializer.ts`, JSON→HTML server-side ohne DOM). (3) **Web-Export Phase B** (design-treuer Vertical Slice: `styleToCss.ts`, Drop-Cap + Callout-Reparser, agnostischer Bundle-Writer `webExport.ts`, **File ▸ „Export to Web (HTML)…"**). tsc + build + 52er-Smoke-Test + 37/37-Round-Trip grün; am echten LANGSAM-Magazin validiert. Details: „Status Session 36" unten.
> **Zuletzt erledigt:** Session 34 = **Print-Export „Für den Druck"** (Beschnitt + Schnittmarken + Innen-/Außenstege + dpi-Preflight; eigener Export-Transform via temp `style-print.typ`, **kein** safe-apply; `StyleLayout`-Felder `bleed`/`cropMarks`/`facingPages`/`binding`; Generator-Print-Modus mit oversized Seite + `PAPER_MM`-Tabelle + `crop-marks()`-Helper + `style-bleed`; ExportDialog-„Für den Druck"-Block + Layout-Preset „Magazin (Druck) · A4 + 5 mm Beschnitt" + MCP-Tool `penwright_export_print`, `MCP_SETUP_VERSION` → 0.13.0) + **2-up-Doppelseiten-Vorschau** (`zoomState.spread`, per-Projekt persistiert) + **`spread-image`** (23. Design-Element, Double-Truck über den Bund). Empirisch verifiziert (A4+5mm → MediaBox 220×307 mm, Marken + Bleed gerendert, Bildschirm-Build bleibt exakt A4) + adversarialer Multi-Agent-Diff-Review = 0 echte Bugs. CMYK/PDF-X bleibt bewusst draußen (Engine-Grenze [typst#3143]). Details: „Status Session 34" unten.
> **Davor:** Session 33 = **DOCX-Export-Treue** (PDF↔DOCX-Vergleich am Sample-Projekt → Titelseite/Pull-Quotes/Drop-Cap/wrap-it-Prosa werden nicht mehr verworfen, Heading-Labels gestrippt + `Section N.M`-Refs, Zitatgruppen `(A et al., 2021; B …)`, `figure-caption-credit`, APA-nahe Bibliographie; Deserializer: `@key.`-Satzzeichen-Fix + Heading-Zeilen-Split + H5/H6; `MCP_SETUP_VERSION` → 0.12.0) + **Release-DMG neu gebaut** (beide Bun-Binaries frisch, App + DMG `spctl: accepted, Notarized Developer ID`). Details: „Status Session 33" unten.
> Session 32 = (1) **MCP-Registrierung mit Startauswahl** — Penwright registriert sich als MCP-Server bei **genau einem** von zwei Hosts: **Meta-MCP** (Aggregator-Proxy `localhost:3663`, `POST /register` + Datei-Unregister der `com.metamcp.desktop/config.json`) **oder Claude Code** (User-Scope, `claude mcp add` / `~/.claude.json`-Fallback). Neues Modul `mcpRegistration.ts` (`ensureMcpTarget` = Ziel registrieren + anderen deregistrieren, idempotent jeden Boot, Timestamp-Backups, nur eigener Eintrag), Startauswahl via Dialog (`McpConnectionDialog.svelte`, Erststart-Auto + Hilfe-Menü) + `--mcp-target`-Flag + Smart-Default, persistiert als `mcpTarget`. (2) **MCP-Server in der Demo voll freigeschaltet** — `buildMcpEnv()` bäckt im Trial `PENWRIGHT_TRIAL_UNTIL` statt des Lizenz-Keys ein, der Server (`validateAccess()`) läuft die kompletten 14 Tage und verweigert erst bei abgelaufener Demo. Binary neu gebaut + Gate per Direkt-Test verifiziert. **Hinweis:** beide Features sind **funktional fertig + getestet (Build/`tsc`/Binary-Smoke-Test grün), aber NICHT live gegen eine laufende Meta-MCP-Instanz / echte Claude-Code-Installation getestet** — siehe „Status Session 32" + offene Smoke-Tests unten.
> Session 31 = StartScreen-Polish + zwei Bugfixes (`app:checkTypst`, git-lose Versionierung), MCP-Apps/Design-Vorher-Nachher verworfen; Session 30 = Politur (0 Build-Warnungen, „Verlauf & Wiederherstellen"-Hub); Session 29 = **Fokus-Schnitt** (CLI/Terminal/Modi raus — §1d); Session 28 = volles i18n + ＋-Einfügen-Menü + Vorschau.
> **Nächste Session — Fokus: 🔑 PHASE C (der Keystone).** Die tragenden Magazin-Makros (`opener`/`pull`/`frage`/`notiz`/`bildtafel`/`randnotiz` + `#columns`) zu **echten benannten AST-Nodes** machen, damit sie in **PDF + DOCX + Web gleichzeitig** keine Platzhalter/Code-Leaks mehr sind (zahlt 3× ein). Höchstes Regressionsrisiko (Editor-Deserializer + Serializer + Schema). **Exakte Aufgabe, Reihenfolge, Gates und offene Entscheidungen: Abschnitt „Nächste Session — Fokus" unten** (+ Plan-Doc §1.3 / §Phase C / §6 / §7). Die **Release-Themen bleiben bestehen** — sie kommen nach C+D+E.
> Lies diesen Handover, dann `CLAUDE.md` → danach loslegen.

---

## 0. TL;DR — wo wir stehen

- Produkt **Penwright** (Rebrand komplett). Lizenz: Einmalkauf **59 €**, 14-Tage-Trial → `LicenseGate`, ein `pw_LIC…`-Key schaltet alles frei; **die 14-Tage-Demo schaltet seit Session 32 auch den MCP-Server voll frei** (via `PENWRIGHT_TRIAL_UNTIL`, s. „Status Session 32"). Offline-Grace 7 Tage. In-App-Handbuch (`HandbookViewer`, EN/DE via `?raw`).
- **macOS „just works" ist bewiesen:** ein **notarisiertes, gestapeltes DMG** wurde gebaut + verifiziert (`spctl: accepted, source=Notarized Developer ID`). Typst-Binary + Fonts + Packages + MCP-Binary sind gebündelt **und** signiert/hardened. Du kannst **jederzeit** per `source build/notarize.env.local && npm run package:mac` ein fertiges DMG bauen. **v1 = nur Apple Silicon.**
- **Kanonische Domain:** `penwright.online` — **muss noch registriert werden** (Launch-Blocker für Website/Pricing/Support-Links).
- **Letzte Session (36):** Pre-Launch-Bugfixes (`#columns`-DOCX-Drop, Heading-`<label>`-Escaping) + **Web-Export Phase A + B** (`htmlSerializer.ts` / `styleToCss.ts` / `webExport.ts`, File ▸ „Export to Web (HTML)…", agnostisches self-contained `.html`-Bundle). Auf Branch `feat/web-export` (committet, nicht gemergt). **→ Nächster Schritt: 🔑 PHASE C (Keystone)** — siehe „Nächste Session — Fokus" + [web-export-feasibility-and-plan.md](web-export-feasibility-and-plan.md).
- **Letzte Session davor (35):** Round-trip-Escaping-Fix + bidirektionale Preview↔Source-Navigation; Typst-source-first verworfen. **v0.9.0** committet/getaggt/gepusht.

---

## Was diese Session passiert ist (alles im Branch, wird gepusht)

### A) Einheitliches „Look"-Modell (großer UI-Umbau)
Prinzip: **du gestaltest dort, wo es wirkt.** Drei Reichweiten, drei Orte, eine Vokabel („Look"):
- **Global** → `style.typ` öffnet den **visuellen Look-Designer** als Hauptansicht (nicht den rohen Code; `'design'`-Tab-Typ in `App.svelte`, `DesignPanel mainView`). Jedes Projekt bekommt automatisch eine `style.typ` (`ensureStyleFile` in `projectManager` — beim Öffnen nur die *Dateien*, **kein** erzwungener Root-Import → ändert bestehende Docs optisch nicht; neue Projekte bekommen den Import direkt; Default-Fonts = Template-Fonts „New Computer Modern").
- **Kapitel** → kontextueller Slot in der **unteren Statusleiste** (`LookStatus.svelte`): „Kapitel-Look ▾" im Kapitel · „✦ Global-Look" in style.typ · „✦ Look" sonst (öffnet style.typ). **„✎ anpassen"** öffnet den vollwertigen `SectionLookEditor` (Akzent/Primär-Farbe, Body/Heading-Font, Basisgröße, Zeilenabstand, Spalten, H1–H3) mit **„Für alle mit diesem Look"** vs. **„Nur dieses Kapitel"** (forkt eine kapitel-eigene Rubrik). Kapitel-Erkennung über echtes `#include` (`section:context` via `findRootFile`; `macros.typ`/`style.typ` sind **keine** Kapitel).
- **Stelle** → Rechtsklick „✨ Design with AI" → **Popover an der Auswahl** (`DesignAiPopover.svelte`): pinnt + Prompt kopieren / Claude öffnen. Claude liest via MCP-Tool `penwright_get_selection`.
- **„Design"-Sidebar-Tab entfernt.** Die Nav-Tabs (Files/Outline/Chapters/Project/Comments) sind in eine **Top-Bar** gewandert (links, neben die Format-Toolbar). Die alte Section-Style-Dropdown-Liste im Chapters-Tab (`IncludesPanel`) ist raus.

### B) Safe-Apply-Engine — „jede Design-Änderung ist ein sicheres Experiment"
`safeApplyDesign(writes, label)` in `ipcHandlers`: **jede** In-App-Design-Mutation (`style:save`, `section:apply/clear/saveStyle`) wird *vor* dem Commit kompiliert (`TypstCompiler.verify()` — One-off-Compile, eigener Temp-Pfad). Bricht sie das Dokument → **Rollback**, der letzte funktionierende Look bleibt sichtbar. `appState.lastCompileOk` unterscheidet „Änderung bricht ein funktionierendes Doc" (→ rollback) von „war schon kaputt" (→ commit ohne Verify). **Design-Undo-Stack** (`design:undo`/`design:canUndo`) + Button „↩ Rückgängig" im Designer. **Invariante: jede neue In-App-Design-Mutation MUSS durch `safeApplyDesign`** (nie Design schreiben + erst danach kompilieren).

### C) Bundling / Notarization (macOS launch-reif)
- `mcpSetup` setzt `TYPST_BIN` + `TYPST_PACKAGE_PATH` + `TYPST_FONT_PATH` → MCP-Server kompiliert/exportiert auf sauberer Maschine **ohne** System-Typst.
- Notarize-Dedup (afterSign-Plugin raus, `mac.notarize: true` bleibt). **Identity OHNE Präfix** (`"Rene Jesser (3LAHNFWNT3)"` — electron-builder wählt den Cert-Typ selbst; der „Developer ID Application:"-Präfix wirft `InvalidConfigurationError`). `disable-library-validation` in den Haupt-Entitlements (ein Sign-Pass deckt MCP + Typst). `afterPack-sign-mcp.mjs` signiert MCP + Typst robust (globt, Insurance). **Electron-Fuses** (`runAsNode`/`--inspect`/`NODE_OPTIONS` aus). DMG wird nach dem Build notarisiert + gestapelt.
- **Credentials:** `build/notarize.env.local` (**git-ignoriert!**) enthält `CSC_NAME`/`APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`.

### D) Pre-Launch-Härtung (Security + Performance)
- Security: `handleDropImage` Path-Traversal gefixt (`path.basename`), tote `vswrite.netlify.app`-URL → In-App-Handbuch, Electron-Fuses.
- Performance: `wordStats` nicht mehr pro Tastendruck (nur `docChanged` + `doc.descendants()` + Debounce, kein `getJSON`-Clone), Kommentar-Dekorationen via `tr.mapping` statt Full-Rebuild, überlappende Typst-Compiles werden gekillt (Sequence-Guard), Auto-Backup async (`fs.promises`).

### E) Onboarding
`OnboardingWizard.svelte` — First-Run-Tour (6 Schritte, u. a. die drei Design-Flächen), `onboardingSeen`-Flag + `persist:setOnboardingSeen`, erneut über „Hilfe → Show Introduction".

### F) Windows-Scaffolding (vorbereitet, **ungetestet**)
`.exe`-Handling (`typstPath`), Bun-Windows-Target (`build-mcp-binary.mjs --win`), voller win32-Branch in `mcpSetup` (`isMcpSetupSupported`, `%APPDATA%\Claude`, `%LOCALAPPDATA%\…\Claude.exe`). **Offen:** Typst-`.exe` besorgen (→ `resources/bin/typst-x64-win32.exe`), Code-Signing **bewusst weggelassen** (~300 € EV/OV → SmartScreen-Hinweis akzeptiert), Test auf echter Windows-Maschine.

---

## 1. Erledigt: Volles i18n (EN + DE umschaltbar)

**Entscheidung:** Variante **(B) Volles i18n** — EN + DE, zur Laufzeit umschaltbar. Default beim Erststart = **OS-Sprache** (Deutsch wenn OS deutsch, sonst Englisch), danach merkt sich die App die Wahl.

**Architektur** (Details in `CLAUDE.md` → „Internationalization (i18n)"): leichter Svelte-5-Rune-Store unter `src/shared/i18n/`. `en/<ns>.ts` + `de/<ns>.ts` je Namespace (23 Namespaces), `en` ist die Typ-Wahrheit, `de` wird dagegen typgeprüft. Reaktiver Zugriff via `t().<ns>.<key>` (`store.svelte.ts`). **Import-Regeln:** `.svelte` → `@shared/i18n/store.svelte`; tsc-geprüfte `.ts` (Editor-Node-Views) → **relativer** Pfad; **Main-Prozess** → `resolveDict(getLocale()).<ns>` (kein Rune-Store). Globale Persistenz: electron-store `locale` + IPC `app:getLocale`/`app:setLocale` (setLocale baut die native Menüleiste neu). **Sprach-Dropdown:** „Oberfläche"-Sektion im Dokument-Einstellungen-Dialog (`SettingsPanel`).

**Migriert:** native Menüleiste, alle Main-Prozess-Dialoge (`fileManager`/`projectManager`/`importExport`/`ipcHandlers`), Editor-Toolbar/Search/Shortcuts/Welcome, Slash-Commands + Editor-Node-View-Popups (Image/Footnote/Table/Bibliography/RawBlock/Pagebreak), DesignPanel/LookStatus/SectionLookEditor/DesignAiPopover, Onboarding/MCP-Wizard, Backup/Crash/Version/Project-Panel, Comments/Export/Sidebar, alle Picker/Panels, StartScreen/License/About, App.svelte (Alerts/Nav/Statusleiste/Trial-Banner). `tsc --noEmit` + `electron-vite build` grün.

**Erledigt (Vollständigkeits-Runde):**
- **QuickSettings/Zahnrad entfernt:** das ⚙-Popover (Schriftgröße + Zeilenabstand + doppelte Dokumentsprache) ist komplett raus (Button, Panel, `QuickSettings.svelte`, `showQuickSettings`, der `quickSettings`-IPC-Case + Message-Typ). Schriftgröße/Zeilenabstand leben im Design-Panel, Dokumentsprache in den Dokument-Einstellungen.
- **UI-Sprache schnell erreichbar:** EN/DE-Kürzel in der unteren Statusleiste (ein Klick toggelt), zusätzlich zur „App-Sprache" in den Dokument-Einstellungen + dem StartScreen-Switcher. **Wichtig:** UI-Sprache (i18n-Store) und Dokument-Textsprache (`#set text(lang)`) sind getrennt — nicht verwechseln.
- **StartScreen-Switcher:** kompakter EN/DE-Umschalter oben rechts auf dem StartScreen (der Haupt-Picker im Settings-Dialog braucht ein offenes Projekt).
- **Main→Renderer-Fehlertexte:** in `mainDialogs` gezogen — Sidebar-Fehler (`handleNewFolder`/`handleAddAssets`), Quit-Dialog (`index.ts`), Lizenz-Status-Messages (`licenseManager`), die Design-Undo-Tooltips (`safeApplyDesign`-Labels) und die „Keine KI-Änderungen"-Notification. Die Design/Section-Guard-Errors in `ipcHandlers` (z. B. „Chapter not found") bleiben englisch — sie werden nie angezeigt (Renderer mappt auf eigene `look.*`-Texte). Auch container-`aria-label`s (Sidebar/Comments/ProjectSearch/Export) sind jetzt lokalisiert.

**Offen:**
- **Manueller Smoke-Test:** Sprache im Settings-Dialog + auf dem StartScreen umschalten → Live-Update von UI + nativer Menüleiste prüfen; App neu starten → Wahl bleibt erhalten; Erststart auf DE-/EN-OS prüfen (electron-store `locale` ggf. löschen zum Re-Test).
- **Compile-Fehler** (Typst-CLI-Ausgabe in der Vorschau) bleiben englisch — kommen vom Typst-Binary selbst, bewusst nicht übersetzt.
- **Handbuch** ist separat zweisprachig (`handbuch.md`/`handbook.md`, `HandbookViewer` mit eigenem EN/DE-Toggle) — unabhängig von der UI-Sprache, bewusst so gelassen.

---

## 1b. Editor-UX: „＋ Einfügen"-Menü + Block-Exit (nach i18n)

- **„＋ Einfügen"-Button** links in der Toolbar öffnet ein Dropdown mit **allen** `/`-Befehlen (+ `@` Citation/Reference), gruppiert (Text & Struktur / Blöcke / Verweise & Medien). **Single Source:** `getCommands()` in `src/editor/lib/slashCommands.ts` (jedes Item hat `group: 'text'|'blocks'|'refs'`); Slash-Menü **und** Toolbar-Dropdown speisen sich daraus → können nie auseinanderlaufen. Neuer Einfügbarer = **ein** Eintrag in `getCommands()`. Der `{}`-Toolbar-Button bleibt bewusst der *generische* Code-Block (Inline-Code-Beispiele), **nicht** der Typst-Raw-Block — der ist `/Typst-Code` (`typstRawBlock`).
- **Typst-Block verlassen** jetzt auch per **`Esc`** / **`Cmd+Enter`** (zusätzlich zu „✓ Fertig") — in `typstRawBlock.ts`, eigener Tooltip-Key `rawBlockDoneTooltip`.
- **Onboarding:** neuer Schritt „Alles einfügen — der ＋-Button" zwischen „Schreiben" und „Design" (`onboarding.steps.insert`).
- **Doku nachgezogen:** `CLAUDE.md` (Action-Discovery-Split), in-App-Handbuch `handbook.md`/`handbuch.md` (Toolbar-Tabelle, Abschnitt „Inhalte einfügen", Oberflächensprache-Hinweis + Layout-Diagramm), `project_status.md`.

---

## 1c. Vorschau: Auto/Manuell + folgt dem Kapitel (nach i18n)

- **Vorschau-Modus (auto/manuell), globale Einstellung** im Settings-Dialog → „Vorschau". Default `auto` (wie bisher, 400 ms Debounce). `manual` gatet **nur** den tipp-/speicher-getriggerten Recompile in `fileManager.saveFile()` (`if (getPreviewMode()==='auto') compiler.compilePdf()`) — Öffnen, externe/KI-Watcher-Änderungen und Undo-AI kompilieren weiter. Speichern bleibt immer automatisch. Manueller Trigger: **Refresh-Button (↻)** in der Vorschau-Leiste (IPC `preview:compile`). Renderer spiegelt `previewState.mode` + `previewState.dirty` (gesetzt bei Editor-`onUpdate`, gelöscht bei `previewPdfUpdate`) → „Veraltet"-Badge + Akzent auf ↻. Persistenz: electron-store `previewMode` (`getPreviewMode`/`setPreviewMode`, IPC `persist:get/setPreviewMode`).
- **Vorschau folgt aktivem Kapitel:** beim Dateiwechsel setzt `messageHandler` (`'update'`-Handler, `firstHeadingTitle()`) `previewState.scrollTarget` = Kapiteltitel; `PdfPreviewPanel` scrollt via pdf.js `getOutline()` (PDF-Lesezeichen) zur passenden Seite — **nur bei Ziel-Wechsel** (`lastScrolledTarget`-Guard, race-frei: `pendingScrollTarget` wird **nach** dem Render angewendet), nie bei reinen Recompiles. `firstHeadingTitle` liest erst `= Überschrift`, sonst `title: "…"`/`title: [...]`-Makro-Argument → funktioniert auch in Magazin-/Makro-Projekten (`#opener(title: …)`); am echten LANGSAM-Magazin verifiziert. Fallback = kein Sprung (kein Titel/kein Match). Kompiliert weiterhin das **ganze** Wurzel-Dokument.

> Hinweis: zwei latente Bugs in dieser Runde gefixt — (1) **native Menü-Main-Aktionen** (Document Settings, Merge/Split, Open as Typst Source, Ensure Bibliography, Open Sources Folder, Add Citation Manually, Undo AI Edit, New Project) wurden vom Renderer nie an Main weitergeleitet → `messageHandler` leitet sie jetzt via `MENU_MAIN_ACTIONS` weiter; (2) Kapitel-Sprung landete auf Seite 1 (Label-Suffix + Recompile-Race) — behoben.
- **Offen/Test:** manuell prüfen — Modus-Umschaltung greift live; bei langen Multi-Kapitel-Docs Kapitel-Sprung verifizieren (setzt voraus, dass Typst PDF-Lesezeichen aus Headings erzeugt — sollte default sein); Heading-Matching ist fuzzy (Nummerierung/Markup werden normalisiert).

---

## 1d. Fokus-Schnitt (Session 29 — erledigt)

Auf Produkt-Feedback hin wurde Wartungs-/Identitäts-Ballast entfernt (Ziel: ruhigeres „Schreibwerkzeug", weniger Fläche):
- **CLI** (`src/cli/`, ungenutzt) gelöscht.
- **Integriertes Terminal** komplett raus: `terminalManager.ts`, `TerminalPanel.svelte`, `setupTerminal` + `terminal:*`-IPC, `terminal`-Feld der Main-AppState, Preload-Kanäle, Statusleisten-Button, `PanelState.showTerminal/terminalHeight`. **node-pty wird nicht mehr importiert** (dep kann optional aus `package.json` — braucht `npm install`).
- **Focus / Typewriter / Reading Mode** komplett raus: Funktionen, `uiState`-Felder, Toolbar-Buttons, Focus-Exit-Button, `scrollCursorToCenter`, Shortcuts (`Cmd+\``, `Cmd+Alt+R`, `Esc`-Exit), View-Menü-Einträge, ~120 Z. CSS in `App.svelte` + `editor/style.css`.
- **Spuren bereinigt:** ShortcutCheatsheet, StartScreen (Block „Terminal/AI" → reine KI-Anbindung), `skillTemplates` (Mode-Toggles-Sektion), ~16 verwaiste i18n-Keys (en+de), Doku (CLAUDE.md, Handbuch EN/DE, project_status, next-steps). `tsc` + Build grün.
- **Status:** uncommittet im Working-Tree (auf `main`).

---

## Status Session 36 (Pre-Launch-Bugfixes + Web-Export Phase A + B)

> **Verifikation:** `tsc --noEmit` + `electron-vite build` (0 Warnungen) + `node esbuild.mcp.mjs` grün; Round-Trip-Test `scripts/roundtrip-test.mts` **37/37** (30 alt + 7 neu für Heading-Labels); neuer Web-Export-Smoke-Test `scripts/html-export-test.mts` **52/52**; B1 + Web-Export am **echten LANGSAM-Magazin** empirisch validiert. **Alles auf Branch `feat/web-export` (ab `fix/prelaunch-export-bugs` ab `main`), committet, NICHT gepusht / nicht gemergt.** Voller Plan + Korrekturen + Markt-Einordnung: [web-export-feasibility-and-plan.md](web-export-feasibility-and-plan.md).

**Kontext:** René sah beim Bau seiner eigenen Projekt-Webseite, dass ein **HTML-/Web-Export** aus Penwright extrem sinnvoll wäre (Print **und** Web aus einer Quelle: eigene Artikel, Kunden-Artikel, einfaches Blog-Design). Multi-Agent-Recherche (Code + Web + adversariale Verifikation) + Erstlektüre des echten `~/Desktop/LANGSAM`-Magazins → **machbar, Marktlücke real (niemand macht „ein strukturiertes Manuskript → design-treuer Print + responsives Web"), Penwright einzigartig positioniert**. Entscheidung: **vor dem Launch bauen** (Launch-Headline „Print + Web"). Commits: `0e8dd1b` (Fixes), `588b3e9` (Plan-Docs), `8ca1c65` (Phase A), `154441c` (Phase B).

1. **Pre-Launch-Bugfixes (Phase 0 — unabhängig vom Web-Export, treffen die bewiesene Thesis/Paper-Zielgruppe):**
   - **B1 — `#columns` still aus DOCX verschluckt.** `columns` war in `SKIP_LEADERS` (`docxSerializer.ts`) → ganze Zweispalter (z. B. ~halbes LANGSAM-Interview) fielen lautlos aus dem DOCX. Fix: `columns` raus aus dem Regex, in den bestehenden `designText`-Pfad (`['block','dropcap','columns']`) geroutet → Text überlebt. Am echten Interview verifiziert. **⚠️ Bewusste Rest-Limitierung → Phase C:** in `#columns` *verschachtelte* User-Makros (`#frage`/`#lead`) werden weiter verworfen (`handleInlineFunc` droppt unbekannte Kleinschreib-Makros) → „Antworten ohne Fragen". Der Keystone behebt das (Makros→Nodes).
   - **B2 — Heading-`<label>`-Escaping zerschoss Querverweise.** Deserializer (`deserializer.ts:161`) fasste `<sec:x>` als Heading-Text, Serializer (`serializer.ts` `escapeTypstText`) escapte `<`/`>` → Öffnen+Speichern eines Kapitels mit beschrifteter Überschrift schrieb `= Titel \<sec:x\>` → **Label + jeder `@sec:x`-Verweis kaputt** (PDF + Cross-Ref-Graph). Fix: Deserializer spaltet ein abschließendes `<label>` in ein `label`-Attr (Backslash-Guard für literale `\<x\>`); Serializer emittiert es **un-escaped**; neue Editor-Extension `typstHeadingLabel.ts` deklariert das Attr im ProseMirror-Schema (sonst beim Laden verworfen). +7 Round-Trip-Asserts. `MCP_SETUP_VERSION` 0.13.0 → **0.14.0** (B1 steckt in der DOCX-MCP-Binary).
2. **Web-Export Phase A — Foundation (Plumbing-Spike, kein Editor-Eingriff):** `@tiptap/static-renderer@3.20.5` exakt gepinnt (core/pm bleiben 3.20.5 — die Versions-Skew-Falle aus der Recherche vermieden; react/react-dom nur als devDeps). Entry `@tiptap/static-renderer/json/html-string` (`renderJSONContentToString`, reine JSON→String, **kein DOM/jsdom/react**, explizite node/mark-Mappings = das docxSerializer-Muster). Neu: `src/shared/htmlSerializer.ts` (`serializeHtml(doc, opts)` → self-contained `<article class="pw-article">` + scoped `<style>`). Container-Entscheidung: **pure `.html`** (kein `.mdx` — MDX ist JSX, rohes `<style>` bricht den Acorn-Parser).
3. **Web-Export Phase B — design-treuer Vertical Slice:**
   - **B.0 Agnostisches Output-Modell** (René: „maximal portabel"): `mode: 'fragment' | 'document'` + `ArticleMeta` (head + Open-Graph) + neutrale `meta.json` + opt-in data-URI-Inline → einbettbar überall (Astro/WordPress/Ghost/Datei/Kunden-CMS), keine Host-Kopplung.
   - **B.1 `src/shared/styleToCss.ts`** — Projekt-Tokens → CSS-Custom-Properties + Element-Regeln, gescopt unter `.pw-article` (pro-Selektor-Prefix, leak-gesichert; `@scope` opt-in). Print→Web-Übersetzungen: Lese-Maß statt Papier, ratio-skalierte Headings, leading→line-height; Print-only-Felder + `custom.preamble` übersprungen.
   - **B.2 Drop-Cap + Callout** — kleiner Raw-Block-Reparser in `htmlSerializer.ts`: `#dropcap`/`#lead` → `.pw-dropcap`, gentle-clues `#info`/`#warning`/… → `.pw-callout` (+ minimaler Inline-Typst→HTML); CSS mit **permanentem Firefox-`::first-letter`-Float-Fallback** + color-mix-Tint. Am `07-design-showcase` verifiziert (Drop-Cap + 4 Callouts).
   - **B.3 `src/main/webExport.ts`** (electron-frei) `buildWebBundle` → `index.html` + `fragment.html` + `meta.json` + `assets/` (Bild-Copy+Rewrite oder data-URI-Inline); verdrahtet via `importExport.runWebExport` → **File ▸ „Export to Web (HTML)…"** (i18n en/de; `menuBuilder`/`appState`/`index.ts` wie `handleExportPdf/Docx`). Am echten LANGSAM-Feature-Kapitel validiert: Drop-Cap/Prosa/`#emph`/Fußnoten/Tokens rendern; die 5 noch-nicht-Nodes (opener/pull/bildtafel/interlude) = unsichtbare Platzhalter (erwartete Slice-Treue).
4. **Multi-Agent-Review** von Phase A+B (Security/Correctness/Robustness/Quality, **27 bestätigte Findings**) → die **Security- + Korrektheits-Findings wurden diese Session gefixt** (Commit `85e7577`, +13 rote→grüne Regressionstests, Smoke-Test jetzt **65/65**): URL-Scheme-Sanitizer (`javascript:`/`data:text/html` raus an Link-/Image-Sinks), `styleToCss`-Token-Härtung (Font-/`codeBlock.background`-Werte aus `style.json` können nicht mehr aus `<style>` ausbrechen) + `</style>`-Neutralisierung, textColor/highlight/width-Validierung gegen CSS-Grammatik, Asset-Pfad-Traversal-Schutz (`../` + Nicht-Bild-Dateien werden nicht ins Bundle kopiert/inlined), Reparser-Bracket-Bugs (Callout mit `)` im Titel / Dropcap mit `[` in Args), Emphasis-Wortgrenzen (`snake_case`), globales `img { max-width }`, slugify-Trim, prefixRule-Komma-Split. **Bewusst offen (low/nit, im Review notiert):** `runWebExport`↔`runFilteredExport`-Dedup, `meta.json` description/cover füllen, Export-Indicator-Paint-Timing.

---

## Status Session 35 (Escaping-Fix + bidirektionale Preview↔Source-Navigation + Release v0.9.0)

> **Verifikation:** `electron-vite build` grün (0 Fehler/Warnungen); Round-Trip-Regressionstest `scripts/roundtrip-test.mts` (`npx tsx`, 30/30). Die interaktiven Nav-Verhalten (Klick→Kapitel, Cursor→Vorschau) vom User im laufenden Build bestätigt.

**Kontext:** Ausgangsfrage war „kann man Text direkt in der Design-Vorschau editieren?" → Multi-Agent-Analyse (Codebase + Web + adversariale Kritik): echtes In-Preview-**Editing** ist mit dem gebündelten `typst 0.14.2` nicht machbar (SVG/PDF tragen keine Source-Spans, kein `jump`-Subcommand) und ein **Typst-source-first-Umbau wurde bewusst verworfen** (Parser ≠ Renderer → Design-Makros sind ohne Compiler-Lauf nicht editierbar darstellbar; 30–50 % eines Magazins wären Makro-Totzone; Engine-Versions-Skew Vorschau≠Export; Session-9-Perf; 40–60 PW ohne echten Gewinn). Entscheidung im Memory `decision-no-source-first`. **Stattdessen zwei fokussierte Features auf dem bestehenden TipTap-Pfad:**

1. **Escaping-Fix (Korrektheit, round-trip-kritisch).** `serializer.ts`: neue `escapeTypstText()` maskiert Typst-Sonderzeichen (`\ * _ ` `` ` `` ` # @ $ < > ~ [ ]`) in Fließtext-Runs + `escapeLeadingBlockMarker()` für führende `= - + / 1.`; **Code-Marks ausgenommen** (Typst-Raw un-escapet nicht). `deserializer.ts` ist jetzt **escape-aware** (`splitInlineConstructs` + `stripKnownInlines` überspringen `\x`; `parseFormattedText` neu geschrieben mit `unescapeLiteral`/`findClosingDelim`) → exakte Umkehrung. Vorher: literale `*`/`@wort`/`#x`/`$` wurden still zu Markup/Zitat/Code/Mathe (Kompilier- **und** Reopen-Korruption). **Nebenbei gefixt:** Code-Blöcke akkumulierten bei jedem Speichern einen `\n` (`parseBlock` strippt jetzt den Fence-Newline). Test: `scripts/roundtrip-test.mts`.
2. **Bidirektionale Navigation (additiv, kein neuer Editor).** *Preview→Source:* `PdfPreviewPanel.svelte` `onPreviewClick` (imperativ am Scroll-Container) baut aus den pdf.js-Text-Spans eine Phrase + nächstes Heading (`headingForPage` via `getOutline()`) → `penwright:preview-jump`-Event; `App.svelte` `handlePreviewJump` sucht per `project:search` die Datei (Heading-Disambiguierung + -Fallback), öffnet sie + springt (reuse `penwright:project-search-jump`/TreeWalker). Plain-Click navigiert, Drag-Select bleibt Copy (`getSelection().isCollapsed`). *Source→Preview:* `App.svelte` `nearestHeadingTitle`/`scheduleHeadingFollow` in `onTransaction` → setzt `previewState.scrollTarget` aufs Heading am Cursor (debounced; vorhandene `scrollToChapter`-Maschinerie scrollt nur bei Heading-Wechsel → kein Jank). Plan: `documentation/done/preview-sync-and-escaping-plan.md`.

**Release v0.9.0:** Version gebumpt (package.json, README-Badge+Text, next-steps, project_status-Changelog Session 35). Zwei Commits (`feat:` + `chore: release v0.9.0`) auf `main` gepusht, annotierter Tag `v0.9.0` gepusht. **Kein GitHub-Release** (privates Repo → kein Kunden-Kanal; Distribution noch offen — siehe Release-Sprint). `scripts/reset-trial.mjs` (lokales Trial-Reset-Tool) bewusst **untracked** gelassen. Release-Workflow-Präferenz im Memory `feedback-release-workflow`.

**Offen:** der ganze Release-Sprint (siehe „Nächste Session — Fokus"). Manuelle QA der zwei Nav-Features in echten Multi-Kapitel-/Magazin-Projekten.

---

## Status Session 34 (Print-Export „Für den Druck" + 2-up-Vorschau + `spread-image`)

> **Verifikation:** `tsc --noEmit` + `electron-vite build` (0 Warnungen) + `node esbuild.mcp.mjs` grün. Generator + Export + Spread **empirisch** gegen die gebündelte Typst-CLI kompiliert + gerendert (A4 + 5 mm Bleed → MediaBox 220×307 mm; Schnittmarken an allen vier Ecken im Beschnitt; Full-Bleed läuft bis zum physischen Rand; `style-print.typ`-Transform an einem Multi-Kapitel-Mini-Projekt durchgespielt; Bildschirm-Build bleibt exakt A4 = kein Bleed-Leak in die Editier-Vorschau; `spread-image`-Naht durchlaufend). **Adversarialer Multi-Agent-Review** des kompletten Diffs (4 Dimensionen × Skeptiker-Verifikation) = **0 echte Bugs**. Voller Plan + Status: `documentation/done/print-export-plan.md` (auf „implementiert" gesetzt).

**Ziel:** Penwright vom „schönen Bildschirm-PDF" auf **druckerei-tauglich** heben — rein Typst-intern (kein Engine-Warten), für Magazine/Broschüren. Bewusst **NICHT** in-App: CMYK/PDF-X mit gesetzten Boxen (Typst kann kein ICC-Profil einbetten [typst#3143] und keine TrimBox/BleedBox setzen → die **gezeichneten Schnittmarken SIND die Trim-Definition**; CMYK = Druckerei-/Acrobat-Nachschritt).

1. **Schema** (`src/shared/styleTypes.ts`): `StyleLayout` um `bleed`/`cropMarks`/`facingPages`/`binding` — **optional** (additiver, print-only Concern → die 7 vollen Layout-Preset-Literale + `themePresets` (nutzt `Partial<StyleLayout>`) mussten nicht angefasst werden; `sanitizeProjectStyle` füllt sie aus den Defaults, der Generator guard't jeden Read mit `?? ''`).
2. **Generator** (`src/shared/styleParser.ts`): `generateStyleTypst(style, { print?: boolean })`. Print-Modus emittiert (a) eine **oversized Seite** = Trim + 2×Bleed via Typst-Ausdruck `210mm + 2 * 5mm` (so muss die Bleed-Einheit nicht in JS geparst werden) + `PAPER_MM`-Tabelle (Landscape tauscht die Maße statt `flipped`), (b) bleed-bewusste Margen + Facing-Pages-Innen/Außenstege mit Bundzuwachs, (c) ein Modul-level `#let style-bleed` (0mm Bildschirm / Bleed im Druck) + `crop-marks(bleed)`-Helper im `set page(foreground: …)` (Markenlänge = Bleed → kein Clipping bei 3 mm). **Split (live vs. export):** `facingPages`/`binding` prägen die Geometrie und werden **auch** im Bildschirm-Modus emittiert (ein gebundenes Heft soll man beim Schreiben sehen); nur der **Bleed-Überlauf + die Marken** sind export-only.
3. **Full-Bleed-Elemente brauchten KEINE Änderung** — `#page(margin: 0pt, background: image(width:100%,height:100%))` blutet über die geerbte oversized Seite (empirisch bestätigt). `style-bleed` wird nur vom neuen **`spread-image`** (23. Design-Element, `designElements.ts`) konsumiert: ein Bild über zwei gegenüberliegende Seiten/über den Bund — emittiert zwei Seiten, erzwingt geraden/linken Start (`pagebreak(to: "even")`), splittet das Bild **exakt mittig** (beide Seiten rendern dasselbe `cover`-Bild, nur um eine Seitenbreite versetzt → nahtlos), blutet via `style-bleed`. (Header/Footer/Numbering auf den Spread-Seiten unterdrückt.)
4. **Export-Pfad** (`src/main/importExport.ts`): `ExportConfig.print`; `writePrintExportTemp()` schreibt temp `.penwright-style-print.typ` (Print-Style) + temp Root (Style-Import von `style.typ` → temp umgebogen; Inject-Fallback, falls ein Projekt gar keinen Style importiert), kompiliert, räumt **beide** Temp-Dateien in `finally` auf. **Bewusster Gegen-Fall zur safe-apply-Invariante:** schreibt nur Temp-Dateien, mutiert das Projekt nie → routet **nicht** durch `safeApplyDesign`. dpi-Preflight `preflightPrintImages()` (PNG-IHDR + JPEG-SOFn-Header ohne Dependency, < ~1500 px Kantenlänge → Warnung) via IPC `export:preflightImages`. **`startExport`: PDF öffnet jetzt immer den Export-Dialog** (auch Single-File), damit die Druckoptionen erreichbar sind; DOCX-Single-File geht weiter direkt.
5. **UI** (`src/renderer/components/ExportDialog.svelte`): „Für den Druck"-Block (Bleed-Dropdown 3/5 mm + frei, Schnittmarken, Doppelseiten + Bundzuwachs, „Als Standard merken" → merge in `style.json` über den normalen `style:save`/safe-apply-Pfad, RGB-Hinweis, Niedrigauflösungs-Warnung aus dem Preflight). Vorbelegt aus `getExportableSections().printDefaults`. **Layout-Preset** „Magazin (Druck) · A4 + 5 mm Beschnitt" (`layoutPresets.ts`); **Theme-Apply** (Renderer `DesignPanel.applyTheme` + MCP `penwright_apply_style`) erhält die vier Print-Felder wie `sections`/`custom`.
6. **2-up-Doppelseiten-Vorschau** (`PdfPreviewPanel.svelte`): `spread`-Modus — Seite 1 allein, dann 2–3, 4–5 … als Flex-Rows (jede PDF-Seite einzeln von pdf.js gerendert; `pageElements` bleibt ein flaches Per-Seite-Array → `renderPage`/Observer/`scrollToChapter` unverändert; der Rebuild-`$effect` feuert auch bei `spread`-Wechsel und ruft **nie** erneut `getDocument` auf — der ArrayBuffer ist detached). Toggle (`▭▭`) in `PreviewPanel`s Leiste (`zoomState.spread` + `togglePdfSpread`); per Projekt persistiert in `preferences.json` als `pdfSpread`.
7. **MCP**: `penwright_export_print({ outputPath, bleed?, cropMarks?, facingPages?, binding? })` (mirror des Export-Transforms, `resolveInsideProject`-Pfadvalidierung, Temp-Cleanup); `MCP_SETUP_VERSION` 0.12.0 → **0.13.0** (der Export steckt in der Bun-Binary). `DESIGN_SKILL` um Print/Spread/Gutter-Creep-Hinweise ergänzt.

**Offen (bewusst):** CMYK/PDF-X (Engine-Grenze, Re-Eval wenn Typst upstream ICC/PDF-X liefert). Manuelles QA-Stichprobe: realer Druck-Export an einem Magazin (Beschnitt sichtbar, Marken korrekt, Spread über den Bund) + 2-up-Toggle im UI.

---

## Status Session 33 (DOCX-Export-Treue + frisches Release-DMG)

> **Verifikation:** `tsc --noEmit` + `electron-vite build` + `node esbuild.mcp.mjs` grün; Round-Trip-Test (deserialize→serialize) über alle 7 Sample-Kapitel sauber; PDF↔DOCX-Vergleich am Sample-Projekt vorher/nachher per Absatz-Dump. **Committet (`aedb0c3`) + gepusht.** DMG + App beide `spctl: accepted, Notarized Developer ID` + `stapler validate` ok.

1. **Methode:** Sample-Projekt headless einmal als PDF (Typst) und einmal als DOCX (App-Pfad `resolveIncludes` → `deserializeTypst` → `serializeDocx`) exportiert, beide als Text gedumpt und verglichen. Gefundene Lücken → Fixes in `docxSerializer.ts` (Export-only) und `deserializer.ts` (hilft auch dem Editor).
2. **DOCX-Serializer:** Text-tragende Design-Container (`#align`/`#block`/`#dropcap`/`#wrap-content`, auch hinter führenden `#v()`-Spacern) emittieren ihren sichtbaren Text als gestylte Absätze (`#text(size/weight/style)` → Run-Größe/fett/kursiv; Chunk-Split an Leer-/`#v()`-Zeilen; verworfen wird nur noch, was nach dem Parsen <2 sichtbare Zeichen hat — reine Linien/Ornamente). Heading-Labels werden aus dem Text gestrippt und im Pre-Pass mit mitgezählten Abschnittsnummern als `Section N.M`-Ziele registriert. Benachbarte Citation-Nodes kollabieren zu einer Klammer mit `et al.` + Komma. Figure-Captions: `caption: "…"` und `caption: figure-caption-credit("…", "…")` (nutzt `creditSeparator`/`creditLabel` aus style.json). Bibliographie: „References", Autoren mit `et al.`, `--`→`–`, `Venue, Vol(No), Seiten. DOI/URL`.
3. **Deserializer:** (a) `@name`-Regex strippt trailing `.`/`:` (wie Typst) — `@key.` am Satzende erzeugte einen unbekannten Citekey, auch der Editor-Badge war falsch; Round-Trip bleibt byte-identisch. (b) Aufeinanderfolgende `=`-Heading-Zeilen (ohne Leerzeile) werden als eigene Blöcke gesplittet statt zu einem Absatz zu verkleben (beim Speichern wäre die Quelle korrumpiert worden); Math-Parity-Guard lässt `= x`-Zeilen in mehrzeiligen `$…$` unangetastet; `={1,6}` statt `={1,4}` (H5/H6).
4. **`MCP_SETUP_VERSION` 0.11.0 → 0.12.0** — der Serializer steckt in der MCP-Binary (`penwright_export_docx`); Bump re-triggert den Setup-Wizard, damit Bestandsnutzer die neue Binary bekommen.
5. **Release-DMG neu gebaut:** `source build/notarize.env.local && npm run package:mac` → beide Bun-MCP-Binaries frisch (aarch64 + x86_64 — die x86 aus Session 32 war veraltet, damit erledigt), App notarisiert + gestapelt. Das DMG selbst stapelt electron-builder nicht — manueller Nachschritt: `codesign` → `notarytool submit --wait` → `stapler staple` → verifiziert.
6. **Bewusst offen (nicht launch-relevant):** Inline-Mathe bleibt als `$…$`-Rohtext im DOCX (lesbar + editierbar; Rasterisieren würde Zeilenhöhe/Editierbarkeit verschlechtern — falls je, einziger v1.1-Kandidat); Galerie-Captions/Zahlen tief in `#grid`-Argumenten; `rect(…)`-Platzhalter-Figuren ergeben nur die Caption.

---

## Status Session 32 (MCP-Registrierung mit Startauswahl + Demo-Freischaltung)

> **Verifikation:** `npx electron-vite build` = grün, `tsc --noEmit` (main + shared + mcp) = grün, MCP-Binary neu gebaut (`npm run build:mcp` + `build:mcp-binary` host-arch) + Trial-Gate per **Direkt-Test der Binary** verifiziert (kein Cred → exit 1; `PENWRIGHT_TRIAL_UNTIL` in Zukunft → läuft; in Vergangenheit → exit 1). **Uncommittet im Working-Tree.** **NICHT** live getestet gegen eine laufende Meta-MCP-Instanz / echte Claude-Code-Installation — das ist der offene Smoke-Test unten.

1. **MCP-Registrierung mit Startauswahl** (neues Modul `src/main/mcpRegistration.ts`). Penwright ist selbst ein MCP-Server und registriert sich bei **genau einem** von zwei Hosts (Invariante: nie Doppel-Eintrag):
   - **(A) Meta-MCP** — lokaler Aggregator-Proxy `http://localhost:3663`. Verfügbarkeit `GET /` (`probeMetaMcp`); **registrieren** `POST /register` (Hot-Reload, Dedup-by-`name`, Proxy vergibt eigene id); **deregistrieren** durch Editieren der beobachteten `…/com.metamcp.desktop/config.json` (es gibt **kein** HTTP-Unregister) — entfernt **nur** Einträge mit unserem `name`, lässt `profiles`/`active_profile` unangetastet, behandelt `servers` als Array **oder** Objekt-Map.
   - **(B) Claude Code** — User-Scope (global): `claude mcp add --scope user penwright --env K=V -- <bin>` (CLI via Common-Paths + Login-Shell aufgelöst, da GUI-Apps den PATH nicht erben), **Fallback** direktes `~/.claude.json`→`mcpServers`-Edit. Deregister = eigenen Key aus `~/.claude.json` löschen.
   - **Orchestrierung** `ensureMcpTarget(target)`: registriert **erst** den Ziel-Host, entfernt **dann** den anderen → ein fehlgeschlagener Wechsel lässt nie null Hosts aktiv. Meta gewählt + nicht erreichbar → meldet `meta-not-running`, registriert **nicht** still in Claude Code. Jeder Config-Write mit Timestamp-Backup.
   - **Server-Definition** (`buildServerDefinition`) = identische Binary + Env wie der Claude-Desktop-Wizard (`mcpSetup.ensureInstalledBinary()` + `buildMcpEnv()` herausgezogen + geteilt).
   - **Startauswahl** (`index.ts initMcpRegistration`, Fire-and-forget nach Window-Creation): `--mcp-target=meta|claude`-Flag (persistiert), sonst persistiertes `mcpTarget` re-applien, sonst Smart-Default (Meta falls erreichbar, sonst Claude Code) **ohne** Persistierung. Persistiert als `mcpTarget` (electron-store, `null` bis entschieden).
   - **UI** `McpConnectionDialog.svelte`: Auto beim Erststart (bis Wahl getroffen, sequenziert mit Onboarding/Crash, hat Vorrang vor dem Claude-Desktop-Wizard) + **Hilfe → „MCP-Verbindung…"**. Zwei Karten (Meta mit Läuft/Läuft-nicht-Badge, Claude Code), Empfohlen/Aktiv-Tags, Trial-Hinweis. IPC `mcp:getConnectionStatus` / `mcp:setTarget`. i18n-Namespace **`mcpConnection`** (en+de, in beiden `index.ts` registriert → 25 Namespaces). Menü-Eintrag + Event `penwright:show-mcp-connection`.
   - **Bewusst getrennt** vom bestehenden Claude-**Desktop**-Wizard (`mcpSetup.ts` / `claude_desktop_config.json`) — anderer Host, koexistiert.
2. **MCP-Server in der Demo voll freigeschaltet (komplette 14-Tage-Demo).** Vorher verlangte der Server zwingend einen `pw_LIC`-Key (sonst `process.exit(1)`). Jetzt: `buildMcpEnv()` bäckt im Trial `PENWRIGHT_TRIAL_UNTIL=<Trial-Ende epoch-ms>` (aus `licenseManager.getTrialEndMs()`) **statt** des Keys ein; der Server (`src/mcp/server.ts` `validateAccess()` = gültige Lizenz **ODER** `now < PENWRIGHT_TRIAL_UNTIL`) startet die kompletten 14 Tage. Erst bei abgelaufener Demo ohne Lizenz (`getEntitlement().access === 'expired'`) verweigert er + der Claude-Desktop-Wizard wirft. `buildMcpEnv` gibt jetzt `access: 'licensed'|'trial'|'expired'` zurück (statt `hasLicense`); der Dialog zeigt einen **grünen** „Demo aktiv (noch N Tage)"-Hinweis statt der Lizenz-Warnung. **`.mcpb`-Distribution unverändert lizenzpflichtig** (separater Manual-Install-Kanal ohne App-Trial-Stempel).

**Offen — manuelle Smoke-Tests (headless nicht prüfbar, höchster Hebel):**
- **Meta-MCP-Pfad:** Meta-MCP-App starten → Penwright starten → Dialog „Meta-MCP" wählen → in Meta-MCP erscheint `penwright`; dann auf „Claude Code" wechseln → Eintrag verschwindet aus Meta-MCPs `config.json` **und** taucht in `~/.claude.json` auf (und umgekehrt). Prüfen, dass `profiles`/`active_profile` + fremde Server unangetastet bleiben.
- **Claude-Code-Pfad:** mit installiertem `claude`-CLI → `claude mcp add` greift; ohne CLI im PATH (GUI-Start) → `~/.claude.json`-Fallback schreibt korrekt. `--mcp-target=meta|claude`-Flag prüfen.
- **Demo:** im Trial (kein Key) MCP-Setup/Registrierung laufen lassen → Server startet wirklich in Claude (Tools sichtbar), nicht nur Binary-Direkt-Test. Nach Trial-Ablauf → verweigert.
- ~~**Achtung Packaging:** die **x86_64-Binary** ist noch alt~~ — **erledigt in Session 33** (`package:mac` hat beide Architekturen neu gebaut, DMG notarisiert + gestapelt).

---

## Status Session 31 (UI-Polish + zwei Bugfixes + zwei verworfene Features)

> **Verifikation:** `npx electron-vite build` = 0 Svelte-Warnungen, `tsc --noEmit` = grün, gebündeltes `dist/main/index.js` hat **keine** Runtime-`require("./…")` mehr. **Uncommittet im Working-Tree** (User committet auf Ansage).

1. **StartScreen aufgeräumt** (`StartScreen.svelte` + `startScreen.ts` en/de + `penwright-logo.svg`):
   - **KI-Anbindung-Block raus** (das große AI-Integration-Card mit den 3 Skill-Badges + die 6 i18n-Keys). Redundant: Onboarding-Wizard + „Hilfe → Mit Claude Desktop verbinden" decken das ab; der Screen fokussiert jetzt auf die 3 Aktions-Cards.
   - **Logo zentriert:** die `penwright-logo.svg` hatte eine viewBox `0 0 760 150`, das Artwork füllte aber nur die linken ~53 % → wirkte links-verschoben. viewBox auf `4 17 408 116` getrimmt (+ `width`/`height` angepasst) → optisch zentriert, kein Artwork bewegt.
   - **Untertitel** „WYSIWYG-Editor für Typst" → **„Typst, visuell geschrieben"** / „Typst, written visually" (wärmer, weniger Jargon, behält „Typst" zur Orientierung).
   - **Oben-rechts-EN/DE-Schalter entfernt** — der Statusleisten-Toggle ist funktional identisch, konsistenter mit dem Projekt-Layout. (Handbuch EN/DE Zeile 63 nachgezogen — verwies noch auf den Schalter.)
2. **Bug: `app:checkTypst` lief *immer* auf „Typst nicht gefunden".** Root cause: der Handler lud den Resolver per Runtime-`require('./typstPath')`. electron-vite bündelt den ganzen Main-Prozess in **eine** `dist/main/index.js` → es gibt keine `typstPath.js` zur Laufzeit → `require` wirft „Cannot find module" → `catch` → `false`. Betraf **jeden** gebauten/paketierten Build, obwohl Typst gebündelt **und** beim User installiert ist. Fix: statischer `import { getTypstPath }` + `import { execFileSync }`. **Derselbe Bug** steckte in `crashReporter.ts` (`require('./appState')` → Projekt-Kontext-Block fiel still aus jedem Crash-Report) — mit-gefixt. Neue **Pitfall-Notiz** in `CLAUDE.md`.
3. **Bug: „Version speichern" bei git-losen Projekten tot.** LANGSAM (Magazin aus der ai-magazine-designer-Pipeline) hat **kein `.git`** — nur `.penwright/` (daher gingen Auto-Backups, aber keine Versionen). `canSave` hing an `git:status`-Änderungsdateien, die ein Nicht-Repo nie liefert → Button permanent ausgegraut, obwohl die UI „erste Version legt Verlauf an" verspricht. Fix in `ProjectPanel.svelte`: erste Version (`!isRepo`) ist erlaubt und committet das ganze Projekt (Backend `git:saveVersion` macht `ensureRepo` + `git add -A` eh schon richtig). **Betrifft jedes von außen geöffnete Projekt**, nicht nur LANGSAM. Nuance in `CLAUDE.md` (Persistenz-Schichten → Versions) ergänzt.
4. **MCP Apps — ausführlich recherchiert, bewusst verworfen (pre-launch).** Offizielle MCP-Erweiterung (Spec 2026-01-26, Claude Desktop unterstützt es). Technisch sauber integrierbar (`ui://`-Resource + `registerAppTool`/`registerAppResource`, chunked PDF-Bytes wie das `pdf-server`-Beispiel, HTML ins Bun-Binary einbetten). **Aber:** Penwright *ist* schon die (bessere, live-aktualisierende) PDF-Vorschau; eine eingebettete, on-demand, schlechtere Variante in Claude wäre ein Nachbau des App-Kerns an einem Ort, wo die volle App eh ein Cmd+Tab entfernt läuft. Lokales stdio = gleiche Maschine → strukturell redundant. Echter Wert nur: (a) Marketing-Story „läuft in Claude" (billiger per Demo-GIF lösbar), (b) das Vorher/Nachher-Design-Widget. **Nicht vor dem Launch; Details/Refs in §2.**
5. **Design-Vorher/Nachher-Vergleich — evaluiert, nicht gebaut.** Versionierung löst es *nicht* (Quelltext-Diff von Style-Tokens ist als Design-Entscheidung wertlos), aber Safe-Apply + Design-Undo + Live-Vorschau geben schon einen *sequenziellen* Vergleich (anwenden → undo → wieder anwenden). Echte Lücke nur: *gleichzeitig* nebeneinander, und das lohnt v. a. bei subtilen Änderungen — schmaler Nutzen. **Falls je:** Design-Undo zu einem A/B-Toggle ausbauen (Snapshots nimmt Safe-Apply eh auf), **nicht** Split-Screen. Auch das: nicht vor Launch.

**Offen — manueller Smoke-Test (höchster Hebel):** der **„von außen geöffnetes Projekt"-Pfad** (Roh-Ordner / Magazin-Pipeline-Output, ohne `.git`, ohne in-App erstellt): öffnen → deployen `.claude/skills` + `style.typ` korrekt? Design-Panel-Root richtig aufgelöst? Erste Version speicherbar (jetzt gefixt)? Export ok? Beide Bugs dieser Session lebten in genau diesem Pfad.

---

## Status Session 30 (die drei priorisierten Punkte — erledigt)

> **Verifikation:** `unset ELECTRON_RUN_AS_NODE && npx electron-vite build` = **0 Warnungen** (vorher 34), `tsc --noEmit -p tsconfig.json` = grün. **Committet + auf `main` gepusht** (`096219a` + Doku-Nachzug).

1. **a11y-Warnungen weg — sauberer Build.**
   - **Root cause:** `svelte-ignore`-Kommentare wirken in diesem Projekt **nicht zuverlässig**, sobald die Komponente `<script lang="ts">` hat (TS-Preprocessing verschiebt Quell-Positionen) — deshalb feuerten viele a11y-Warnungen **trotz** vorhandener Ignore-Kommentare. (Standalone mit `svelte/compiler` reproduziert + bestätigt.)
   - **Fix daher markup-basiert** statt Ignore: Modal-Backdrops schließen via `e.target === e.currentTarget` (statt innerer `stopPropagation`), Dialog-Container `role="dialog"` + `tabindex="-1"`, leere Overlays `role="presentation"`, Labels via `for`/`id`, `autofocus` → `use:focusOnMount`-Action, ReferencePicker-Liste als `role="listbox"`/`option` (Tastatur über `<svelte:window>`), SearchReplace-Keydown auf die Inputs. Tote Ignore-Kommentare entfernt.
   - Mitgenommen: 6 **unused-CSS**-Warnungen (3 davon `{@html}`-Code → `:global()` = Styling war faktisch kaputt + jetzt korrekt; 2 echt tot → gelöscht) und 4 **„state captures initial value"**-Warnungen (intentionale Prop-Seeds in `$state(...)` → `untrack()`).
2. **Onboarding „Design"-Schritt** (`onboarding.steps.design`, en+de) aufs **Look-Modell** umgeschrieben — kein „Design-Tab" mehr: `style.typ` = visueller Look-Designer (ganzes Dokument), Statusleiste = Kapitel-Look, Rechtsklick = Design with AI. Zwei zurückgebliebene „Design tab"-Stellen im In-App-Handbuch (`handbook.md`/`handbuch.md`) gleich mitkorrigiert.
3. **Persistenz vereinheitlicht — „Verlauf & Wiederherstellen"-Hub** (gewählte Variante: *ein gemeinsamer Verlauf-Hub*).
   - Neuer **`HistoryDialog.svelte`**: drei beschriftete Abschnitte mit Zweck-Zeile — **Versionen** (Git → `VersionDetail` Diff/Restore), **Auto-Backups** (Restore + ⚙-Einstellungen interval/maxCount/maxAiSnapshots), **KI-Änderungen** (per-Datei-Stack → „↩ Letzte rückgängig"). **KI-Undo ist damit erstmals im UI sichtbar** (vorher nur Menü „Bearbeiten → KI-Bearbeitung rückgängig").
   - `ProjectPanel` zeigt nur noch Save-Version + Änderungen + **einen** Button zum Hub (inline History-Liste + Auto-Backup-Footer raus). `BackupListDialog.svelte` **gelöscht** (vom Hub absorbiert).
   - Backend: neue IPC `ai:list` / `ai:undoLast` (+ `fileManager.getAiSnapshotsList`), in `preload-entry` gewhitelistet. Neuer i18n-Namespace **`history`** (en+de, in beiden `index.ts` registriert → jetzt 24 Namespaces). **Mechanik unverändert** (popAiSnapshot-Stack, Git-Versionen, Backup-Snapshots bleiben getrennt — nur die *Darstellung* ist gebündelt). CLAUDE.md nachgezogen.

**Offen — manuelle Smoke-Tests (headless nicht prüfbar):**
- Projekt öffnen → Projekt-Tab → **„Verlauf & Wiederherstellen"**: Versionen-Klick → Diff + Restore; Auto-Backup → Restore + ⚙-Einstellungen ändern; KI-Änderungen → „Letzte rückgängig" (am besten nach einer echten MCP/KI-Bearbeitung der offenen Datei).
- **a11y-Stichprobe:** Modale per **Esc** schließen, Klick auf Backdrop schließt, Klick **innerhalb** schließt **nicht**; ReferencePicker-Tastaturnav (↑↓ Enter Esc); „Neues Projekt"-Dialog fokussiert das Namensfeld automatisch.

---

## Nächste Session — Fokus: 🔑 PHASE C (Keystone) → danach D/E → dann Release-Sprint

> **Branch:** auf `feat/web-export` weiterarbeiten (enthält Fixes + Phase A + B). **Pflichtlektüre vorab:** [web-export-feasibility-and-plan.md](web-export-feasibility-and-plan.md) — v. a. **§1.3** (was die LANGSAM-Makros wirklich sind + die harte `#grid`-Inline-Layout-Stelle), **§„Phase C"**, **§6** (Hard Gates), **§7** (offene Entscheidungen). Dann der echte Artefakt `~/Desktop/LANGSAM/macros.typ` + `chapters/` (Interview = der schwere Fall). **Vorlagen für neue Nodes:** `src/editor/lib/typstFootnote.ts`, `typstReference.ts`, `typstHeadingLabel.ts` (diese Session neu).

### A) Phase C — der Keystone (JETZT · ~1,5–2,5 Wochen · höchstes Regressionsrisiko)

**Ziel:** die tragenden, hand-geschriebenen Magazin-Makros aus opaken `typstRawBlock`-Atomen in **echte benannte TipTap-Nodes** verwandeln. Sobald sie Nodes sind, tragen sie in **EINEM** Schritt nach **PDF + DOCX + HTML** *und* werden im Editor echt-WYSIWYG editierbar (statt Roh-Text-Blobs). Das ist der eigentliche Hebel hinter dem Web-Export — ohne Phase C bleibt Web „Text mit Löchern". **Touchiert den regressionsreichsten Teil der App** (Editor-Deserializer + Serializer + Schema = der WYSIWYG↔Typst-Round-Trip, von dem jeder Compile abhängt).

**Konkrete Aufgaben (in dieser Reihenfolge):**
1. **~7 neue Nodes anlegen** (~100–250 LOC each, Muster von `typstFootnote`/`typstReference` kopieren), in `editor.ts` registrieren:
   `articleHeader` (← `opener`: kicker/title/standfirst/byline), `dropCap` (← `lead`), `pullQuote` (← `pull`, +`who`), `question` (← `frage`), `callout` (← `notiz`: title/tone), `figurePanel` (← `bildtafel`: image+note), `marginNote` (← `randnotiz`) — **plus ein `columns`-Node** für `#columns(n)[…]` (Kinder rekursiv re-parsen).
2. **Deserializer-Erkennung** (`deserializer.ts`): diese Makros parsen **in die Nodes** statt in `typstRawBlock`. **Strategie = Hybrid** (offene Entscheidung §7): Marker-Kommentar `// penwright:node=…` für Penwright-*generierte* Konstrukte + Name-Heuristik für Bestands-LANGSAM-Makros. **⚠️ Achtung:** der Erkenner muss **VOR** dem `isRawBlock`-`//`-Check laufen (ein führendes `//` zwingt einen Block sonst nach `typstRawBlock`).
3. **Serializer-Round-Trip** (`serializer.ts`): jeder Node re-emittiert den **exakten** `#makro(...)`-Aufruf. **Akzeptanz-Maßstab = COMPILE-Stabilität (identisches gerendertes PDF) + erhaltene Cross-Ref-Labels — NICHT Byte-Identität** (Plan §1.2 C9: der heutige Round-Trip ist gar nicht byte-identisch, nur fixpunkt-konvergent). **Automatischen Test bauen:** N echte LANGSAM-Kapitel → Nodes → serialize → gegen identischen kompilierten-PDF-Hash prüfen (~2–3 Tage allein dafür). **Nicht mergen, bis grün an echten Docs.**
4. **In die drei Serializer verdrahten:**
   - **HTML** (`htmlSerializer.ts`): `nodeMapping` je neuem Node (ersetzt die heutigen Platzhalter) + CSS in `styleToCss.ts` für pull-quote / margin-note / question / figure-panel / columns (Plan §6.5: Float+`shape-outside`, Grid-Side-Column, `column-width`).
   - **DOCX** (`docxSerializer.ts`): die neuen Nodes rendern — **fixt zugleich die B1-Rest-Limitierung** (verschachtelte `#frage`/`#lead` in `#columns`, „Antworten ohne Fragen", s. „Status Session 36"). `MCP_SETUP_VERSION` bumpen.
   - **PDF:** unverändert (Serializer emittiert dieselben Makro-Aufrufe → compile-stabil).
5. **UI-Affordances:** Slash-Commands / ＋-Menü-Einträge je Node über `getCommands()` (eine Quelle → beide Oberflächen).
6. **Hard Gates (Plan §6) einhalten:** (a) **nichts Halb-Treues geht raus**; (b) Akzeptanz = compile-stabil + Labels erhalten, per Auto-Test an echten LANGSAM-Kapiteln; (c) **Kill-Kriterium** notieren (falls Typsts HTML-Backend zuerst magazin-reif wird → eigenen Serializer aufgeben, Typst wrappen).
7. **Offene Entscheidungen (Plan §7) treffen:** Erkennungsstrategie (Hybrid empfohlen) · Keystone-Scope (nur die 7 LANGSAM-Nodes, oder auch ein generischer `#grid`-2-up → responsive-Stack-Fallback für den Interview-Kopf).

**Verifikation Phase C:** `tsc --noEmit -p tsconfig.json` + `unset ELECTRON_RUN_AS_NODE && npx electron-vite build` + `node esbuild.mcp.mjs` + `scripts/roundtrip-test.mts` + `scripts/html-export-test.mts` + der **neue Compile-Stabilitäts-Test** an echten LANGSAM-Kapiteln, alle grün.

### B) Danach: Phase D + E (Web-Export fertigstellen)
- **Phase D (~5–7 Tage):** Breite auf den strukturierten Nodes — columns/pull-quote/margin-note/question/figure-panel CSS, Section-Overlays → scoped CSS; restlichen `classifyRawBlock`/`parseInlineTypst` aus `docxSerializer` nach HTML portieren; **Mathe via Typst→SVG-Hook + MathML/aria (kein KaTeX)**; `buildExportContext` (Cross-Refs/Zitate/Fußnoten/Biblio) wiederverwenden.
- **Phase E (~5–7 Tage):** Print-only-Konstrukte (`aufmacher`/`doppelseite`/Cover → Hero/Article-Header, **nie** `#place`→CSS); voller LANGSAM-Durchlauf (das Sample-Projekt übt die Makros NICHT — nur ein LANGSAM-Export beweist sie); `custom.preamble` strip-with-warning; ExportDialog-Kapitelauswahl + Inline-Assets-UI (das Menü exportiert aktuell das ganze Dokument); `@scope`-Enhancement-Pass; **MCP-Tool `penwright_export_web`** (Mirror von `penwright_export_docx`).

### C) Danach: 🚀 Release-Sprint (die bestehenden Launch-Themen — bleiben gültig)
**v0.9.0 ist committet/getaggt/gepusht (kein GitHub-Release, bewusst). Nach dem Web-Pack (C+D+E):**
1. **Release planen** — konkrete Schritte + Reihenfolge bis zum ersten öffentlichen Release.
2. **`penwright.online` registrieren** (Launch-Blocker — Website/Pricing/Support-Links; Marken-Recherche DPMA/EUIPO Klasse 9 steht aus).
3. **Homepage** — fertigstellen ODER neu vom Design; Showcase-Projekte (Thesis / Magazin-Spread / Brochure / CV / Report / Newsletter) — **jetzt auch der Web-Export als Showcase** („derselbe Artikel als Print-PDF *und* als Live-Webseite").
4. **Newsletter** — Anbieter + Einbettung + Double-Opt-in (Updates per „Newsletter + manueller Download", Auto-Updater gestrichen).
5. **Download-Distribution** — wo/wie die notarisierte DMG gehostet wird (Tendenz Dropbox; stabile Public-Links, Versionierung, SHA).
6. **DMG bauen** — `source build/notarize.env.local && npm run package:mac` (notarisiert, Apple Silicon).
7. **Manuelle Smoke-Tests / QA** — „von außen geöffnetes Projekt"-Pfad; Design-with-AI-E2E; Safe-Apply-Rollback; **Web-Export E2E im laufenden Build** (`electron-vite dev` → File ▸ Export to Web → Bundle im Browser öffnen). **Windows** Fast-Follow.

> Reihenfolge: **Phase C → D → E → Release-Sprint.** Falls UI-Politur dazwischenkommt: mitnehmen, nicht launch-blocking.

---

## 2. Andere offene Themen
- **`penwright.online` registrieren** — Website/Pricing/Support lösen sonst nicht auf (Launch-Blocker). Marken-Recherche (DPMA/EUIPO, Klasse 9) steht aus.
- ~~**„Für den Druck exportieren" (Print-Export)**~~ — **✅ erledigt Session 34** (MVP + 2-up-Vorschau + `spread-image`). Penwright ist jetzt **druckerei-tauglich** (Beschnitt + Schnittmarken + Innen-/Außenstege + dpi-Preflight, rein Typst-intern via temp `style-print.typ`, kein safe-apply). Details: „Status Session 34" oben + [print-export-plan.md](done/print-export-plan.md) (auf „implementiert"). **Nur noch offen:** CMYK/PDF-X (Engine-Grenze [typst#3143] — die gezeichneten Marken sind die Trim-Definition, CMYK = Druckerei-/Acrobat-Nachschritt) + manuelle QA-Stichprobe an einem echten Druck-Magazin.
- **🆕 Showcase-Projekte für die Homepage** — ein paar verschiedene fertige Projekte generieren (z. B. Thesis, Magazin-Spread, Brochure/Flyer, CV/Lebenslauf, Report, Newsletter), die als **Auszüge/Screenshots auf penwright.online** zeigen, *was* mit Penwright möglich ist und *in welchem Umfang*. Material für die Landingpage. Ideal: jeweils ein echtes Mini-Projekt + gerendertes PDF + ein, zwei Screenshots des Editors/Design-Looks.
- **MCP Apps — evaluiert 2026-06-08 → verworfen (pre-launch), Re-Eval nur post-launch.** Offizielle MCP-Erweiterung (Spec 2026-01-26, offiziell/production, Claude Desktop unterstützt es). **Technisch sauber machbar:** `ui://`-HTML-Resource + `_meta.ui.resourceUri` + `registerAppTool`/`registerAppResource` aus `@modelcontextprotocol/ext-apps/server`, View via Vite + `vite-plugin-singlefile`, PDF-Bytes chunked wie das offizielle `pdf-server`-Beispiel, HTML ins Bun-Binary einbetten (generiertes TS-String-Modul), läuft über stdio (kein HTTP/express nötig — das ist nur die Dev-Playground der Examples). **Verworfen, weil:** Penwright *ist* schon die live-aktualisierende PDF-Vorschau; eine eingebettete, on-demand, schlechtere Variante in Claude wäre ein Nachbau des App-Kerns, wo die volle App eh ein Cmd+Tab entfernt läuft. Lokales stdio = gleiche Maschine → strukturell redundant (kein „auf dem Handy"-Szenario). Echter Nicht-Redundanz-Wert nur: (a) **Marketing-Story** „läuft in Claude" — billiger per Demo-GIF der bestehenden App; (b) das **Vorher/Nachher-Design-Widget**. **Wenn je gebaut:** auf das Vorher/Nachher-Widget zuschneiden, nicht den vollen PDF-Viewer; pdf.js-Worker unter iframe-CSP ist die Hauptfalle; ext-apps gegen die exakt installierte Version pinnen (jung, v1.7). Refs: `github.com/modelcontextprotocol/ext-apps`, `modelcontextprotocol.io/extensions/apps/overview`, Beispiel `examples/pdf-server`.
- **Manueller E2E-Test Design-with-AI** mit Claude Desktop (Pin → `penwright_get_selection` → anwenden → Editor lädt neu → Popover toastet → Pin weg). Headless nicht durchspielbar.
- **Safe-Apply-Rollback gezielt testen:** eine Section/Custom-Code, die absichtlich nicht kompiliert → muss zurückgerollt werden, „↩ Rückgängig" muss greifen.
- **Skill-Update auf bestehenden Projekten:** greift erst nach Löschen der alten `.claude/skills/design/SKILL.md` (neue Projekte automatisch via `ensureClaudeSkills`).
- **Holdout:** `vswrite-desktop` (Repo-/Ordnername) bleibt — dokumentiert in `CLAUDE.md` → Naming Convention.

---

## 3. Branding-Fakten (für UI-Texte / Logo / Farben)
- **Name:** Penwright (*pen* + *-wright* = „Handwerker der geschriebenen Seite").
- **Brand-Farben:** dark `#211e1a`, terracotta/accent `#a8503a`, cream `#f4f1ec`, muted `#8a8174`. Schriften: **Spectral** (Headings/Logo), **Crimson Pro** (Body).
- **Logo:** „P."-Monogramm. Assets in `build/icons/`, `src/renderer/assets/penwright-*.svg`.
- **Domain:** `penwright.online` (kanonisch, **muss registriert werden**). Support-Mail `feedback@penwright.online`.

---

## 4. Build-/Run-Befehle (macOS, aus VS Code/Cursor-Terminal)
```bash
# Dev (das unset ist Pflicht aus VS-Code-Terminals)
unset ELECTRON_RUN_AS_NODE && electron-vite dev
# Builds (Verifikation)
unset ELECTRON_RUN_AS_NODE && npx electron-vite build   # main + preload + renderer
node esbuild.mcp.mjs                                     # MCP-Server (server.ts)
# Notarisiertes DMG (Credentials aus der git-ignorierten Datei laden)
source build/notarize.env.local && npm run package:mac
```
- Git: arbeite auf einem **neuen Branch ab `main`**. `.claude/` + `build/notarize.env.local` + `release/` sind git-ignoriert. Commit nur auf Ansage des Users; Commit-Messages enden mit `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Verifikation nach Code-Änderungen: `electron-vite build` + `tsc --noEmit -p tsconfig.json` clean (+ `node esbuild.mcp.mjs` bei MCP-Änderungen). MCP-Tool-Änderung → `MCP_SETUP_VERSION` bumpen.

---

## 5. Lesereihenfolge (neuer Chat)
1. **`documentation/handover.md`** ← dieses Dokument.
2. **`CLAUDE.md`** — Architektur, Konventionen, **Safe-Apply-Invariante**, **Naming Convention**.
3. Bei Bedarf: `documentation/mcp-server.md` (MCP-Tool-Referenz), `documentation/handbook.md` (User-Manual, EN/DE), `documentation/next-steps.md` (Release-Checkliste).
   `project_status.md` + `documentation/done/**` = **Historie** (Changelog, teils noch „vswrite"-Sprech — bewusst nicht umgeschrieben).
