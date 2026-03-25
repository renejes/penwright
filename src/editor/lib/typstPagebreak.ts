import { Node } from '@tiptap/core';

export const TypstPagebreak = Node.create({
  name: 'pagebreak',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-pagebreak]' }];
  },

  renderHTML() {
    return ['div', { 'data-pagebreak': '', class: 'typst-pagebreak' }, 'Page Break'];
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
      label.textContent = 'Page Break';

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
