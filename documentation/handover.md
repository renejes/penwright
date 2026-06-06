# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-06-06, Ende der i18n-Session.
> **Branch:** `design-on-selection` (ab `main`).
> **Letzte Aufgabe (erledigt):** **Volles i18n** — die gesamte UI ist jetzt EN + DE umschaltbar
> (Dropdown im Dokument-Einstellungen-Dialog, OS-Erkennung beim Erststart). Siehe §1 + `CLAUDE.md` → „Internationalization (i18n)".
> Lies diesen Handover, dann `CLAUDE.md` → danach loslegen.

---

## 0. TL;DR — wo wir stehen

- Produkt **Penwright** (Rebrand komplett). Lizenz: Einmalkauf **59 €**, 14-Tage-Trial → `LicenseGate`, ein `pw_LIC…`-Key schaltet alles frei (inkl. MCP), Offline-Grace 7 Tage. In-App-Handbuch (`HandbookViewer`, EN/DE via `?raw`).
- **macOS „just works" ist bewiesen:** ein **notarisiertes, gestapeltes DMG** wurde gebaut + verifiziert (`spctl: accepted, source=Notarized Developer ID`). Typst-Binary + Fonts + Packages + MCP-Binary sind gebündelt **und** signiert/hardened. Du kannst **jederzeit** per `source build/notarize.env.local && npm run package:mac` ein fertiges DMG bauen. **v1 = nur Apple Silicon.**
- **Kanonische Domain:** `penwright.online` — **muss noch registriert werden** (Launch-Blocker für Website/Pricing/Support-Links).

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

## 2. Andere offene Themen
- **`penwright.online` registrieren** — Website/Pricing/Support lösen sonst nicht auf (Launch-Blocker). Marken-Recherche (DPMA/EUIPO, Klasse 9) steht aus.
- **🆕 Showcase-Projekte für die Homepage** — ein paar verschiedene fertige Projekte generieren (z. B. Thesis, Magazin-Spread, Brochure/Flyer, CV/Lebenslauf, Report, Newsletter), die als **Auszüge/Screenshots auf penwright.online** zeigen, *was* mit Penwright möglich ist und *in welchem Umfang*. Material für die Landingpage. Ideal: jeweils ein echtes Mini-Projekt + gerendertes PDF + ein, zwei Screenshots des Editors/Design-Looks.
- **🆕 MCP Apps evaluieren (post-launch, v1.x)** — die erste offizielle MCP-Erweiterung (Spec 2026-01-26, RC 2026-07-28): MCP-Server können **interaktive UI in einem sandboxed iframe direkt im Chat-Host** (Claude Desktop, ChatGPT, VS Code) rendern. **Relevanz für Penwright:** der größte Hebel ist eine **Live-PDF-Vorschau in Claude Desktop** (es gibt ein offizielles `pdf-server`-Beispiel + ein Svelte-Starter-Template) → Design-with-AI wird zu „beschreiben → *hier* sehen → iterieren" ohne App-Wechsel. Plus ein „Look anwenden"-/Vorher-Nachher-Widget im Chat. Passt zu `penwright_get_selection` + Safe-Apply, die schon stehen. **Nicht** Penwright in Claude nachbauen — nur die „Loop-Closer" rüberbringen. **Nach** dem Launch + wenn die Spec ihren RC durch hat. Penwrights MCP-Binary müsste dafür UI-Resources ausliefern. Refs: `modelcontextprotocol.io/extensions/apps/overview`, `github.com/modelcontextprotocol/ext-apps`.
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
