# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-06-05, Ende der Session „Design after writing".
> **Branch:** `design-on-selection` (ab `main`), **noch nicht committet/gepusht** —
> Working Tree enthält das fertige Feature, wartet auf Commit-Freigabe.
> **Nächste Aufgabe:** das **Bundling-/„Just-Works"-Audit** + DMG/Notarization (siehe §4).
> Lies diesen Handover, dann `CLAUDE.md` → danach loslegen.

---

## ✅ Erledigt diese Session: „Design after writing" (zwei Ebenen)

Das in **[design-on-selection-plan.md](design-on-selection-plan.md)** geplante Feature
ist **vollständig gebaut** (alle drei Stages). Builds grün (`electron-vite build` +
`esbuild.mcp` + `tsc --noEmit` clean).

- **Ebene 1 (Gesamt-Design)** funktioniert wie gehabt über die bestehenden Design-Tools;
  neu ist nur das **Framing** im `DESIGN_SKILL` („Designing on Request").
- **Ebene 2 (Stelle gestalten) — neu:** Text markieren → Rechtsklick **„✨ Design with
  AI"** → `App.svelte` `pinSelectionForDesign()` pinnt Anker (`anchorText` +
  1-basierte `occurrence` + `nodeType`) via `selection:pin`; der Main-Prozess hängt einen
  **Design-Snapshot** an (Theme / Palette / Fonts / Layout / sectionStyle / grober
  `usedElements`-Scan) und schreibt `.penwright/selection.json`. Der **Design-Tab** öffnet
  mit einer **Hub-Karte** (`DesignPanel.svelte`): Vorschau + Kontext-Digest + Buttons
  „Prompt kopieren" / „Claude öffnen" / „Lösen".
- **MCP:** neues Tool **`penwright_get_selection`** (`server.ts` + Manifest), liest den Pin.
  `MCP_SETUP_VERSION` → **`0.11.0`** (Wizard re-deployt das Binary).
- **Auto-Unpin:** der chokidar-Watcher (`fileManager.ts`) räumt den Pin, sobald Claude die
  gepinnte Datei extern ändert, und schickt `selectionApplied` → Karte toastet
  „Dokument aktualisiert".
- **Klarstellung Design-Tab (gleiche Session):** das Feature heißt UI-seitig jetzt
  **„Design with AI"** (generisch; der „Claude öffnen"-Button bleibt, weil er buchstäblich
  Claude Desktop öffnet). Der Design-Tab ist in **drei Flächen** gegliedert: Pin-Karte
  „Design with AI" = *eine Stelle*; Zone **„Globale Styles"** (Palette/Themes/Layout/Fonts/
  Headings/Elements/Custom) = *ganzes Dokument* (Scope-Label mit Root-Dateiname + „?"-Hilfe);
  Zone **„Section Styles"** = *pro Kapitel* (eigene „?"-Hilfe). **Harte Schreib-Sicherung**:
  `resolveStyleRootFile()` (ipcHandlers) schreibt globales Design immer an die Projekt-Root
  (`main.typ`/`document.typ`/`index.typ`), **nie** in ein offenes Kapitel → der „zerschießt
  das Kapitel"-Footgun ist tot. `style:get` liefert den Root-Basename fürs Label.
- **Geänderte Dateien:** `persistenceManager`, `ipcHandlers`, `preload-entry`, `index.ts`
  (Kontextmenü), `fileManager`, `App.svelte`, `messageHandler`, `DesignPanel.svelte`,
  `mcp/server.ts`, `mcp/manifest.template.json`, `mcpSetup.ts`, `skillTemplates.ts`,
  neu: `src/shared/selectionTypes.ts`. Doku in `CLAUDE.md` aktualisiert.
- **Offen / noch zu prüfen:** **manueller E2E-Test** mit Claude Desktop (Pin → Claude liest
  `penwright_get_selection` → wendet etwas an → Editor lädt neu → Pin verschwindet). Skill-Update
  greift auf **bestehenden** Projekten erst nach Löschen der alten
  `.claude/skills/design/SKILL.md` (neue Projekte automatisch via `ensureClaudeSkills`).

---

## ✅ Erledigt diese Session: Bundling-Audit + 3 Fixes

Der **Ist-Zustand ist gut**: Typst-Binary (arm64), 22 Typst-Packages, 7 Fonts (inkl.
Brand-Fonts Crimson Pro + Spectral), Sample-Projekt, Icons, Handbuch (`?raw`), MCP-Binary
(beide darwin-Triples) sind gebündelt und im App-Pfad korrekt verdrahtet
(`buildTypstCompileArgs` → `--font-path` + `--package-path`). Die **App selbst ist auf
Apple Silicon self-contained.** Drei Lücken gefixt:

1. **`TYPST_BIN` fehlte im MCP-Wizard** → die aus der .app herauskopierte MCP-Binary fiel
   auf bare `typst` zurück und konnte auf einer sauberen Maschine **nicht** kompilieren/
   exportieren. `mcpSetup.ts` setzt jetzt `TYPST_BIN` (+ Package/Font-Path, war schon da).
2. **Notarize-Doppelkonfig** (`mac.notarize:true` **und** `afterSign: electron-builder-notarize`)
   → das redundante afterSign-Plugin entfernt; der eingebaute notarytool-Pfad bleibt.
3. **Signierung der gebündelten Binaries**: `disable-library-validation` in die Haupt-
   `entitlements.mac.plist` gezogen (der eine Sign-Pass deckt MCP + Typst ab); `afterPack-
   sign-mcp.mjs` robust umgeschrieben (globt MCP **und** Typst, invertierter Arch-Bug behoben)
   als Absicherung. **Wichtig:** `afterPack` läuft **vor** electron-builders Sign-Pass
   (in app-builder-lib 26 verifiziert), darum ist der Hook nur Insurance, nicht der Primär-Signer.

- **Offen (Build-Zeit, braucht echten `package:mac`):** Notarisierten DMG bauen +
  **prüfen**, dass die Nested-Binaries (Typst, MCP) in `Contents/Resources` signiert+hardened
  sind und durchnotarisieren. Apple-Credentials als Env: `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` (erstellen unter account.apple.com → Anmeldung & Sicherheit →
  App-spezifische Passwörter), `APPLE_TEAM_ID` (Identity `3LAHNFWNT3` ist gesetzt).
- **Plattform:** v1 = **nur Apple Silicon**.

### Windows-Scaffolding (vorbereitet, ungetestet)

Code-seitig vorbereitet, ohne Windows/Cert testbar:
- `typstPath.ts` — `.exe`-Handling fürs gebündelte Typst-Binary (`typst-x64-win32.exe`).
- `build-mcp-binary.mjs` — Bun-Windows-Target (`--win` → `penwright-mcp-x86_64-pc-windows-msvc.exe`,
  cross-compile von macOS möglich). `package:win` baut die MCP-Binary jetzt mit.
- `mcpSetup.ts` — voller win32-Branch: `isMcpSetupSupported()`, `platformBinary()`,
  Config-Pfad `%APPDATA%\Claude`, Install `%APPDATA%\Penwright\mcp-server\penwright-mcp.exe`,
  Claude-Discovery `%LOCALAPPDATA%\…\Claude.exe`. `mcp:getSetupStatus.supported` nutzt das jetzt.

**Noch offen für Windows (braucht Windows-Maschine / Entscheidungen):**
- **Typst-`.exe` besorgen** und nach `resources/bin/typst-x64-win32.exe` legen (kein Fetch-Script).
- **Code-Signing bewusst weggelassen** (EV/OV-Zertifikat ~300 €/Jahr) → Nutzer sehen SmartScreen.
- Echter Test auf Windows + Claude Desktop (Config-Pfad, Bun-`.exe`-Spawn, node-pty/Terminal).
- Linux: App ginge standalone, aber Claude Desktop gibt's dort nicht → MCP moot.

---

## 0. TL;DR — wo wir stehen

- Produkt heißt **Penwright** (Rebrand vollständig durch — Identität, Logo, MCP, Protokolle, Skill, alle `penwright_*`-Tools, `.penwright/`-Projektordner inkl. Einmal-Migration). Kein „loses Ende" mehr außer zwei bewusst dokumentierten Holdouts (siehe `CLAUDE.md` → **Naming Convention**: Repo-/Ordnername `vswrite-desktop`, das ist der echte Git-Repo-Name).
- **Lizenzmodell (M8.7) ist fertig:** Einmalkauf **59 €**, lokaler **14-Tage-Trial** → danach `LicenseGate` (gesperrt), **ein** `pw_LIC…`-Key schaltet alles frei (inkl. MCP), Offline-Grace **7 Tage**, „Buy" geht direkt zum Polar-Checkout. Lizenz-UI ist **englisch**.
- **In-App-Handbuch:** `HandbookViewer.svelte` rendert das gebündelte Handbuch (`marked`, EN/DE), „Help → User Guide" + About-Button öffnen es. Kein externes Docs-Hosting mehr.
- **Kanonische Domain:** `penwright.online` (muss noch registriert werden). Support-Mail `feedback@penwright.online`.
- **Rebrand + Lizenz + Handbuch** sind auf `main` gepusht (`ecde226`). Das
  **„Design after writing"-Feature** liegt fertig auf Branch `design-on-selection`
  (noch **uncommitted** — siehe ✅-Block oben).

**→ Jetzt: das Bundling-/„Just-Works"-Audit** (User installiert nur Penwright → hat
alles, keine Zusatz-Installs) + DMG/Notarization — Details in §4.

---

## 1. ✅ (Erledigt) „Design after writing" (zwei Ebenen) — Hintergrund

**Ziel:** Schreiben und Gestalten entkoppeln. Zwei Ebenen:

1. **Ebene 1 — Gesamt-Design.** Man chattet einfach mit Claude („mach das ganze
   Dokument magazin-mäßig"). **Geht schon** über die bestehenden MCP-Design-Tools
   (`penwright_apply_style` / `apply_palette` / `apply_layout` / `generate_layout`).
   Hier ist fast nur **Framing** (Skill + UI-Hinweis) zu tun.
2. **Ebene 2 — Design an einer bestimmten Stelle. ← das neue Stück.** Text
   markieren → an Claude übergeben → beschreiben („hier 2-Spalten-Layout", „diesen
   Satz als Randnotiz", „das als Pull-Quote in Akzentfarbe"). Das Schwierige:
   **Claude muss wissen, was „das" ist** (Selektions-Awareness).

**Entscheidungen, die schon feststehen** (im neuen Chat NICHT neu aufmachen):
- **Option 1:** der User beschreibt **in Claude Desktop**, nicht in Penwright
  (MCP ist Pull-only). Kein eingebetteter Copilot. (Ein lokales, auf Penwright
  trainiertes Modell wäre eine spätere Update-Option — bewusst out of scope.)
- **Pin statt Live-Sync:** der User **pinnt** die Auswahl bewusst (App-Wechsel zu
  Claude würde die Selektion sonst kollabieren). Der Pin macht die Reihenfolge
  sichtbar.
- **Der Design-Sidebar-Tab ist der Hub.** Alles Gestalterische an einem Ort. Im
  Editor lebt nur der leichte Pin-Auslöser (Rechtsklick „✨ Design with AI").
- **Nichts feuert automatisch** — die Hub-Karte zeigt die Buttons (Copy Prompt /
  Open Claude), der User klickt selbst.
- **Claude bekommt immer den Design-Kontext** (Theme/Palette/Fonts/Layout/
  Section-Style/bereits genutzte Elemente), damit es harmonisch entscheidet.

**Der vollständige, datei-genaue Plan steht in
[design-on-selection-plan.md](design-on-selection-plan.md)** — drei Stages:
1. Selektion pinnen (`.penwright/selection.json` + Rechtsklick + Design-Tab öffnen),
2. Hub-Karte im Design-Tab,
3. MCP-Brücke (`penwright_get_selection` + `design-conventions`-Skill).
Der Plan nennt die Vorlagen im Code (v. a. `addCommentFromSelection()` als
Selektions-Muster, das native Kontextmenü in `index.ts`, `get_style` als
MCP-Lese-Vorlage, `saveProjectStyle` als `.penwright/`-Schreib-Vorlage).

---

## 2. Was in der letzten Session passiert ist (Kontext, alles committed + gepusht)

- **Rebrand komplett** (`6c3b2de`, `42064e7`): Protokolle `penwright-asset://` /
  `penwright-font://`, Skill-Slug `penwright`, alle **56** MCP-Tools `penwright_*`,
  Manifest-Identität, `.vswrite/` → `.penwright/` **mit Einmal-Migration**
  (`migrateLegacyProjectDir` in `projectManager.ts` — benennt einen Alt-Ordner
  beim Öffnen um), style.typ-Marker `penwright:custom` / `:section-style`, interne
  Identifier (IPC-Channel `'penwright'`, Window-Events `penwright:*`, Log-Tags,
  CSS-Klassen). `electron-store` heißt jetzt `penwright-settings`.
- **M8.7 Lizenzmodell** (`6c3b2de`): `licenseManager.getEntitlement()`
  (`licensed`/`trial`/`expired`) als einzige Gating-Wahrheit; `persistenceManager`
  `trialStartedAt` + `ensureTrialStarted()`; `LicenseGate.svelte`; Trial-Banner +
  Statusleiste; alles in **englischer** UI.
- **Handbuch** (`ecde226`): Lizenz-/Updates-/MCP-Sektionen auf den echten Stand
  korrigiert (waren noch Basic/Pro-Modell + Auto-Updater); In-App-Viewer gebaut;
  URLs auf `penwright.online`.
- **Merge:** `docx-overhaul` → `main` (Fast-Forward) → `origin/main` gepusht.

---

## 3. Branding-Fakten (für UI-Texte / Logo / Farben)
- **Name:** Penwright (*pen* + *-wright* = „Handwerker der geschriebenen Seite").
- **Brand-Farben:** dark `#211e1a`, terracotta/accent `#a8503a`, cream `#f4f1ec`,
  muted `#8a8174`. Schriften: **Spectral** (Headings/Logo), **Crimson Pro** (Body).
  Beide liegen in `~/Library/Fonts` (system-weit).
- **Logo:** „P."-Monogramm. Assets in `build/icons/`, `src/renderer/assets/penwright-*.svg`,
  `documentation/penwright-*.svg`, Referenz `documentation/brand/penwright-monogram-final.png`.
- **Domain:** `penwright.online` (kanonisch, **muss registriert werden**).
  Marken-Recherche (DPMA/EUIPO, Klasse 9) steht noch aus.

---

## 4. Andere offene Themen (nicht die nächste Aufgabe, aber notiert)
- **➡️ DIREKT NACH DEM DESIGN-FEATURE: Bundling-/„Just-Works"-Audit.** Ziel: der
  User installiert **nur Penwright** und hat **alles** — keine Zusatz-Installs.
  Intensiv prüfen, dass das gepackte `.app` wirklich self-contained ist:
  - **Typst-Binary** (`resources/bin/typst-{arch}-{platform}`), **24 Typst-Packages**
    (`resources/typst-packages/`), **OFL-Fonts** inkl. der Brand-Fonts **Crimson Pro
    + Spectral** (`resources/fonts/`) — NICHT auf die system-installierten Fonts vom
    Dev-Rechner verlassen! Auf einer **sauberen Maschine** ohne Homebrew/Typst/Fonts testen.
  - **MCP-Binary** (`Contents/Resources/mcp/bin/penwright-mcp-*`) + Setup-Wizard-Copy.
  - **Handbuch** (jetzt via `?raw` im Renderer-Bundle), **Sample-Projekt**
    (`resources/sample-project/`), **Icons**.
  - Alles via `extraResources` in `package.json`. Dann **DMG + Notarization**
    (Launch-Blocker, Apple-Dev-Account da). Detail-Checkliste: `next-steps.md`.
- **Launch-Blocker (Teil des Bundling-Audits):** DMG-Build + **Notarization**.
  **Wichtig:** Auto-Updater ist **gestrichen** (Updates per Newsletter);
  `next-steps.md` §3.4 ist nur noch Referenz.
- **Lokalisierung:** die Lizenz-UI ist englisch (wie Menü/Toolbar), aber
  `McpSetupWizard` + `CrashReportDialog` sind noch deutsch — App-UI ist gemischt.
  Kandidat für eine konsistente Lokalisierungs-Runde.
- **Holdout:** `vswrite-desktop` (Repo-/Ordnername) bleibt — dokumentiert in
  `CLAUDE.md` → Naming Convention.

---

## 5. Lesereihenfolge (neuer Chat)
1. **`documentation/handover.md`** ← dieses Dokument.
2. **`CLAUDE.md`** — Architektur, Konventionen, **Naming Convention**. Aktuell
   (Penwright-Sprech).
3. **`documentation/design-on-selection-plan.md`** — der datei-genaue Plan der
   nächsten Aufgabe.
4. Bei Bedarf: `documentation/mcp-server.md` (MCP-Tool-Referenz),
   `documentation/handbook.md` (was die App laut Handbuch kann).
   `project_status.md` + `documentation/done/**` = **Historie** (Changelog,
   teils noch „vswrite"-Sprech — bewusst nicht umgeschrieben).

---

## 6. Build-/Run-Befehle (macOS, aus VS Code/Cursor-Terminal)
```bash
# Dev (das unset ist Pflicht aus VS-Code-Terminals)
unset ELECTRON_RUN_AS_NODE && electron-vite dev
# Builds (Verifikation)
unset ELECTRON_RUN_AS_NODE && npx electron-vite build   # main + preload + renderer
node esbuild.mcp.mjs                                     # MCP-Server (server.ts)
# Packaging
npm run package:mac
```
- Git: arbeite auf einem **neuen Branch ab `main`** (z. B. `design-on-selection`).
  `.claude/` ist untracked und bleibt es. Commit nur auf Ansage des Users;
  Commit-Messages enden mit
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Verifikation nach Code-Änderungen: beide Builds grün + `tsc --noEmit -p tsconfig.json`
  clean auf den geänderten Dateien. MCP-Tool-Änderung → `MCP_SETUP_VERSION` bumpen.

---

## 7. Nützlicher Startsatz für den neuen Chat
> „Lies `documentation/handover.md`, dann `CLAUDE.md`, dann
> `documentation/design-on-selection-plan.md`. Wir bauen das **„Design after
> writing"-Feature** (zwei Ebenen: Gesamt-Design via Claude-Chat; Abschnitts-Design
> via Markieren → Rechtsklick „Design with AI" → Pin → `penwright_get_selection`).
> Leg einen Branch `design-on-selection` ab `main` an und fang mit **Stage 1** an."
