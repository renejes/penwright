/**
 * TipTap Table Extensions configured for Penwright.
 * Wraps the official @tiptap/extension-table family with Typst-appropriate defaults.
 *
 * Adds a control bar below each table (via ProseMirror widget decorations):
 * - Gear icon (left) → opens settings dropdown (add/remove rows/cols, delete)
 * - "Done" button (right) → exits table, adds a new paragraph below
 */

import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';
import { t } from '../../shared/i18n/store.svelte';

const tableControlsKey = new PluginKey('tableControls');

// Track open dropdowns for cleanup
const openDropdownCleanups = new Set<() => void>();

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
          let backdropEl: HTMLElement | null = null;

          function closeDropdown() {
            dropdownEl?.remove();
            backdropEl?.remove();
            dropdownEl = null;
            backdropEl = null;
            openDropdownCleanups.delete(closeDropdown);
          }

          function openDropdown() {
            const tableNode = view.state.doc.nodeAt(pos);
            if (!tableNode) return;

            const rows = tableNode.childCount;
            const cols = tableNode.child(0)?.childCount ?? 0;

            // Backdrop (fixed, full viewport)
            backdropEl = document.createElement('div');
            backdropEl.className = 'table-settings-backdrop';
            backdropEl.addEventListener('mousedown', (e) => {
              e.preventDefault();
              closeDropdown();
            });
            document.body.appendChild(backdropEl);

            // Dropdown (fixed-positioned near the gear icon)
            dropdownEl = document.createElement('div');
            dropdownEl.className = 'table-settings-dropdown';

            const gearRect = gear.getBoundingClientRect();
            dropdownEl.style.position = 'fixed';
            dropdownEl.style.left = `${gearRect.left}px`;
            dropdownEl.style.bottom = `${window.innerHeight - gearRect.top + 4}px`;

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
              { label: t().editorLib.tableAddColumn, action: () => tiptapEditor.chain().focus().addColumnAfter().run() },
              { label: t().editorLib.tableAddRow, action: () => tiptapEditor.chain().focus().addRowAfter().run() },
              { label: t().editorLib.tableRemoveColumn, danger: true, action: () => tiptapEditor.chain().focus().deleteColumn().run() },
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
