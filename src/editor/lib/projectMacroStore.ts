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

/**
 * Fired whenever the catalogue changes, because the node views are built BEFORE
 * it arrives.
 *
 * `project:listMacros` walks the whole project over IPC, so it resolves well
 * after the document has been set and every `typstRawBlock` node view has
 * already asked `getProjectMacros()` and been told "nothing". Without a signal
 * they stayed as code blocks for the rest of the session — the card simply never
 * appeared, which is exactly what it looked like in practice.
 */
export const PROJECT_MACROS_EVENT = 'penwright:project-macros-changed';

function announce(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROJECT_MACROS_EVENT));
}

export function setProjectMacros(next: ProjectMacroItem[]): void {
  const before = macros;
  macros = Array.isArray(next) ? next : [];
  // Cheap identity check — the names are what a node view matches on.
  const same = before.length === macros.length
    && before.every((m, i) => m.name === macros[i].name && m.relPath === macros[i].relPath);
  if (!same) announce();
}

export function getProjectMacros(): ProjectMacroItem[] {
  return macros;
}

export function clearProjectMacros(): void {
  if (!macros.length) return;
  macros = [];
  announce();
}

// The call itself comes from the shared module, so the menu inserts exactly what
// the MCP server and the tests compile. One implementation, three callers.
export { buildMacroCall, macroSignature } from '../../shared/macroCall';
