# Plan: Escaping-Fix + bidirektionale Preview↔Source-Navigation

> **Status: IMPLEMENTIERT (2026-06-27), manuelle GUI-Verifikation ausstehend.** Source-first ist verworfen ([[decision-no-source-first]]); wir bleiben TipTap-source-first und liefern zwei fokussierte Features. Reihenfolge: **(1) Escaping-Fix → (2) Navigation in beide Richtungen.** Alle Datei:Zeile gegen den realen Code verifiziert.
>
> **Umgesetzt:** Serializer-Escaping ([serializer.ts](../src/editor/lib/serializer.ts) `escapeTypstText`/`escapeLeadingBlockMarker`, Code-Marks ausgenommen), Deserializer escape-aware (`splitInlineConstructs`/`stripKnownInlines`/`parseFormattedText` + `unescapeLiteral`/`findClosingDelim`), Code-Block-`\n`-Akkumulation gefixt; Round-Trip-Regressionstest [scripts/roundtrip-test.mts](../scripts/roundtrip-test.mts) (`npx tsx scripts/roundtrip-test.mts`, 30/30 grün). Cursor-Follow ([App.svelte](../src/renderer/App.svelte) `nearestHeadingTitle`/`scheduleHeadingFollow` in `onTransaction`). Preview→Source-Klick ([PdfPreviewPanel.svelte](../src/renderer/components/PdfPreviewPanel.svelte) `onPreviewClick`/`headingForPage` → `penwright:preview-jump`; [App.svelte](../src/renderer/App.svelte) `handlePreviewJump`/`searchProjectFiles`). `electron-vite build` grün.

---

## Feature 1 — Serializer-Escaping-Fix (round-trip-sicher)

### Problem (verifiziert)
[serializer.ts:216](../src/editor/lib/serializer.ts#L216) gibt Plain-Text-Runs **verbatim** aus. Literale Typst-Sonderzeichen in Fließtext werden dadurch:
- **falsch kompiliert** (`*` → fett, `$` → Mathe, `@wort` → Zitat, `#x` → Code-Modus, `<x>` → Label), und
- **beim nächsten Öffnen still korrumpiert**, weil der Deserializer sie als Markup zurückparst ([deserializer.ts](../src/editor/lib/deserializer.ts) `parseFormattedText` Z.1115, `splitInlineConstructs` Z.917).

**Kritisch:** Der Deserializer kennt **kein** Backslash-Escaping. Ein einseitiger Serializer-Fix (`\*` schreiben) würde beim Re-Parsen zu kaputtem Markup (`*foo\*` matcht die Bold-Regex falsch). Der Fix muss **koordiniert** sein: escapen **und** un-escapen.

### Lösung
Typst escapt Markup mit Backslash (`\*`, `\#`, …). Wir nutzen genau das.

**A) [serializer.ts](../src/editor/lib/serializer.ts) — `escapeTypstText()` einführen**
- Neue Funktion, escapt in dieser Reihenfolge (Backslash zuerst!): `\ * _ ` ` ` # @ $ < > ~ [ ]`.
- Angewandt auf den rohen Text-Run in `serializeInline` **vor** dem Mark-Wrapping ([serializer.ts:216](../src/editor/lib/serializer.ts#L216)). Mark-Delimiter (`*…*`, `_…_`) bleiben unescaped — nur der Nutzer-Text innen wird escaped.
- **Leading-Block-Marker:** in `serializeNode` (paragraph) führendes `= `, `- `, `+ `, `/ ` escapen, damit ein Absatz „- kein Listenpunkt" beim Reparsen keine Liste wird.
- **Nicht** angewandt auf: `typstRawBlock`/`bibliography`-Passthrough (Z.139/144 — das ist roher Typst, korrekt unberührt), Attribut-Strings (href/color — eigener String-Kontext).

**B) [deserializer.ts](../src/editor/lib/deserializer.ts) — escape-aware machen**
- `splitInlineConstructs` (Z.917): am Schleifenkopf, wenn `text[i] === '\\'`, **2 Zeichen überspringen** (i+=2), ohne `textStart` zu verschieben. So kann ein escaptes `\#`/`\@` keinen Konstrukt-Trigger auslösen und bleibt im Text-Slice.
- `parseFormattedText` (Z.1115): Regex durch einen **escape-bewussten Scan** ersetzen — `\x` zählt als literales `x`, nur **unescapte** `*`/`_`/`` ` `` sind Delimiter; emittierter Text wird **un-escaped** (`\x` → `x`).
- Damit ist Serializer⁻¹ = Deserializer auf Plain-Prosa.

### Test (Pflicht — round-trip-kritisch)
Kein Test-Framework vorhanden → temporäres Harness `scripts/roundtrip-test.mjs` (via `npx tsx`, falls verfügbar; sonst Inline-Transpile). Invarianten:
1. **TipTap→Typst→TipTap** für Text mit `* _ ` # @ $ < > [ ] \` → identische Plain-Text-Node (keine Marks, kein Citation).
2. **Bestehendes Markup** (`*bold*`, `@key`, `#footnote[…]`) round-trippt unverändert.
3. **Doppel-Round-Trip idempotent** (zweiter Durchlauf ändert nichts → keine Backslash-Akkumulation).
4. Stichprobe: echtes Sample-Kapitel (`resources/sample-project/chapters/*.typ`) deserialize→serialize bleibt kompilierbar.

**Akzeptanz:** literaler Text mit Sonderzeichen kompiliert korrekt **und** überlebt Schließen/Öffnen. Bestehende Dokumente bekommen beim ersten Speichern ggf. einmalig Backslashes vor bisher „nackten" Sonderzeichen — benigne, semantisch identische Normalisierung (wie die dokumentierte `_x_`/`*x*`-Normalisierung).

---

## Feature 2 — Bidirektionale Navigation

Ziel: **(2a)** Cursor in der `.typ` → Preview folgt automatisch dorthin; **(2b)** Klick in die Preview → richtige `.typ` öffnet + springt an die Stelle. Granularität: Heading-genau (Source→Preview, via PDF-Outline) bzw. Wort-genau (Preview→Source, via Anchor/Projektsuche). Kein Span-Mapping, kein WASM.

### 2a — Source → Preview (Cursor-Follow; bestehenden Mechanismus erweitern)
Heute setzt nur der `update`-Handler `previewState.scrollTarget = firstHeadingTitle()` beim Datei-Wechsel ([messageHandler.ts:42](../src/renderer/messageHandler.ts#L42)). `PdfPreviewPanel` reagiert via `$effect` + `scrollToChapter()` ([PdfPreviewPanel.svelte:127](../src/renderer/components/PdfPreviewPanel.svelte#L127),[:145](../src/renderer/components/PdfPreviewPanel.svelte#L145)) und de-dupt über `lastScrolledTarget` (scrollt nur bei *Änderung* des Targets → kein Jank beim Tippen innerhalb einer Section).

**Änderung ([App.svelte](../src/renderer/App.svelte) onTransaction / Selection-Handler):**
- Bei Cursor-/Selektionsänderung das **nächstgelegene vorausgehende Heading** zur Cursor-Position bestimmen (`doc.descendants`, letztes `heading` mit `pos ≤ selection.from`) und `previewState.scrollTarget = headingTitle` setzen (leicht debounced).
- Da `scrollToChapter` nur bei Target-*Wechsel* feuert, scrollt die Preview erst, wenn der Cursor eine Heading-Grenze überschreitet → ruhiges Verhalten.
- File-Switch-Logik bleibt (initiales Target via `firstHeadingTitle`); Cursor-Follow verfeinert danach.

### 2b — Preview → Source (neu)
**Bausteine, die schon existieren:** pdf.js TextLayer-Spans pro Glyph ([PdfPreviewPanel.svelte:298-308](../src/renderer/components/PdfPreviewPanel.svelte#L298-L308)); PDF-Outline→Page-Mapping (`scrollToChapter`); `project:search` IPC (datei-übergreifend, file+line); `filetree:open`+`openTab` ([App.svelte:848](../src/renderer/App.svelte#L848)); der TreeWalker-Jump in `handleProjectSearchJump` ([App.svelte:752](../src/renderer/App.svelte#L752)).

**Änderung A — [PdfPreviewPanel.svelte](../src/renderer/components/PdfPreviewPanel.svelte): Klick→Anchor**
- Delegierter `click`-Listener auf `canvasContainer` (überlebt Re-Renders). Bei Klick auf eine `.textLayer span`:
  - Wenn `window.getSelection()` **nicht collapsed** (User hat per Drag selektiert/kopiert) → **nichts tun** (Copy-Workflow bleibt unberührt). Nur Plain-Click = Navigation (SyncTeX-Konvention).
  - Anchor-Phrase bilden: Text des geklickten Spans + Nachbar-Spans bis ~40 Zeichen (eindeutiger als ein einzelnes Wort).
  - Page-Index aus `wrapper.dataset.pageIndex`; nächstes vorausgehendes Heading via Outline (tiefstes Bookmark mit Page ≤ Klick-Page) als Kontext/Fallback.
  - `CustomEvent('penwright:preview-jump', { detail: { text, heading } })` dispatchen. Cursor-Affordance: `cursor: pointer` auf Text-Spans.

**Änderung B — [App.svelte](../src/renderer/App.svelte): Anchor→Source**
- Listener `penwright:preview-jump`:
  1. `project:search` mit der Phrase (case-insensitive, Whitespace-normalisiert) → Treffer (file+pos).
  2. Treffer im File bevorzugen, dessen Kapitel-Heading zum `heading`-Kontext passt; sonst erster Treffer.
  3. Ziel-File öffnen (falls nicht offen) via `handleFileOpen`; danach Editor an die Textstelle springen (TreeWalker-Muster aus `handleProjectSearchJump` wiederverwenden → scrollen + selektieren).
  4. **Fallback** (kein Text-Treffer, z. B. makro-/design-generierter Text = Totzone): nach dem `heading`-Text suchen → Datei öffnen + zum Heading springen. Ehrliche Degradation auf Kapitel-Granularität.

**Preload:** `project:search` ist bereits in `INVOKE_CHANNELS` (keine Channel-Änderung nötig). Verifizieren.

### Tests (manuell, im echten App-Lauf)
- 2a: Cursor durch mehrere Kapitel/Headings bewegen → Preview folgt jeweils zur richtigen Section; Tippen innerhalb einer Section scrollt **nicht**.
- 2b: Plain-Click auf ein Wort im Fließtext → richtige Datei öffnet, Editor springt + selektiert; Drag-Select zum Kopieren funktioniert weiterhin; Klick auf makro-generiertes Design fällt sauber auf Heading-Sprung zurück.

---

## Reihenfolge & Risiko
1. **Escaping-Fix zuerst** (round-trip-kritisch, mit Test-Harness; höchster Korrektheits-ROI).
2. **2a Cursor-Follow** (klein, niedriges Risiko, nutzt vorhandene Maschinerie).
3. **2b Preview→Source** (mittel; nutzt vorhandene `project:search`/`filetree:open`/TreeWalker-Bausteine).

Kein neuer Editor, keine zweite Engine, kein Versions-Skew. Alles additiv zum bestehenden TipTap-Pfad.
