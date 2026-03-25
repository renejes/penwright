/**
 * Splits a document at `= Heading 1` boundaries into separate chapters.
 *
 * Shared module — no VS Code dependencies. Pure string manipulation.
 */

export interface Chapter {
  title: string;
  content: string;
}

/**
 * Splits a document at `= Heading 1` boundaries into separate chapter files.
 */
export function splitIntoChapters(text: string): { config: string; chapters: Chapter[] } {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let config = '';
  let currentChapter: Chapter | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^=\s+(.+)$/);
    if (match) {
      // Save previous chapter
      if (currentChapter) {
        currentChapter.content = currentLines.join('\n').trim();
        chapters.push(currentChapter);
      } else if (currentLines.length > 0) {
        // Lines before first heading = config (#set, #import, etc.)
        config = currentLines.join('\n').trim();
      }
      currentChapter = { title: match[1].trim(), content: '' };
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Save last chapter
  if (currentChapter) {
    currentChapter.content = currentLines.join('\n').trim();
    chapters.push(currentChapter);
  } else if (currentLines.length > 0) {
    config = currentLines.join('\n').trim();
  }

  return { config, chapters };
}

/**
 * Generates a filename-safe slug from a chapter title.
 */
export function slugify(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const num = String(index + 1).padStart(2, '0');
  return `${num}-${slug || 'chapter'}`;
}
