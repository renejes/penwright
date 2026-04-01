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

### 2.3 Nice-to-Have (Post-Release)

- Dark Mode
- Deutsche UI-Uebersetzung
- Linux `.rpm`-Paket (fuer Fedora/RHEL)
- Crash-Reporter (z.B. Sentry)
- Virtualisierung fuer grosse Dokumente (Performance)
- Offline-Cache fuer Zotero-Bibliographien

---

## 3. Distribution: Self-Hosted auf Hetzner VPS

### 3.1 Infrastruktur-Uebersicht

Gleiche Infrastruktur wie Synova-App — bestehender Hetzner VPS (46.225.25.41) mit Coolify/Traefik.

```
User besucht vswrite.com
  -> Klickt "Download"
  -> Laedt DMG von releases.vswrite.com
  -> Installiert App

App prueft bei jedem Start:
  -> Fragt https://releases.vswrite.com/latest-mac.yml
  -> Vergleicht mit eigener Version
  -> Falls neuer: "Update verfuegbar" Dialog -> Download + Install
```

| Dienst | URL | Hosting |
|--------|-----|---------|
| Homepage | https://vswrite.com | Netlify |
| Release-Server | https://releases.vswrite.com | Hetzner VPS (Nginx-Container) |

### 3.2 Release-Server einrichten

Neuen Nginx-Container auf dem VPS aufsetzen (analog zu `synova-releases`):

```bash
# Auf VPS: Verzeichnis anlegen
ssh -i ~/.ssh/id_hetzner root@46.225.25.41
mkdir -p /data/vswrite-releases

# In Coolify: neuen Nginx-Container anlegen
# - Name: vswrite-releases
# - Image: nginx:alpine
# - Domain: releases.vswrite.com
# - Volume: /data/vswrite-releases:/usr/share/nginx/html:ro
# - Network: coolify (Traefik)
# - SSL: automatisch via Let's Encrypt
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
    "url": "https://releases.vswrite.com"
  }
}
```

electron-builder generiert dann automatisch `latest-mac.yml` (bzw. `latest-linux.yml`) beim Build — diese Datei muss zusammen mit DMG/ZIP auf den VPS.

**3. Im Main Process (`src/main/index.ts`) Auto-Updater einbinden:**

```typescript
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  // ... bestehender Code ...

  // Auto-Update Check (nach 5 Sekunden, dann alle 4 Stunden)
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});
```

Der Updater zeigt automatisch einen nativen Dialog wenn ein Update gefunden wird.

### 3.4 macOS: DMG erstellen, signieren, hochladen

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

**Output in `release/`:**
```
release/
  vswrite-X.Y.Z.dmg              <- Download fuer User
  vswrite-X.Y.Z-mac.zip          <- Update-Bundle (fuer Auto-Updater)
  latest-mac.yml                  <- Updater-Manifest (Version + URL + SHA512)
```

**Auf VPS hochladen:**
```bash
scp -i ~/.ssh/id_hetzner \
  release/vswrite-*.dmg \
  release/vswrite-*-mac.zip \
  release/latest-mac.yml \
  root@46.225.25.41:/data/vswrite-releases/
```

**Verifizieren:**
```bash
# Manifest erreichbar?
curl -s https://releases.vswrite.com/latest-mac.yml | head -5

# DMG downloadbar?
curl -sI https://releases.vswrite.com/vswrite-X.Y.Z.dmg | head -3

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

2. Committen + Pushen
   git add package.json && git commit -m "Bump version to X.Y.Z" && git push

3. Build erstellen
   export APPLE_ID="..."
   export APPLE_APP_SPECIFIC_PASSWORD="..."
   export APPLE_TEAM_ID="3LAHNFWNT3"
   npm run build && npm run package:mac

4. Auf VPS hochladen
   scp -i ~/.ssh/id_hetzner \
     release/vswrite-*.dmg \
     release/vswrite-*-mac.zip \
     release/latest-mac.yml \
     root@46.225.25.41:/data/vswrite-releases/

5. Verifizieren
   curl -s https://releases.vswrite.com/latest-mac.yml
   # App starten -> sollte "Update verfuegbar" zeigen

6. Git Tag setzen
   git tag vX.Y.Z && git push origin vX.Y.Z
```

### 3.8 Download-Link fuer Homepage

**Initialer Download (DMG):**
```
https://releases.vswrite.com/vswrite-X.Y.Z.dmg
```

Diesen Link als Download-Button auf vswrite.com einbinden.

**Auto-Updater Endpoint:**
```
https://releases.vswrite.com/latest-mac.yml
```

Konfiguriert in `package.json` → `build.publish.url`. Die App fragt diesen Endpoint automatisch ab.

### 3.9 Dateien auf dem VPS (Referenz)

```
/data/vswrite-releases/
  latest-mac.yml                  <- Auto-Updater Manifest (macOS)
  latest-linux.yml                <- Auto-Updater Manifest (Linux, spaeter)
  vswrite-X.Y.Z.dmg              <- macOS Installer
  vswrite-X.Y.Z-mac.zip          <- macOS Update-Bundle
  vswrite-X.Y.Z.AppImage         <- Linux (spaeter)
  vswrite-X.Y.Z-setup.exe        <- Windows (spaeter)
```

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

### Phase 3: Distribution (naechster Schritt)

- [ ] `electron-updater` installieren und im Main Process einbinden
- [ ] `publish`-Config in `package.json` hinzufuegen (generic Provider → releases.vswrite.com)
- [ ] Nginx-Container `vswrite-releases` auf Hetzner VPS anlegen (Coolify)
- [ ] DNS: `releases.vswrite.com` → VPS (46.225.25.41)
- [ ] macOS DMG bauen, signieren, notarisieren
- [ ] DMG + ZIP + latest-mac.yml auf VPS hochladen
- [ ] Download-Link auf vswrite.com einbinden
- [ ] Auto-Update einmal End-to-End testen

### Phase 4: QA & Release

- [ ] Alle Features auf macOS manuell testen
- [ ] Multi-File-Projekte, Includes, Zitationen testen
- [ ] File-Locking, externe Edits, Crash Recovery testen
- [ ] Undo AI Edit testen (Terminal-Edit → Undo)
- [ ] Auto-Updater testen (alte Version installieren → Update erkennt neue)
- [ ] Performance bei grossen Dokumenten (50+ Seiten) testen
- [ ] DMG auf sauberem Mac (ohne Developer Tools) testen — Gatekeeper
- [ ] Git-Tag erstellen: `git tag v1.0.0`

### Phase 5: Post-Release

- [ ] Linux AppImage bauen + auf VPS hochladen
- [ ] Windows Installer (wenn Nachfrage)
- [ ] Dark Mode
- [ ] Deutsche UI-Uebersetzung
- [ ] Dokumenten-Zoom (Slider)
- [ ] Crash-Reporter (Sentry)
- [ ] Vollstaendiges WCAG 2.1 AA Accessibility-Audit
