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

> **Status (umgesetzt in v0.11.x+):** Die drei Kern-Bitten aus §4 sind live —
> Tokens liegen an `:root` **in einem `@layer penwright`**, es ist nichts
> Skinbares mehr hardcoded (inkl. `html{background}`), und der Token-Satz wurde
> um `--pw-rule` / `--pw-measure` / `--pw-space` erweitert. Für den Konsumenten
> heißt das konkret: **ein `:root { --pw-* }`-Override im `<head>` genügt, ohne
> `!important` und unabhängig von der Ladereihenfolge.** Details unten.

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

**Der offizielle Token-Satz** (alle an `:root`, alle konsequent verwendet — kein
Skinbares mehr hardcoded):

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
| `--pw-rule` | Linien-/Trennerfarbe (leitet sich aus `--pw-muted` ab, einzeln überschreibbar) |
| `--pw-measure` | Lesebreite (Default `70ch`) |
| `--pw-space` | Grund-Seitenabstand (Innenabstand des Artikels) |

**Die drei Kern-Bitten — Status: ✅ umgesetzt.**

1. ✅ **Tokens an `:root`, in einem `@layer penwright`.** Statt sie *pro*
   `.pw-article` zu setzen (wo ein Konsument nur den Artikel-Body erreichte und
   Cover/Inhaltsverzeichnis außen vor blieben), liegen die **Default**-Tokens
   jetzt an `:root` in einer niedrig priorisierten *Cascade Layer*. Der Effekt:
   ein **unlayered** Konsumenten-Override (dein `:root { --pw-* }`) **gewinnt
   immer** — egal ob im `<head>` geladen, egal welche Reihenfolge, **ohne
   `!important`** (unlayered schlägt layered grundsätzlich). Das war der
   eigentliche Knackpunkt: vorher stand das fragment-eigene `:root` im
   `<body>`-`<style>` und schlug einen `<head>`-Skin per Quelltext-Reihenfolge
   → die Seite behielt Penwrights Hintergrund. **Wichtig:** nur die *Token-
   Defaults* sind gelayert; die gescopten `.pw-article`-Regeln bleiben
   **unlayered**, damit das Umgebungs-CSS der Host-Seite (`p {}`, `a {}` …)
   Penwrights *Struktur* nicht überschreiben kann — verloren geht nur gegen
   einen *Token*-Override, genau wie gewollt.

2. ✅ **Nichts Skinbares mehr hardcoded.** Der `<head>`-Hintergrund nutzt jetzt
   `html{background:var(--pw-background, <literal>)}` (Token mit Literal nur als
   Fallback). Alle Trenner/Linien laufen über `var(--pw-rule)`, alle
   Farben/Schriften/Maße über die Tokens.

3. ✅ **Token-Satz erweitert** um `--pw-rule`, `--pw-measure`, `--pw-space`
   (siehe Tabelle).

**So skinnt ein Konsument** — dank `@layer` reicht wirklich *ein* Block an
`:root`, ohne `!important` und egal wo geladen:

```css
/* penwright-skin.css beim Konsumenten — z.B. im <head> eingebunden */
:root {
  --pw-font-body: "Vollkorn", Georgia, serif;
  --pw-font-heading: ui-monospace, Menlo, monospace;
  --pw-background: transparent;
  --pw-text: #1a1a1a;
  --pw-accent: #8b2a38;
}
```

→ Penwrights Layout bleibt, aber alles trägt den Look des Konsumenten. Genau
das Ziel: *eigen im Satz, einheitlich im Look.*

**Browser-Floor:** `@layer` ist Baseline 2022 — älter als das `color-mix()`, das
der Export ohnehin schon verwendet. Der Export setzt also keinen neuen
Browser-Mindeststand voraus.

**Randfall Mehrfach-Einbettung:** Weil die Defaults am globalen `:root` liegen,
teilen sich **zwei nackt** auf *eine* Seite geklebte Penwright-Fragmente den
später deklarierten `:root`-Block. Der §6.2-Fluss bettet ohnehin jeden Artikel
in „seine eigene Hülle" (einen Wrapper) ein — das isoliert sie und erlaubt
zugleich Per-Fragment-Skinning über den Wrapper. Also: beim Platzieren mehrerer
Artikel auf einer Seite jeden in einen eigenen Container wrappen.

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

- [x] `meta.json`: `kind`-Feld verlässlich setzen (`"article"` / `"magazine"`);
      generisch halten (kein Leak von date/tags/summary/accent — auch kein
      `kicker`/`byline` auf Issue-Ebene, nur pro Artikel).
- [x] `--pw-*`-Tokens an **`:root`** exponieren (nicht auf `.pw-article`), in
      einem `@layer penwright`, damit ein Konsumenten-Override ohne `!important`
      und unabhängig von der Ladereihenfolge gewinnt.
- [x] **Keine** hardcoded Farben/Schriften außerhalb der Tokens
      (inkl. `html{background}` → `var(--pw-background, <fallback>)`).
- [x] Token-Namen + Zweck dokumentiert; Satz erweitert
      (`--pw-rule`, `--pw-measure`, `--pw-space`).
- [x] Webfonts gebündelt (`@font-face` + Dateien in `assets/fonts/`,
      Standalone-Treue).
- [ ] Bilder **web-groß** exportieren (skalieren + komprimieren) — *offen*
      (aktuell werden Original-Assets kopiert; WebP/Resize noch nicht drin).
- [ ] Optional: konfigurierbarer Home/Zurück-Link fürs gehostete Magazin —
      *offen*.

---

*Kurzfassung: `meta.json` generisch, Design 100 % über `--pw-*` an `:root` (in
`@layer penwright`, ohne `!important` überschreibbar), nichts Skinbares
hardcoden, Fonts gebündelt. Dann kann jede Seite deinen Export einbetten und in
ihre Identität kleiden — ohne dein Layout zu brechen. Offen bleibt: Bild-
Kompression (web-groß) und der optionale Home-Link.*
