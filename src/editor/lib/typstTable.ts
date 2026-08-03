/**
 * TipTap Table Extensions configured for Penwright.
 * Wraps the official @tiptap/extension-table family with Typst-appropriate defaults.
 *
 * Adds a control bar below each table (via ProseMirror widget decorations):
 * - Gear icon (left) → opens settings dropdown (add/remove rows/cols, delete)
 * - "Done" button (right) → exits table, adds a new paragraph below
 */

import { Extension } from '@tiptap/core';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { selectedRect } from '@tiptap/pm/tables';
import { shiftTableColumn } from '../../shared/tableParams';
import { attachFloating, closeOnOutside, type FloatingHandle } from './popupAnchor';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';
import { t } from '../../shared/i18n/store.svelte';

const tableControlsKey = new PluginKey('tableControls');

// Track open dropdowns for cleanup
const openDropdownCleanups = new Set<() => void>();


/**
 * Runs a column command AND moves the table's own parameters with it, in one
 * transaction.
 *
 * The serializer can reconcile `columns:` / `align:` / `fill:` … from the COUNT
 * alone, but a count can only ever say "one more" — it cannot say WHERE, so a
 * column inserted in the middle would shift every entry after it onto the wrong
 * column. Here the position is known, so this is the only place that can get it
 * right. The serializer's reconciliation stays as the net for shape changes that
 * do not come through this menu (an AI edit, a paste, an undo).
 *
 * One transaction so the document is never briefly inconsistent and a single
 * undo takes back the whole edit.
 *
 * The indices are the ones prosemirror-tables itself uses (read from its
 * source): `addColumnBefore` inserts at `rect.left`, `addColumnAfter` at
 * `rect.right`, and `deleteColumn` removes the whole selected span — which is
 * why removal loops rather than dropping a single entry.
 */
function columnCommand(editor: Editor, op: 'before' | 'after' | 'remove'): void {
  // Read BEFORE the structural change: afterwards the map describes the new
  // shape and `rect.right` has already moved.
  let index: number | null = null;
  let count = 1;
  try {
    const rect = selectedRect(editor.view.state);
    index = op === 'after' ? rect.right : rect.left;
    if (op === 'remove') count = Math.max(1, rect.right - rect.left);
  } catch {
    index = null;                       // selection is not in a table
  }

  const chain = editor.chain().focus();
  const structural =
    op === 'before' ? chain.addColumnBefore()
    : op === 'after' ? chain.addColumnAfter()
    : chain.deleteColumn();

  structural
    .command(({ tr, dispatch }) => {
      // Runs on the SAME transaction, after the structural step — so `tr.doc`
      // already has the new shape and `index` is the position from before it.
      if (index === null || !dispatch) return true;
      const $from = tr.selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name !== 'table') continue;
        const params = typeof node.attrs.params === 'string' ? node.attrs.params : '';
        if (!params) return true;       // no parameters of its own — nothing to move
        let next = params;
        if (op === 'remove') {
          // Always at the same index: each removal shifts the rest down onto it.
          for (let i = 0; i < count; i++) next = shiftTableColumn(next, 'remove', index);
        } else {
          next = shiftTableColumn(next, 'insert', index);
        }
        if (next !== params) tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, params: next });
        return true;
      }
      return true;
    })
    .run();
}

/**
 * Inserts a row, keeping a `table.header` row first.
 *
 * Typst requires `table.header(...)` to be the FIRST positional argument, so a
 * row ABOVE the header is not representable at all. Inserting one anyway made
 * the former header row stop being row 0, `serializeTable` then saw no header,
 * and `table.header(…)` was dropped — the repeating header row silently gone
 * from every page of the rendered document.
 *
 * So when the cursor is in the header row, "row above" inserts BELOW it, as the
 * first body row. That is the row the user can actually have, they see it
 * appear, and one undo takes it back — where losing the header changes every
 * page and nothing on screen says so.
 */
function rowCommand(editor: Editor, where: 'before' | 'after'): void {
  let redirect = false;
  if (where === 'before') {
    try {
      const rect = selectedRect(editor.view.state);
      const firstRow = rect.table.firstChild;
      const headerFirst =
        !!firstRow &&
        firstRow.childCount > 0 &&
        Array.from({ length: firstRow.childCount }, (_, i) => firstRow.child(i))
          .every(cell => cell.type.name === 'tableHeader');
      redirect = headerFirst && rect.top === 0;
    } catch {
      redirect = false;                 // selection is not in a table
    }
  }
  const chain = editor.chain().focus();
  (where === 'after' || redirect ? chain.addRowAfter() : chain.addRowBefore()).run();
}

function buildTableDecorations(doc: PmNode, tiptapEditor: Editor): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      const endPos = pos + node.nodeSize;

      const widget = Decoration.widget(
        endPos,
        (view: EditorView) => {
          // ── Container (control bar) ──
          const container = document.createElement('div');
          container.className = 'table-controls';

          // ── Gear button (left) ──
          const gear = document.createElement('button');
          gear.className = 'table-gear-btn';
          gear.innerHTML = '&#9881;';
          gear.title = t().editorLib.tableSettingsTitle;

          let dropdownEl: HTMLElement | null = null;
          let floating: FloatingHandle | null = null;
          let unbindOutside: (() => void) | null = null;

          function closeDropdown() {
            floating?.stop();
            floating = null;
            unbindOutside?.();
            unbindOutside = null;
            dropdownEl?.remove();
            dropdownEl = null;
            openDropdownCleanups.delete(closeDropdown);
          }

          function openDropdown() {
            const tableNode = view.state.doc.nodeAt(pos);
            if (!tableNode) return;

            const rows = tableNode.childCount;
            const cols = tableNode.child(0)?.childCount ?? 0;

            // Dropdown (fixed-positioned near the gear icon). Placed by
            // `attachFloating` once its buttons exist and it can be measured.
            dropdownEl = document.createElement('div');
            dropdownEl.className = 'table-settings-dropdown';
            dropdownEl.style.position = 'fixed';

            const dimsText = (c: number, r: number) =>
              t().editorLib.tableDims
                .replace('{cols}', String(c))
                .replace('{rows}', String(r));

            dropdownEl.innerHTML = `
              <div class="table-settings-header">${t().editorLib.tableHeader}</div>
              <div class="table-settings-dims">${dimsText(cols, rows)}</div>
            `;

            // Action buttons
            const actions = document.createElement('div');
            actions.className = 'table-settings-actions';

            const btnData = [
              { label: t().editorLib.tableAddColumnBefore, action: () => columnCommand(tiptapEditor, 'before') },
              { label: t().editorLib.tableAddColumn, action: () => columnCommand(tiptapEditor, 'after') },
              { label: t().editorLib.tableAddRowBefore, action: () => rowCommand(tiptapEditor, 'before') },
              { label: t().editorLib.tableAddRow, action: () => rowCommand(tiptapEditor, 'after') },
              { label: t().editorLib.tableRemoveColumn, danger: true, action: () => columnCommand(tiptapEditor, 'remove') },
              { label: t().editorLib.tableRemoveRow, danger: true, action: () => tiptapEditor.chain().focus().deleteRow().run() },
            ];

            for (const bd of btnData) {
              const btn = document.createElement('button');
              btn.textContent = bd.label;
              if (bd.danger) btn.className = 'danger';
              btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                bd.action();
                // Refresh dimensions display
                setTimeout(() => {
                  const updatedTable = view.state.doc.nodeAt(pos);
                  if (updatedTable && dropdownEl) {
                    const dimsEl = dropdownEl.querySelector('.table-settings-dims');
                    if (dimsEl) {
                      const nr = updatedTable.childCount;
                      const nc = updatedTable.child(0)?.childCount ?? 0;
                      dimsEl.textContent = dimsText(nc, nr);
                    }
                  }
                }, 50);
              });
              actions.appendChild(btn);
            }
            dropdownEl.appendChild(actions);

            // Divider
            const divider = document.createElement('div');
            divider.className = 'table-settings-divider';
            dropdownEl.appendChild(divider);

            // Delete table
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'danger table-settings-delete';
            deleteBtn.textContent = t().editorLib.tableDelete;
            deleteBtn.addEventListener('mousedown', (e) => {
              e.preventDefault();
              closeDropdown();
              tiptapEditor.chain().focus().deleteTable().run();
            });
            dropdownEl.appendChild(deleteBtn);

            document.body.appendChild(dropdownEl);
            // `prefer: 'above'` keeps the design decision this menu was written
            // with — it opens upward out of the gear so it does not cover the
            // table it edits — while gaining the fallback the hardcoded
            // `bottom:` could not have: a gear near the top of the window now
            // drops below instead of running off the screen. `cap` because this
            // menu has no max-height of its own and carries seven buttons.
            floating = attachFloating(
              dropdownEl,
              () => (gear.isConnected ? gear.getBoundingClientRect() : null),
              { prefer: 'above', cap: true, observe: gear },
            );
            // Replaces the full-screen backdrop: it blocked the wheel outright
            // (measured 480 px → 0 px of editor scroll) for as long as the menu
            // was open.
            unbindOutside = closeOnOutside(() => [dropdownEl, gear], closeDropdown);
            openDropdownCleanups.add(closeDropdown);
          }

          gear.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropdownEl) {
              closeDropdown();
            } else {
              openDropdown();
            }
          });

          // ── Done button (right) ──
          const done = document.createElement('button');
          done.className = 'table-done-btn';
          done.textContent = t().editorLib.blockDone;
          done.title = t().editorLib.tableDoneTooltip;

          done.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { state } = view;
            const tr = state.tr.insert(
              endPos,
              state.schema.nodes.paragraph.create(),
            );
            tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)));
            view.dispatch(tr);
            view.focus();
          });

          container.appendChild(gear);
          container.appendChild(done);

          return container;
        },
        {
          side: 1,
          key: `table-controls-${pos}-${node.nodeSize}`,
          stopEvent: () => true,
          destroy: () => {
            // Clean up any open dropdown/backdrop for this widget
            for (const cleanup of openDropdownCleanups) {
              cleanup();
            }
          },
        },
      );

      decorations.push(widget);
      return false; // don't descend into table children
    }
    return true;
  });

  return DecorationSet.create(doc, decorations);
}

export const TypstTable = Table.extend({
  addProseMirrorPlugins() {
    const editor = this.editor;
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: tableControlsKey,
        state: {
          init(_, state) {
            return buildTableDecorations(state.doc, editor);
          },
          apply(tr, old, _, newState) {
            if (tr.docChanged) {
              return buildTableDecorations(newState.doc, editor);
            }
            return old;
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
}).configure({
  resizable: false,
  HTMLAttributes: {
    class: 'typst-table',
  },
});

export const TypstTableRow = TableRow;

export const TypstTableCell = TableCell.configure({
  HTMLAttributes: {
    class: 'typst-table-cell',
  },
});

export const TypstTableHeader = TableHeader.configure({
  HTMLAttributes: {
    class: 'typst-table-header',
  },
});

/**
 * Carries a `#table(...)`'s own named parameters, as SOURCE TEXT, on the table
 * node — `columns: (auto, 1fr), align: (left, right), fill: (…)` and whatever
 * else the author wrote.
 *
 * This is what makes the cells editable without claiming the styling. The
 * deserializer keeps the parameter list verbatim and `serializeTable` writes it
 * back untouched, so a hand-tuned `stroke:` survives a round trip byte-for-byte
 * while the prices inside the table become ordinary editable cells.
 *
 * Declaring it HERE is what makes it survive. ProseMirror drops attributes its
 * schema does not know — the failure that lost heading labels, and that
 * `ListAttachment` exists to prevent for lists. Without this, the deserializer
 * would set `params`, the editor would discard them on the first keystroke, and
 * the next save would emit a bare `columns: N`, silently deleting every
 * alignment, fill and stroke the author had written.
 *
 * Mirrored to `data-typst-params` so it also survives copy/paste and DOM
 * (de)serialization, following the ListAttachment / HeadingLabel pattern.
 */
export const TableParams = Extension.create({
  name: 'tableParams',

  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          params: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-typst-params') ?? '',
            renderHTML: (attributes) => {
              if (!attributes.params) return {};
              return { 'data-typst-params': attributes.params };
            },
          },
          /**
           * Which of the two header forms the author wrote. `table.header[A][B]`
           * and `table.header([A], [B])` render identically (pixel-compared), so
           * this is not about meaning — it is about not rewriting eight client
           * files on every save just because we prefer the other spelling.
           */
          headerForm: {
            default: 'paren',
            parseHTML: (element) => element.getAttribute('data-header-form') ?? 'paren',
            renderHTML: (attributes) => {
              if (attributes.headerForm !== 'bracket') return {};
              return { 'data-header-form': 'bracket' };
            },
          },
        },
      },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          /**
           * The cell was written as a STRING (`"Kanal"`), not as a content block
           * (`[Kanal]`). The two are not the same thing — `"*fett*"` renders the
           * asterisks literally — and nine of the corpus's sixteen tables write
           * their cells this way. Remembering it keeps those files byte-stable;
           * the moment the user gives such a cell real markup, the serializer
           * drops back to a content block, because a string could not carry it.
           */
          literal: {
            default: false,
            parseHTML: (element) => element.getAttribute('data-literal') === 'true',
            renderHTML: (attributes) => {
              if (!attributes.literal) return {};
              return { 'data-literal': 'true' };
            },
          },
        },
      },
    ];
  },
});
