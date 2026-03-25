# vswrite — Feature-Übersicht & Roadmap

> **Stand:** 2026-03-22
> Zusammenfassung aller implementierten Features und verbleibende Nice-to-Have Features für zukünftige Sessions.

---

## Abgeschlossene Features (Phase 1–17)

### Kern-Editor (Phase 1–5)
- WYSIWYG-Editor auf Basis von TipTap/ProseMirror in Svelte 5 Webview
- Bidirektionale Serialisierung Typst ↔ TipTap JSON (Round-Trip-sicher)
- Raw Blocks für nicht-darstellbare Typst-Elemente (Math, Config, Code, Comments)
- Toolbar mit allen Formatierungen, reaktive Button-States
- Slash Commands (`/`) mit 11 Befehlen
- Link-Editor (`Cmd+K`), Statusbar (Wörter, Kompilierungsstatus)
- Live-Preview via SVG (Typst CLI), auto-compile bei Änderungen

### Command Hub & Export (Phase 6)
- ☰ Aktions-Menü mit gruppierten Commands (Insert, Format, File, Style Templates, Help)
- PDF Export (`typst compile → .pdf`)
- Keyboard Shortcut Cheatsheet

### Settings & Projekt-Scaffolding (Phase 7)
- Dokument-Settings Panel (Font, Size, Language, Paper, Margins, Leading, Spacing, Indent, Heading Numbering, Page Numbers, Header/Footer, Columns, Page Fill, Bibliography Style)
- 5 Projekt-Templates (Document, Thesis, Paper, Letter, Book)
- New File / New Project Commands

### Multi-File & Bilder (Phase 8)
- Kapitel-Merge (rekursive `#include`-Auflösung → neue Datei / PDF / Clipboard)
- Kapitel-Übersicht Sidebar (Heading-Hierarchie, Navigation)
- Bild-Support: File-Picker, Drag & Drop, Paste, `assets/`-Auto-Verwaltung

### UX-Verfeinerung (Phase 9)
- Focus Mode (dimmt umgebende Absätze)
- Suchen & Ersetzen (`Cmd+F`/`Cmd+H`)
- Wort-Ziel mit Fortschrittsanzeige
- Quick-Settings Toolbar (Font Size, Spacing, Language)
- Kapitel-Split an H1-Grenzen

### Include-Manager & Preview-Sync (Post-Phase 9)
- Include-Manager Sidebar (Drag & Drop, ↑/↓, hinzufügen/entfernen)
- Heading-Navigation scrollt im WYSIWYG-Editor
- Preview folgt Tab-Wechsel

### Fußnoten, Tabellen & Style Templates (Phase 10)
- Fußnoten mit Popup-Editor und Auto-Nummerierung
- Tabellen-Editor mit Control-Bar
- 6 Style Templates (Classic Academic, Modern Clean, Minimal, Vibrant, Elegant, Professional Report)

### AI Agent Kompatibilität (Phase 11)
- Block-Level Reconciler: Externe Edits als Undo-fähige Transaktionen
- Cursor-Erhaltung bei externen Änderungen

### Zitations-Management (Phase 12)
- BibTeX-Parser, BibWatcher, `@`-Autocomplete
- Auto-Import aus PDFs (DOI → CrossRef API)
- Manuelle Zitations-Eingabe
- Literaturverzeichnis-Vorschau im Editor

### Bild-Dialog & Textausrichtung (Phase 13)
- Bild-Dialog (Breite, Alt-Text, Alignment)
- Textausrichtung (Left/Center/Right/Justify) mit Shortcuts
- Drag & Drop aus VS Code Explorer
- Style Templates Submenu im Command Hub

### CLI Tool & AI Agent Integration (Phase 14)
- Shared Library (`src/shared/`) — plattformunabhängige Kernlogik
- `vswrite-cli` mit 14 Commands (info, check, merge, split, compile, etc.)
- Auto-Install ins Terminal PATH, SKILL.md Auto-Deployment
- `--json` Flag für maschinenlesbare Ausgabe

### Compile Delay, Root-Erkennung, Bibliographie Multi-File (Phase 15)
- Konfigurierbarer Compile-Delay (VS Code Setting: 0.5s/1s/2s/4s, Default 2s)
- Scroll-Position-Erhaltung im Preview bei Recompile
- Bibliographie in `#include`-Dateien: Extension sucht `#bibliography` auch in inkludierten Dateien und kann Style dort ändern
- 3 SKILL.md-Varianten (vswrite, typst, research) für AI-Agenten aktualisiert

### Typewriter Mode, Spellcheck, Undo AI Edit, Conflict Guard (Phase 16)
- Typewriter Mode: Cursor bleibt vertikal zentriert beim Schreiben
- Browser-native Rechtschreibprüfung mit Sprach-Synchronisierung
- Undo Last AI Edit: Snapshot-basierter Undo für externe Edits (max 20 Snapshots)
- Conflict Guard: Puffert AI-Edits während User aktiv tippt, wendet nach 2s Pause an

### Welcome Screen, Error Recovery, DOCX Export (Phase 17)
- Welcome Screen mit Feature-Highlights, Typst-Installationshinweis, "Don't show again"
- User Guide im Command Hub (☰ → Help → User Guide)
- Error Recovery: Deserializer-Fehler werden als Notification angezeigt mit "Open as Source" Fallback
- DOCX Export via `docx` npm Package (Extension + CLI: `vswrite-cli export-docx`)
  - Headings (nummeriert), Paragraphen, Listen, Tabellen, Bilder, Links, Fußnoten, Seitenumbrüche
  - Table of Contents, Bibliographie aus .bib-Dateien
  - Multi-File Support (Includes werden vor Export aufgelöst)
  - Config-Blocks (#set, #show, #import) werden gefiltert
- Artsy Style Template
- Heading Numbering Fix

---

## Vor Release

### Licensing & Monetarisierung

> Kommt als letztes — nach dem Feature-Freeze, wenn alle Features stabil sind.

#### Freemium-Modell mit LemonSqueezy

**Modell:** Kostenlose Basisversion im VS Code Marketplace + Pro-Jahresabo (10€/Jahr) über LemonSqueezy. 14-Tage kostenlose Trial der Pro-Features für neue Nutzer.

**Warum LemonSqueezy statt eigenem Server:**
- Übernimmt EU-MwSt-Handling (Merchant of Record) — kein eigenes Steuerthema
- Subscription-Management (Verlängerung, Kündigung, Rechnungen) eingebaut
- License-Key API für Validierung — kein eigener Auth-Server nötig
- Hosted Checkout — keine eigene Payment-Seite bauen
- Webhook-Support für Key-Aktivierung/Deaktivierung

**Kostenlos (Free Tier):**
- WYSIWYG Editor (Kernfunktion)
- Grundformatierung (Bold, Italic, Headings, Lists, Blockquotes, Code Blocks)
- Slash Commands
- Search & Replace
- Live Preview

**Pro (10€/Jahr — 14-Tage Trial inkl.):**
- Style Templates
- PDF Export
- DOCX Export
- Multi-File Support (Merge, Split, Include Manager)
- Project Templates
- Footnotes
- Tabellen-Editor
- Document Settings Panel
- Focus Mode
- Word Goal
- Zitations-Management
- AI Agent Kompatibilität

**Technische Umsetzung:**

1. **`licenseManager.ts`** (Extension Host):
   - License Key in `globalState` speichern (persistiert über Sessions)
   - Validierung gegen LemonSqueezy License API (`POST https://api.lemonsqueezy.com/v1/licenses/validate`)
   - Offline-Grace-Period: Key wird lokal gecacht, Revalidierung alle 7 Tage
   - `isProActive()` Hilfsfunktion für Feature-Gates

2. **Feature-Gate Pattern:**
   ```typescript
   // In typstEditorProvider.ts oder jeweiligem Feature
   if (!licenseManager.isProActive()) {
     vscode.window.showInformationMessage(
       'PDF Export is a Pro feature. Upgrade for €10/year.',
       'Upgrade'
     ).then(choice => {
       if (choice === 'Upgrade') openCheckoutUrl();
     });
     return;
   }
   ```

3. **Commands:**
   - `vswrite: Activate License` — Input-Box für License Key → Validierung → Freischaltung
   - `vswrite: Manage License` — Zeigt Status (Free/Pro, Ablaufdatum), Link zum Kundenportal
   - `vswrite: Upgrade to Pro` — Öffnet LemonSqueezy Checkout im Browser

4. **UX bei gesperrten Features:**
   - Pro-Features im Command Hub mit kleinem "Pro" Badge markiert
   - Klick zeigt freundlichen Upgrade-Hinweis (nicht blockierend, nicht nervig)
   - Kein Nag-Screen, kein Timer — einfach Feature nicht verfügbar mit Erklärung

5. **LemonSqueezy Setup:**
   - Produkt erstellen: "vswrite Pro" (Subscription, 10€/Jahr)
   - License Key Generation aktivieren
   - Checkout-Link generieren (wird in Extension hinterlegt)
   - Optional: Webhook für automatische Key-Deaktivierung bei Kündigung

#### Landing Page

**Was:** Einfache Website für vswrite mit Produkt-Beschreibung, Feature-Übersicht, Pricing und Checkout-Link.

**Umsetzung:**
- Statische Seite (z.B. Astro oder plain HTML) auf Hetzner oder Vercel
- LemonSqueezy Checkout-Link eingebettet
- Screenshots / GIFs des Editors
- Klare Gegenüberstellung Free vs. Pro
- "Built for academics, by an academic" Messaging
