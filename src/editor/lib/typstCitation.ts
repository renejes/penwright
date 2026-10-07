import { Node, type Editor } from '@tiptap/core';
import { attachFieldPopup } from './fieldPopup';
import { formatCitationPage, pageFieldFromSupplement } from '../../shared/citationPdf';
import { t } from '../../shared/i18n/store.svelte';

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
    return ({ node, editor, getPos }: { node: { attrs: Record<string, unknown>; type: { name: string } }; editor: Editor; getPos: () => number | undefined }) => {
      const dom = document.createElement('span');
      dom.className = 'typst-citation';
      dom.contentEditable = 'false';

      const icon = document.createElement('span');
      icon.className = 'typst-citation-icon';
      icon.textContent = '@';

      const text = document.createElement('span');
      text.className = 'typst-citation-text';

      const paint = (attrs: Record<string, unknown>) => {
        const citekey = String(attrs.citekey ?? '');
        const label = String(attrs.label || citekey);
        const supplement = String(attrs.supplement ?? '');
        text.textContent = supplement ? `${label} ${supplement}` : label;
        dom.title = `@${citekey}`;
        dom.setAttribute('data-supplement', supplement);
      };
      paint(node.attrs);
      let attrs = node.attrs;

      dom.appendChild(icon);
      dom.appendChild(text);

      dom.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('penwright:citation-leave'));
      });

      const pagePopup = attachFieldPopup(dom, () => {
        const pos = getPos();
        const live = pos == null ? null : editor.state.doc.nodeAt(pos);
        const attrs = (live?.attrs ?? node.attrs) as Record<string, unknown>;
        return {
          title: `@${String(attrs.citekey ?? '')}`,
          fields: [{
            key: 'page',
            label: t().editorLib.citationPageLabel,
            hint: t().editorLib.citationPageHint,
            rows: 1,
          }],
          read: () => pageFieldFromSupplement(String(attrs.supplement ?? '')),
          write: (_key, value) => {
            const at = getPos();
            if (at == null) return;
            const current = editor.state.doc.nodeAt(at);
            if (!current) return;
            if (value.trim() && !formatCitationPage(value)) return;
            const supplement = formatCitationPage(value) ?? '';
            editor.view.dispatch(editor.state.tr.setNodeMarkup(at, undefined, {
              ...current.attrs,
              supplement,
            }));
          },
        };
      });

      // Right-click on a citation → open Project Search pre-filled with
      // `@<citekey>` (whole-word) so the user lands on every usage in the
      // project. Whole-word stops `@chen2021codex` matching `@chen2021codex2`.
      dom.addEventListener('contextmenu', (e) => {
        const citekey = String(attrs.citekey || '');
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
          attrs = updatedNode.attrs;
          paint(attrs);
          return true;
        },
        destroy() {
          pagePopup.destroy();
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
