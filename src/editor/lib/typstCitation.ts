import { Node } from '@tiptap/core';

/**
 * Inline atom node for Typst citations (@citekey).
 * Renders as a styled badge with author and year.
 * Serializes to @citekey in Typst output.
 */
export const TypstCitation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      citekey: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-citation]',
        getAttrs(dom) {
          return {
            citekey: (dom as HTMLElement).getAttribute('data-citekey') ?? '',
            label: (dom as HTMLElement).getAttribute('data-label') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-citation': '',
        'data-citekey': node.attrs.citekey,
        'data-label': node.attrs.label,
        class: 'typst-citation',
      },
      node.attrs.label || `@${node.attrs.citekey}`,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'typst-citation';
      dom.contentEditable = 'false';
      dom.title = `@${node.attrs.citekey}`;

      const icon = document.createElement('span');
      icon.className = 'typst-citation-icon';
      icon.textContent = '@';

      const text = document.createElement('span');
      text.className = 'typst-citation-text';
      text.textContent = node.attrs.label || node.attrs.citekey;

      dom.appendChild(icon);
      dom.appendChild(text);

      return {
        dom,
        stopEvent: () => true,
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'citation') return false;
          text.textContent = updatedNode.attrs.label || updatedNode.attrs.citekey;
          dom.title = `@${updatedNode.attrs.citekey}`;
          return true;
        },
      };
    };
  },
});
