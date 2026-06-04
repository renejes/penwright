# Penwright — Handover für den nächsten Chat

> **Stand:** 2026-06-04, Ende der Session „Rebrand-Abschluss + Lizenz + Handbuch-Viewer".
> **Branch:** alles auf `main` gemerged **und gepusht** (letzter Commit `ecde226`).
> **Nächste Aufgabe:** das **„Design nach dem Schreiben"-Feature** (zwei Ebenen, Rechtsklick → Claude). Detaillierter, datei-genauer Plan liegt in **[design-on-selection-plan.md](design-on-selection-plan.md)**.
> Lies diesen Handover, dann `CLAUDE.md`, dann den Plan — danach loslegen.

---

## 0. TL;DR — wo wir stehen

- Produkt heißt **Penwright** (Rebrand vollständig durch — Identität, Logo, MCP, Protokolle, Skill, alle `penwright_*`-Tools, `.penwright/`-Projektordner inkl. Einmal-Migration). Kein „loses Ende" mehr außer zwei bewusst dokumentierten Holdouts (siehe `CLAUDE.md` → **Naming Convention**: Repo-/Ordnername `vswrite-desktop`, das ist der echte Git-Repo-Name).
- **Lizenzmodell (M8.7) ist fertig:** Einmalkauf **59 €**, lokaler **14-Tage-Trial** → danach `LicenseGate` (gesperrt), **ein** `pw_LIC…`-Key schaltet alles frei (inkl. MCP), Offline-Grace **7 Tage**, „Buy" geht direkt zum Polar-Checkout. Lizenz-UI ist **englisch**.
- **In-App-Handbuch:** `HandbookViewer.svelte` rendert das gebündelte Handbuch (`marked`, EN/DE), „Help → User Guide" + About-Button öffnen es. Kein externes Docs-Hosting mehr.
- **Kanonische Domain:** `penwright.online` (muss noch registriert werden). Support-Mail `feedback@penwright.online`.
- **Alles auf `main` gepusht.** Working Tree sauber.

**→ Jetzt bauen wir die nächste große Fähigkeit: Design nach dem Schreiben.**

---

## 1. Die nächste Aufgabe: „Design after writing" (zwei Ebenen)

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
  Editor lebt nur der leichte Pin-Auslöser (Rechtsklick „✨ Design with Claude").
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
- **Launch-Blocker:** DMG-Build + **Notarization** (Apple-Dev-Account vorhanden).
  Siehe `next-steps.md`. **Wichtig:** Auto-Updater ist **gestrichen** (Updates per
  Newsletter); `next-steps.md` beschreibt teils noch den alten electron-updater-Plan.
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
> via Markieren → Rechtsklick „Design with Claude" → Pin → `penwright_get_selection`).
> Leg einen Branch `design-on-selection` ab `main` an und fang mit **Stage 1** an."
