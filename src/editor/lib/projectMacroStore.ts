/**
 * The building blocks the OPEN project defines, held where both insert surfaces
 * can reach them.
 *
 * `getCommands()` is called fresh every time the slash menu or the ＋ dropdown
 * opens, so a plain module-level list is enough — no reactivity needed, and
 * `src/editor/lib/*` is tsc-checked and must not pull in the rune store.
 *
 * Refilled whenever the open file changes, because visibility is per file: a
 * macro is callable only where it is imported (proven against the compiler —
 * see `src/main/projectMacros.ts`). Offering a chapter every macro in the
 * project would offer macros that cannot compile at the cursor.
 */

// Relative, not `@shared`: this file is tsc-checked and tsconfig has no paths.
import type { ProjectMacro } from '../../shared/macroCall';

export type ProjectMacroItem = ProjectMacro;

let macros: ProjectMacroItem[] = [];

export function setProjectMacros(next: ProjectMacroItem[]): void {
  macros = Array.isArray(next) ? next : [];
}

export function getProjectMacros(): ProjectMacroItem[] {
  return macros;
}

export function clearProjectMacros(): void {
  macros = [];
}

// The call itself comes from the shared module, so the menu inserts exactly what
// the MCP server and the tests compile. One implementation, three callers.
export { buildMacroCall, macroSignature } from '../../shared/macroCall';
