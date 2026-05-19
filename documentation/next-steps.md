# vswrite Desktop — Next Steps bis zum Release

> Audit-Datum: 2026-04-17 | Letzte Aktualisierung: 2026-05-16 | App-Version: **0.7.0** (package.json + Doku synchron)
>
> **Was hier drinsteht:** ausschliesslich noch offene Arbeit Richtung 1.0-Release. Was bereits erledigt ist — Security-Audit, Performance, MCP-Server (43 Tools + Auto-Discover-Wizard mit Bun-compiled Standalone-Binary), Skills (4: typst / vswrite / research / writing-style), Crash-Reporting, Dokumenten-Zoom (Editor + PDF, per-Projekt), Cheatsheet, Bestaetigungsdialoge — steht unter [project_status.md](project_status.md) im Session-Log und in den Feature-Tabellen. Separate Plan-Dokumente: [design-editor-plan.md](done/design-editor-plan.md) (Visual-Style-Editor + Design-MCP-Tools), [third-party-licensing.md](done/third-party-licensing.md) (Typst-Package-Bundling, Hybrid).

---

## 0. Stand

Die App ist inhaltlich release-ready fuer den akademischen Schreib-Use-Case. **Strategische Entscheidung 2026-05-16:** vswrite startet nicht nur als Akademik-Tool, sondern als Design-Tool fuer beliebige PDF-Outputs (Brochures, Magazines, Reports, CVs, Poster). Der Design-Editor + Typst-Package-Bundling werden noch vor v1.0 eingebaut — der Launch verschiebt sich dadurch um ~6 Wochen, ist es aber wert weil vswrite damit als breitestes positioniertes Tool startet.

Was zwischen heute und v1.0 noch fehlt:

1. **Typst-Package-Bundling-Setup** — Hybrid-Strategie aus [third-party-licensing.md](done/third-party-licensing.md); Bundle-Liste finalisieren, Audit-Script + Acknowledgments-Dialog (~4–6 Tage)
2. **Design-Editor + MCP-Tools** — Phasen A bis D aus [design-editor-plan.md](done/design-editor-plan.md) (~7 Wochen)
3. **Distribution einrichten** — Firebase-Hosting + electron-updater + DMG-Build & Notarization
4. **Handbuch-Online-Hosting** auf Netlify
5. **Finales QA** auf einer realen 100-Seiten-Thesis (nicht nur die acht Test-Chapters) **plus** Design-Use-Cases (Brochure, CV, Magazine-Spread)
6. **DOCX-Iteration** kontinuierlich — `#raw("…")` inline, `#outline()` als Word-TOC, weitere Typst-Konstrukte

Reihenfolge sinnvoll: **Bundling → Design-Editor → Distribution → Handbuch-Hosting → QA → DMG**.

---

## 1. Security-Audit — verbleibende Befunde (niedrige Prio)

> Phase 1 (Session 6) + Phase 2 (Session 8) sind abgeschlossen — Inventur in [project_status.md](project_status.md) unter „Security".

| Befund | Datei | Beschreibung |
|--------|-------|--------------|
| PostMessage ohne Origin-Check | `src/editor/lib/ipcAdapter.ts:40` | Nur relevant im VS Code Extension-Kontext, nicht in Electron |
| Settings ohne Schema-Validierung | `src/main/ipcHandlers.ts` | Geringe Angriffs-Flaeche, da nur interne IPC ueber Preload-Whitelist erreichbar |
| 4× `innerHTML`-Nutzung | `src/editor/lib/` | TipTap-interne Nutzung, nicht user-kontrolliert |

Optional vor 1.0; nicht launch-blocking.

---

## 2. Teilweise implementiert

| Feature | Status | Was fehlt |
|---------|--------|-----------|
| Find/Replace (Single-File) | Funktional | DOM-basiert statt TipTap-aware, kann bei Edge Cases Treffer uebersehen |
| i18n / Lokalisierung | Handbuch 2-sprachig | UI-Strings nicht extrahiert, App komplett auf Englisch |

---

## 3. Build & Distribution

### 3.1 Build-Scripts (aktueller Stand in package.json)

```bash
npm install                              # einmalig Dependencies installieren
npx electron-rebuild -f -w node-pty      # einmalig, nativ fuer Terminal bauen

npm run dev                              # Dev-Server + Hot-Reload
npm run build                            # electron-vite build (Main + Preload + Renderer)
npm run build:mcp                        # esbuild MCP Server -> dist/mcp/server.mjs
npm run package:mac                      # electron-builder --mac (DMG + ZIP)
npm run package:win                      # electron-builder --win (NSIS)
npm run package:linux                    # electron-builder --linux (AppImage + deb)
```

Alle `dev`/`build`/`start` Scripts prefixen `unset ELECTRON_RUN_AS_NODE` — noetig wenn aus VS Code/Cursor Terminal gestartet (Terminal.app/iTerm2 haben das Problem nicht).

### 3.2 electron-builder Config (liegt in `package.json` unter `"build"`)

Bereits konfiguriert:

- `appId: com.vswrite.desktop`, `productName: vswrite`
- macOS: `dmg`+`zip` Target, Hardened Runtime, Notarization ueber `electron-builder-notarize`, Identity `Developer ID Application: Rene Jesser (3LAHNFWNT3)`, Entitlements in `build/entitlements.mac.plist`
- Windows: NSIS-Installer
- Linux: AppImage + deb
- Extra-Resources: Typst-Binary aus `resources/bin/` wird pro Platform gebundelt, plus `documentation/vswrite-logo.svg`

Fuer den ersten Release fehlt noch der `"publish"`-Block — siehe 3.4.

### 3.3 Distribution: Firebase Hosting

Auslieferung ueber Firebase Hosting — globales CDN, kostenloses SSL, Deploy via `firebase deploy`. Standardmaessig `*.web.app`-URL, Custom Domain optional spaeter.

```
User besucht vswrite.com
  -> Klickt "Download"
  -> Laedt DMG von https://<vswrite-projekt-id>.web.app/
  -> Installiert App

App prueft bei jedem Start (nach 5s, dann alle 4h):
  -> Fragt https://<vswrite-projekt-id>.web.app/latest-mac.yml
  -> Vergleicht mit eigener Version
  -> Falls neuer: nativer "Update verfuegbar" Dialog -> Download + Install
```

**Firebase-Projekt einrichten (einmalig):**

```bash
npm install -g firebase-tools
firebase login

firebase init hosting
# - Use existing project: <vswrite-projekt-id>
# - Public directory: releases
# - Configure as SPA: No
# - GitHub Auto-Deploy: No
```

`firebase.json` (MIME-Types fuer Electron-Artefakte):

```json
{
  "hosting": {
    "public": "releases",
    "ignore": ["firebase.json", "**/.*"],
    "headers": [
      { "source": "**/*.dmg", "headers": [
        { "key": "Content-Type", "value": "application/x-apple-diskimage" },
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]},
      { "source": "**/*.zip", "headers": [
        { "key": "Content-Type", "value": "application/zip" },
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]},
      { "source": "**/*.blockmap", "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]},
      { "source": "**/latest*.yml", "headers": [
        { "key": "Content-Type", "value": "text/yaml" },
        { "key": "Cache-Control", "value": "no-cache" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]}
    ]
  }
}
```

`.firebaserc` (committen):

```json
{ "projects": { "default": "<vswrite-projekt-id>" } }
```

`.gitignore` ergaenzen (Binaries nicht ins Repo, Manifest schon):

```
.firebase/
releases/*.dmg
releases/*.zip
releases/*.blockmap
releases/*.exe
releases/*.AppImage
```

### 3.4 Auto-Updater (electron-updater)

```bash
npm install electron-updater
```

`package.json` -> `build`-Block ergaenzen:

```json
"publish": {
  "provider": "generic",
  "url": "https://<vswrite-projekt-id>.web.app"
}
```

electron-builder schreibt dann automatisch `latest-mac.yml` / `latest.yml` / `latest-linux.yml` mit SHA512 beim Build.

In `src/main/index.ts` einbinden:

```typescript
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  // ... bestehender Code ...
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});
```

### 3.5 macOS Release-Workflow

**Voraussetzungen:**

```bash
export APPLE_ID="deine@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="3LAHNFWNT3"
```

**Release bauen + ausliefern:**

```bash
# 1. Version hochzaehlen in package.json

# 2. Clean-Build + Packaging
npm run build && npm run build:mcp && npm run package:mac

# 3. Output liegt in release/
#    vswrite-X.Y.Z.dmg              <- User-Download
#    vswrite-X.Y.Z.dmg.blockmap     <- Differential-Update-Map
#    vswrite-X.Y.Z-mac.zip          <- Update-Bundle fuer Auto-Updater
#    vswrite-X.Y.Z-mac.zip.blockmap
#    latest-mac.yml                  <- Updater-Manifest (Version + URL + SHA512)

# 4. Artefakte in releases/ kopieren + deployen
cp release/vswrite-*.dmg \
   release/vswrite-*-mac.zip \
   release/*.blockmap \
   release/latest-mac.yml \
   releases/

firebase deploy --only hosting

# 5. Verifizieren
curl -s https://<vswrite-projekt-id>.web.app/latest-mac.yml | head -5
xcrun stapler validate release/vswrite-*.dmg

# 6. Git-Tag
git add package.json releases/latest-mac.yml
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

### 3.6 Windows & Linux

```bash
npm run package:win        # release/vswrite-X.Y.Z-setup.exe + latest.yml
npm run package:linux      # release/vswrite-X.Y.Z.AppImage + latest-linux.yml
```

Windows: Code-Signing optional — ohne Signing zeigt SmartScreen eine Warnung. Fuer signierte Builds EV-Zertifikat (~200 EUR/Jahr) konfigurieren.

### 3.7 Custom Domain (optional, spaeter)

Firebase Console -> Hosting -> Add custom domain -> `releases.vswrite.com` -> DNS-Records beim Provider. Danach `build.publish.url` in package.json auf neue Domain umstellen. **Wichtig:** Bestehende User behalten den alten `*.web.app`-Endpoint im Updater bis zum naechsten Update — beide Endpoints parallel laufen lassen, bis genug migrierte Versionen draussen sind.

---

## 4. Handbuch-Hosting

Die Handbuecher liegen im Repo unter [documentation/handbuch.md](handbuch.md) (Deutsch) und [documentation/handbook.md](handbook.md) (Englisch). Das sind die **Quellen der Wahrheit**.

### 4.1 Online-Hosting (Pflicht vor Launch)

Die Handbuecher werden nach `vswrite.netlify.app` deployed:

- Deutsch: `https://vswrite.netlify.app/de/docs`
- Englisch: `https://vswrite.netlify.app/en/docs`

**Sync-Strategie:** Netlify-Build liest direkt aus `documentation/handbuch.md` und `documentation/handbook.md` im Haupt-Repo (via Netlify-CMS oder `netlify.toml` Build-Command, das die Markdown-Dateien in die Statische-Site-Generierung einbindet). Alternativ ein Docs-Repo `vswrite-docs`, das diese Dateien per Submodule/Pull einzieht.

Vorteil: eine Quelle, immer konsistent mit der App-Version die draussen ist.

### 4.2 In-App-Zugriff (bereits implementiert)

Drei Einstiegspunkte zeigen auf die online gehostete Version:

1. **StartScreen** -> "Open User Guide"-Link
2. **Help-Menue** -> "User Guide" + "Report Issue"
3. **About-Dialog** -> "User Guide"-Button + "Website"-Button

Alle nutzen `shell.openExternal` via `app:openExternal` IPC (rejected alles ausser `https://`).

### 4.3 Offline-Bundling (optional, fuer v1.1)

Falls Offline-Zugriff gewuenscht:

```json
// package.json -> build.extraResources
{
  "from": "documentation/handbuch.md",
  "to": "docs/handbuch.md"
},
{
  "from": "documentation/handbook.md",
  "to": "docs/handbook.md"
}
```

Im Renderer dann ein simpler Markdown-Viewer-Dialog (oder einfach `shell.openPath` auf die gebundelte Datei, welche dann im System-Default-Viewer aufgeht). Strategie: **primaer online**, bei Netzwerk-Fehler Fallback auf bundled.

### 4.4 Sprachwahl

Der In-App-Link zeigt aktuell statisch auf `/de/docs`. Sobald die UI-i18n eingefuehrt wird, soll die Sprachwahl an die UI-Sprache gekoppelt werden (User-Locale oder expliziter Toggle in Settings).

---

## 5. Release-Checkliste

### Phase 3.5: Design-Editor + Bundled Packages (pre-1.0 — Sessions 20–22, **komplett**)

> Spezifikation und Hintergrund: archiviert unter [done/design-editor-plan.md](done/design-editor-plan.md) und [done/third-party-licensing.md](done/third-party-licensing.md). Was unten als `[x]` markiert ist, wurde gebaut.

**Vorgelagert: Typst-Package-Bundling** (Session 20, 2026-05-17 — abgeschlossen)

- [x] Bundle-Liste finalisiert: 13 user-facing + 11 transitive Packages (`wrap-it`, `meander`, `cetz`, `fletcher`, `lilaq`, `drafting`, `droplet`, `codly`, `showybox`, `gentle-clues`, `glossarium`, `subpar`, `lovelace` + deren Deps)
- [x] LICENSE-Check pro Package, dokumentiert in [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md) (auto-generiert per Audit-Script)
- [x] `resources/typst-packages/` Struktur, in `package.json` `extraResources` aufgenommen
- [x] `scripts/fetch-typst-packages.mjs` + `scripts/audit-bundled-deps.mjs` — failed bei Deny-List-Hit
- [x] Main-Process + MCP-Server: `--package-path` via `buildTypstCompileArgs()` und `TYPST_PACKAGE_PATH` env-Var (Wizard schreibt sie in Claude-Config)
- [x] `AcknowledgmentsDialog.svelte` + Hook im About-Dialog
- [x] TYPST_SKILL + VSWRITE_SKILL ergaenzt um Bundled-Packages-Sektion mit Code-Beispielen
- [ ] Bundle-Fonts (Inter, IBM Plex, JetBrains Mono, Crimson Pro, Libertinus, Spectral — alle OFL) — kommt in Phase B des [Design-Editors](done/design-editor-plan.md)
- [ ] **Einmalige Rechtsberatung** (DACH-Anwalt mit OSS-Erfahrung, ~30–60 min) — wegen cetz LGPL-3.0, vor dem ersten kommerziellen Release

**Phase A — Style Variables (Datenmodell + Settings-Dialog-Erweiterung)** (Session 21, 2026-05-17 — abgeschlossen)

- [x] `<project>/.vswrite/style.json` Schema-Implementierung in `persistenceManager.ts` (`getProjectStyle` / `saveProjectStyle` / `hasProjectStyle`)
- [x] `src/shared/styleParser.ts` — JSON → Typst-Preamble Generator (`generateStyleTypst`), `ensureStyleInclude`, `detectStylePreambleConflicts` für Migrations-Warnung
- [x] `SettingsPanel.svelte` Erweiterung: Tab-Bar (Style/Document), Color-Picker (5 semantische Slots: primary/accent/text/background/muted), Font-Dropdowns (body/heading/code), Scale-Inputs (base/leading), Layout-Picker (paper/margin/columns), Heading-Tuning (H1/H2 Size/Weight/Color-Slot/Margin-Top)
- [x] Live-Preview-Pipeline: `style:save` IPC schreibt `style.typ` + sichert `#include "style.typ"` im Root-File + ruft Compiler — kein zusätzliches Debounce nötig, weil Apply-Klick der Trigger ist
- [x] End-to-End-Verifikation: Typst-CLI kompiliert den generierten `style.typ` ohne Warnungen; svelte-check + electron-vite build clean (4 vor-existente Fehler ebenfalls mitbehoben)

**Phase B — Visual Style Editor (eigener Sidebar-Tab)** (Sessions 21–22, 2026-05-17 — Foundation abgeschlossen)

- [x] Sidebar-Tab "Design" angelegt (DesignPanel.svelte), `panelState.sidebarTab` Union erweitert
- [x] Color-Palette-Tool: 5 Slots mit @melloware/coloris-Picker, 8 kuratierte Presets, debouncedem `style:save`
- [x] Font-Browser: 7 OFL-Schriften gebündelt (Inter, IBM Plex Sans/Serif/Mono, JetBrains Mono, Crimson Pro, Spectral), Cards mit Live-Preview via `vswrite-font://` Protokoll + @font-face, Buttons zum Mapping auf Body/Heading/Code
- [x] Bundling-Pipeline: `scripts/fetch-typst-fonts.mjs`, `scripts/audit-bundled-deps.mjs` erweitert um Font-OFL-Check, `--font-path` in `buildTypstCompileArgs()` und MCP-Server `typstCompileArgs()`, `TYPST_FONT_PATH` Env-Var via Setup-Wizard, `AcknowledgmentsDialog.svelte` zeigt Fonts neben Packages
- [x] Schema-Erweiterung: `custom.preamble` Escape-Hatch (CodeMirror-Editor im Design-Panel) + Round-Trip via `extractCustomBlock()`. Layout (Numbering / Header / Footer / Fill), Scale (paragraphSpacing / firstLineIndent), Headings.numbering ins style.json migriert. DesignPanel um Scale / Layout / Headings Sections erweitert
- [x] Konsolidierung: Document Settings auf `lang` + `bibliographyStyle` reduziert (Style-Tab raus), QuickSettings schreibt jetzt in style.json, Konflikt-Banner entfernt, Legacy "Style Templates"-Submenu aus dem Menü gezogen (MCP-Tools `vswrite_list_styles` / `vswrite_apply_style` bleiben als Legacy-Path bis das neue Theme-Format steht)

**Phase B Round 2 (Session 22 — komplett)**
- [x] Heading-Style-Designer mit H1–H6 + collapsible Cards mit Live-Preview-Lines
- [x] Special-Elements-Editor: Blockquote / Code-Block / Figure / Table. Callouts bewusst draußen — via `gentle-clues` + Custom-Code-Block lösbar
- [x] 6 Theme-Presets im neuen ProjectStyle-Format (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis). Ersetzen die 7 alten Style-Templates
- [x] 6 Layout-Presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster) inkl. `layout.orientation` Schema-Erweiterung

**Phase C — Design-MCP-Tools** (Session 22 — komplett)

- [x] `vswrite_get_style` / `vswrite_update_style` (deep-merge mit Sanitizer)
- [x] `vswrite_list_fonts` (gebündelte OFL-Fonts mit family / category / description)
- [x] `vswrite_apply_palette` (presetId ODER per-slot hex overrides, kombinierbar)
- [x] `vswrite_list_layouts` / `vswrite_apply_layout` — Layout-Swaps via MCP
- [x] `vswrite_apply_style` migriert auf THEME_PRESETS
- [x] `vswrite_list_design_elements` / `vswrite_insert_design_element` mit Library (Banner / Sidebar / Pull-Quote / Callout / Hero / Divider) — Anchor-basiert wie `add_image`
- [x] `vswrite_generate_layout` (NL-Intent → Theme + Layout + optionaler Hero)
- [x] Design-Element-Library in `src/shared/designElements.ts`
- [x] MCP_SETUP_VERSION bumped 0.5.0 → 0.6.0

**Phase D — Design-Skill** (Session 22 — komplett)

- [x] `DESIGN_SKILL` in `skillTemplates.ts` — Color-Theory, Typografie-Pairing, Heading-Hierarchy, Layout-Patterns, "Modern Looks 2026", WCAG-Kontrast-Regeln, Anti-Patterns, Workflow-Rezept
- [x] In `ensureClaudeSkills` registriert (jetzt 5 Skills)
- [x] MCP-Prompt `design-conventions` eingebunden

### Phase 3.6: Magazine-Polish-Pack (Session 23, 2026-05-19 — **komplett**)

> Plan: [done/magazine-polish-plan.md](done/magazine-polish-plan.md). Audience zu ~100% AI (Claude Desktop via MCP) — die Bausteine sind so geschnitten, dass eine Sprach-KI ganze Magazin-Seiten daraus komponieren kann ohne dass der User hand-typesetten muss.

- [x] **9 neue Design-Elemente:** `drop-cap`, `divider-asterisks`, `divider-ornament`, `pull-quote-display`, `pull-quote-block`, `article-opener`, `section-opener`, `gallery-2up`, `gallery-3up`, `magazine-cover` (15 total, vorher 6)
- [x] **7. Layout-Preset `magazine-editorial`** — A4 portrait, 2 cols, 10.5pt, per-page Header-Strip mit Issue-Label + Accent-Rule
- [x] **Cross-Cutting Generator-Erweiterung:** `style.typ` exportiert `style-fonts` (body/heading/code) als Modul-level Dict; Design-Elemente referenzieren `style-fonts.heading` statt Font-Namen ins Template zu backen → Theme-Swap aktualisiert Typografie automatisch
- [x] **Photographer-Credit Schema:** `StyleFigure.creditSeparator` + `creditLabel` (default `" — "` + `"Photo: "`); Generator emittiert `figure-caption-credit(caption, credit)` Helper neben `style-colors` / `style-fonts`; DesignPanel Figure-Card um die zwei Inputs erweitert
- [x] **Magazine-Cover per-page-margin-override** via Typsts `#page(margin: 0pt)` für eine Seite — kleinster Schritt Richtung Full-Bleed ohne Schema-Arbeit
- [x] **Sample-Showcase erweitert:** `resources/sample-project/chapters/07-design-showcase.typ` zeigt 7 der 9 neuen Elemente live (Section-Opener + Magazine-Cover beschrieben, nicht inline weil sie Pagebreaks setzen)
- [x] **Skill-Updates:** `DESIGN_SKILL` Anti-Patterns um Drop-Cap-Häufigkeit + Opener-Doppelung + Section-Opener-Chaining ergänzt
- [x] **MCP-Binary-Rebuild:** `MCP_SETUP_VERSION` 0.6.0 → 0.7.0, Bun-Binary neu für aarch64 + x86_64 darwin

**Bewusst out of scope** (für eine spätere Iteration aufgehoben, falls Bedarf):
- [ ] Full-Bleed-Images mit Per-Section-Page-Margin-Overrides (Schema-Arbeit, ~1 Woche)
- [ ] Marginalia / Side-Notes (drafting-Package-Wrapper)
- [ ] Mosaik-Grids (3+ asymmetrische Bilder)
- [ ] Initialen-Heading-Differenzierung (erste Seite eines Kapitels vs. Folgeseiten)

### Phase 4: Distribution

- [ ] Firebase-Projekt in Console anlegen (Region `europe-west3`)
- [ ] `firebase login` + `firebase init hosting` (public dir: `releases`)
- [ ] `firebase.json` + `.firebaserc` committen
- [ ] `.gitignore` ergaenzen (Binaries ignorieren, Manifest committen)
- [ ] `electron-updater` installieren + in `src/main/index.ts` einbinden
- [ ] `publish`-Config in `package.json` hinzufuegen
- [ ] Handbuch-Hosting auf Netlify eingerichtet (de/en)
- [x] „Open Sample Project"-Logik im StartScreen — Sample lebt unter `resources/sample-project/`, wird via `extraResources` mitgebundelt; `project:openSample` IPC kopiert nach `~/Documents/vswrite-sample-thesis` (mit Suffix-Counter falls vorhanden), `git init` + initialer Version, oeffnet als Projekt
- [x] MCP-Binary-Build in den Package-Workflow eingebaut — `package:mac` ruft jetzt `build:mcp-binary:all` (beide Mac-Archs) vorab; `afterPack`-Hook re-signed die Binary mit JIT-Entitlements aus `build/entitlements.mac.mcp.plist`
- [ ] **macOS DMG bauen, signieren, notarisieren** — wichtigster offener Punkt. Identity (`Developer ID Application: Rene Jesser`) + Notarize-Plugin (`electron-builder-notarize`) sind in `package.json` verkabelt; bisher nie real durchlaufen. Bekannte Stolperkanten: Hardened-Runtime fuer das gebundlete `typst-*`-Binary, JIT-Entitlements fuer das Bun-compiled `vswrite-mcp-<arch>` (via `afterPack-sign-mcp.mjs`), Notarize-Wartezeiten von Apple
- [ ] Auto-Discover-Wizard auf notarisiertem DMG E2E testen — `mcp:setup` muss aus `Contents/Resources/mcp/bin/` korrekt nach `~/Library/Application Support/vswrite/mcp-server/` kopieren und chmod+x setzen, Claude Desktop muss die kopierte signierte Binary spawnen koennen
- [ ] Artefakte deployen
- [ ] Download-Link auf vswrite.com einbinden
- [ ] Auto-Updater End-to-End testen (alte Version installieren -> Update)

### Phase 5: QA & Release

#### Core-Features

- [ ] Alle Features auf macOS manuell testen
- [ ] Multi-File-Projekte, Includes, Zitationen
- [ ] File-Locking, externe Edits, Crash Recovery
- [ ] Undo AI Edit (Terminal-Edit -> Undo)
- [ ] **Crash-Reporting E2E:** kuenstlichen Crash provozieren (`throw new Error('test')` in Renderer + Main), Boot-Dialog erscheint mit korrektem Inhalt, Mail-Vorbereitung oeffnet `feedback@vswrite.com` mit Body
- [ ] **DOCX-Export auf realer 100-Seiten-Thesis** — in Word / Pages / LibreOffice oeffnen, TOC-Refresh, Heading-Numbering-Live-Test durch Umordnen
- [ ] Auto-Updater-E2E-Test
- [ ] Performance auf 100+ Seiten (Tippen, Scrollen im Preview, Recompile)
- [ ] Symlink-Angriffs-Test: Symlink `/project/x.typ -> /etc/passwd` setzen, sicherstellen dass Open/Write rejecten
- [ ] Lizenz-Tampering-Test: electron-store JSON editieren, Pro vortaeuschen, App sollte zurueck auf "Unlicensed" fallen
- [ ] DMG auf sauberem Mac (ohne Developer Tools) testen — Gatekeeper
- [ ] Git-Tag `v0.7.0` erstellen

#### Writer-Features (Sessions 11–15)

> Alles auf `/Users/renejesser/Desktop/test_thesis` durchziehen — das Projekt enthaelt Footnotes, Citations, Comments, Cross-References (Figuren / Tabellen / Equations / Section-Labels).

**Find in Project:**
- [ ] `Cmd+Shift+F` oeffnet das Slide-In-Panel
- [ ] Suche nach Wort liefert gruppierte Treffer pro Datei
- [ ] Optionen: case sensitive / whole word / regex / `.bib` einbeziehen verhalten sich jeweils richtig
- [ ] Klick auf einen Treffer scrollt im Editor zur Stelle
- [ ] Replace-All ueber alle Dateien funktioniert + Confirm-Dialog erscheint vorher

**Footnote-UI:**
- [ ] Toolbar-Button „Fn" inserts leere Fussnote, Popup oeffnet automatisch
- [ ] `/Footnote` slash-command verhaelt sich gleich
- [ ] Klick auf bestehende Fussnote oeffnet sie zum Editieren; `Esc` / `Cmd+Enter` schliesst
- [ ] Round-Trip: Fussnote schreiben, Datei reload — Inhalt bleibt erhalten

**Comments / Annotations:**
- [ ] Selektion + Toolbar „Cm" / Menue `Edit -> Add Comment` / `Cmd+Alt+M` legen Kommentar an
- [ ] **Highlights erscheinen sofort beim File-Open** (frueher: nur nach Klick auf Comments-Tab — Bug behoben)
- [ ] Klick auf Highlight scrollt im Side-Panel zum Eintrag
- [ ] Anchor-Klick im Side-Panel scrollt im Editor zur Stelle (mit Flash)
- [ ] Comments wandern als sichtbare `comments/<id>.md` ins Projekt
- [ ] Comments **erscheinen NICHT** im PDF/DOCX-Output
- [ ] Resolved-Toggle blendet Highlight aus, Eintrag bleibt im Panel
- [ ] Loeschen entfernt Datei + Highlight

**Reading Mode:**
- [ ] `Cmd+Alt+R` toggelt Buchsatz-Typografie
- [ ] Code-, Math- und Raw-Typst-Bloecke bleiben monospace
- [ ] Editing bleibt aktiv (Tippfehler direkt korrigierbar)
- [ ] View-Menue + Toolbar-`𝓡`-Toggle synchron

**Backlinks:**
- [ ] Hover ueber ein Heading im Outline zeigt `↪`-Button → oeffnet Project-Search mit dem Heading-Text
- [ ] Right-Click auf Citation-Badge oeffnet Project-Search mit `@<citekey>` (whole-word)
- [ ] Beide Trigger zeigen alle Vorkommen ueber alle Kapitel

**Outline drag-to-reorder:**
- [ ] Heading-Row im Outline ist drag-bar
- [ ] Drop ueber/unter einer anderen Row bewegt den ganzen Block (Heading + zugehoerige Inhalte bis zum naechsten gleich-/hoeherrangigen Heading)
- [ ] Drop-Linie erscheint als blaue 2-px-Anzeige
- [ ] Drop-on-self / drop-direkt-darunter sind No-Ops
- [ ] Verschachtelte H2 unter H1 wandern mit
- [ ] Source-File reflektiert die Reihenfolge nach Save

**Inline Source Preview:**
- [ ] 350-ms-Hover ueber `@chen2021codex` oeffnet Karte mit Autor / Jahr / Titel
- [ ] „PDF oeffnen"-Button erscheint, wenn `sources/<citekey>*.pdf` existiert (test_thesis hat das fuer alle 5 Citations)
- [ ] Karte verschwindet **nicht** wenn Maus von Badge zu Karte wandert (250-ms-Grace)
- [ ] Klick auf „PDF oeffnen" oeffnet das PDF als Tab im PdfFileViewer

**Cross-References:**
- [ ] `/Reference` slash-command oeffnet den Picker
- [ ] `Edit -> Insert Reference…` Menue oeffnet ihn auch
- [ ] `Cmd+Alt+L` oeffnet ihn ebenfalls
- [ ] Picker zeigt alle Labels gruppiert nach Typ (Abbildung / Tabelle / Gleichung / Ueberschrift / Andere) mit Caption-Vorschau
- [ ] Filter-Input filtert ueber Label, Caption und Pfad
- [ ] Type-Tabs (Alle / Abb. / Tab. / Gl. / § / Andere) filtern korrekt
- [ ] Tastatur: `↑↓` navigiert, `Enter` fuegt ein, `Esc` schliesst
- [ ] Eingefuegte Pille (orange `↳ label`) ist visuell vom blauen `@`-Citation-Badge unterscheidbar
- [ ] Round-Trip: Reference einfuegen, save, reload — kommt als Reference-Node (nicht als Citation) zurueck
- [ ] Cross-File-Refs (Discussion -> @sec:results / @fig:scaling / @tbl:params / @eq:attention) resolven im PDF zu „Section 4 / Figure 1 / Table 1 / Equation (1)"
- [ ] Disambiguierungs-Edge-Case: ein Citekey wie `chen2021codex` (ohne Doppelpunkt, ohne bekanntes Praefix) bleibt Citation; ein Label wie `fig:scaling` wird Reference
- [ ] Picker zeigt korrekte Caption-Vorschau (test_thesis: „Parameter counts and architectural family…", „Parameter scaling of encoder vs. decoder…")

#### MCP-Server (Session 16)

> Smoke-Tests am laufenden MCP-Prozess via Claude Desktop oder Cowork. Pro-Lizenz noetig.

- [ ] **Versionen:** `vswrite_save_version` mit Message → erscheint im ProjectPanel-Verlauf; `vswrite_list_versions` liefert sie zurueck; `vswrite_show_version` zeigt Diff; `vswrite_restore_version` rollt zurueck (vorher Test-Version saven)
- [ ] **Comments:** `vswrite_add_comment` mit anker-basiertem Insert → erscheint im CommentsPanel als gelbes Highlight; `vswrite_list_comments` filtert; `vswrite_resolve_comment` blendet aus; `vswrite_delete_comment` entfernt die `.md`
- [ ] **Cross-Refs:** `vswrite_list_labels` listet alle `<label>`s aus test_thesis; `vswrite_insert_reference` mit existierendem Label klappt, mit nicht-existierendem schlaegt aehnliche Labels vor
- [ ] **Footnotes:** `vswrite_add_footnote` mit `afterText` und Body → `#footnote[…]` an der Stelle; Klammer-Balance-Check rejected unbalanced Body
- [ ] **Search/Replace:** `vswrite_search_project` mit `wholeWord: true` und Query `"@chen2021codex"` findet alle Backlinks; `vswrite_replace_in_project` mit Citekey-Rename funktioniert (vorher save_version!)
- [ ] **Source-Lookup:** `vswrite_find_source_for_citation({ citekey: "chen2021codex" })` liefert `sources/chen2021codex.pdf`
- [ ] **Export-Strict:** `vswrite_export_pdf({ outputPath: "exports/test.pdf" })` erstellt `exports/`-Ordner falls fehlt; `outputPath: "/tmp/foo.pdf"` (ausserhalb Projekt) wird abgelehnt
- [ ] **DOCX:** `vswrite_export_docx({ outputPath: "exports/test.docx" })` produziert ein in Word oeffenbares Dokument mit Multilevel-Numbering
- [ ] **Markdown-Import:** `vswrite_import_markdown({ markdown: "# Test\n…", destPath: "chapters/06-test.typ" })` schreibt korrekt; `srcPath` mit absolutem Pfad ausserhalb des Projekts funktioniert (read-only)
- [ ] **Add-Image:** `vswrite_add_image({ srcPath: "/path/to/chart.png", caption: "X", label: "fig:test", file: "chapters/01.typ", afterText: "..." })` kopiert Asset, baut Figure-Snippet, fuegt nach Anker ein, eine Round-Trip statt drei
- [ ] **Skill-Prompts:** `prompts/get` lieferte alle vier Skills (`typst-reference`, `vswrite-conventions`, `research-workflow`, `writing-style`) aus den deployed `.claude/skills/<name>/SKILL.md`

#### Dokument-Zoom (Session 17)

- [ ] Editor-Zoom: Status-Bar-Prozent (`100 %`) klicken → Slider-Popover; Slider verschieben skaliert den Editor reaktiv
- [ ] `Cmd+Alt+=` / `Cmd+Alt+-` / `Cmd+Alt+0` funktionieren als Editor-Zoom-Shortcuts (View-Menue „Editor Zoom"-Submenu)
- [ ] PDF-Zoom: `−` / `+` im Preview-Header und in geoeffneten PDF-Tabs skalieren das PDF crisp (pdfjs-Viewport-Scale, kein verwaschenes Bitmap)
- [ ] `Cmd+Shift+=` / `Cmd+Shift+-` / `Cmd+Shift+0` als PDF-Zoom-Shortcuts (View-Menue „Preview Zoom"-Submenu)
- [ ] Scrollbars sichtbar auch bei Zoom > 100 % (horizontal + vertikal)
- [ ] Zoom-Levels werden in `<project>/.vswrite/preferences.json` persistiert — Projekt schliessen + wieder oeffnen restored die Werte
- [ ] Browser-Zoom (`Cmd+=` etc.) bleibt erhalten unter „Zoom Window In/Out" — separat von Dokument-Zoom

#### MCP Auto-Discover-Wizard (Session 18)

- [ ] Erster Boot mit aktivierter Pro-Lizenz: Wizard erscheint ~2 s nach Start
- [ ] „Spaeter"-Button stasht die Version — Wizard kommt nicht beim naechsten Boot wieder
- [ ] „Mit Claude Desktop verbinden…" im Hilfe-Menue triggert den Wizard manuell
- [ ] Klick auf „Jetzt verbinden": Binary wird nach `~/Library/Application Support/vswrite/mcp-server/vswrite-mcp` kopiert, `chmod 755`, in `claude_desktop_config.json` eingetragen
- [ ] Andere bestehende `mcpServers`-Eintraege bleiben unangetastet, Backup `.claude_desktop_config.vswrite-bak.<ts>.json` wird angelegt
- [ ] Ohne Pro-Lizenz: Wizard zeigt verstaendliche Fehlermeldung und schreibt keine Config
- [ ] Ohne Claude Desktop: Wizard erkennt das und bietet Download-Link, keine Config-Aenderung
- [ ] Idempotenz: Wizard zweimal aufrufen → kein Duplikat-Eintrag, `alreadyConfigured: true`
- [ ] **End-to-End** (auf notarisiertem DMG): nach Wizard-Run Claude Desktop neu starten, vswrite-Tools sind sichtbar, MCP-Server laeuft weiter wenn vswrite gequittet wird

### Phase 6: Post-Release / Nice-to-Have

- [ ] Linux AppImage + Windows Installer deployen (je nach Nachfrage)
- [ ] Dark Mode
- [ ] Deutsche UI-Uebersetzung (UI-Strings extrahieren, i18n-Framework)
- [ ] „Publish to GitHub"-Button (aktuell nur via Terminal + `gh` CLI)
- [ ] Bundeled Offline-Handbuch (v1.1)
- [ ] Vollstaendiges WCAG 2.1 AA Accessibility-Audit
- [ ] Editor-interne Virtualisierung (TipTap rendert aktuell alle DOM-Nodes — Obergrenze liegt bei ~200 Seiten pro Einzel-Datei)
- [ ] Linux `.rpm`-Paket (fuer Fedora/RHEL)
- [ ] Offline-Cache fuer Zotero-Bibliographien
- [ ] Worker-basierter Serializer (nach inkrementellem Cache nicht mehr noetig, kann kommen falls 100 ms+ anfaellt)
- [ ] **MCP Phase 5:** Resources-API + Electron-IPC-Bridge zum laufenden App-Window — externe Agents koennen das laufende Editor-State live abfragen statt nur via Disk
