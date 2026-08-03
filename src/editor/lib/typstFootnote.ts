import { Node, type Editor } from '@tiptap/core';
import { t } from '../../shared/i18n/store.svelte';
import { attachFloating, closeOnOutside, type FloatingHandle } from './popupAnchor';

/**
 * Insert a footnote at the current selection and immediately open its
 * editor popup. The popup is bound to the NodeView's click handler, so
 * we synthesize a click on the freshly-mounted DOM node once
 * ProseMirror has rendered the change.
 */
export function insertFootnoteWithEditor(editor: Editor): void {
  if (!editor) return;
  editor.chain().focus().insertContent({ type: 'footnote', attrs: { content: '' } }).run();

  // Wait for ProseMirror to mount the NodeView, then dispatch a click on
  // the just-inserted footnote so the popup opens for immediate editing.
  // We retry a few times in case the NodeView hasn't attached yet.
  let attempts = 0;
  const tryOpen = () => {
    const root = editor.view.dom;
    // The freshly inserted footnote sits immediately before the cursor.
    const candidates = root.querySelectorAll('span.typst-footnote');
    let target: HTMLElement | null = null;
    if (candidates.length > 0) {
      // Prefer the footnote whose preview is empty — that's the new one.
      for (let i = candidates.length - 1; i >= 0; i--) {
        const el = candidates[i] as HTMLElement;
        const preview = el.querySelector('.typst-footnote-preview');
        if (preview?.classList.contains('typst-footnote-empty')) {
          target = el;
          break;
        }
      }
      target ??= candidates[candidates.length - 1] as HTMLElement;
    }
    if (target) {
      target.click();
      return;
    }
    if (attempts++ < 5) requestAnimationFrame(tryOpen);
  };
  requestAnimationFrame(tryOpen);
}

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
        preview.textContent = text.length > 30 ? text.slice(0, 30) + '\u2026' : (text || t().editorLib.footnotePreviewEmpty);
        if (!text) preview.classList.add('typst-footnote-empty');
        else preview.classList.remove('typst-footnote-empty');
      };
      updatePreview(node.attrs.content as string);

      dom.title = t().editorLib.footnoteEditTitle;
      dom.appendChild(marker);
      dom.appendChild(preview);

      // Popup editor elements
      let popup: HTMLDivElement | null = null;
      let floating: FloatingHandle | null = null;
      let unbindOutside: (() => void) | null = null;

      function closePopup() {
        floating?.stop();
        floating = null;
        unbindOutside?.();
        unbindOutside = null;
        if (popup) {
          popup.remove();
          popup = null;
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

        // Popup panel. Placed by `attachFloating` once it is in the document and
        // measurable — a footnote badge is inline, so at the end of a line the
        // old `left = rect.left` pushed a 300 px panel off the right edge.
        popup = document.createElement('div');
        popup.className = 'footnote-popup';

        const label = document.createElement('div');
        label.className = 'footnote-popup-label';
        label.textContent = t().editorLib.footnoteLabel;
        popup.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.className = 'footnote-popup-textarea';
        textarea.value = node.attrs.content as string;
        textarea.placeholder = t().editorLib.footnotePlaceholder;
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
          // The textarea just grew; re-place so it cannot walk out of the
          // viewport while it is being typed into.
          floating?.update();
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
        hint.textContent = t().editorLib.footnoteHint;
        popup.appendChild(hint);

        document.body.appendChild(popup);

        // `cap` because `.footnote-popup` has no max-height of its own and a
        // long note grows without limit on a page that cannot scroll.
        floating = attachFloating(
          popup,
          () => (dom.isConnected ? dom.getBoundingClientRect() : null),
          { cap: true, observe: dom },
        );
        // Replaces the full-screen backdrop this used to build. Measured: that
        // backdrop took `.editor-container` from 480 px of wheel scroll to 0 —
        // while a footnote was open the document could not be scrolled at all.
        unbindOutside = closeOnOutside(() => [popup, dom], closePopup);

        // Focus and auto-resize after mount
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.selectionStart = textarea.value.length;
          textarea.selectionEnd = textarea.value.length;
          autoResize();
          // The height is only final after the resize.
          floating?.update();
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
          const content = updatedNode.attrs.content as string;
          updatePreview(content);
          dom.title = t().editorLib.footnoteEditTitle;
          return true;
        },
        destroy() {
          closePopup();
        },
      };
    };
  },
});
