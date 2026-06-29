# Penwright — Plan: „Für den Druck exportieren" (Print-Export)

> **Status:** ✅ **MVP + 2-up-Vorschau + Doppelseiten-Bild (`spread-image`) implementiert (2026-06-14).** Nur CMYK/PDF-X (§7) bleibt bewusst draußen (Engine-Grenze).
> **Erstellt:** 2026-06-13. **Autor:** René + Claude (Recherche + Architektur-Grounding gegen den Code).
> **Zweck:** Penwright vom „schönen Bildschirm-PDF" auf „an eine Druckerei lieferbar" heben — für hochwertige Magazine (z. B. Garten-/Landschaftsbau-Magazin einer Agentur-Kundin), Broschüren, Flyer.
> **Lesereihenfolge vorab:** `CLAUDE.md` (Safe-Apply-Invariante, Persistenz-Schichten → **Style**), dann dieses Dokument.

---

## ✅ Implementiert (2026-06-14) — was gebaut wurde

Alle MVP-Schritte (§4.1–4.7) **plus** die 2-up-Doppelseiten-Vorschau (§6). Empirisch verifiziert (A4 + 5 mm → MediaBox 220×307 mm, Schnittmarken + Full-Bleed gerendert, Bildschirm-Build bleibt exakt A4); `tsc --noEmit` + `electron-vite build` + `build:mcp` grün; adversarialer Multi-Agent-Review = 0 echte Bugs.

- **Schema** (`styleTypes.ts`): `StyleLayout.bleed/cropMarks/facingPages/binding` — **optional** (additiv, Sanitizer-gefüllt, rückwärtskompatibel; die 7 Layout-Preset-Literale mussten nicht angefasst werden).
- **Generator** (`styleParser.ts`): `generateStyleTypst(style, { print: true })` — oversized `width`/`height` (Trim + 2×Bleed) via Typst-Ausdruck statt mm-Parsing, `PAPER_MM`-Tabelle, Bleed-Margen, Facing-Pages-Innen/Außenstege + Bundzuwachs (**live** im Bildschirm-Modus, nur der Bleed-Überlauf ist export-only), `#let style-bleed` (0mm Bildschirm / Bleed im Druck), `crop-marks(bleed)`-Helper im `foreground` (Markenlänge = Bleed → kein Clipping bei 3 mm). **Full-Bleed-Elemente brauchten KEINE Änderung** — sie bluten korrekt über die geerbte oversized Seite (`#page(margin: 0pt, background: image(width:100%,height:100%))`); `style-bleed` ist für künftige explizite Snippets (`spread-image`) exportiert.
- **Export** (`importExport.ts`): `ExportConfig.print`; `writePrintExportTemp()` schreibt temp `.penwright-style-print.typ` + temp Root (Style-Import umgebogen, Inject-Fallback für style-lose Projekte), kompiliert, räumt **beide** Temp-Dateien in `finally` auf — **kein safe-apply** (mutiert das Projekt nicht). `getExportableSections().printDefaults` belegt den Dialog vor. **PDF öffnet jetzt immer den Dialog** (auch Single-File) damit die Druckoptionen erreichbar sind. dpi-Preflight (`preflightPrintImages` + PNG/JPEG-Header-Parsing ohne Dependency, Schwelle ~1500 px) → IPC `export:preflightImages`.
- **UI** (`ExportDialog.svelte`): „Für den Druck"-Block (Bleed 3/5 mm/frei, Schnittmarken, Doppelseiten + Bundzuwachs, „Als Standard merken" → `style:save`-Pfad, RGB-Hinweis, Niedrigauflösungs-Warnung).
- **Layout-Preset** „Magazin (Druck) · A4 + 5 mm Beschnitt" (`layoutPresets.ts`); Theme-Apply (Renderer + MCP) erhält die Print-Felder.
- **MCP** (`server.ts`): `penwright_export_print({ outputPath, bleed?, cropMarks?, facingPages?, binding? })`; `MCP_SETUP_VERSION` 0.12.0 → **0.13.0** (Binary bei nächstem `package:mac`-Lauf neu bauen).
- **2-up-Vorschau** (§6): `zoomState.spread` + Toggle in der Vorschau-Leiste; `PdfPreviewPanel` rendert Seite 1 allein, dann 2–3, 4–5 … als Flex-Rows (pdf.js pro Seite, kein Re-`getDocument`); per-Projekt persistiert in `preferences.json` (`pdfSpread`).

- **Doppelseiten-Bild** (§5, `spread-image` — 23. Design-Element in `designElements.ts`): emittiert zwei Seiten (linke/rechte Hälfte), erzwingt Start auf gerader/linker Seite (`#pagebreak(to: "even")`), splittet das Bild **exakt mittig** über den Bund (beide Seiten rendern dasselbe `cover`-skalierte Bild, nur per `dx` versetzt → nahtlos), blutet über `style-bleed` an alle physischen Ränder. Empirisch verifiziert (Richtungs-Testbild: Bänder 3-4-5 | 6-7-8 laufen lückenlos über die Naht; Parität korrekt; optionaler Credit unten rechts im Beschnitt). Über MCP `penwright_insert_design_element({ elementId: "spread-image" })` nutzbar; `DESIGN_SKILL` um Print/Spread/Gutter-Creep-Hinweise ergänzt. **Voraussetzung:** `style.typ` muss `style-bleed` exportieren (alte Projekte einmal neu speichern).

**Bewusst offen:** nur noch §7 CMYK/PDF-X (Engine-Grenze, Nachschritt). Test-Checkliste §8 bleibt für manuelles QA gültig.

---

## 0. TL;DR — was gebaut wird und was nicht

**In-App (rein Typst-intern, kein Warten auf die Engine):** Penwright erzeugt ein **druckerei-taugliches PDF** mit **Beschnitt (Bleed), Schnittmarken, Innen-/Außenstegen (Bundzuwachs)** und einem **dpi-Preflight**. Das deckt ~80 % realer Magazin-Jobs ab (gerade Digital-/Onlinedruckereien, die RGB selbst konvertieren).

**Bewusst NICHT in-App (Engine-Grenze + Lizenz):** **CMYK-Farbmanagement + echtes PDF/X mit gesetzten Boxen.** Das bleibt ein **Nachschritt** (Acrobat Pro / Ghostscript / die Druckerei selbst). Begründung in §7.

**Stretch (eigenes Feature, später):** **Doppelseiten-Bilder** („double truck", Bild über zwei Seiten / über den Bund) + eine **Doppelseiten-Vorschau (2-up)** im PDF-Panel. Siehe §5–6.

---

## 1. Hintergrund: was eine Druckerei im Preflight verlangt

Fünf Dinge (Quellen unten in §9):

1. **CMYK statt RGB** — über ein eingebettetes ICC-Profil (z. B. ISO Coated v2 / PSO). → **Nachschritt** (§7).
2. **Beschnitt (Bleed)** — randabfallende Motive 3 mm (Magazine oft **5 mm**) über den Endformat-Rand hinaus. → **in-App** (§4.2).
3. **Schnittmarken (Crop/Trim Marks)** — Eckwinkel, die zeigen, wo geschnitten wird. → **in-App** (§4.2).
4. **PDF/X-1a oder PDF/X-4** — genormter Container mit definierten Trim/Bleed/Media-Boxen, eingebettete Fonts. → **teilweise** (Fonts bettet Typst ein; Boxen kann Typst NICHT setzen → §7).
5. **300 dpi Bilder** am Endformat (Strichgrafik 1200 dpi). → **dpi-Preflight in-App** (§4.5), Bilder bleiben unverändert eingebettet.

**Kritische Code-Erkenntnis:** Typst exportiert nur eine **MediaBox** (= physische Seitengröße), **keine TrimBox/BleedBox**. Daraus folgt die ganze Architektur: **die gezeichneten Schnittmarken SIND die Trim-Definition.** Eine echte PDF/X mit gesetzten Boxen entsteht erst im Nachschritt. Das ist akzeptiert (viele Digitaldruckereien arbeiten mit sichtbaren Schnittmarken), muss aber im UI-Text klar kommuniziert werden.

---

## 2. Was heute fehlt (Audit-Stand 2026-06-13)

| Anforderung | Heute in Penwright | Datei |
|---|---|---|
| Bleed | ❌ nur eine uniforme `margin` | [styleTypes.ts](../src/shared/styleTypes.ts) `StyleLayout` |
| Schnittmarken | ❌ | [styleParser.ts](../src/shared/styleParser.ts) Seiten-Emission ~Z. 294–314 |
| Innen-/Außensteg | ❌ nur uniform | dito |
| Druck-Flags beim Compile | ❌ keine | [typstPath.ts](../src/main/typstPath.ts) `buildTypstCompileArgs` |
| dpi-Warnung | ❌ | — |
| Full-Bleed-Elemente bleed-bewusst | ❌ gehen von Seite = Endformat aus | [designElements.ts](../src/shared/designElements.ts) `full-bleed-image` / `spread-opener` / `magazine-cover` |

Was schon da ist und genutzt wird: das gesamte Magazin-Layout-Vokabular (22 Design-Elemente, Themes/Layouts/Section-Styles), Fonts werden eingebettet, der `magazine-cover` macht per-page `#page(margin: 0pt)` (kleinster Full-Bleed-Schritt).

---

## 3. Architektur-Entscheidungen (vor dem Coden lesen)

### 3.1 Aktivierungsmodell — „das ist ein Druck-Projekt", einmal gesetzt

**Kein globaler Always-On-Modus und keine Pro-Export-Fummelei.** Die Druck-Eigenschaft ist eine **Projekt-Eigenschaft**, die einmal gesetzt wird und in `style.json` → `layout` lebt — konsistent mit dem bestehenden „nur Tokens, keine Magic-Flags"-Schema. Drei Ebenen:

1. **Aktivierung = einmal, am besten als Layout-Preset.** Die Druck-Parameter (Papier, `bleed`, `cropMarks`, `facingPages`, `binding`) werden in `style.json` persistiert. Auslöser idealerweise ein neues Preset **„Magazin (Druck) A4 + 5 mm Beschnitt"** in [layoutPresets.ts](../src/shared/layoutPresets.ts), genau wie die heutigen 7 Layout-Presets — ein Klick, das Projekt „ist" ab da ein Druckprojekt. **Kein separater Boolean-Modus**; das Signal ist schlicht „diese Layout-Tokens sind gesetzt" (intern: `bleed > 0` aktiviert die oversized Seite, `cropMarks && bleed>0` die Marken).

2. **Der entscheidende Split — was im Editieren sichtbar ist vs. nur im Export:**
   - **Live (Teil des Designs, gehört in die Editier-Vorschau):** `paper`, `facingPages`, `binding` (Innen-/Außensteg), `columns`. Ein gebundenes Heft mit Innensteg sieht anders aus als uniforme Ränder — das *soll* man beim Schreiben sehen. → diese Felder emittiert `apply-style` ganz normal, auch im Bildschirm-Modus.
   - **Nur Export (Druckvorstufe, NICHT beim Tippen):** der **Beschnitt-Überlauf** (oversized `width`/`height`) + die **Schnittmarken**. Sonst klebt jede Editier-Vorschau voller Eckwinkel. → nur der Print-Transform (§4.4) emittiert sie. Optionaler späterer „Druckansicht"-Toggle in der Vorschau (zeigt Marken/Beschnitt), default aus.

   Merkhilfe: **Seitengeometrie, die das Layout prägt = live; reine Prepress-Marken = export-only.** Ein Full-Bleed-Bild füllt im Editieren die Endformat-Seite (sieht richtig aus); erst im Export läuft es über `style-bleed` in den physischen Beschnitt.

3. **Export liest die Tokens.** „Für den Druck (PDF)" ist aus den Projekt-Werten **vorbelegt** (nichts neu einstellen), pro Export übersteuerbar. Es ist ein **Export-Zeit-Transform** (temp `style-print.typ`), der das echte `style.typ` nicht mutiert → **kein safe-apply nötig**, voll reversibel.

**Alltag:** Projekt anlegen → einmal Preset „Magazin (Druck)" → normal schreiben (Vorschau bleibt ruhig) → „Für den Druck exportieren" → druckerei-taugliches PDF. Ein digitaler Newsletter ohne das Preset bleibt unberührt (kein Bleed/keine Marken).

> **Alternativen, die wir NICHT nehmen:** (a) Bleed/Marken dauerhaft in `apply-style` emittieren → würde jede Editier-Vorschau zukleistern. (b) Ein globaler App-weiter „Druckmodus" → Print-ness ist pro Projekt, nicht pro App. (c) Reine Pro-Export-Optionen ohne Persistenz → man stellt bei jedem Export alles neu ein. Verworfen.

### 3.2 Der Export-Pfad ist ein eigener Transform, kein neues Style-Schreiben
`safeApplyDesign` (die Invariante aus `CLAUDE.md`) gilt für **In-App-Design-Mutationen**, die `style.typ` dauerhaft schreiben. Der Druck-Export schreibt **temporäre** Dateien (wie `writeExportTemp` heute), kompiliert, räumt auf — er mutiert das Projekt nicht und braucht daher **keinen** safe-apply-Pfad. Aber: er muss bei Compile-Fehler sauber abbrechen + Temp aufräumen (try/finally, wie `runFilteredExport` heute).

### 3.3 Geteilte Quelle, einmal richtig
Die Full-Bleed-Element-Anpassung (§4.3) passiert **einmal** in `designElements.ts` + dem Seiten-Generator. Danach legen **neue Projekte** automatisch korrekt an, und **bestehende** Projekte bekommen es, sobald sie den Druck-Export nutzen (der Generator emittiert die bleed-bewusste Variante). Keine Pro-Projekt-Handarbeit.

### 3.4 Wo der Code lebt
- **Schema:** `src/shared/styleTypes.ts` (dependency-free, shared).
- **Generator:** `src/shared/styleParser.ts` (`generateStyleTypst` + neue `emitPrintPage`-Hilfe).
- **Elemente:** `src/shared/designElements.ts`.
- **Export-Orchestrierung:** `src/main/importExport.ts` (`runFilteredExport` erweitern oder `runPrintExport` daneben).
- **UI:** `src/renderer/components/ExportDialog.svelte` (+ ggf. DesignPanel-Layout-Sektion für die persistierten Werte).
- **MCP (optional):** `src/mcp/server.ts` (`penwright_export_print`).

---

## 4. MVP — Schritt für Schritt

### 4.1 Schema-Erweiterung (`styleTypes.ts`)

`StyleLayout` um vier Felder ergänzen (alle mit Sanitizer + Default = „aus"):

```ts
export interface StyleLayout {
  // … bestehende Felder …
  /** Beschnitt (Bleed) — Typst-Länge wie "3mm" / "5mm". "" = kein Bleed (Default). */
  bleed: string;
  /** Schnittmarken zeichnen. Default false. Greift nur, wenn bleed > 0. */
  cropMarks: boolean;
  /** Facing-Pages: Innen-/Außenstege statt uniformer Marge. Default false. */
  facingPages: boolean;
  /**
   * Bei facingPages: zusätzlicher Innensteg (Bundzuwachs) — Typst-Länge.
   * "" = kein Zuwachs. Wird auf die Innen-Marge addiert.
   */
  binding: string;
}
```

- Sanitizer: `bleed`/`binding` → `pickLenOrEmpty`; `cropMarks`/`facingPages` → `pickBool`.
- In `DEFAULT_PROJECT_STYLE.layout` ergänzen: `bleed: '', cropMarks: false, facingPages: false, binding: ''`.
- **Wichtig (Rückwärtskompatibilität):** `sanitizeProjectStyle` füllt fehlende Felder aus dem Default → bestehende `style.json` ohne diese Keys brechen nicht.
- Optional: `marginInside` / `marginOutside` / `marginTop` / `marginBottom` als getrennte Felder, falls die uniforme `margin` für Facing-Pages nicht reicht. **MVP-Vereinfachung:** `facingPages` leitet Innen/Außen aus der bestehenden `margin` ab (innen = margin + binding, außen = margin), statt vier neue Felder. Erst wenn nötig, splitten.

### 4.2 Seiten-Generator (`styleParser.ts`)

Die Seiten-Emission sitzt heute bei ~Z. 294–314 (`pageProps`-Array → `set page(...)`). Für den Druck-Export wird `generateStyleTypst` um einen **Modus-Parameter** erweitert: `generateStyleTypst(style, { print: true })`. Im Print-Modus:

**(a) Oversized Seite statt `paper:`-String.** Typsts `paper: "a4"` gibt das Endformat; für Bleed muss man **explizite `width`/`height` = Endformat + 2×Bleed** setzen. Dafür eine **Papiermaß-Tabelle** anlegen (mm), mind. für die genutzten Formate:

```ts
const PAPER_MM: Record<string, [number, number]> = {
  a2: [420, 594], a3: [297, 420], a4: [210, 297], a5: [148, 210],
  'us-letter': [216, 279], // … bei Bedarf erweitern
};
```
- Querformat (`orientation === 'landscape'`) → Maße tauschen statt `flipped: true` (weil wir jetzt explizite width/height setzen).
- `width = w + 2*bleed`, `height = h + 2*bleed` (in mm, als `…mm` emittiert).

**(b) Margen relativ zum Endformat-Rand.** Der Inhalt soll am selben Platz sitzen wie ohne Bleed → die physische Marge = **Bleed + gewünschte Marge**:
- Uniform: `margin: (top: <bleed+margin>, bottom: …, left: …, right: …)`.
- Facing-Pages: `margin: (inside: <bleed+margin+binding>, outside: <bleed+margin>, top: <bleed+margin>, bottom: <bleed+margin>)` — Typst löst `inside`/`outside` pro Seitenparität automatisch auf.

**(c) Schnittmarken im `foreground`.** Eine Helper-Funktion `crop-marks(bleed)` in `style.typ` emittieren, die acht Eckwinkel via `place` + `line` zeichnet — je Ecke zwei Linien, die **außerhalb** des Endformats (im Beschnittbereich) liegen und **nicht** in den Inhalt ragen. Ins `set page(foreground: crop-marks(<bleed>))` hängen (nur wenn `cropMarks && bleed>0`). Skizze der Mechanik:

```typst
#let crop-marks(bleed) = context {
  let m = 4mm           // Markenlänge
  let g = bleed         // Abstand vom physischen Rand = Beschnittbreite
  // pro Ecke: eine horizontale + eine vertikale Linie, die am Endformat-Eck ansetzt
  // und nach außen in den Beschnitt läuft. place(top+left, dx:.., dy:..) + line(length:..)
  // … vier Ecken × 2 Linien …
}
```
Details beim Bauen ausarbeiten (Vorzeichen/dx/dy je Ecke). Alternativ prüfen, ob ein gebündeltes Package das schon kann — Stand Audit: keines der 24 Packages liefert Marken, also selbst zeichnen.

**(d) `set page(...)` zusammenbauen** wie heute (fill/numbering/header/footer bleiben), nur `paper:` → `width:`/`height:` und `margin:` ersetzt, `foreground:` ergänzt.

> **Nachprüfen beim Bauen:** Setzt man `width`/`height` **und** `columns` gleichzeitig, bleibt das Spaltenlayout korrekt? (Sollte — `columns` ist orthogonal.) Und Header/Footer sitzen relativ zur Marge, also automatisch richtig im Beschnitt-Offset.

### 4.3 Bleed-bewusste Full-Bleed-Elemente (`designElements.ts`)

Heute füllen `full-bleed-image`, `spread-opener`, `magazine-cover` die **Endformat**-Seite (per `#page(margin: 0pt)` o. ä.). Im Druck mit oversized Seite müssen sie bis zum **physischen** Rand laufen, sonst entsteht genau der weiße Blitzer, den Bleed verhindern soll.

**Lösung:** Die Elemente so umstellen, dass sie das Bild über `place` + negative Offsets / `#rect(width: 100% + 2*bleed, …)` bis zum physischen Rand ziehen — gesteuert über eine **module-level Variable `style-bleed`**, die `style.typ` exportiert (analog zu `style-colors` / `style-fonts`). Im Bildschirm-Modus ist `style-bleed = 0mm` → Verhalten unverändert; im Druck-Modus = der echte Bleed → die Elemente laufen automatisch über.

- `style.typ` exportiert `#let style-bleed = <bleed-or-0mm>` (Generator).
- Die drei Elemente referenzieren `style-bleed` in ihren Maß-Berechnungen.
- **Einmalige Änderung an drei Snippets** + eine Generator-Zeile. Danach: jedes Projekt korrekt, neue wie bestehende.

> **Test-Kern:** ein `full-bleed-image` im Druck-Export → das Bild muss in der oversized PDF bis an den physischen Seitenrand reichen (über die Schnittmarken-Linie hinaus), nicht am Endformat enden.

### 4.4 Export-Pfad (`importExport.ts`)

`runFilteredExport` (Z. 180–241) ist die Vorlage. Zwei Optionen:

- **A (empfohlen, minimal):** `ExportConfig` um `print?: { bleed; cropMarks; facingPages }` erweitern. Wenn gesetzt **und** `format === 'pdf'`:
  1. `style = getProjectStyle(projectDir)`, Druckwerte aus `config.print` drübermergen.
  2. Temporäres `style-print.typ` via `generateStyleTypst(style, { print: true })` schreiben **neben** das echte `style.typ`.
  3. Temp-Root schreiben (wie `writeExportTemp`), aber `#import "style.typ"` → `#import "style-print.typ"` umbiegen.
  4. `execFileSync(getTypstPath(), buildTypstCompileArgs([tempRoot, outFile]))`.
  5. `finally`: beide Temp-Dateien löschen.
- **B:** eigener `runPrintExport()` daneben — sauberer getrennt, mehr Duplikat.

→ **A**, weil es den bestehenden Filter-/Temp-/Cleanup-Pfad wiederverwendet.

**Compile-Flags:** Stand heute reicht `buildTypstCompileArgs([root, out])` (Fonts werden eingebettet). **Kein** zusätzliches Typst-Flag macht CMYK/PDF/X — das geht nicht über die CLI. Also keine neuen Flags im MVP.

### 4.5 dpi-Preflight (Heuristik)

Vor dem Druck-Export einen **Pre-Check** laufen lassen, der alle im Projekt referenzierten Bilder findet und bei wahrscheinlicher Niedrigauflösung warnt:

- Bild-Referenzen aus den `.typ` ziehen (`image("…")` / die Figure-Snippets) — ein Regex-Scan reicht.
- Pixelmaße aus dem Datei-Header lesen (PNG: IHDR-Bytes; JPEG: SOFn-Marker) — **keine** Dependency nötig, ein paar Zeilen Buffer-Parsing, oder `image-size`/`probe-image-size` als kleine Dep.
- **Heuristik** (weil das Platzierungsmaß compile-time ist und Penwright es statisch nicht kennt): warnen, wenn ein Bild < ~1500 px Kantenlänge hat (reicht bei A4-Vollbreite nicht für 300 dpi). Schwelle dokumentieren als „grobe Warnung", nicht als exakter dpi-Wert.
- Surface: ein Hinweis-Schritt im Export-Dialog („3 Bilder evtl. zu niedrig aufgelöst: …, trotzdem exportieren?"), nicht-blockierend.

### 4.6 UI (`ExportDialog.svelte`)

- Im Export-Dialog (öffnet bei Multi-Kapitel; Single-File geht direkt) einen **Modus „Für den Druck" (PDF)** ergänzen, der die Druck-Optionen zeigt: Bleed (3/5 mm Dropdown + frei), Schnittmarken (Checkbox), Facing-Pages/Bundzuwachs (Checkbox + Länge).
- Persistierte Defaults aus `style.json` vorbelegen; Änderungen im Dialog können optional zurück in `style.json` (über den normalen `style:save`-Pfad → safe-apply) oder nur für diesen Export gelten. **MVP:** nur für diesen Export, mit „als Standard merken"-Checkbox.
- **Klartext-Hinweis** im Dialog: „Erzeugt ein druckerei-taugliches PDF mit Beschnitt + Schnittmarken in **RGB**. Für farbverbindlichen Offsetdruck konvertiert die Druckerei (oder ein Nachschritt) nach CMYK/PDF-X." — verhindert falsche Erwartung.
- i18n: neue Keys im `exportDialog`-Namespace (en + de), Shape in `en/exportDialog.ts` führend.

### 4.7 MCP (optional, aber naheliegend)

- `penwright_export_print({ outputPath, bleed, cropMarks, facingPages, selectedChapters? })` analog zu `penwright_export_pdf` — route durch denselben Print-Export-Transform, `resolveInsideProject`-Pfadvalidierung.
- Damit kann Claude im Magazin-Workflow direkt eine Druck-PDF erzeugen.
- **`MCP_SETUP_VERSION` bumpen** (der Serializer/Export steckt in der Bun-Binary) → Setup-Wizard re-triggert, Bestandsnutzer bekommen die neue Binary. Siehe `CLAUDE.md` → MCP packaging.

---

## 5. Doppelseiten-Bilder („double truck") — ✅ implementiert (2026-06-14)

Ein Bild, das über zwei gegenüberliegende Seiten **über den Bund** läuft — klassisches Magazin-Element. Gebaut als 23. Design-Element `spread-image` (siehe Implementierungs-Summary oben). Die unten beschriebene Mechanik + Fallstricke wurden umgesetzt; die folgenden Notizen bleiben als Referenz.

### Mechanik
Typst rendert **eine Seite pro `page`** — es gibt kein natives „dieses Bild über zwei Seiten". Lösung: ein Macro `spread-image(path, ..)`, das **zwei Seiten** emittiert:
- **Linke (gerade) Seite:** linke Bildhälfte, die am **inneren** Rand (Bund) bündig sitzt und am **äußeren** + oben/unten in den Beschnitt überläuft.
- **Rechte (ungerade) Seite:** rechte Bildhälfte, spiegelbildlich.
- Umsetzung: volles Bild laden, je Seite via `place` + `clip`/Offset die passende Hälfte zeigen (linke Seite: Bild um halbe Breite nach links versetzt anzeigen; rechte Seite: rechte Hälfte). `#page(margin: 0pt)` + `style-bleed`-Überlauf wie bei Full-Bleed.

### Fallstricke (im Plan festhalten)
1. **Seitenparität.** Ein Spread MUSS auf einer geraden (linken) Seite **beginnen**. Das Macro muss prüfen/erzwingen, dass die linke Hälfte auf einer geraden Seite landet — ggf. eine Leerseite davor einfügen (`#pagebreak(to: "even")` o. ä.). Setzt Facing-Pages-Denken voraus.
2. **Bundverlust (Gutter Creep / Shingling).** Ein schmaler Streifen verschwindet im Bund. → kritische Motive (Gesichter, Text) **nicht** mittig an den Bund legen; manche Druckereien wollen ein paar mm über die Mitte dupliziert. Als Hinweis im `DESIGN_SKILL` + Element-Doku.
3. **Auflösung.** Das Bild braucht ~2× Breite (zwei Seiten). dpi-Preflight (§4.5) greift hier besonders.
4. **Bildschirm-Vorschau.** Im normalen 1-up-Preview sieht man zwei Halbbilder auf getrennten Seiten — verwirrend. → braucht die 2-up-Vorschau aus §6, um sinnvoll beurteilbar zu sein.

### Scope-Empfehlung
Erst nach MVP. Als 23. Design-Element (`spread-image`) in `designElements.ts` + MCP `penwright_insert_design_element`-Eintrag. Kein eigenes Schema nötig (nutzt `style-bleed` + Facing-Pages).

---

## 6. Companion: Doppelseiten-Vorschau (2-up / Facing Pages)

Nützlich für **jedes** Magazin (nicht nur Spreads): die Vorschau so anzeigen, wie das Heft aufgeschlagen wird.

- **Ort:** `src/renderer/components/PdfPreviewPanel.svelte` (rendert heute pdf.js Seite für Seite).
- **Mechanik:** neuer Ansichtsmodus „Doppelseite" — render Seite *N* und *N+1* nebeneinander, mit korrekter Parität: **Seite 1 allein rechts**, dann **2–3, 4–5, …** als Paare (so öffnet ein Magazin). pdf.js kann jede Seite einzeln rendern (`page.getViewport` + `renderPage`), also zwei Canvas nebeneinander im Spread-Container.
- **Reiner Vorschau-Modus**, entkoppelt vom Export. Toggle in der Vorschau-Leiste (neben dem bestehenden Zoom/Refresh).
- **Zoom/Scroll:** die bestehende `BASE_SCALE * pdfZoom`-Logik gilt pro Canvas; horizontaler Platz für zwei Seiten → ggf. Default-Zoom im Spread-Modus kleiner.
- **Aufwand:** moderat, in sich geschlossen, kein Backend. Guter eigenständiger Quick-Win — auch ohne Spreads ein Magazin-Feature.

---

## 7. Farbmanagement / PDF/X — externer Nachschritt (NICHT in-App)

**Warum nicht in-App:**
- Typst bettet **kein ICC-Profil** ein (Issue [#3143](https://github.com/typst/typst/issues/3143) offen) und kann **keine PDF/X-Boxen** setzen. CMYK-*Farbwerte* gibt Typst zwar an, aber ohne Profil drucker-untauglich.
- Es gibt keine sauber permissiv-lizenzierte Lib, die „RGB-PDF → PDF/X-4 CMYK mit Profil" in einem Aufruf macht und sich bedenkenlos in eine **kommerzielle** Electron-App bündeln lässt.

**Empfohlene Wege (in dieser Reihenfolge im Handbuch dokumentieren):**
1. **Druckerei macht die Vorstufe.** Penwright liefert oversized RGB-PDF mit Schnittmarken + Bleed; die Druckerei konvertiert mit **ihrem** kalibrierten Profil → für farbkritische Hochglanz-Ausgaben das **beste** Ergebnis. Default-Empfehlung.
2. **Acrobat Pro** (manuell): „Druckproduktion → Farben konvertieren" (ISO Coated v2) + „Beschnittzeichen" + als PDF/X-4 speichern.
3. **Ghostscript** (automatisierbar): RGB→CMYK + PDF/X-3 in einem Aufruf. **Lizenz-Caveat:** Ghostscript ist **AGPL** → in einer kommerziellen App nur als **optionales, vom Nutzer selbst installiertes** externes Tool aufrufen (nicht mitbündeln), oder Finger weg und auf Weg 1/2 verweisen. Falls je integriert: als „externer Konvertierer (Pfad in Settings)"-Feature, klar getrennt vom App-Binary.

**Re-Eval-Trigger:** sobald Typst upstream ICC/PDF-X liefert (#3143), die in-App-CMYK-Tokens + Profil-Einbettung nachziehen. Bis dahin bewusst draußen.

---

## 8. Test-Checkliste (beim Bauen abarbeiten)

- [ ] `style.json` ohne die neuen Felder lädt fehlerfrei (Default-Auffüllung).
- [ ] Bildschirm-Vorschau **unverändert** (kein Bleed/keine Marken im normalen Preview).
- [ ] Druck-Export A4 + 3 mm Bleed: PDF-MediaBox = 216×303 mm; Inhalt sitzt am selben Platz wie ohne Bleed.
- [ ] Schnittmarken: acht Eckwinkel, im Beschnitt, ragen nicht in den Satzspiegel.
- [ ] `full-bleed-image` im Druck-Export läuft bis zum **physischen** Rand (über die Trim-Linie), kein weißer Blitzer.
- [ ] Facing-Pages: Innensteg > Außensteg, korrekt pro Seitenparität (linke vs. rechte Seite).
- [ ] dpi-Preflight: ein absichtlich kleines Bild (z. B. 600 px) löst die Warnung aus; großes nicht.
- [ ] Compile-Fehler im Druck-Export → Temp-Dateien (`style-print.typ` + Temp-Root) sauber aufgeräumt (try/finally).
- [ ] Multi-Kapitel-Druck-Export respektiert die Kapitelauswahl (Filter-Pfad).
- [ ] (falls MCP) `penwright_export_print` schreibt nur innerhalb des Projekts; `MCP_SETUP_VERSION` gebumpt; Binary neu gebaut (beide Mac-Archs).
- [ ] (Stretch) `spread-image` beginnt auf gerader Seite; 2-up-Vorschau zeigt die Hälften zusammenhängend.
- [ ] `tsc --noEmit` + `electron-vite build` grün; bei MCP-Änderung `node esbuild.mcp.mjs` grün.

---

## 9. Aufwand & Reihenfolge

| Schritt | Aufwand | Abhängigkeit |
|---|---|---|
| 4.1 Schema | klein | — |
| 4.2 Generator (Bleed/Marken/Margen) | **mittel** (Papiertabelle + Marken-Geometrie) | 4.1 |
| 4.3 Full-Bleed-Elemente bleed-bewusst | klein–mittel (die eine Falle) | 4.2 |
| 4.4 Export-Pfad | klein (Wiederverwendung) | 4.2 |
| 4.5 dpi-Preflight | klein (Heuristik) | — |
| 4.6 UI + i18n | mittel | 4.4 |
| 4.7 MCP | klein | 4.4 |
| **MVP gesamt** | **~1 fokussierte Session** | |
| 6 2-up-Vorschau | mittel, eigenständig | — |
| 5 Doppelseiten-Spread | mittel–groß (Parität, Splitting) | MVP + §6 |

**Empfohlene Reihenfolge:** 4.1 → 4.2 → 4.3 → 4.4 → 4.6 (→ 4.5, 4.7) = lieferbares MVP. Danach §6 (2-up-Vorschau, eigenständiger Quick-Win), dann §5 (Spreads) bei Bedarf.

---

## 10. Bewusst draußen (kein Scope)
- **Sonderfarben / Pantone** — Nische, Typst-seitig ohnehin nicht profil-verwaltet.
- **Imposition / Ausschießen** (Bogenmontage) — macht die Druckerei / ein RIP.
- **In-App-CMYK-Vorschau / Softproof** — bräuchte Farbmanagement, das Typst nicht liefert.

---

## 11. Quellen (Recherche 2026-06-13)
- Typst Color-Management (CMYK/ICC, offen): https://github.com/typst/typst/issues/3143
- Typst Bleed/Page-Options: https://github.com/typst/typst/issues/3131
- Typst Forum — Bleed/Trim/Crop: https://forum.typst.app/t/bleed-trim-slug-crop-marks-for-printing/123
- PDF/X erklärt (IMG.LY): https://img.ly/blog/what-does-print-ready-pdf-mean-understanding-pdf-x-standards-for-professional-printing/
- Prepress-Checkliste 2026 (PDF Press): https://pdfpress.app/blog/print-ready-pdf-guide
- Affinity — Print-Design-Guide: https://www.affinity.studio/blog/print-design-everything-you-need-to-know
