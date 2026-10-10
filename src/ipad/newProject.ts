/**
 * A new project on the iPad is a folder of .typ files.
 * No Git, no .penwright, no compiler — the Mac adds those when it opens the folder.
 */

import { templates } from '../shared/projectTemplates';
import { PROJECT_TYPES, localize, type GalleryItem, type Locale, type PresetManifest } from '../shared/presetTypes';
import bundled from './bundledPresets.json';
import type { DirItem, ProjectFs } from './projectFs';
import { saveRefusal } from './writingSurface';

interface BundledPreset {
  id: string;
  manifest: PresetManifest;
  files: Record<string, string>;
}

const bundledPresets = (bundled as unknown as { presets: BundledPreset[] }).presets;

export function blankGallery(locale: Locale): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const type of PROJECT_TYPES) {
    if (!type.blankTemplateId) continue;
    if (!templates.some((t) => t.id === type.blankTemplateId)) continue;
    items.push({
      key: `template:${type.blankTemplateId}`,
      kind: 'template',
      id: type.blankTemplateId,
      type: type.id,
      label: locale === 'de' ? 'Leeres Projekt' : 'Blank',
      tagline: localize(type.description, locale),
      highlights: [],
      icon: type.icon,
    });
  }
  return items;
}

/** Blank starters plus the designed presets. The iPad writes the files and does not render them. */
export function projectGallery(locale: Locale): GalleryItem[] {
  const designed = [...bundledPresets].sort(
    (a, b) => (a.manifest.order ?? 100) - (b.manifest.order ?? 100),
  );
  const cards: GalleryItem[] = designed.map((preset) => ({
    key: `preset:${preset.id}`,
    kind: 'preset',
    id: preset.id,
    type: preset.manifest.type,
    label: localize(preset.manifest.label, locale),
    tagline: localize(preset.manifest.tagline, locale),
    highlights: [],
    icon: PROJECT_TYPES.find((t) => t.id === preset.manifest.type)?.icon ?? '✦',
    origin: 'bundled',
  }));
  return [...blankGallery(locale), ...cards];
}

export function presetBundle(id: string): BundledPreset | null {
  return bundledPresets.find((p) => p.id === id) ?? null;
}

export function safeProjectName(name: string): string | null {
  const clean = name.trim().replace(/[/\\]/g, '');
  if (!clean || clean.startsWith('.') || clean.includes('..')) return null;
  return clean;
}

/** Paths the session sees are relative to `root`, which itself sits in the picked folder. */
export function rootedFs(inner: ProjectFs, root: string): ProjectFs {
  const full = (rel: string) => (rel ? `${root}/${rel}` : root);
  const strip = (p: string) => (p === root ? '' : p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p);
  return {
    readText: (p) => inner.readText(full(p)),
    writeText: (p, contents) => inner.writeText(full(p), contents),
    writeBytes: (p, data) => inner.writeBytes(full(p), data),
    readBytes: (p) => inner.readBytes(full(p)),
    mkdir: (p) => inner.mkdir(full(p)),
    remove: (p) => inner.remove(full(p)),
    removeDir: (p) => inner.removeDir(full(p)),
    exists: (p) => inner.exists(full(p)),
    async readDir(p) {
      const items = await inner.readDir(full(p));
      return items.map((item): DirItem => ({ ...item, path: strip(item.path) }));
    },
  };
}

export function templateFiles(templateId: string): Record<string, string> | null {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return null;
  const files: Record<string, string> = {};
  for (const [rel, content] of Object.entries(template.files)) {
    if (saveRefusal(rel)) continue;
    files[rel] = content;
  }
  return files;
}
