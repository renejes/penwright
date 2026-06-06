import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { t } from '../../shared/i18n/store.svelte';

/**
 * Custom TipTap node for Typst code that can't be rendered as WYSIWYG.
 * Displays as a styled code block with an editable textarea.
 * Content is passed through 1:1 during serialization (roundtrip-safe).
 */
export const TypstRawBlock = Node.create({
  name: 'typstRawBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      content: { default: '' },
      blockType: { default: 'unknown' }, // math | config | code | comment | unknown
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-typst-raw]',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            content: el.getAttribute('data-content') ?? '',
            blockType: el.getAttribute('data-block-type') ?? 'unknown',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-typst-raw': '',
        'data-content': node.attrs.content,
        'data-block-type': node.attrs.blockType,
        class: `typst-raw-block typst-raw-${node.attrs.blockType}`,
      },
      node.attrs.content,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      // Container
      const dom = document.createElement('div');
      dom.classList.add('typst-raw-block', `typst-raw-${node.attrs.blockType}`);

      // Label
      const label = document.createElement('div');
      label.classList.add('typst-raw-label');
      label.textContent = getBlockLabel(node.attrs.blockType);
      dom.appendChild(label);

      // Editable textarea for raw Typst content
      const textarea = document.createElement('textarea');
      textarea.classList.add('typst-raw-textarea');
      textarea.value = node.attrs.content;
      textarea.spellcheck = false;
      textarea.rows = Math.max(1, node.attrs.content.split('\n').length);

      textarea.addEventListener('input', () => {
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos !== undefined) {
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                content: textarea.value,
              })
            );
            textarea.rows = Math.max(1, textarea.value.split('\n').length);
          }
        }
      });

      // Leave the block: insert a paragraph right after it and move the cursor
      // there. Shared by the "Done" button and the keyboard shortcuts below
      // (plain Enter stays inside the textarea as a newline).
      const exitBlock = () => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (pos === undefined) return;
        const endPos = pos + node.nodeSize;
        const tr = editor.view.state.tr.insert(
          endPos,
          editor.view.state.schema.nodes.paragraph.create()
        );
        tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)));
        editor.view.dispatch(tr);
        editor.view.focus();
      };

      // Esc or Cmd/Ctrl+Enter exits the block without reaching for the mouse.
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
          e.preventDefault();
          exitBlock();
        }
      });

      // "Done" button to exit the block and create a new line below
      const doneBtn = document.createElement('button');
      doneBtn.classList.add('typst-raw-done');
      doneBtn.textContent = t().editorLib.blockDone;
      doneBtn.title = t().editorLib.rawBlockDoneTooltip;
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exitBlock();
      });

      dom.appendChild(textarea);
      dom.appendChild(doneBtn);

      return {
        dom,
        // Let the textarea and done button handle their own events
        stopEvent(event: Event) {
          const tag = (event.target as HTMLElement)?.tagName;
          return tag === 'TEXTAREA' || tag === 'BUTTON';
        },
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'typstRawBlock') return false;
          if (textarea.value !== updatedNode.attrs.content) {
            textarea.value = updatedNode.attrs.content;
            textarea.rows = Math.max(1, updatedNode.attrs.content.split('\n').length);
          }
          dom.className = `typst-raw-block typst-raw-${updatedNode.attrs.blockType}`;
          label.textContent = getBlockLabel(updatedNode.attrs.blockType);
          return true;
        },
      };
    };
  },
});

function getBlockLabel(blockType: string): string {
  const m = t().editorLib;
  switch (blockType) {
    case 'math':
      return m.rawBlockMath;
    case 'config':
      return m.rawBlockConfig;
    case 'code':
      return m.rawBlockCode;
    case 'comment':
      return m.rawBlockComment;
    default:
      return m.rawBlockDefault;
  }
}
