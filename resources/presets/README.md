# Penwright preset library

Every folder here (except `_shared/`) is a **real, compile-tested project** that
becomes a "start writing in great design" option in the New-Project gallery.
Choosing a preset **copies the folder verbatim** (`presetManager.createFromPreset`)
— what ships is exactly what the user gets. So the folder must compile offline
with the bundled Typst, look finished, and be pre-filled with placeholder
(Lorem-style) content the user just overwrites.

## Anatomy of a preset folder

```
<preset-id>/
  preset.json            # manifest (see below) — NOT copied into the user's project
  thumbnail.png          # rendered page-1 preview for the gallery — NOT copied
  main.typ               # root: imports style.typ, applies apply-style, includes chapters
  style.typ              # penwright:generated-style (from .penwright/style.json)
  .penwright/style.json  # design tokens (drives the Design panel); for magazines: sections[]
  macros.typ             # magazine/zine only — a copy of _shared/macros.typ
  chapters/…             # one file per chapter; magazines: each a DIFFERENT layout
  assets/…               # placeholder images (neutral, license-clean)
```

`preset.json`:

```json
{
  "id": "magazine-slow",
  "type": "magazine",
  "label":   { "en": "Slow / Literary", "de": "Slow / Literarisch" },
  "tagline": { "en": "A calm editorial issue.", "de": "Ein ruhiges Heft." },
  "highlights": {
    "en": ["6 chapters, each its own layout", "Drop caps, pull-quotes, photo spreads"],
    "de": ["6 Kapitel, je ein eigenes Layout", "Initiale, Pull-Quotes, Bildstrecken"]
  },
  "root": "main.typ",
  "openFile": "chapters/01-editorial.typ",
  "order": 10
}
```

`id` MUST equal the folder name. `type` is one of the ids in
`src/shared/presetTypes.ts` (`document` · `thesis` · `paper` · `letter` · `book`
· `magazine` · `report` · `newsletter` · `portfolio` · `cookbook`). `openFile`
is the chapter the user lands on (skip the cover — land on writable prose).

## Rules

- **Compiles offline.** Only the bundled Typst packages
  (`resources/typst-packages/`) may be `#import`ed. `macros.typ` uses `droplet`
  + `drafting`, both bundled.
- **Design lives in `.penwright/style.json`.** `style.typ` is generated from it
  (`penwright:generated-style`). For a magazine, populate `sections[]` with the
  per-chapter rubrics (reuse `src/shared/sectionPresets.ts` ids where possible)
  so each chapter's look is switchable from the Design panel / ChapterLookBar.
- **Magazine "each chapter a different layout"** = per-chapter `#show: <id>-style`
  opt-in (from `sections[]`) + the `macros.typ` furniture (`opener`/`lead`/`pull`/
  `bildtafel`/`frage`/`columns`/`interlude`/`aufmacher`/…) + placeholder prose.
- **Placeholder content is Lorem-style**, language-neutral, generous enough to
  show the layout breathing. Structural fields (kicker/title/byline) get short
  neutral placeholders.
- **Macro lockstep:** if a magazine preset uses the macros, its `macros.typ`
  MUST be a copy of `_shared/macros.typ` (keep them identical). The macro
  names/signatures are recognised by the editor's magazine AST nodes — see the
  header of `_shared/macros.typ`.

## Authoring workflow

1. Build the project in Penwright (or by hand), pre-fill Lorem content, get the
   look right in the Design panel.
2. Copy the project folder here as `<preset-id>/`, strip `.git/` and
   `.penwright/{backups,ai-snapshots,preferences.json}` (keep `style.json`).
3. Add `preset.json`.
4. Run `node scripts/presets-build.mjs` — compiles every preset with the bundled
   Typst (fails the build on error) and renders each `thumbnail.png`.
5. `resources/presets/` is bundled into the app via `package.json`
   `extraResources`.
