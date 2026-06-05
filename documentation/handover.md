# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-06-05, Ende der großen „Design/Look-Modell + Launch-Reife"-Session.
> **Branch:** `design-on-selection` (ab `main`) — wird in dieser Session **committet + nach `main` gepusht**.
> **Nächste Aufgabe:** **Lokalisierung** — die UI konsequent auf **Englisch** vereinheitlichen,
> oder einmal **vollständiges i18n** (EN + DE umschaltbar) nachziehen. Erst Entscheidung, dann Umsetzung. Siehe §1.
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

## 1. Nächste Aufgabe: Lokalisierung (Englisch / i18n)

**Problem:** Die UI ist **gemischt DE/EN** — native Menüleiste + Lizenz-UI englisch, aber viele (gerade neuere) Komponenten deutsch. Für eine Bezahl-App unrund.

**Erst die Entscheidung mit dem User klären:**
- **(A) Englisch-only** — alle UI-Strings auf Englisch vereinheitlichen. Schnell, ein Sprachstand.
- **(B) Volles i18n** — EN + DE umschaltbar (leichter `t()`-Store + Locale-Maps). Mehr Aufwand, DE-Markt bleibt.

**Es gibt noch KEINE i18n-Infrastruktur** — Strings sind hart in den `.svelte`/`.ts`. Bei (B): ein `i18n.ts` mit `locale`-Store + `t(key)` + `en`/`de`-Maps, Strings nach Keys ziehen. Das Handbuch ist bereits zweisprachig (`handbuch.md`/`handbook.md`).

**Deutschsprachige Surfaces (nicht erschöpfend):** `DesignPanel`, `LookStatus`, `SectionLookEditor`, `DesignAiPopover`, `OnboardingWizard`, `McpSetupWizard`, `CrashReportDialog`, diverse `alert()`/Toast-Texte, der „Kapitel-Look"/„Global-Look"-Wortschatz.

---

## 2. Andere offene Themen
- **`penwright.online` registrieren** — Website/Pricing/Support lösen sonst nicht auf (Launch-Blocker). Marken-Recherche (DPMA/EUIPO, Klasse 9) steht aus.
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
