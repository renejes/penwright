/**
 * Reconciles external content changes by applying incremental ProseMirror
 * transactions instead of editor.commands.setContent().
 *
 * This preserves the undo history so users can Cmd+Z to revert external edits
 * (e.g., from AI agents like Claude Code).
 *
 * Strategy: Compare old and new documents at the top-level node level.
 * Find the minimal changed range (common prefix + suffix) and replace
 * only the differing middle section via a single ProseMirror transaction.
 */

import type { Editor } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';

interface TipTapDoc {
  type: 'doc';
  // Accept both the deserializer's TipTapNode[] and generic Record arrays
  content: Record<string, unknown>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTipTapDoc = { type: 'doc'; content: any[] };

/**
 * Applies newDocJSON to the editor using an incremental transaction
 * that preserves the undo history.
 *
 * Returns true if the document was changed, false if it was identical.
 */
export function reconcileContent(
  editor: Editor,
  newDocJSON: TipTapDoc | AnyTipTapDoc,
): boolean {
  const { state, view } = editor;
  const oldDoc = state.doc;

  // Create new ProseMirror document from JSON using the editor's schema
  let newDoc: PMNode;
  try {
    newDoc = PMNode.fromJSON(state.schema, newDocJSON);
  } catch {
    // Fallback: full replacement (loses undo, but at least content updates)
    editor.commands.setContent(newDocJSON as Parameters<typeof editor.commands.setContent>[0]);
    return true;
  }

  // Skip if documents are identical
  if (oldDoc.eq(newDoc)) return false;

  // Collect top-level nodes from both documents
  const oldNodes: PMNode[] = [];
  oldDoc.forEach((node) => oldNodes.push(node));

  const newNodes: PMNode[] = [];
  newDoc.forEach((node) => newNodes.push(node));

  // Find common prefix length (identical nodes from the start)
  const minLen = Math.min(oldNodes.length, newNodes.length);
  let prefixLen = 0;
  while (prefixLen < minLen && oldNodes[prefixLen].eq(newNodes[prefixLen])) {
    prefixLen++;
  }

  // Find common suffix length (identical nodes from the end)
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldNodes[oldNodes.length - 1 - suffixLen].eq(
      newNodes[newNodes.length - 1 - suffixLen],
    )
  ) {
    suffixLen++;
  }

  // If everything matches, nothing to do
  if (
    prefixLen + suffixLen >= oldNodes.length &&
    prefixLen + suffixLen >= newNodes.length
  ) {
    return false;
  }

  // Calculate ProseMirror positions for the replacement range in the old doc
  let from = 0;
  for (let i = 0; i < prefixLen; i++) {
    from += oldNodes[i].nodeSize;
  }

  let to = oldDoc.content.size;
  for (let i = 0; i < suffixLen; i++) {
    to -= oldNodes[oldNodes.length - 1 - i].nodeSize;
  }

  // Collect the replacement nodes from the new document
  const replacementNodes = newNodes.slice(prefixLen, newNodes.length - suffixLen);

  // Build and dispatch the transaction
  const { tr } = state;
  if (replacementNodes.length > 0) {
    tr.replaceWith(from, to, replacementNodes);
  } else if (from < to) {
    tr.delete(from, to);
  } else {
    return false;
  }

  view.dispatch(tr);
  return true;
}
