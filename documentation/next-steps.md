# vswrite Desktop — Next Steps bis zum Release

> Audit-Datum: 2026-04-17 | App-Version (Doku): 0.7.0 (Pre-Release) | package.json: 0.1.0 — vor dem ersten Release auf 0.7.0 hochzaehlen.

---

## 0. Zusammenfassung

Die App ist inhaltlich release-ready: Security ist mehrfach gehaertet (zuletzt gegen Symlink-Bypass), grosse Dokumente sind performant dank Preview-Virtualisierung und inkrementellem Serializer, DOCX-Export nutzt echte Word-Styles mit Live-Heading-Numbering, und ein About-Dialog zeigt Version + Lizenz + Diagnostics.

Offen fuer den tatsaechlichen Launch sind: **Distribution einrichten** (Firebase Hosting + Auto-Updater E2E), **Crash-Telemetrie** und **finales QA auf echter 100-Seiten-Thesis**. Reihenfolge vor Release: Sentry -> Updater End-to-End -> QA -> DMG.

---

## 1. Security-Audit: Befunde und Status

> Phase 1 (Session 6) + Phase 2 (Session 8) abgeschlossen.

### 1.1 Behoben (Session 6 + 8)

| Schweregrad | Befund | Fix |
|-------------|--------|-----|
| KRITISCH | Path Traversal in `textfile:read/write/readBinary` | `isPathWithin()` Validierung (Session 6), zusaetzlich realpath-Aufloesung gegen Symlinks (Session 8) |
| KRITISCH | Command Injection in PDF-Export (`execSync`) | `execFileSync` mit Array-Argumenten |
| KRITISCH | Symlink-Bypass in `isPathWithinProject` / `isPathWithinGitDir` / Asset-Protocol | Neues Modul [src/main/pathSecurity.ts](src/main/pathSecurity.ts) mit `fs.realpathSync` + Fallback fuer noch-nicht-existierende Pfade |
| KRITISCH | MCP Server: keine Pfad-Validierung in `read_file`/`write_file`/`open_file`/`compile`/`add_citation` | `resolveInsideProject()` in [src/mcp/server.ts](src/mcp/server.ts) — jeder Pfad wird gegen Projekt-Realpath gecheckt |
| HOCH | Lizenz-Daten als Plaintext in electron-store | Verschluesselt via Electrons `safeStorage` (OS Keychain / DPAPI / libsecret) — Tampering fuehrt zu Decrypt-Fail und gilt als "keine Lizenz" |
| HOCH | Verwundbare `@xmldom/xmldom` | `npm audit fix` → 0 vulnerabilities |
| HOCH | SVG Injection via `{@html}` im Preview | DOMPurify-Sanitisierung mit SVG-Profil |
| HOCH | `sandbox: false` | `sandbox: true` gesetzt |
| HOCH | Protocol-Handler ohne Pfad-Validierung | Pfade gegen Projektverzeichnis validiert, jetzt symlink-aware |
| MITTEL | Fehlende CSP-Header | Content Security Policy in `index.html` |
| MITTEL | Terminal-Respawn ohne Limit | Max 5 Respawns |
| MITTEL | Git-Pfade nicht validiert | `isPathWithinGitDir()` fuer stage/unstage, jetzt symlink-aware |
| MITTEL | `filetree:open` ohne Pfad-Check | `isPathWithinProject()` hinzugefuegt |
| NIEDRIG | `shell.openExternal` ohne Protokoll-Check fuer Renderer-initiierte Links | `app:openExternal` IPC akzeptiert nur `https://` (About-Dialog-Links) |

### 1.2 Verbleibend (niedrige Prioritaet)

| Befund | Datei | Beschreibung |
|--------|-------|--------------|
| PostMessage ohne Origin-Check | `src/editor/lib/ipcAdapter.ts:40` | Nur relevant im VS Code Extension-Kontext, nicht in Electron |
| Settings ohne Schema-Validierung | `src/main/ipcHandlers.ts` | Geringe Angriffs-Flaeche, da nur interne IPC ueber Preload-Whitelist erreichbar |
| 4x `innerHTML`-Nutzung | `src/editor/lib/` | TipTap-interne Nutzung, nicht user-kontrolliert |

### 1.3 Positive Sicherheitsmassnahmen

- `contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`
- Preload-Whitelist — nur definierte IPC-Channels erreichbar
- `will-navigate` blockiert, `setWindowOpenHandler` verweigert Popups
- DOMPurify fuer SVG-Sanitisierung
- CSP-Header (script-src 'self', img-src 'self' data: vswrite-asset:)
- Realpath-basierte Pfad-Validierung ueberall wo User-Pfade eingehen
- Lizenz-Blob via OS-Keychain verschluesselt
- File-Lock-Mechanismus fuer Shared Folders
- Keine Secrets in der Git-History (gitleaks: sauber)

---

## 2. Feature-Review: Stand der Arbeit

### 2.1 Erledigt in Session 6

- [x] **Crash Recovery** — Backup-Snapshots alle 30s in `~/.vswrite/backups/`, Recovery-Dialog beim Oeffnen
- [x] **Undo AI Edit** — Snapshot-Ring-Buffer (max 20), stellt Zustand vor externer Datei-Aenderung wieder her
- [x] **Accessibility** — ARIA-Labels auf Toolbar (25+ Buttons), Sidebar, Tabs, Status-Bar, Keyboard-Handler
- [x] **Export Loading-State** — Pulsierende Status-Anzeige "Exporting PDF/DOCX..." mit `aria-live`
- [x] **CommandHub Redesign** — 7 fokussierte Gruppen statt 5 ueberladene (40 -> 22 Items), Format-Redundanz entfernt

### 2.2 Erledigt in Session 7

- [x] Typst CLI gebundelt: Binary in `resources/bin/` mitgeliefert, User muss Typst nicht installieren
- [x] `typstPath.ts`: Resolver findet gebundelte Binary in Production, System-PATH in Development
- [x] File Watcher Fix: Sidebar-Flackern bei eigenem Auto-Save behoben (Timestamp-Guard)
- [x] Tauri-Migration evaluiert und verworfen

### 2.3 Erledigt in Session 8

**Security-Haertung:**
- [x] Neues Modul `src/main/pathSecurity.ts` mit realpath-basiertem `isPathWithin()` — schliesst Symlink-Escape
- [x] Pfad-Validierung in allen MCP-Tools (`open_file`, `read_file`, `write_file`, `compile`, `add_citation`) ueber `resolveInsideProject()`
- [x] Lizenz-Daten via `safeStorage` OS-verschluesselt — Manipulation des Tiers ueber electron-store-JSON unmoeglich
- [x] `app:openExternal` IPC nur fuer `https://` URLs

**Performance bei grossen Dokumenten:**
- [x] Preview-Virtualisierung: `content-visibility: auto` + `contain-intrinsic-size` pro Seite
- [x] Lazy-DOMPurify via IntersectionObserver (Sanitize nur fuer sichtbare Seiten + 1 Viewport Vorspann, Cache pro Seite)
- [x] Async File-I/O in `fileManager.saveFile`/`openFile`/File-Watcher (kein `writeFileSync` mehr im Main)
- [x] Async textfile-IPC-Handler (`textfile:read`/`write`/`readBinary`)
- [x] Parallele async SVG-Reads in `typstCompiler` statt sequenziellem Sync
- [x] **Inkrementelle Serialisierung**: `serializeTypstCached()` in [src/editor/lib/serializer.ts](src/editor/lib/serializer.ts) mit `WeakMap<PMNode, string>`-Cache — bei 100 Seiten faellt Serialize-Kosten pro Keystroke von ~150 ms auf ~1-2 ms

**DOCX-Export Quality Quick-Win:**
- [x] [docxSerializer.ts](src/shared/docxSerializer.ts) komplett auf benannte Word-Styles umgebaut (Heading1-6, Quote, CodeBlock, BibliographyEntry, TableHeader, TableCell, Caption)
- [x] Page-Size + Margins + Body-Font + Font-Size + Line-Spacing werden aus Typst `#set`-Settings uebernommen
- [x] **Live Multilevel-Heading-Numbering** via Word-Numbering-Config — Supervisor kann Kapitel in Word umstellen, Zahlen aktualisieren sich automatisch
- [x] Typst Numbering-Pattern-Parsing (`"1.1"` -> Dezimal, `"A.1"` -> Upper Letter + Dezimal, `"I.A.1"` -> Roman + Letter + Dezimal)
- [x] Citations: Lookup in `.bib` -> `(Autor Jahr)` statt `[citekey]`
- [x] Table-Header-Bug: Inline-Marks (italic, Farbe, Links) werden nicht mehr durch Bold-Reassembly gefressen — Header nutzt `TableHeader`-Style
- [x] Bilder: echte Aspect-Ratio aus PNG-/JPEG-Header gelesen (keine Querformat-Quetsche mehr)
- [x] Lokalisierte TOC-/Bibliography-Labels (DE/EN/FR/ES/IT/PT/NL)

**UX:**
- [x] **About-Dialog** ([src/renderer/components/AboutDialog.svelte](src/renderer/components/AboutDialog.svelte)) — Version, Electron/Chromium/Node-Versionen, Platform/Arch, Lizenz-Tier, Links (User Guide, Website, Report Issue), "Copy Diagnostics" fuer Bug-Reports
- [x] Menue-Integration: macOS App-Menue + Help-Menue auf Windows/Linux, `Help -> Report Issue` auf allen Plattformen

### 2.4 Teilweise implementiert

| Feature | Status | Was fehlt |
|---------|--------|-----------|
| Zoom | Browser-Zoom via Menue vorhanden | Dokumenten-Zoom (Slider, 15-200%) fehlt |
| Spell Check | Electron-native + Sync aus Typst-`lang`-Setting | - |
| Find/Replace | Funktional | DOM-basiert statt TipTap-aware, kann bei Edge Cases Treffer uebersehen |
| i18n/Lokalisierung | Handbuch 2-sprachig (handbuch.md + handbook.md) | UI-Strings nicht extrahiert, komplett auf Englisch |
| Bestaetigungsdialoge | Meist vorhanden | Fehlen bei destruktiven Git-Operationen (unstage, reset) |

### 2.5 Nice-to-Have (nach v1.0)

- Dark Mode
- Deutsche UI-Uebersetzung
- Linux `.rpm`-Paket (fuer Fedora/RHEL)
- Virtualisierung im Editor selbst (aktuell rendert TipTap alle DOM-Nodes)
- Offline-Cache fuer Zotero-Bibliographien
- "Publish to GitHub"-Button (aktuell nur via Terminal + `gh` CLI)
- Worker-basierter Serializer (nach inkrementellem Cache nicht mehr noetig, kann kommen falls 100 ms+ anfaellt)

### 2.6 Vor Launch noch einbauen

- [ ] **Crash-Telemetrie (Sentry)** — am Launch-Tag gibt es Bugs, ohne Telemetrie keine Reproduktion. Opt-out-Toggle in Settings. **Kritischster Launch-Enabler.**
- [ ] **Shortcut-Cheat-Sheet** (`Cmd+/` oder `?`) — aktuell kennen User die 20 Shortcuts nicht, bis sie das Handbuch lesen. Discovery-Problem.
- [ ] **"Open Sample Project"** im StartScreen — neuer User vs. leerer WYSIWYG = Bounce. Ein-Klick-Beispielprojekt zeigt Typst-Vibe.
- [ ] **Bestaetigungsdialog bei Git-unstage / Reset**
- [ ] **Package.json Version bumpen auf 0.7.0** (aktuell 0.1.0)

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

Fuer den ersten Release fehlt noch `"publish"`-Block — siehe 3.4.

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

Firebase Console -> Hosting -> Add custom domain -> `releases.vswrite.com` -> DNS-Records beim Provider. Danach `build.publish.url` in package.json auf neue Domain umstellen. **Wichtig:** Bestehende User behalten den alten `*.web.app`-Endpoint im Updater bis zum naechsten Update — beide Endpoints parallel laufen lassen, bis gaertig genug migrierte Versionen draussen sind.

---

## 4. Handbuch-Hosting & In-App-Zugriff

Die Handbuecher liegen im Repo unter [documentation/handbuch.md](handbuch.md) (Deutsch) und [documentation/handbook.md](handbook.md) (Englisch). Das sind die **Quellen der Wahrheit**.

### 4.1 Online-Hosting (Pflicht)

Die Handbuecher werden nach `vswrite.netlify.app` deployed:

- Deutsch: `https://vswrite.netlify.app/de/docs`
- Englisch: `https://vswrite.netlify.app/en/docs` *(nach Launch)*

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

Aktuell **nicht implementiert** — der online gehostete Weg reicht fuer v1.0.

### 4.4 Sprachwahl

Der In-App-Link zeigt aktuell statisch auf `/de/docs`. Sobald die UI-i18n eingefuehrt wird, soll die Sprachwahl an die UI-Sprache gekoppelt werden (User-Locale oder expliziter Toggle in Settings).

---

## 5. Release-Checkliste

### Phase 1: Security Fixes (erledigt)

- [x] Path Traversal + Symlink-Bypass behoben (ueberall realpath)
- [x] Command Injection durch `execFileSync` ersetzt
- [x] SVG-Sanitisierung via DOMPurify
- [x] `sandbox: true`, CSP-Header, Protocol-Pfad-Validierung
- [x] MCP Server Pfad-Validierung
- [x] Lizenz-Daten OS-verschluesselt

### Phase 2: Features (erledigt)

- [x] Crash Recovery / Backup-System
- [x] Undo AI Edit
- [x] Accessibility ARIA-Labels
- [x] Export Loading-State
- [x] CommandHub Redesign
- [x] Typst CLI gebundelt
- [x] File-Watcher Flacker-Fix
- [x] Preview-Virtualisierung + Lazy Sanitize
- [x] Async File-I/O im Main-Prozess
- [x] Inkrementelle Serialisierung
- [x] DOCX-Export mit Word-Styles + Live-Multilevel-Numbering
- [x] About-Dialog

### Phase 3: Vor Launch (TODO)

- [ ] Crash-Telemetrie (Sentry) mit Opt-out-Toggle
- [ ] Shortcut-Cheat-Sheet-Overlay (`Cmd+/`)
- [ ] "Open Sample Project" im StartScreen
- [ ] Bestaetigungsdialog bei destruktiven Git-Ops
- [ ] package.json Version -> 0.7.0

### Phase 4: Distribution

- [ ] Firebase-Projekt in Console anlegen (Region `europe-west3`)
- [ ] `firebase login` + `firebase init hosting` (public dir: `releases`)
- [ ] `firebase.json` + `.firebaserc` committen
- [ ] `.gitignore` ergaenzen
- [ ] `electron-updater` installieren + in `src/main/index.ts` einbinden
- [ ] `publish`-Config in `package.json` hinzufuegen
- [ ] Handbuch-Hosting auf Netlify eingerichtet (de/en)
- [ ] macOS DMG bauen, signieren, notarisieren
- [ ] Artefakte deployen
- [ ] Download-Link auf vswrite.com einbinden
- [ ] Auto-Updater End-to-End testen (alte Version installieren -> Update)

### Phase 5: QA & Release

- [ ] Alle Features auf macOS manuell testen
- [ ] Multi-File-Projekte, Includes, Zitationen
- [ ] File-Locking, externe Edits, Crash Recovery
- [ ] Undo AI Edit (Terminal-Edit -> Undo)
- [ ] **DOCX-Export auf realer 100-Seiten-Thesis** — in Word / Pages / LibreOffice oeffnen, TOC-Refresh, Heading-Numbering-Live-Test durch Umordnen
- [ ] Auto-Updater-E2E-Test
- [ ] Performance auf 100+ Seiten (Tippen, Scrollen im Preview, Recompile)
- [ ] Symlink-Angriffs-Test: Symlink `/project/x.typ -> /etc/passwd` setzen, sicherstellen dass Open/Write rejecten
- [ ] Lizenz-Tampering-Test: electron-store JSON editieren, Pro vortaeuschen, App sollte zurueck auf "Unlicensed" fallen
- [ ] DMG auf sauberem Mac (ohne Developer Tools) testen — Gatekeeper
- [ ] Git-Tag `v0.7.0` erstellen

### Phase 6: Post-Release

- [ ] Linux AppImage + Windows Installer deployen (je nach Nachfrage)
- [ ] Dark Mode
- [ ] Deutsche UI-Uebersetzung
- [ ] Dokumenten-Zoom (Slider)
- [ ] "Publish to GitHub"-Button
- [ ] Bundeled Offline-Handbuch (v1.1)
- [ ] Vollstaendiges WCAG 2.1 AA Accessibility-Audit
- [ ] MCP Server Phase 4 (Resources, Electron IPC-Bridge)
- [ ] **MCP Tools fuer Footnotes & Comments** — siehe Abschnitt 6.

---

## 6. MCP Phase 4 — Writer-Features fuer Agents

Aktuell koennen Agents Footnotes nur ueber generische `read_file` / `write_file` einfuegen (Typst-Syntax muss der Agent selbst kennen) und Comments nur ueber direktes Schreiben in `comments/<id>.md` (kein Schema-Schutz, keine ID-Generierung). Das funktioniert, aber ist fragil. Sinnvolle Erweiterungen:

### 6.1 Footnote-Tool

```ts
add_footnote({
  file: "chapters/03-method.typ",
  after_text: "five reference works",   // exakter Substring zum Verankern
  body: "Selection was peer-reviewed only — see the methodological note.",
  occurrence: 1,                         // 1-basierter Index, falls after_text mehrfach vorkommt
})
```

Verhalten: liest die Datei, findet `after_text`, fuegt direkt dahinter `#footnote[<body>]` ein, schreibt zurueck. Falls `after_text` mehrfach vorkommt, kommt der Treffer am `occurrence`-Index dran.

Edge-Cases:
- `after_text` nicht gefunden -> Fehler mit Vorschlaegen aehnlicher Strings
- `after_text` mehrfach -> Fehler mit Treffer-Liste, wenn `occurrence` fehlt
- Body enthaelt selbst `]` -> ueber `#footnote[..]` mit balanced-bracket-encoder loesen

### 6.2 Comment-Tools

```ts
add_comment({
  file: "chapters/01-introduction.typ",
  anchor: "five reference works",        // muss in der Datei vorkommen
  body: "Quelle ergaenzen?",
  resolved: false,                        // optional, default false
})

list_comments({
  file?: "chapters/...",                  // optional Filter
  include_resolved?: false,
})

resolve_comment({ id: "2026-04-28-1432-a3f", resolved: true })
delete_comment({ id: "2026-04-28-1432-a3f" })
```

`add_comment` macht intern: ID generieren, `comments/<id>.md` schreiben mit korrekt gefuelltem Frontmatter, `rangeStart` aus aktueller Datei berechnen, `author` aus Git-Config holen. Der Agent muss das Frontmatter-Schema **nicht** kennen.

### 6.3 Wo das hingehoert

Implementierung im MCP-Server [src/mcp/server.ts](src/mcp/server.ts) — die Logik existiert bereits in [src/main/commentManager.ts](src/main/commentManager.ts), muss aber so refaktoriert werden, dass sie ohne `appState` (also ohne Electron-Kontext) lauft. Konkret: `appState.projectDir` durch einen explicit uebergebenen `projectDir`-Parameter ersetzen, oder einen Standalone-Wrapper bauen.

### 6.4 Pro-Gating

Wie alle MCP-Tools auf Pro-Lizenz gegated. Dokumentation in [mcp-server.md](mcp-server.md) ergaenzen, sobald implementiert.
