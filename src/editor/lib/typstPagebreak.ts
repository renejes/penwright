import { Node } from '@tiptap/core';
import { t } from '../../shared/i18n/store.svelte';

export const TypstPagebreak = Node.create({
  name: 'pagebreak',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  /**
   * The call's arguments, verbatim — `weak: true`, `to: "even"`, or empty.
   *
   * They are not editable here and they are not meant to be; the node exists so
   * the break is visible and movable. The attribute is what stops a round trip
   * from rewriting a deliberate `#pagebreak(weak: true)` as a forced break.
   */
  addAttributes() {
    return {
      args: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-pagebreak-args') ?? '',
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.args ? { 'data-pagebreak-args': String(attrs.args) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-pagebreak]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // Carry the args through the HTML round trip too — copy/paste inside the
    // editor goes via HTML, and a paste that dropped them would reintroduce
    // exactly the bug the attribute exists to prevent.
    return ['div', { ...HTMLAttributes, 'data-pagebreak': '', class: 'typst-pagebreak' }, 'Page Break'];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = 'typst-pagebreak';
      dom.contentEditable = 'false';

      const line = document.createElement('div');
      line.className = 'typst-pagebreak-line';

      const label = document.createElement('span');
      label.className = 'typst-pagebreak-label';
      label.textContent = t().editorLib.pageBreakLabel;

      line.appendChild(label);
      dom.appendChild(line);

      return {
        dom,
        stopEvent: () => false,
        ignoreMutation: () => true,
      };
    };
  },
});
