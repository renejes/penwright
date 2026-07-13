/**
 * Search Highlight Decorations.
 *
 * Find & Replace renders its match highlights as ProseMirror Decorations
 * (ephemeral, render-only) instead of wrapping the live nodeview DOM in
 * `<mark>` elements. Mutating the contentDOM corrupts ProseMirror's view —
 * and the old "commit via `setContent(view.dom.innerHTML)`" step destroyed
 * every custom Typst node (nodeviews render without the `data-*` attributes
 * their parseHTML rules need, so math/citations/footnotes/references/images/
 * tables/magazine nodes all degraded to plain text on a single Replace).
 * Replacements are real transactions on the document model instead
 * (see SearchReplace.svelte), which also keeps them undoable.
 *
 * Same plugin pattern as commentDecorations.ts: state is pumped in via a
 * plugin-meta transaction; on `docChanged` the decoration set is remapped.
 */

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface SearchMatch {
  from: number;
  to: number;
}

interface SetSearchMeta {
  matches: SearchMatch[];
  /** 0-based index into `matches` that gets the `search-current` class; -1 = none. */
  current: number;
}

const searchKey = new PluginKey<DecorationSet>('penwrightSearch');

/**
 * Finds all case-insensitive matches of `term` in the document's text nodes
 * (a match must fit within a single text node — same semantics as the old
 * DOM TreeWalker search). typstRawBlock content lives in attrs, not text
 * nodes, so raw code is naturally excluded.
 */
export function findSearchMatches(editor: Editor, term: string): SearchMatch[] {
  const matches: SearchMatch[] = [];
  if (!term) return matches;
  const needle = term.toLowerCase();
  editor.state.doc.descendants((node: PMNode, pos: number) => {
    if (!node.isText || !node.text) return;
    let hay = node.text.toLowerCase();
    let localNeedle = needle;
    // Unicode edge: toLowerCase() can CHANGE the string length ('İ' → 'i̇'),
    // which would desync every offset derived from the lowered copy — and a
    // Replace on a shifted range corrupts text. Fall back to case-sensitive
    // matching for such nodes; everywhere else the offsets are 1:1.
    if (hay.length !== node.text.length) {
      hay = node.text;
      localNeedle = term;
    }
    let idx = hay.indexOf(localNeedle);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + localNeedle.length });
      // Advance past the WHOLE match — overlapping ranges ('aa' in 'aaa')
      // would inflate the count and let Replace All eat characters (the
      // back-to-front transaction assumes disjoint ranges).
      idx = hay.indexOf(localNeedle, idx + localNeedle.length);
    }
  });
  return matches;
}

export function setSearchHighlights(editor: Editor | null, matches: SearchMatch[], current: number): void {
  if (!editor || editor.isDestroyed) return;
  const tr = editor.view.state.tr.setMeta(searchKey, { matches, current } satisfies SetSearchMeta);
  editor.view.dispatch(tr);
}

export function clearSearchHighlights(editor: Editor | null): void {
  setSearchHighlights(editor, [], -1);
}

function buildDecorations(doc: PMNode, meta: SetSearchMeta): DecorationSet {
  if (meta.matches.length === 0) return DecorationSet.empty;
  const decorations = meta.matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === meta.current ? 'search-highlight search-current' : 'search-highlight',
    }),
  );
  return DecorationSet.create(doc, decorations);
}

export const SearchDecorations = Extension.create({
  name: 'searchDecorations',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: searchKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDeco, _oldState, newState) {
            const meta = tr.getMeta(searchKey) as SetSearchMeta | undefined;
            if (meta) return buildDecorations(newState.doc, meta);
            if (tr.docChanged) return oldDeco.map(tr.mapping, newState.doc);
            return oldDeco;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
