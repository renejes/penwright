/**
 * Preset library — the taxonomy + manifest shapes shared by the main-process
 * scanner (presetManager.ts) and the renderer gallery (NewProjectDialog).
 *
 * Two kinds of starting point coexist:
 *  • a "blank starter" — one of the thin `projectTemplates` (a bag of files with
 *    minimal placeholder text), materialised programmatically by
 *    handleCreateProject. One per project type.
 *  • a rich "preset" — a bundled, real, compile-tested project FOLDER under
 *    `resources/presets/<id>/`, copied verbatim by createFromPreset. Carries a
 *    populated design (`.penwright/style.json` + generated `style.typ`), macros,
 *    placeholder assets, and chapters pre-filled with placeholder content (and,
 *    for magazines, per-chapter looks). What ships is exactly what the user
 *    gets — WYSIWYG, guaranteed by the compile-test/thumbnail build step.
 *
 * Labels/taglines are carried INLINE as {en,de} on the data (a preset is data,
 * not a UI string) so each preset ships its own bilingual copy without touching
 * the i18n dictionaries; the gallery resolves them for the active locale.
 */

export type Locale = 'en' | 'de';

/** A short piece of copy in both shipped UI languages. */
export interface LocalizedText {
  en: string;
  de: string;
}

/** A bilingual list (the "what you get" bullets). */
export interface LocalizedList {
  en: string[];
  de: string[];
}

/**
 * A project-type bucket in the New-Project gallery. Types are ordered; each may
 * name a `blankTemplateId` (a thin projectTemplates entry) that becomes the
 * "Blank" starter shown first in that type's group. Rich presets attach to a
 * type via their manifest `type` field.
 */
export interface ProjectTypeDef {
  id: string;
  order: number;
  /** A single emoji/glyph shown on the type + on blank/thumbnail-less cards. */
  icon: string;
  label: LocalizedText;
  description: LocalizedText;
  /** The thin projectTemplates id that seeds this type's "Blank" card (if any). */
  blankTemplateId?: string;
}

/**
 * `preset.json` — the per-preset manifest shipped inside every preset folder.
 * The folder name SHOULD equal `id`. Everything else in the folder is the real
 * project, copied verbatim.
 */
export interface PresetManifest {
  /** Unique, kebab-case; matches the folder name. */
  id: string;
  /** The project type this preset belongs to (a ProjectTypeDef id). */
  type: string;
  label: LocalizedText;
  /** One-line "what this is" shown on the card. */
  tagline: LocalizedText;
  /** "What you get" bullets shown on hover/detail. */
  highlights?: LocalizedList;
  /** Root .typ file (default "main.typ"). */
  root?: string;
  /** File to open after creation (default: the root). */
  openFile?: string;
  /** Sort order within the type group (lower first; default 100). */
  order?: number;
  /** Which page presets-build renders as the gallery thumbnail (default 1) —
   *  image-led presets point at a content page rather than a sparse title page. */
  thumbnailPage?: number;
}

/**
 * The 10 project-type buckets. The first six map to the existing thin
 * `projectTemplates` (their id === blankTemplateId) so every type keeps a
 * "start blank" option; the last four are new types introduced with the preset
 * library (they get presets, and optionally a blank template later).
 */
export const PROJECT_TYPES: ProjectTypeDef[] = [
  {
    id: 'document', order: 10, icon: '📄', blankTemplateId: 'document',
    label: { en: 'Document', de: 'Dokument' },
    description: { en: 'A single-file document for anything short.', de: 'Ein Ein-Datei-Dokument für alles Kurze.' },
  },
  {
    id: 'thesis', order: 20, icon: '🎓', blankTemplateId: 'thesis',
    label: { en: 'Thesis', de: 'Abschlussarbeit' },
    description: { en: 'Chapters, title page, table of contents, bibliography.', de: 'Kapitel, Titelseite, Inhaltsverzeichnis, Literaturverzeichnis.' },
  },
  {
    id: 'paper', order: 30, icon: '🔬', blankTemplateId: 'paper',
    label: { en: 'Paper', de: 'Wissenschaftlicher Artikel' },
    description: { en: 'Abstract, sections, references — for a submission.', de: 'Abstract, Abschnitte, Referenzen — für eine Einreichung.' },
  },
  {
    id: 'letter', order: 40, icon: '✉️', blankTemplateId: 'letter',
    label: { en: 'Letter', de: 'Brief' },
    description: { en: 'A formal or personal letter on one page.', de: 'Ein formeller oder persönlicher Brief auf einer Seite.' },
  },
  {
    id: 'book', order: 50, icon: '📖', blankTemplateId: 'book',
    label: { en: 'Book', de: 'Buch' },
    description: { en: 'Long-form: novel, non-fiction, poetry, picture book.', de: 'Langform: Roman, Sachbuch, Lyrik, Bilderbuch.' },
  },
  {
    id: 'magazine', order: 60, icon: '📰', blankTemplateId: 'magazine',
    label: { en: 'Magazine', de: 'Magazin' },
    description: { en: 'An editorial issue where each chapter is its own layout.', de: 'Ein Heft, in dem jedes Kapitel ein eigenes Layout ist.' },
  },
  {
    id: 'report', order: 70, icon: '📊',
    label: { en: 'Report / Whitepaper', de: 'Report / Whitepaper' },
    description: { en: 'Cover, executive summary, findings, charts.', de: 'Deckblatt, Management-Summary, Ergebnisse, Diagramme.' },
  },
  {
    id: 'newsletter', order: 80, icon: '🗞️',
    label: { en: 'Newsletter / Zine', de: 'Newsletter / Zine' },
    description: { en: 'Short-form editorial — playful, multi-column.', de: 'Kurzformat-Editorial — verspielt, mehrspaltig.' },
  },
  {
    id: 'portfolio', order: 90, icon: '🖼️',
    label: { en: 'Portfolio / Case Study', de: 'Portfolio / Case-Study' },
    description: { en: 'Big images, metrics, before/after — show your work.', de: 'Große Bilder, Kennzahlen, Vorher/Nachher — zeig deine Arbeit.' },
  },
  {
    id: 'cookbook', order: 100, icon: '🍲',
    label: { en: 'Cookbook', de: 'Kochbuch' },
    description: { en: 'Recipe pages with ingredients, steps, photos.', de: 'Rezeptseiten mit Zutaten, Schritten, Fotos.' },
  },
];

/** Resolves a {en,de} value for the active locale (falls back to en). */
export function localize(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return '';
  return (locale === 'de' ? text.de : text.en) || text.en || text.de || '';
}

/** Resolves a bilingual list for the active locale (falls back to en). */
export function localizeList(list: LocalizedList | undefined, locale: Locale): string[] {
  if (!list) return [];
  const arr = locale === 'de' ? list.de : list.en;
  return (arr && arr.length ? arr : list.en) ?? [];
}

/** Looks up a project type by id. */
export function getProjectType(id: string): ProjectTypeDef | undefined {
  return PROJECT_TYPES.find((t) => t.id === id);
}

/**
 * A single gallery card the renderer renders — resolved for the active locale
 * by the main-process scanner, so the dialog stays presentation-only. A card is
 * either a blank `template` (materialised by handleCreateProject) or a rich
 * `preset` (copied by createFromPreset).
 */
export interface GalleryItem {
  /** Stable key: `template:<id>` or `preset:<id>`. */
  key: string;
  kind: 'template' | 'preset';
  /** templateId or presetId, passed back to main on create. */
  id: string;
  /** Project-type id this card sits under. */
  type: string;
  label: string;
  tagline: string;
  highlights: string[];
  /** Rendered preview as a data: URI (presets only, when a thumbnail exists). */
  thumbnail?: string;
  /** Fallback glyph when there is no thumbnail. */
  icon: string;
  /** Where a preset lives: 'bundled' (shipped, read-only) or 'user' (the
   *  writable userData library — the user's own saved presets, deletable). */
  origin?: 'bundled' | 'user';
}

/**
 * Payload the renderer sends to save the CURRENT project as a reusable user
 * preset (`preset:save`). Everything else is derived from the open project.
 */
export interface SavePresetInput {
  label: string;
  /** A project-type id (defaults to 'document' if unknown). */
  type: string;
  tagline?: string;
}
