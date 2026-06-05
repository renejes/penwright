/**
 * Comment Decorations.
 *
 * Renders gold-yellow highlights for the anchor text of every active
 * (non-resolved) comment without modifying the underlying document. The
 * comment data lives entirely outside the Typst source — it sits in
 * `<project>/comments/<id>.md` files — so we use ProseMirror Decorations
 * (ephemeral, render-only) rather than document marks. The source stays
 * clean and never compiles a comment into the PDF/DOCX output.
 *
 * On click, we dispatch a `penwright:comment-click` event with the comment id
 * so the renderer can scroll the side-panel to that entry.
 */

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface CommentMark {
  id: string;
  anchor: string;
  resolved: boolean;
  orphaned?: boolean;
}

interface SetMarksMeta {
  marks: CommentMark[];
}

const commentsKey = new PluginKey<DecorationSet>('penwrightComments');

// Module-level cache: a single editor instance is enough for Penwright, and
// keeping the marks here lets `apply()` re-derive decorations after every
// `docChanged` transaction without having to re-pump them through.
let currentMarks: CommentMark[] = [];

export function setCommentMarks(editor: Editor | null, marks: CommentMark[]): void {
  currentMarks = marks;
  if (!editor) return;
  const tr = editor.view.state.tr.setMeta(commentsKey, { marks } satisfies SetMarksMeta);
  editor.view.dispatch(tr);
}

function buildDecorations(doc: PMNode, marks: CommentMark[]): DecorationSet {
  if (marks.length === 0) return DecorationSet.empty;

  // Collect text nodes with their absolute positions. Anchor matches must
  // fit within a single text node — anchors that span multiple paragraphs
  // are rare and we accept "no highlight" for those cases (the comment
  // still shows up in the side panel as orphaned-but-listed).
  const parts: { text: string; from: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      parts.push({ text: node.text, from: pos });
    }
  });

  const decorations: Decoration[] = [];
  for (const mark of marks) {
    if (mark.resolved) continue;
    if (!mark.anchor) continue;
    for (const part of parts) {
      const idx = part.text.indexOf(mark.anchor);
      if (idx >= 0) {
        const from = part.from + idx;
        const to = from + mark.anchor.length;
        decorations.push(
          Decoration.inline(from, to, {
            class: 'penwright-comment-mark',
            'data-comment-id': mark.id,
          }),
        );
        break;
      }
    }
  }

  return DecorationSet.create(doc, decorations);
}

export const CommentDecorations = Extension.create({
  name: 'commentDecorations',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: commentsKey,
        state: {
          init(_, state) {
            return buildDecorations(state.doc, currentMarks);
          },
          apply(tr, oldDeco, _oldState, newState) {
            const meta = tr.getMeta(commentsKey) as SetMarksMeta | undefined;
            if (meta) {
              // Marks list changed → rebuild from scratch.
              return buildDecorations(newState.doc, meta.marks);
            }
            if (tr.docChanged) {
              // PERF: remap existing decorations through the transaction's
              // changes (O(changes)) instead of re-scanning the whole document
              // on every keystroke. Positions stay anchored as text shifts;
              // deleted ranges drop out. Stable anchoring is also more correct
              // than re-running indexOf (which could jump to a new occurrence).
              return oldDeco.map(tr.mapping, newState.doc);
            }
            return oldDeco;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
          handleClick(_view, _pos, event) {
            const target = (event.target as HTMLElement | null)?.closest('.penwright-comment-mark') as HTMLElement | null;
            if (!target) return false;
            const id = target.dataset.commentId;
            if (!id) return false;
            window.dispatchEvent(new CustomEvent('penwright:comment-click', { detail: { id } }));
            return false; // don't swallow — let the cursor still move
          },
        },
      }),
    ];
  },
});
