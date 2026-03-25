import { Node } from '@tiptap/core';

/**
 * Inline atom node for Typst footnotes.
 * Renders as a superscript marker with preview text.
 * Click to open an inline editor popup (no window.prompt).
 * Serializes to #footnote[content].
 */
export const TypstFootnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      content: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-footnote]',
        getAttrs(dom) {
          return {
            content: (dom as HTMLElement).getAttribute('data-content') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-footnote': '',
        'data-content': node.attrs.content,
        class: 'typst-footnote',
      },
      '',
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'typst-footnote';
      dom.contentEditable = 'false';

      const marker = document.createElement('sup');
      marker.className = 'typst-footnote-marker';
      // Number is set automatically via CSS counter (counter-increment: footnote)

      const preview = document.createElement('span');
      preview.className = 'typst-footnote-preview';
      const updatePreview = (text: string) => {
        preview.textContent = text.length > 30 ? text.slice(0, 30) + '\u2026' : (text || 'click to edit');
        if (!text) preview.classList.add('typst-footnote-empty');
        else preview.classList.remove('typst-footnote-empty');
      };
      updatePreview(node.attrs.content as string);

      dom.title = 'Click to edit footnote';
      dom.appendChild(marker);
      dom.appendChild(preview);

      // Popup editor elements
      let popup: HTMLDivElement | null = null;
      let backdrop: HTMLDivElement | null = null;

      function closePopup() {
        if (popup) {
          popup.remove();
          popup = null;
        }
        if (backdrop) {
          backdrop.remove();
          backdrop = null;
        }
      }

      function updateNodeContent(newContent: string) {
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos !== undefined) {
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                content: newContent,
              }),
            );
          }
        }
      }

      function openPopup() {
        if (popup) {
          closePopup();
          return;
        }

        const rect = dom.getBoundingClientRect();

        // Backdrop to close on outside click
        backdrop = document.createElement('div');
        backdrop.className = 'footnote-popup-backdrop';
        backdrop.addEventListener('mousedown', (e) => {
          e.preventDefault();
          closePopup();
        });
        document.body.appendChild(backdrop);

        // Popup panel
        popup = document.createElement('div');
        popup.className = 'footnote-popup';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 4}px`;

        const label = document.createElement('div');
        label.className = 'footnote-popup-label';
        label.textContent = 'Footnote';
        popup.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.className = 'footnote-popup-textarea';
        textarea.value = node.attrs.content as string;
        textarea.placeholder = 'Enter footnote text...';
        textarea.rows = 3;

        // Auto-resize
        const autoResize = () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        };
        textarea.addEventListener('input', autoResize);

        // Save on every input (live update)
        textarea.addEventListener('input', () => {
          updateNodeContent(textarea.value);
        });

        // Close on Escape, confirm on Cmd+Enter
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            closePopup();
            editor.commands.focus();
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            closePopup();
            editor.commands.focus();
          }
        });

        popup.appendChild(textarea);

        const hint = document.createElement('div');
        hint.className = 'footnote-popup-hint';
        hint.textContent = 'Esc or Cmd+Enter to close';
        popup.appendChild(hint);

        document.body.appendChild(popup);

        // Focus and auto-resize after mount
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.selectionStart = textarea.value.length;
          textarea.selectionEnd = textarea.value.length;
          autoResize();
        });
      }

      dom.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPopup();
      });

      return {
        dom,
        stopEvent: () => true,
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'footnote') return false;
          node = updatedNode;
          const t = updatedNode.attrs.content as string;
          updatePreview(t);
          dom.title = 'Click to edit footnote';
          return true;
        },
        destroy() {
          closePopup();
        },
      };
    };
  },
});
