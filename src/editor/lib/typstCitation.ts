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
      // Typst `@key[p. 12]` locator. Must round-trip or the supplement
      // becomes visible prose (`[p. 12]`) and drops out of the citation.
      supplement: { default: '' },
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
            supplement: (dom as HTMLElement).getAttribute('data-supplement') ?? '',
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
        'data-supplement': node.attrs.supplement ?? '',
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
      dom.title = `@${node.attrs.citekey} — Right-click to find usages`;

      const icon = document.createElement('span');
      icon.className = 'typst-citation-icon';
      icon.textContent = '@';

      const text = document.createElement('span');
      text.className = 'typst-citation-text';
      text.textContent = node.attrs.label || node.attrs.citekey;

      dom.appendChild(icon);
      dom.appendChild(text);

      // Right-click on a citation → open Project Search pre-filled with
      // `@<citekey>` (whole-word) so the user lands on every usage in the
      // project. Whole-word stops `@chen2021codex` matching `@chen2021codex2`.
      dom.addEventListener('contextmenu', (e) => {
        const citekey = (node.attrs.citekey as string) || '';
        if (!citekey) return;
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('penwright:find-backlinks', {
          detail: { query: `@${citekey}`, wholeWord: true, caseSensitive: true },
        }));
      });

      // Hover preview: 350 ms after entering a citation badge, dispatch a
      // `penwright:citation-hover` event. The App-level listener decides whether
      // to mount the hover card. We also dispatch `penwright:citation-leave`
      // so the card can begin its close-with-grace-period.
      let hoverTimer: number | null = null;
      dom.addEventListener('mouseenter', () => {
        const citekey = (node.attrs.citekey as string) || '';
        if (!citekey) return;
        if (hoverTimer != null) window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => {
          hoverTimer = null;
          const rect = dom.getBoundingClientRect();
          window.dispatchEvent(new CustomEvent('penwright:citation-hover', {
            detail: {
              citekey,
              rect: {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
              },
            },
          }));
        }, 350);
      });
      dom.addEventListener('mouseleave', () => {
        if (hoverTimer != null) {
          window.clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        window.dispatchEvent(new CustomEvent('penwright:citation-leave'));
      });

      return {
        dom,
        stopEvent: () => true,
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'citation') return false;
          text.textContent = updatedNode.attrs.label || updatedNode.attrs.citekey;
          dom.title = `@${updatedNode.attrs.citekey} — Right-click to find usages`;
          return true;
        },
        destroy() {
          // A pending dwell timer would otherwise fire against the detached
          // dom (all-zero rect) and pop a mispositioned hover card.
          if (hoverTimer != null) {
            window.clearTimeout(hoverTimer);
            hoverTimer = null;
          }
        },
      };
    };
  },
});
