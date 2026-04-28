/**
 * Resolves all #include statements in a Typst file recursively.
 * Returns the merged content with #include replaced by actual file content.
 *
 * Shared module — no VS Code dependencies.
 */

import * as path from 'path';
import * as fs from 'fs';

export function resolveIncludes(filePath: string, seen = new Set<string>()): string {
  const absPath = path.resolve(filePath);

  // Prevent circular includes
  if (seen.has(absPath)) {
    return `// [circular include: ${path.basename(absPath)}]\n`;
  }
  seen.add(absPath);

  if (!fs.existsSync(absPath)) {
    return `// [file not found: ${path.basename(absPath)}]\n`;
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const dir = path.dirname(absPath);

  // Replace #include "path" with the content of the referenced file.
  // The blank line after the comment marker is important: without it the
  // marker glues to the chapter's H1 (`// comment\n= Heading`) which the
  // block splitter then keeps in one block, and the deserializer drops it
  // as "config" — making the heading vanish from the DOCX export.
  return content.replace(
    /^#include\s+"([^"]+)"\s*$/gm,
    (_match, includePath: string) => {
      const resolvedPath = path.resolve(dir, includePath);
      const includeContent = resolveIncludes(resolvedPath, new Set(seen));
      return `// ─── ${path.basename(includePath)} ───\n\n${includeContent.trim()}\n\n`;
    },
  );
}
