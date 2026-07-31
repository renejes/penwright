/**
 * A `#table(...)`'s own parameters, and what has to happen to them when the
 * table's shape changes.
 *
 * Shared because two callers need the same knowledge and must not drift: the
 * EDITOR adjusts them the moment the user adds or removes a column (it is the
 * only place that knows WHERE), and the SERIALIZER reconciles them from the
 * count alone as a safety net for every other way a table can change shape —
 * an AI edit, a paste, an undo.
 *
 * Pure: no fs, no Electron, no TipTap.
 */

import { parseMacroCall, splitTypstList } from './macroCall';

/**
 * Typst's per-COLUMN table parameters. Each accepts an array applied column by
 * column that **cycles** when it is shorter than the table — measured, not
 * assumed: `align: (left, right)` on three columns renders pixel-identically to
 * `align: (left, right, left)`.
 *
 * That cycling is why they have to move with `columns:`. Adding a column and
 * rewriting only the count leaves every one of these one entry short, and the
 * new column silently inherits column 1's styling — no error, no warning, just a
 * plausible-looking wrong table. 17 of the 27 corpus tables carry `align:`,
 * 16 `fill:`, 11 `inset:`, 9 `stroke:`.
 *
 * Gutters are deliberately absent: `column-gutter` is per GAP, so its correct
 * length is n−1 and it needs a different rule. Row-shaped parameters (`rows:`,
 * `row-gutter:`) are absent for a simpler reason — measured over the corpus,
 * not one of the 27 real tables uses them.
 */
export const PER_COLUMN_PARAMS = ['align', 'fill', 'stroke', 'inset'];

/** Typst's own default track size, so a new column starts neutral. */
const NEW_COLUMN_WIDTH = 'auto';

interface ParamArg {
  name: string;
  /** Offsets into `params`, not into the wrapper used to parse it. */
  start: number;
  end: number;
  raw: string;
}

/** The `#t(` we wrap `params` in so the macro-call parser can read it. */
const WRAP = 3;

function readParams(params: string): { args: ParamArg[]; declared: number | null } | null {
  const parsed = parseMacroCall(`#t(${params})`);
  if (!parsed) return null;
  const args: ParamArg[] = [];
  for (const a of parsed.args) {
    if (a.name === null) continue;
    args.push({ name: a.name, start: a.start - WRAP, end: a.end - WRAP, raw: a.raw.trim() });
  }
  const columns = args.find(a => a.name === 'columns');
  if (!columns) return null;
  const declared = /^\d+$/.test(columns.raw)
    ? Number(columns.raw)
    : (splitTypstList(columns.raw)?.length ?? null);
  return { args, declared };
}

/** The elements of a literal tuple, or null when it is an expression. */
function tupleItems(raw: string): string[] | null {
  const parts = splitTypstList(raw);
  return parts ? parts.map(p => raw.slice(p.start, p.end).trim()) : null;
}

function tupleText(items: string[]): string {
  // Typst needs the trailing comma to tell a one-element tuple from a
  // parenthesised expression.
  return items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;
}

/** Applies edits back to front, so an earlier one cannot move a later one. */
function applyEdits(params: string, edits: { start: number; end: number; text: string }[]): string {
  let out = params;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/**
 * Rewrites the parameters for a column added at `index`, or removed from it.
 *
 * This is the position-aware path, and the only one that can be right about a
 * column added in the MIDDLE: a count-based reconciliation can only ever append
 * or truncate, which shifts every entry after the insertion point.
 *
 * An array is only touched when its length matches the count the source
 * declared. That is the evidence the author enumerated every column; an array of
 * another length means they were relying on the cycling, and rewriting it would
 * overrule a decision they had already made.
 *
 * An inserted column copies the entry it was added NEXT TO, so it looks like its
 * neighbour; `columns:` alone gets `auto`, because a width is the one thing a
 * new column should not inherit.
 *
 * Returns `params` unchanged when there is nothing to do or nothing it can
 * safely read.
 */
export function shiftTableColumn(
  params: string,
  op: 'insert' | 'remove',
  index: number,
): string {
  const read = readParams(params);
  if (!read || read.declared === null) return params;
  const { args, declared } = read;
  if (index < 0 || index > declared) return params;
  if (op === 'remove' && (declared <= 1 || index >= declared)) return params;

  const edits: { start: number; end: number; text: string }[] = [];

  for (const arg of args) {
    const isColumns = arg.name === 'columns';
    if (!isColumns && !PER_COLUMN_PARAMS.includes(arg.name)) continue;

    if (isColumns && /^\d+$/.test(arg.raw)) {
      edits.push({
        start: arg.start,
        end: arg.end,
        text: String(op === 'insert' ? declared + 1 : declared - 1),
      });
      continue;
    }

    const items = tupleItems(arg.raw);
    if (!items || items.length !== declared) continue;   // an expression, or the author's own cycling

    const next = [...items];
    if (op === 'insert') {
      // A new width is neutral; a new style copies the column it was added beside.
      next.splice(index, 0, isColumns ? NEW_COLUMN_WIDTH : (items[Math.max(0, index - 1)] ?? items[0]));
    } else {
      next.splice(index, 1);
    }
    edits.push({ start: arg.start, end: arg.end, text: tupleText(next) });
  }

  return applyEdits(params, edits);
}

/**
 * Makes the parameters agree with `numCols` from the COUNT alone.
 *
 * The safety net, not the main path: it runs on every serialization and catches
 * a shape change that did not come through the table UI. It can only append or
 * truncate, so a column added in the middle shifts the entries after it — which
 * is exactly why `shiftTableColumn` exists and the editor calls it.
 *
 * When the count already agrees — every edit that does not change the shape, and
 * every edit the UI already handled — the text is returned unchanged and the
 * round trip stays byte-exact.
 */
export function reconcileTableParams(params: string, numCols: number): string {
  const read = readParams(params);
  if (!read || read.declared === null) return params;
  const { args, declared } = read;
  if (declared === numCols) return params;

  const edits: { start: number; end: number; text: string }[] = [];

  for (const arg of args) {
    const isColumns = arg.name === 'columns';
    if (!isColumns && !PER_COLUMN_PARAMS.includes(arg.name)) continue;

    if (isColumns && /^\d+$/.test(arg.raw)) {
      edits.push({ start: arg.start, end: arg.end, text: String(numCols) });
      continue;
    }

    const items = tupleItems(arg.raw);
    if (!items || items.length !== declared) continue;

    const next = [...items];
    // Growing repeats the last entry (a width gets `auto`); the existing columns
    // keep their own, which the compiler confirms is pixel-invisible.
    while (next.length < numCols) next.push(isColumns ? NEW_COLUMN_WIDTH : (next[next.length - 1] ?? NEW_COLUMN_WIDTH));
    next.length = numCols;
    edits.push({ start: arg.start, end: arg.end, text: tupleText(next) });
  }

  return applyEdits(params, edits);
}
