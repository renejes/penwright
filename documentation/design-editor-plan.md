# vswrite Desktop — Design Editor & Design-MCP-Tools

> **Status:** Geplant **vor v1.0**. Eintrag-Datum: 2026-05-16. Strategische Entscheidung 2026-05-16: vswrite wird von Anfang an als Design-Tool positioniert, nicht erst spaeter als Add-on. Geht zusammen mit dem [Third-Party-Bundling](third-party-licensing.md) (Hybrid-Strategie) als Pre-Release-Erweiterung.
>
> Was hier drinsteht: Konzept und Phasen-Plan, mit dem vswrite vom WYSIWYG-Editor fuer akademische Typst-Dokumente zum visuell editierbaren Design-Tool fuer beliebige PDF-Outputs erweitert wird. Akademisches Schreiben bleibt der Default-Use-Case — der Design-Editor ist additiv, nicht ersetzend.

---

## Strategische Einordnung

Das Vorhaben verschiebt vswrite's Positionierung. Aktuell: "WYSIWYG-Editor fuer Typst-Akademik". Mit Style-Editor + Design-MCP-Tools wird daraus: "Typst-basiertes Document-Design-Tool fuer Schreiber **und** Designer".

**Vorteile:**
- Groesserer Markt (Marketing-Brochures, Reports, Magazines, Posters, Business-Cards, alles was sich nicht in Word abbilden laesst aber zu komplex fuer Canva ist)
- Hoeherer Differentiations-Faktor — kein anderes Tool kombiniert Visual-Editing mit code-reproduzierbarem Backend
- Claude Desktop kann ueber MCP wirklich Design-Tasks uebernehmen, nicht nur Text-Tasks
- Reproduzierbares Design als USP gegenueber InDesign / Affinity / Canva: gleicher Source → identisches PDF, beliebig oft, diff-bar, versionierbar via Git

**Risiken:**
- UI-Bloat — zwei Personas im selben Tool, Sidebar voll
- Doku-Komplexitaet — unterschiedliche Workflows mit unterschiedlichen Begriffen
- Erwartungs-Kannibalisierung — Affinity / InDesign-Nutzer kommen mit Drag-and-Drop-Mindset rein, Typst ist code-first
- Build-Time-Performance bei Live-Preview wenn Style-Editor jeden Slider-Tick recompiliert

**Pragmatik (revidiert 2026-05-16):** Wir bauen das vor v1.0 ein. Der Launch verschiebt sich um ~6 Wochen, aber vswrite startet damit als Tool fuer Schreiber **und** Designer statt nachzuruesten. Differenzierungs-Faktor und gleichzeitige Marktbreite sind die Argumente. Akademische Features bleiben gleichwertig erhalten — der Design-Editor ist additiv, nicht ersetzend.

---

## Phase A — Style Variables (~1 Woche, geplant fuer v1.1)

**Minimal Viable Visual-Editing.** Erweiterung des bestehenden "Document Settings"-Dialogs um strukturierte Knobs fuer die haeufigsten Stil-Achsen.

### Datenmodell

Neue Datei `<project>/.vswrite/style.json` (analog zu `preferences.json`). Schema:

```json
{
  "version": "1",
  "colors": {
    "primary": "#0f172a",
    "accent": "#3b82f6",
    "text": "#1a1a1a",
    "background": "#ffffff",
    "muted": "#6b7280"
  },
  "fonts": {
    "body": "Inter",
    "heading": "Inter",
    "code": "JetBrains Mono"
  },
  "scale": {
    "base": "11pt",
    "leading": "1.5",
    "headingScale": "tight"
  },
  "layout": {
    "paper": "a4",
    "margin": "2.5cm",
    "columns": 1,
    "pageNumbering": "1 / 1"
  },
  "headings": {
    "h1": { "size": "24pt", "weight": "700", "color": "primary", "marginTop": "2em" },
    "h2": { "size": "18pt", "weight": "600", "color": "primary", "marginTop": "1.6em" }
  }
}
```

Aus diesem JSON wird ein `style.typ`-Block am Anfang von `main.typ` generiert (oder als separates `#include`). Round-Trip-faehig: existierende Preamble parsen → JSON → editieren → wieder Preamble schreiben. Bei Round-Trip-Konflikten (User hat handgepflegten Code, der nicht ins Schema passt) zeigt das UI eine Warnung: "Style enthaelt manuelle Anpassungen — Schreiben ueberschreibt diese". Save-Version-Empfehlung vor dem Speichern.

### UI

Im bestehenden `SettingsPanel.svelte` neue Section "Style" mit:
- Color-Picker (Hex + HSL) fuer die 5 Farb-Slots
- Font-Dropdowns (System-Fonts) fuer body / heading / code
- Numeric-Inputs fuer base-size + leading
- Paper-Dropdown + Margin-Picker
- Live-Preview rechts (debouncedes Recompile, 300 ms)

### Implementierungs-Aufwand

- `style.json` Schema + Read/Write in `persistenceManager.ts`: ~½ Tag
- `styleParser.ts` (JSON ↔ Typst Preamble): ~2 Tage
- UI-Erweiterung in `SettingsPanel.svelte`: ~2 Tage
- Live-Preview-Pipeline-Integration: ~½ Tag
- Tests + Doku: ~1 Tag

Geschaetzt **5–7 Werktage**. Risiko: Round-Trip-Parser fuer arbitraere bestehende Preambles ist schwierig — fuer v1.1 reicht "neue Projekte starten mit dieser Struktur, alte Projekte koennen migrieren wenn sie wollen".

---

## Phase B — Visual Style Editor (~3–4 Wochen, geplant fuer v1.2)

**Vollwertiges visuelles Design-Werkzeug.** Eigener Sidebar-Tab "Design" mit reichhaltigen Controls. Aufbauend auf der `style.json`-Schema-Infrastruktur aus Phase A.

### UI-Komponenten

- **Color palette tool**
  - 5–8 Farb-Slots (primary, accent, accent-2, text, text-muted, background, surface, border)
  - Hex / HSL / OKLCH-Picker
  - Palette-Presets ("Modern Tech", "Earth Tones", "Editorial", "High Contrast", "Minimalist Mono")
  - "Palette aus Bild extrahieren" — User dropt ein Bild rein, Color-Quantization (k-means oder Median-Cut) liefert 5 dominante Farben

- **Font browser**
  - System-Font-Enumeration via Electron `app.getFonts()` oder `fontkit`
  - Live-Preview-Karte fuer jede Schrift mit Body-Sample + Heading-Sample
  - Filter nach Sans / Serif / Mono / Display
  - Optional: Google-Fonts-Download nach `assets/fonts/` (Lizenz-Check, OFL-only)
  - Variable-Font-Achsen-Slider wenn die Schrift sie unterstuetzt

- **Heading style designer**
  - H1-H6 Cards mit Live-Preview
  - Pro Level: Size / Weight / Color / Letter-Spacing / Margin-Top / Margin-Bottom / Decoration (underline, border-bottom, full-width-bar)
  - "Apply Hierarchy" Preset-Buttons ("Editorial", "Academic", "Marketing", "Documentation")

- **Page layout**
  - Margins (top / right / bottom / left, optional gekoppelt)
  - Columns (1, 2, 3, asymmetric) mit Gap-Setting
  - Header / Footer Content + Style (incl. Page-Numbering-Format-Picker)
  - Page-Background: Solid Color / Gradient / Image (with Opacity)
  - Per-Page-Overrides: Cover-Page anders als Body-Pages

- **Special elements**
  - Blockquote (border-left + indent + color, oder Pull-Quote-Style mit big-quotes)
  - Code-Block (background, font, padding, border)
  - Figure / Caption (caption-position, font, color, separator)
  - Table (header-row-style, alternate-row-shading, border-style)
  - Callout-Boxes (Info / Warning / Tip — color + icon)

- **Layout-Presets**
  - Cover-Page-Builder ("Title-only", "Title + Logo", "Hero-Image + Text-Overlay", "Editorial Spread")
  - Layout-Presets: Brochure (Tri-Fold-Hint via Columns), Magazine (Multi-Column + Pull-Quotes), Business-Card (90×50mm Custom-Paper), Poster (A1/A2 + Grid-System), Thesis (Classic + Modern + Minimal)

### Live-Preview-Pipeline

- Debouncedes Recompile bei Style-Changes (300 ms)
- Side-Preview-Panel zeigt eine repraesentative Seite (User wechselt zwischen "Cover" / "Body" / "Tables" / "Lists" — Pre-rendered Demos)
- Bei Full-Document-Mode wird das aktuelle Dokument kompiliert

### Implementierungs-Aufwand

- Color-Palette-Tool inkl. Image-Color-Extraction: ~3 Tage
- Font-Browser mit System-Enumeration + Previews: ~3 Tage
- Heading-Style-Designer: ~2 Tage
- Page-Layout-Editor: ~2 Tage
- Special-Elements-Editor: ~3 Tage
- Layout-Presets (Cover-Builder + 5 Standard-Layouts): ~4 Tage
- Live-Preview-Pipeline-Refinement: ~2 Tage
- Tests, Doku, UX-Iteration: ~3 Tage

Geschaetzt **3–4 Wochen** mit moderaten Risiko-Aufschlaegen. Groesste Unknown: Google-Fonts-Integration (Rechtliches + Lizenz-Kompatibilitaet — eventuell auf OFL-Subset beschraenken).

---

## Phase C — Design-MCP-Tools (~2 Wochen, geplant fuer v1.2)

**Claude als Design-Partner ueber MCP.** Nachdem Phase A + B die JSON-basierte Style-Infrastruktur etabliert haben, koennen externe Agents wie Claude Desktop diese ueber neue MCP-Tools manipulieren.

### Sechs neue Tools

| Tool | Zweck |
|---|---|
| `vswrite_get_style` | Liefert das strukturierte Style-JSON. **Nicht** raw Typst-Code — Claude soll mit dem strukturierten Modell arbeiten, nicht mit der kompilierten Form. |
| `vswrite_update_style` | Patcht spezifische Properties (Deep-Merge). Beispiel: `{ colors: { primary: "#0f172a" } }` aendert nur die primary-Farbe, alles andere bleibt. Schreibt die aktualisierte `style.json` und generiert `style.typ` neu. |
| `vswrite_list_fonts` | Enumeriert User-System-Fonts mit Familie, Stil, Variable-Achsen-Info. Optional ein "preview" mit Sample-Render zurueckgeben. **Relevant** weil Claude sonst Schriften vorschlaegt, die der User nicht installiert hat. |
| `vswrite_apply_palette` | Wendet komplette Farbpalette an, mit Smart-Mapping (Primary → Headings, Accent → Links + Emphasis, Muted → Captions). Optional `mode: "preserve-text"` damit Body-Text-Color nicht ueberschrieben wird. |
| `vswrite_insert_design_element` | Fuegt vorgefertigte Design-Elemente in ein Dokument ein: Banner, Sidebar, Pull-Quote, Callout-Box, Hero-Section, Section-Divider. Aus einem mit-bundelten Library-File. Anker-basiert wie `add_image`. |
| `vswrite_generate_layout` | **High-Level:** nimmt eine Beschreibung (`"Brochure fuer Yoga-Studio in erdigen Toenen, A4 portrait, drei Spalten Body"`) und einen optionalen Content-Outline. Gibt einen kompletten `main.typ`-Vorschlag plus passende `style.json` zurueck. Verbindet die anderen Tools intern (list_fonts → wahl, apply_palette, update_style, insert_design_element x N). |

### Beispiel-Workflow ueber Claude Desktop

User: *"Mach mir eine Brochure fuer unsere AI-Tool-Suite. Modern und tech-affin, A4 portrait, drei Spalten, Hero auf der ersten Seite."*

Claude (intern):
1. `vswrite_list_fonts({ filter: "sans" })` → waehlt `Inter` (oder `IBM Plex Sans` als Tech-Vibe)
2. `vswrite_apply_palette({ palette: { primary: "#0f172a", accent: "#3b82f6", ... }, mode: "smart" })`
3. `vswrite_update_style({ layout: { columns: 3, paper: "a4" }, headings: { h1: { weight: "800", letterSpacing: "-0.02em" } } })`
4. `vswrite_insert_design_element({ element: "hero", afterText: "<doc-start>", config: { title: "AI Suite", subtitle: "Build faster" } })`
5. `vswrite_insert_design_element({ element: "section-divider", ... })` x 3
6. `vswrite_compile()` → verifiziert, dass das Layout kompiliert
7. Antwort an User mit Preview-Hinweis + Vorschlag fuer naechste Iteration

### Implementierungs-Aufwand

- Tool-Implementations (alle sechs): ~5 Tage
- Design-Element-Library (Banner / Sidebar / Pull-Quote / Callout / Hero / Divider als Typst-Snippets): ~3 Tage
- `generate_layout` LLM-Heuristik-Logik: ~3 Tage (haengt davon ab wie viel deterministisch generiert wird vs. Claude direkt mehrere Calls macht — der einfache Pfad ist "Claude macht 5 Calls", der elegantere ist "einer kompositer Call der intern routet")
- Tests + Doku + MCP-Server-Version-Bump: ~2 Tage

Geschaetzt **2 Wochen** wenn Phase A + B sauber abgeschlossen.

---

## Phase D — Design-Skill (~1 Woche, parallel zu Phase C)

Vierter Project-Skill neben `typst` / `vswrite` / `research` / `writing-style` (siehe [skillTemplates.ts](../src/shared/skillTemplates.ts)), speziell fuer Design-Tasks.

### Inhalt

- **Welche Layout-Pattern wofuer** — Hero-First fuer Marketing-Landing, Cover-Page fuer Theses, Magazin-Spread fuer redaktionellen Content, Grid-System fuer Poster
- **Color-Theory-Basics**
  - Primary / Secondary / Accent / Neutral-Mapping zu Document-Roles (Headings / Links / Callouts / Body)
  - WCAG-Kontrast-Mindestwerte (4.5:1 fuer Body, 3:1 fuer Large-Text)
  - Palette-Konsistenz-Regeln (max. 1 primary, max. 2 accents, mehrere muteds OK)
- **Typografie-Pairing**
  - Welche Schriften kombinieren (Serif-Body + Sans-Heading klassisch, Mono-Accent fuer Tech, ueberwiegend-Sans fuer Modern)
  - Variable-Font-Vorteile (Achsen-Steuerung statt mehrere Files)
  - Anti-Patterns (zwei aehnliche Sans, drei Schriften ohne klare Hierarchie)
- **"Modern looks 2026"** — empirische Notes
  - "Tech" = Sans + Tight-Letter-Spacing + Hoher Kontrast + Wenig Decoration
  - "Editorial" = Serif-Body + Display-Heading + Generous-Margins + Pull-Quotes
  - "Academic" = Serif + Klassische Margins + Subtile Numerierung + Bibliographie-prominent
  - "Minimal" = Eine Schrift + zwei Farben + viel Whitespace
- **Anti-Patterns**
  - Zu viele Schriften (>3)
  - Centered-Body-Text fuer mehr als 2 Zeilen
  - Sub-Pixel-Letter-Spacing in Body-Text
  - Background-Color, die WCAG-Kontrast verletzt
  - "Word-Document"-Look (Default-Times-New-Roman + 1.5-Leading) im Marketing-Kontext

### Aufwand

- Skill-Draft schreiben (200–300 Zeilen): ~3 Tage
- In `projectManager.ts` registrieren + MCP-Prompt-Registrierung: ~½ Tag
- Doku in CLAUDE.md + Handbuechern: ~1 Tag

Geschaetzt **1 Woche** parallel zu Phase C.

---

## Verworfen: Community-Template-Marketplace

War urspruenglich als Phase E geplant (User exportieren `.vswrite-template`-Files, teilen sie, andere installieren). Weggelassen weil:

- Benoetigt eigene Community-Building-Arbeit (Account-System, Moderation, Discovery)
- Phase A–D liefern bereits den ganzen Wert (private Templates funktionieren ueber `.vswrite/style.json` + git-share)
- Power-User koennen Templates ohnehin manuell via Repo-Sharing verbreiten

---

## Gesamt-Aufwand

| Phase | Aufwand | Release |
|---|---|---|
| Vorgelagert — Bundle-Setup ([third-party-licensing.md](third-party-licensing.md)) | ~4–6 Tage | v1.0 |
| A — Style Variables | ~1 Woche | v1.0 |
| B — Visual Style Editor | ~3–4 Wochen | v1.0 |
| C — Design-MCP-Tools | ~2 Wochen | v1.0 |
| D — Design-Skill | ~1 Woche (parallel C) | v1.0 |

Total: **~7–8 Wochen Vollzeit** bis das volle Bild steht. Vorgelagertes Bundle-Setup muss vor Phase B kommen, weil der Visual-Editor `wrap-it` (Text-um-Bild), `cetz` (Grafik) etc. als Garantierte-Verfuegbar-Packages braucht.

---

## Voraussetzungen vor Start

- Bundle-Liste finalisiert ([third-party-licensing.md](third-party-licensing.md)) und die Bundling-Infrastruktur (`resources/typst-packages/` + Audit-Script + Acknowledgments-Dialog) steht
- Klares Performance-Budget — Live-Preview muss bei Style-Changes spuerbar bleiben (Target: < 500 ms vom Klick zum aktualisierten Preview)
- Klare Entscheidung pro / contra Google-Fonts-runtime-Download (initial: nur OFL-Fonts mitbundlen, kein dynamischer Download)

---

## Offene Fragen

- Soll der Visual-Style-Editor das `main.typ` modifizieren, oder eine separate `style.typ` schreiben die per `#import` eingebunden wird? Zweite Variante ist sauberer (Style-Code separat von Content-Code), erste ist konventioneller fuer Typst.
- Wie tief soll Bilder-Embedding gehen? Photo-Backgrounds mit Blend-Modes / Overlays? Oder bewusst klein halten und auf externe Asset-Pipelines verweisen?
- Wo lebt die Design-Element-Library (Banner / Sidebar / Pull-Quote)? In-Repo als `src/shared/designElements.ts` oder als Typst-Package das ueber `#import "@local/vswrite-elements:0.1.0"` eingebunden wird? Letzteres ist sauberer aber komplexer im Build-Setup.
- Soll Variable-Font-Achsen-Steuerung in Phase A schon mit oder erst in Phase B? Inter-Variable z.B. waere ein einfaches Sample.
