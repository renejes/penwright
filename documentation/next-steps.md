# vswrite Desktop — Next Steps bis zum Release

> Audit-Datum: 01.04.2026 | App-Version: 0.1.0 (Pre-Release)

---

## 1. Security-Audit: Befunde und Status

> Alle kritischen und hohen Befunde wurden in Session 6 behoben.

### 1.1 Behoben

| Schweregrad | Befund | Fix |
|-------------|--------|-----|
| KRITISCH | Path Traversal in `textfile:read/write/readBinary` | `isPathWithinProject()` Validierung hinzugefuegt |
| KRITISCH | Command Injection in PDF-Export (`execSync`) | `execFileSync` mit Array-Argumenten |
| HOCH | Verwundbare `@xmldom/xmldom` | `npm audit fix` → 0 vulnerabilities |
| HOCH | SVG Injection via `{@html}` im Preview | DOMPurify-Sanitisierung mit SVG-Profil |
| HOCH | `sandbox: false` | `sandbox: true` gesetzt |
| HOCH | Protocol-Handler ohne Pfad-Validierung | Pfade gegen Projektverzeichnis validiert |
| MITTEL | Fehlende CSP-Header | Content Security Policy in `index.html` |
| MITTEL | Terminal-Respawn ohne Limit | Max 5 Respawns |
| MITTEL | Git-Pfade nicht validiert | `isPathWithinGitDir()` fuer stage/unstage |
| MITTEL | `filetree:open` ohne Pfad-Check | `isPathWithinProject()` hinzugefuegt |

### 1.2 Verbleibend (niedrige Prioritaet)

| Befund | Datei | Beschreibung |
|--------|-------|--------------|
| PostMessage ohne Origin-Check | `src/editor/lib/ipcAdapter.ts:40` | Nur relevant im VS Code Extension-Kontext, nicht in Electron |
| Settings ohne Schema-Validierung | `src/main/ipcHandlers.ts:77` | Geringe Angriffs-Flaeche, da nur interne IPC |
| 4x `innerHTML`-Nutzung | `src/editor/lib/` | TipTap-interne Nutzung, nicht user-kontrolliert |

### 1.3 Positive Sicherheitsmassnahmen

- `contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`
- Preload-Whitelist — nur definierte IPC-Channels
- `will-navigate` blockiert, `setWindowOpenHandler` verweigert Popups
- DOMPurify fuer SVG-Sanitisierung
- CSP-Header (script-src 'self', img-src 'self' data: vswrite-asset:)
- File-Lock-Mechanismus fuer Shared Folders
- Keine Secrets in der Git-History (gitleaks: sauber)

---

## 2. Feature-Review: Was fehlt oder verbessert werden sollte

### 2.1 Erledigt (Session 6)

- [x] **Crash Recovery** — Backup-Snapshots alle 30s in `~/.vswrite/backups/`, Recovery-Dialog beim Oeffnen
- [x] **Undo AI Edit** — Snapshot-Ring-Buffer (max 20), stellt Zustand vor externer Datei-Aenderung wieder her
- [x] **Accessibility** — ARIA-Labels auf Toolbar (25+ Buttons), Sidebar, Tabs, Status-Bar, Keyboard-Handler
- [x] **Export Loading-State** — Pulsierende Status-Anzeige "Exporting PDF/DOCX..." mit `aria-live`
- [x] **CommandHub Redesign** — 7 fokussierte Gruppen statt 5 ueberladene (40 → 22 Items), Format-Redundanz entfernt

### 2.2 Teilweise implementierte Features

| Feature | Status | Was fehlt |
|---------|--------|-----------|
| Zoom | Browser-Zoom via Menue vorhanden | Dokumenten-Zoom (Slider, 15–200%) fehlt |
| Spell Check | Electron-native integriert | Sprachauswahl beschraenkt, nur en-US als Default |
| Find/Replace | Funktional | DOM-basiert statt TipTap-aware, kann bei bestimmten Edge Cases Treffer uebersehen |
| i18n/Lokalisierung | Nicht vorhanden | UI komplett auf Englisch, obwohl Handbuch auf Deutsch existiert |
| Bestaetigungsdialoge | Meist vorhanden | Fehlen bei destruktiven Git-Operationen |
| DOCX Export | Strukturell vollstaendig (Headings, Listen, Tabellen, Footnotes, Bibliografie, Bilder) | Output-Formatierung unbrauchbar — User muesste komplett neu formatieren (siehe 2.4) |

### 2.3 Nice-to-Have (Post-Release)

- Dark Mode
- Deutsche UI-Uebersetzung
- Linux `.rpm`-Paket (fuer Fedora/RHEL)
- Crash-Reporter (z.B. Sentry)
- Virtualisierung fuer grosse Dokumente (Performance)
- Offline-Cache fuer Zotero-Bibliographien

### 2.4 DOCX Export Qualitaet (Quick-Win)

Der bestehende [docxSerializer](src/shared/docxSerializer.ts) (915 Zeilen) deckt strukturell alles ab — Headings, Listen, Tabellen, Footnotes, Bibliografie, Bilder, Hyperlinks. Die produzierte Word-Datei sieht aber so unbrauchbar formatiert aus, dass User komplett neu formatieren muessten.

**Architekturwechsel verworfen:**

- Pandoc kann Typst **nicht** als Input lesen ([Pandoc Issue #8740](https://github.com/jgm/pandoc/issues/8740)) — eine direkte `typst -> docx` Konversion via Pandoc ist nicht moeglich.
- Pandoc bundeln waere ~150 MB pro Plattform-Binary, GPL-2.0+ (lizenz-problematisch fuer kommerzielle Distribution), zusaetzlicher Code-Signing-Aufwand pro Plattform.
- ODT statt DOCX waere kein Architektur-Win — beides sind ZIP+XML, Qualitaet haengt am Serializer, nicht am Format.

**Plan: gezielte Fixes am bestehenden Serializer**

- [ ] Test-Dokument mit allen Format-Features exportieren (Headings + Tabellen + Bilder + Footnotes + Bibliografie + Blockquotes + Listen + Math)
- [ ] In Word, Pages und LibreOffice oeffnen, konkrete Bruchstellen pro Element-Typ dokumentieren
- [ ] Pro Bruchstelle gezielt in [convertNode](src/shared/docxSerializer.ts#L288), [convertInlineContent](src/shared/docxSerializer.ts#L565) bzw. [convertTable](src/shared/docxSerializer.ts#L752) fixen
- [ ] Word-Styles statt Inline-Formatierung verwenden (vermutlich groesster Hebel) — `styles`-Block in `serializeDocx()` ([docxSerializer.ts:147](src/shared/docxSerializer.ts#L147)) ausbauen
- [ ] Re-Test, bis Output ohne manuelle Nacharbeit verwendbar ist
- [ ] Optional fuer spaeter: ODT-Export zusaetzlich anbieten — die AST-Traversal-Logik ist wiederverwendbar, nur der Render-Layer (~30 % des Codes) muesste neu

---

## 3. Distribution: Firebase Hosting

> Setup orientiert sich exakt am Synova-App-Pattern ([synova-app/firebase.json](../../synova-app/firebase.json), [synova-app/documentation/distribution.md](../../synova-app/documentation/distribution.md)). Einzige Anpassung: Electron statt Tauri (`latest-mac.yml` statt `latest.json`).

### 3.1 Infrastruktur-Uebersicht

Auslieferung ueber Firebase Hosting — globales CDN, kostenloses SSL, Deploy via `firebase deploy`. Standardmaessig `*.web.app`-URL, keine Custom Domain noetig (kann spaeter ergaenzt werden).

```
User besucht vswrite.com
  -> Klickt "Download"
  -> Laedt DMG von https://<vswrite-projekt-id>.web.app/
  -> Installiert App

App prueft bei jedem Start:
  -> Fragt https://<vswrite-projekt-id>.web.app/latest-mac.yml
  -> Vergleicht mit eigener Version
  -> Falls neuer: "Update verfuegbar" Dialog -> Download + Install
```

| Dienst | URL | Hosting |
|--------|-----|---------|
| Homepage | https://vswrite.com | (bestehende Konfiguration) |
| Releases | https://&lt;vswrite-projekt-id&gt;.web.app | Firebase Hosting |

GCP-Projekt anlegen via [console.firebase.google.com](https://console.firebase.google.com/) — Region `europe-west3` (Frankfurt) waehlen. Projekt-ID merken (z.B. `vswrite-app` oder eine generierte ID wie bei Synova `gen-lang-client-XXXXX`).

### 3.2 Firebase-Projekt einrichten (einmalig)

```bash
# Firebase CLI installieren (falls noch nicht vorhanden)
npm install -g firebase-tools
firebase login

# Im vswrite-desktop Repo
firebase init hosting
# - Use existing project: <vswrite-projekt-id>
# - Public directory: releases
# - Configure as SPA: No
# - GitHub Auto-Deploy: No
```

`firebase.json` (analog zu Synova, MIME-Types fuer Electron angepasst):

```json
{
  "hosting": {
    "public": "releases",
    "ignore": [
      "firebase.json",
      "**/.*"
    ],
    "headers": [
      {
        "source": "**/*.dmg",
        "headers": [
          { "key": "Content-Type", "value": "application/x-apple-diskimage" },
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      },
      {
        "source": "**/*.zip",
        "headers": [
          { "key": "Content-Type", "value": "application/zip" },
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      },
      {
        "source": "**/*.blockmap",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      },
      {
        "source": "**/latest*.yml",
        "headers": [
          { "key": "Content-Type", "value": "text/yaml" },
          { "key": "Cache-Control", "value": "no-cache" },
          { "key": "Access-Control-Allow-Origin", "value": "*" }
        ]
      }
    ]
  }
}
```

`.firebaserc` (committen):

```json
{
  "projects": {
    "default": "<vswrite-projekt-id>"
  }
}
```

`.gitignore` ergaenzen (analog Synova — Binaries nicht committen, Manifest schon):

```
# Firebase
.firebase/

# Firebase Hosting (release binaries)
releases/*.dmg
releases/*.zip
releases/*.blockmap
releases/*.exe
releases/*.AppImage
```

### 3.3 Auto-Updater einrichten (electron-updater)

**1. Package installieren:**

```bash
npm install electron-updater
```

**2. In `package.json` Build-Config ergaenzen:**

```json
"build": {
  "publish": {
    "provider": "generic",
    "url": "https://<vswrite-projekt-id>.web.app"
  }
}
```

electron-builder generiert dann automatisch `latest-mac.yml` (bzw. `latest-linux.yml`, `latest.yml` fuer Windows) beim Build — diese Manifeste muessen zusammen mit DMG/ZIP/Blockmaps deployed werden. Im Gegensatz zu Tauri (manuelles `latest.json`) ist hier keine Signatur-Kopie noetig — electron-builder schreibt SHA512 direkt ins YML.

**3. Im Main Process ([src/main/index.ts](src/main/index.ts)) Auto-Updater einbinden:**

```typescript
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  // ... bestehender Code ...

  // Auto-Update Check (nach 5 Sekunden, dann alle 4 Stunden)
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});
```

Der Updater zeigt automatisch einen nativen Dialog, wenn ein Update gefunden wird.

### 3.4 macOS: DMG erstellen, signieren, deployen

**Voraussetzungen:**
1. Apple Developer ID Certificate im Keychain (`Developer ID Application: Rene Jesser (3LAHNFWNT3)`)
2. Umgebungsvariablen setzen:
   ```bash
   export APPLE_ID="deine@email.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="3LAHNFWNT3"
   ```

**Build:**
```bash
npm run build && npm run package:mac
```

**Output in `release/` (electron-builder Default):**
```
release/
  vswrite-X.Y.Z.dmg              <- Download fuer User
  vswrite-X.Y.Z.dmg.blockmap     <- Differential-Update-Map
  vswrite-X.Y.Z-mac.zip          <- Update-Bundle (fuer Auto-Updater)
  vswrite-X.Y.Z-mac.zip.blockmap
  latest-mac.yml                  <- Updater-Manifest (Version + URL + SHA512)
```

**Build-Artefakte ins `releases/` kopieren und deployen:**
```bash
cp release/vswrite-*.dmg \
   release/vswrite-*-mac.zip \
   release/*.blockmap \
   release/latest-mac.yml \
   releases/

firebase deploy --only hosting
```

**Verifizieren:**
```bash
# Manifest erreichbar?
curl -s https://<vswrite-projekt-id>.web.app/latest-mac.yml | head -5

# DMG downloadbar?
curl -sI https://<vswrite-projekt-id>.web.app/vswrite-X.Y.Z.dmg | head -3

# Notarisierung pruefen
xcrun stapler validate release/vswrite-*.dmg
```

### 3.5 Windows: EXE/NSIS-Installer

```bash
npm run build && npm run package:win
```

**Output:** `release/vswrite-X.Y.Z-setup.exe` + `release/latest.yml`

Code-Signing ist optional — ohne Signing zeigt Windows eine SmartScreen-Warnung. Fuer signierte Builds ein EV-Zertifikat (z.B. Sectigo, ~200 EUR/Jahr) beschaffen und in `package.json` konfigurieren.

### 3.6 Linux: AppImage

```bash
npm run build && npm run package:linux
```

**Output:** `release/vswrite-X.Y.Z.AppImage` + `release/latest-linux.yml`

### 3.7 Kompletter Release-Workflow (Checkliste)

Bei jedem neuen Release:

```
1. Version hochzaehlen
   - package.json: "version": "X.Y.Z"

2. Build erstellen
   export APPLE_ID="..."
   export APPLE_APP_SPECIFIC_PASSWORD="..."
   export APPLE_TEAM_ID="3LAHNFWNT3"
   npm run build && npm run package:mac

3. Build-Artefakte ins releases/ Verzeichnis kopieren
   cp release/vswrite-*.dmg \
      release/vswrite-*-mac.zip \
      release/*.blockmap \
      release/latest-mac.yml \
      releases/

4. Firebase Deploy
   firebase deploy --only hosting

5. Verifizieren
   curl -s https://<vswrite-projekt-id>.web.app/latest-mac.yml
   # App starten -> sollte "Update verfuegbar" zeigen

6. Committen + Pushen (nur latest-mac.yml + package.json — Binaries sind gitignored)
   git add package.json releases/latest-mac.yml
   git commit -m "Release vX.Y.Z"
   git push

7. Git Tag setzen
   git tag vX.Y.Z && git push origin vX.Y.Z
```

### 3.8 Download-Link fuer Homepage

**Initialer Download (DMG):**
```
https://<vswrite-projekt-id>.web.app/vswrite-X.Y.Z.dmg
```

Diesen Link als Download-Button auf vswrite.com einbinden.

**Auto-Updater Endpoint:**
```
https://<vswrite-projekt-id>.web.app/latest-mac.yml
```

Konfiguriert in `package.json` → `build.publish.url`. Die App fragt diesen Endpoint bei jedem Start ab.

### 3.9 Hosting verwalten

```bash
# Deployen
firebase deploy --only hosting

# Aktive Version ansehen
firebase hosting:channel:list

# Rollback zur vorherigen Version
firebase hosting:clone <vswrite-projekt-id>:live <vswrite-projekt-id>:previous
```

### 3.10 Dateien auf Firebase Hosting (Referenz)

```
releases/                          <- Lokales Verzeichnis, wird deployed
  latest-mac.yml                   <- Auto-Updater Manifest (macOS) — committed
  latest-linux.yml                 <- Auto-Updater Manifest (Linux, spaeter)
  latest.yml                       <- Auto-Updater Manifest (Windows, spaeter)
  vswrite-X.Y.Z.dmg               <- macOS Installer (gitignored)
  vswrite-X.Y.Z.dmg.blockmap      <- (gitignored)
  vswrite-X.Y.Z-mac.zip           <- macOS Update-Bundle (gitignored)
  vswrite-X.Y.Z-mac.zip.blockmap  <- (gitignored)
  vswrite-X.Y.Z.AppImage          <- Linux (spaeter, gitignored)
  vswrite-X.Y.Z-setup.exe         <- Windows (spaeter, gitignored)
```

### 3.11 Custom Domain (optional, spaeter)

Falls zu einem spaeteren Zeitpunkt eine eigene Subdomain gewuenscht ist:
- Firebase Console → Hosting → Add custom domain → `releases.vswrite.com`
- DNS-Records (A oder CNAME) beim Domain-Provider eintragen
- SSL via Let's Encrypt (24-48h)
- Danach `package.json` → `build.publish.url` auf neue Domain umstellen
- **Wichtig:** Bestehende User behalten den alten `*.web.app`-Endpoint im Updater bis zum naechsten Update — beide Endpoints muessen eine Weile parallel laufen.

---

## 4. Release-Checkliste

### Phase 1: Security Fixes (erledigt)

- [x] Path Traversal in `textfile:read/write/readBinary` beheben
- [x] `execSync` durch `execFileSync` mit Array-Argumenten ersetzen
- [x] `@xmldom/xmldom` updaten (`npm audit fix`)
- [x] SVG-Sanitisierung im PreviewPanel einfuehren (DOMPurify)
- [x] `sandbox: true` setzen
- [x] Protocol-Handler (`vswrite-asset://`) mit Pfad-Validierung absichern
- [x] CSP-Header in `index.html` hinzufuegen
- [x] Terminal-Respawn-Limit, Git-Pfad-Validierung

### Phase 2: Features (erledigt)

- [x] Crash Recovery / Backup-System
- [x] Undo AI Edit (Snapshot-Ring-Buffer)
- [x] Grundlegende ARIA-Labels fuer Accessibility
- [x] Export Loading-State (PDF/DOCX)
- [x] CommandHub Redesign (thematische Sortierung)
- [x] Typst CLI gebundelt (User muss Typst nicht installieren)
- [x] File Watcher: Sidebar-Flackern bei Auto-Save behoben

### Phase 3: DOCX Export Quick-Win (vor Release)

- [ ] Test-Dokument mit allen Format-Features exportieren
- [ ] In Word, Pages, LibreOffice oeffnen — Bruchstellen pro Element-Typ dokumentieren
- [ ] Word-Styles im `serializeDocx()` `styles`-Block ausbauen (statt Inline-Formatierung)
- [ ] Bruchstellen in `convertNode` / `convertInlineContent` / `convertTable` gezielt fixen
- [ ] Re-Test bis Output ohne manuelle Nacharbeit verwendbar ist

### Phase 4: Distribution (naechster Schritt)

- [ ] Firebase-Projekt in Console anlegen (Region `europe-west3`), Projekt-ID notieren
- [ ] `firebase login` + `firebase init hosting` (public dir: `releases`)
- [ ] `firebase.json` (MIME-Header analog Synova) + `.firebaserc` committen
- [ ] `.gitignore` ergaenzen (`releases/*.dmg`, `*.zip`, `*.blockmap`, `*.exe`, `*.AppImage`)
- [ ] `electron-updater` installieren und im Main Process einbinden
- [ ] `publish`-Config in `package.json` hinzufuegen (generic Provider → `*.web.app`-URL)
- [ ] macOS DMG bauen, signieren, notarisieren
- [ ] Artefakte (DMG + ZIP + Blockmaps + latest-mac.yml) nach `releases/` kopieren
- [ ] `firebase deploy --only hosting` ausfuehren
- [ ] Download-Link auf vswrite.com einbinden
- [ ] Auto-Update End-to-End testen (alte Version installieren → Update erkennt neue)
- [ ] Optional spaeter: Custom Domain `releases.vswrite.com` ergaenzen

### Phase 5: QA & Release

- [ ] Alle Features auf macOS manuell testen
- [ ] Multi-File-Projekte, Includes, Zitationen testen
- [ ] File-Locking, externe Edits, Crash Recovery testen
- [ ] Undo AI Edit testen (Terminal-Edit → Undo)
- [ ] DOCX Export auf realem Dokument testen — Output muss ohne Nacharbeit nutzbar sein
- [ ] Auto-Updater testen (alte Version installieren → Update erkennt neue)
- [ ] Performance bei grossen Dokumenten (50+ Seiten) testen
- [ ] DMG auf sauberem Mac (ohne Developer Tools) testen — Gatekeeper
- [ ] Git-Tag erstellen: `git tag v1.0.0`

### Phase 6: Post-Release

- [ ] Typst Binaries fuer andere Plattformen (x64-darwin, x64-linux, x64-win32)
- [ ] Linux AppImage bauen + via `firebase deploy` ausliefern
- [ ] Windows Installer (wenn Nachfrage)
- [ ] Dark Mode
- [ ] Deutsche UI-Uebersetzung
- [ ] Dokumenten-Zoom (Slider)
- [ ] Crash-Reporter (Sentry)
- [ ] Vollstaendiges WCAG 2.1 AA Accessibility-Audit
