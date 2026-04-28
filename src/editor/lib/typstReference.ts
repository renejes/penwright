import { Node } from '@tiptap/core';

/**
 * Inline atom node for Typst cross-references (`@label`).
 *
 * Visually distinct from citation badges so the user can tell at a glance
 * whether `@foo` is a reference into the bibliography or a pointer to a
 * `<label>` somewhere in the project. The node renders as a small pill
 * with an arrow glyph + the bare label (e.g. `↳ fig:results`); Typst itself
 * resolves it to "Fig. 3" at compile time, so the editor stays compact and
 * reorder-safe — no need to keep numbers in sync at edit time.
 *
 * Serializes to `@label` in Typst output, exactly like a citation. The
 * deserializer side disambiguates between citation and reference using a
 * heuristic on the label name (colons / known prefixes → reference).
 */
export const TypstReference = Node.create({
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: { default: '' },
      // Optional caption captured at insert time; kept only as a tooltip
      // hint, never serialized — the source of truth is the `<label>` in
      // the project, which the picker re-scans on every open.
      caption: { default: '' },
      // 'figure' | 'table' | 'equation' | 'heading' | 'other'
      refType: { default: 'other' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-reference]',
        getAttrs(dom) {
          return {
            label: (dom as HTMLElement).getAttribute('data-label') ?? '',
            caption: (dom as HTMLElement).getAttribute('data-caption') ?? '',
            refType: (dom as HTMLElement).getAttribute('data-ref-type') ?? 'other',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-reference': '',
        'data-label': node.attrs.label,
        'data-caption': node.attrs.caption,
        'data-ref-type': node.attrs.refType,
        class: 'typst-reference',
      },
      `@${node.attrs.label}`,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'typst-reference';
      dom.contentEditable = 'false';
      const label = node.attrs.label as string;
      const caption = node.attrs.caption as string;
      dom.title = caption ? `${label}\n${caption}` : label;

      const icon = document.createElement('span');
      icon.className = 'typst-reference-icon';
      icon.textContent = '↳'; // ↳

      const text = document.createElement('span');
      text.className = 'typst-reference-text';
      text.textContent = label;

      dom.appendChild(icon);
      dom.appendChild(text);

      return {
        dom,
        stopEvent: () => true,
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'reference') return false;
          const ul = updatedNode.attrs.label as string;
          const uc = updatedNode.attrs.caption as string;
          text.textContent = ul;
          dom.title = uc ? `${ul}\n${uc}` : ul;
          return true;
        },
      };
    };
  },
});
