/**
 * The shape of a project's own building block, and the call that inserts one.
 *
 * Shared because BOTH processes need it and they must not drift: the main
 * process scans the definitions (`src/main/projectMacros.ts`), the renderer
 * inserts them from the slash menu and the ＋ dropdown, and the MCP server
 * offers them to the agent. Two copies of "how do I write this call" would
 * disagree the first time a signature has a surprise in it — which is the
 * failure this repo already paid for elsewhere, hence the shared-planner rule
 * in CLAUDE.md.
 *
 * Pure: no fs, no Electron. Everything that touches disk stays in main.
 */

export interface MacroParam {
  name: string;
  /** Verbatim Typst default (`""`, `4pt`, `none`). null for a positional param. */
  defaultValue: string | null;
  /** Takes a file path — the UI must offer a picker, not a text field. */
  isPath: boolean;
}

export interface ProjectMacro {
  name: string;
  params: MacroParam[];
  /** The positional parameter that receives a trailing `[…]` content block. */
  bodyParam: string | null;
  /** The `//` comment directly above the definition, or ''. */
  label: string;
  filePath: string;
  relPath: string;
  line: number;
}

export interface ProjectMacroResults {
  macros: ProjectMacro[];
  truncated: boolean;
}

/**
 * Which positional parameter receives a trailing `[…]` content block.
 *
 * Read off 36 real call sites across five projects rather than guessed, because
 * the obvious rule is wrong: it is NOT "the last positional". `#note(body,
 * title: "…")` is called `#note(title: "…")[…]` — the body is the FIRST
 * parameter. What holds in every observed case is that the content goes to the
 * parameter NAMED for it, and the other positionals take strings:
 * `#modul("2.1", "Fachartikel")[…]`, `#summe("Stufe 1", "1.500 €")`, and
 * `#stat(value, label)` takes no body at all.
 */
export const BODY_PARAM = /^(body|content|inhalt|text|koerper|körper|children)$/i;

/**
 * A parameter that names a file rather than a word.
 *
 * `#aufmacher(path, …)` passes its argument straight to `image()`, so a word
 * placeholder is not a placeholder — it is a compile error ("file not found").
 * Found by compiling every generated call against the real corpus, which is the
 * only reason it is here. `designElements.isPathParam` is the same idea for the
 * shipped elements; this vocabulary is wider because these names are the
 * project author's, not ours.
 */
export const PATH_PARAM = /^(path|pfad|src|datei|file|bild|image|img|foto|photo)([A-Z0-9_-].*)?$/i;

/**
 * The Typst call to insert for a macro — the shape its own signature asks for.
 *
 * Named parameters are omitted: they have defaults, and emitting them all would
 * hand a non-Typst user a wall of `credit: none, breite: 44%` to delete. The
 * body parameter becomes a trailing `[…]` because that is how every call site in
 * the corpus writes it; the remaining positionals become quoted placeholders.
 *
 * `values` fills parameters the caller does want set — verbatim Typst, so a
 * string argument arrives already quoted. `bodyPlaceholder` is passed in rather
 * than hardcoded so the renderer can localise it.
 */
export function buildMacroCall(
  macro: ProjectMacro,
  values: Record<string, string> = {},
  bodyPlaceholder = 'Inhalt',
): string {
  const args: string[] = [];
  for (const p of macro.params) {
    if (p.name === macro.bodyParam) continue;
    if (p.defaultValue === null) {
      const v = values[p.name];
      args.push(v !== undefined ? v : p.isPath ? '"assets/bild.jpg"' : `"${p.name}"`);
    } else if (values[p.name] !== undefined) {
      args.push(`${p.name}: ${values[p.name]}`);
    }
  }
  if (!macro.bodyParam) return `#${macro.name}(${args.join(', ')})`;
  const call = args.length ? `#${macro.name}(${args.join(', ')})` : `#${macro.name}`;
  return `${call}[\n  ${values[macro.bodyParam] ?? bodyPlaceholder}\n]`;
}

/** A one-line signature for a menu row: `#modul(nr, titel)[…]`. */
export function macroSignature(macro: ProjectMacro): string {
  const args = macro.params
    .filter(p => p.name !== macro.bodyParam)
    .map(p => (p.defaultValue === null ? p.name : `${p.name}: …`));
  return `#${macro.name}${args.length ? `(${args.join(', ')})` : ''}${macro.bodyParam ? '[…]' : '()'}`;
}
