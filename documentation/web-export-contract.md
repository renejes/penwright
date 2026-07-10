# Web-Export-Vertrag (Contract)

**Was der Penwright-Web-Export liefern muss, damit ihn eine Website sauber
einbetten *und* an ihre eigene Identität anpassen (skinnen) kann.**

Referenz-Konsument: `show-your-work` (renejesser.com). Aber der Vertrag ist
bewusst **generisch** — nichts hier ist site-spezifisch, damit Penwright
verkaufbar bleibt und *jeder* Käufer denselben Export in seine Seite ziehen kann.

---

## 1. Warum das überhaupt

Penwright exportiert fertiges HTML. Eine konsumierende Website will das auf zwei
Arten integrieren:

- **Einzel-Artikel** → die Seite zieht den Artikel-Block heraus und bettet ihn
  in ihre eigene Hülle ein (Kopf, Navigation, Fuß). Er soll sich wie ein
  normaler Beitrag der Seite anfühlen.
- **Magazin** → wird als eigenständige, mehrseitige Mini-Site gehostet (eigene
  Welt, eigenes Blättern). Die Seite verlinkt nur darauf.

Damit **beides** klappt — und damit die Seite den *Look* (Schrift, Farbe)
vereinheitlichen kann, ohne Penwrights *Layout* (Satz, Struktur, Bilder)
anzufassen — braucht der Export einen kleinen, klaren Vertrag. Die
Kern-Erkenntnis:

> **Penwright liefert die STRUKTUR. Der Konsument bringt den SKIN.**
> Struktur = Layout, Satz, Bildplatzierung, Typo-Hierarchie (Penwrights Stärke).
> Skin = Schriften, Farben, Texturen (die Identität der konsumierenden Seite).

Der Vertrag besteht aus drei Teilen: **meta.json**, **HTML-Struktur** und —
das Herzstück — **Design-Tokens als CSS-Variablen**.

---

## 2. `meta.json` — generisches Manifest (pro Export)

Ein maschinenlesbares Manifest, das jeder Konsument liest (Karten/Navigation
generieren, Artikel vs. Magazin unterscheiden).

**Einzel-Artikel:**
```json
{
  "title": "Der untätige Geist",
  "locale": "de",
  "kind": "article",
  "kicker": "Reportage",
  "byline": "Von Mara Lindqvist"
}
```

**Magazin:**
```json
{
  "title": "LANGSAM",
  "locale": "de",
  "kind": "magazine",
  "articles": [
    { "slug": "feature", "file": "feature.html", "title": "Der untätige Geist", "kicker": "Reportage", "byline": "Von Mara Lindqvist" }
  ],
  "assets": ["assets/feature.png"]
}
```

**Regeln:**
- `kind` (`"article"` | `"magazine"`) ist das **verlässliche Unterscheidungs-
  signal** — nicht raten. (Magazin hat zusätzlich `articles[]`.)
- **KEINE konsumenten-spezifischen Felder** in `meta.json`: kein `date`, `tags`,
  `summary`, `accent`, `category` o.ä. Die gehören der konsumierenden Seite und
  liegen dort *daneben* (in show-your-work z.B. als `board.json` neben dem
  Export). So bleibt `meta.json` generisch und Penwright verkaufbar.

---

## 3. HTML-Struktur — self-contained + einbettbar

- Jeder Artikel ist eine **vollständige HTML-Datei**, aber der Inhalt steckt in
  **einem** `<article class="pw-article"> … </article>`-Block. ✅ (macht ihr so)
- Der zugehörige `<style>` reist **im Block mit**, und **alle** Regeln sind auf
  `.pw-article` gescoped (Prefix). So bricht beim Einbetten nichts aus. ✅
- Der `<head>` darf einen minimalen Reset haben, aber **nichts, das beim
  Einbetten überleben muss** — der Konsument nimmt nur den `<article>`-Block und
  wirft `<html>`/`<head>`/Reset weg. (→ siehe aber `html{background}` unter §4.)
- **Magazin-Navigation** (vor/zurück/Index) klar markiert (`<nav class="pw-nav">`),
  damit ein Konsument sie beim Einzel-Einbetten sauber strippen kann. ✅
- **Optional, wünschenswert:** ein konfigurierbarer *Home/Zurück-Link*
  (Home-URL als Export-Option), damit ein gehostetes Magazin zurück zur
  Host-Seite verlinken kann. (Aktuell muss der Konsument den Link nach-injizieren.)

---

## 4. Design-Tokens als CSS-Variablen — das Herzstück fürs Skinnen

Der Konsument will den Look vereinheitlichen (eigene Schriften + Farben) — und
zwar mit **einem** Override für *alles* (Cover, Inhaltsverzeichnis, alle Artikel).
Das geht nur, wenn Penwright sein Design **konsequent über Variablen** exponiert.

**Die Tokens, die ihr schon nutzt** (bitte offiziell dokumentieren + überall
konsequent verwenden):

| Token | Zweck |
|---|---|
| `--pw-font-body` | Fließtext-Schrift |
| `--pw-font-heading` | Überschriften-Schrift |
| `--pw-font-code` | Monospace / Code |
| `--pw-primary` | Primärfarbe |
| `--pw-accent` | Akzentfarbe |
| `--pw-text` | Textfarbe |
| `--pw-background` | Hintergrund |
| `--pw-muted` | Gedämpfter Text |

**Drei konkrete Bitten (das ist die eigentliche Arbeit):**

1. **Tokens an `:root` setzen** (zusätzlich zu / statt `.pw-article`). Aktuell
   liegen sie *pro* `.pw-article` — dann re-skinnt ein Konsument nur den
   Artikel-Body, aber **Cover und Inhaltsverzeichnis eines Magazins bleiben
   außen vor**. An `:root` genügt *ein* Override für alles.

2. **Keine Farbe/Schrift außerhalb der Tokens hart reincodieren.** Alles, was
   hardcoded ist, bleibt beim Skinnen stehen. Konkretes Beispiel aus dem
   aktuellen Export: der `<head>`-Reset `html{background:#eef0ec}` — der sollte
   `var(--pw-background)` nutzen (oder skinbar sein), sonst muss der Konsument
   den Seiten-Hintergrund separat überschreiben.

3. **Token-Satz bei Bedarf erweitern** — je mehr skinbar, desto nahtloser.
   Kandidaten: `--pw-rule` (Linienstärke/-farbe), `--pw-measure` (Textbreite,
   aktuell hart `70ch`), `--pw-space` (Grundabstand). Optional, aber jedes
   zusätzliche Token macht den Skin sauberer.

**So skinnt ein Konsument** (nur zur Illustration — genau das macht
show-your-work heute):

```css
/* penwright-skin.css beim Konsumenten */
:root,
.pw-article {
  --pw-font-body: "Vollkorn", Georgia, serif;
  --pw-font-heading: ui-monospace, Menlo, monospace;
  --pw-background: transparent;
  --pw-text: #1a1a1a;
  --pw-accent: #8b2a38;
}
```

→ Penwrights Layout bleibt, aber alles trägt den Look des Konsumenten. Genau
das Ziel: *eigen im Satz, einheitlich im Look.*

---

## 5. Assets + Fonts (Performance + Portabilität)

- **Bilder:** relative `assets/…`-Pfade sind gut (der Konsument schreibt sie um).
  Aber bitte **web-groß exportieren** — aktuell sind es 4-MB-PNGs in
  Druckauflösung. Für Web: skalieren (z.B. max ~2000 px Kante) + komprimieren
  (WebP oder optimiertes JPG/PNG). Sonst lädt jede Seite mehrere MB.
- **Webfonts:** Soll ein **Standalone-Magazin sein eigenes Design behalten**,
  müssen die Schriften **gebündelt** sein (`@font-face` + `.woff2` in
  `assets/fonts/`) — sonst Fallback auf Georgia. (Im „vom Host geskinnten"
  Modus egal: der Host bringt seine eigenen Fonts mit.)

---

## 6. Wie der Konsument das nutzt (zum Verständnis)

1. `meta.json` lesen → `kind` entscheidet Artikel vs. Magazin; Titel/Kicker/
   Byline → Karte + Kopf.
2. **Einzel-Artikel:** `<article class="pw-article">` herausziehen, `head`/Reset
   und `<nav class="pw-nav">` droppen, Asset-Pfade umschreiben, in die eigene
   Hülle einbetten.
   **Magazin:** ganzen Ordner statisch hosten.
3. `/penwright-skin.css` (Konsumenten-seitig) überschreibt die `--pw-*` →
   einheitlicher Look.
4. `board.json` o.ä. (Konsumenten-seitig) trägt die site-spezifischen Felder
   (date, tags, summary, accent) nach — **nie** in Penwrights `meta.json`.

---

## 7. To-do-Checkliste für Penwright

- [ ] `meta.json`: `kind`-Feld verlässlich setzen; generisch halten (keine
      Site-Felder wie date/tags/summary/accent).
- [ ] `--pw-*`-Tokens an **`:root`** exponieren (nicht nur `.pw-article`).
- [ ] **Keine** hardcoded Farben/Schriften außerhalb der Tokens
      (inkl. `html{background}` → über `--pw-background`).
- [ ] Token-Namen + Zweck dokumentieren; Satz ggf. erweitern
      (`--pw-rule`, `--pw-measure`, `--pw-space`).
- [ ] Bilder **web-groß** exportieren (skalieren + komprimieren).
- [ ] Optional: Webfonts bündeln (Standalone-Treue) + konfigurierbarer
      Home/Zurück-Link.

---

*Kurzfassung: `meta.json` generisch, Design 100 % über `--pw-*` an `:root`,
nichts Skinbares hardcoden, Bilder web-groß. Dann kann jede Seite deinen Export
einbetten und in ihre Identität kleiden — ohne dein Layout zu brechen.*
