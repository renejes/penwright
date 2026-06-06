import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { getCitationEntries, onCitationEntriesUpdate, type CitationEntry } from './citationSuggestion';
import { t } from '../../shared/i18n/store.svelte';

/**
 * Block-level node for Typst #bibliography(...).
 * Shows a live preview of all citation entries from the .bib file.
 * Serializes back to the original #bibliography(...) content.
 */
export const TypstBibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: '#bibliography("references.bib")' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-bibliography]',
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
      'div',
      {
        'data-bibliography': '',
        'data-content': node.attrs.content,
        class: 'typst-bibliography',
      },
      'Bibliography',
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'typst-bibliography';
      dom.contentEditable = 'false';

      const header = document.createElement('div');
      header.className = 'typst-bibliography-header';
      header.textContent = t().editorLib.bibliographyHeader;
      dom.appendChild(header);

      const source = document.createElement('div');
      source.className = 'typst-bibliography-source';
      // Extract path from content
      const pathMatch = (node.attrs.content as string).match(/"([^"]+)"/);
      source.textContent = pathMatch ? pathMatch[1] : '';
      dom.appendChild(source);

      const list = document.createElement('div');
      list.className = 'typst-bibliography-list';
      dom.appendChild(list);

      // "Done" button to exit the block and create a new line below
      const doneBtn = document.createElement('button');
      doneBtn.classList.add('typst-raw-done');
      doneBtn.textContent = t().editorLib.blockDone;
      doneBtn.title = t().editorLib.blockDoneTooltip;
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos !== undefined) {
            const endPos = pos + node.nodeSize;
            const tr = editor.view.state.tr.insert(
              endPos,
              editor.view.state.schema.nodes.paragraph.create(),
            );
            tr.setSelection(
              TextSelection.near(
                tr.doc.resolve(endPos),
              ),
            );
            editor.view.dispatch(tr);
            editor.view.focus();
          }
        }
      });
      dom.appendChild(doneBtn);

      function renderEntries(entries: CitationEntry[]) {
        if (entries.length === 0) {
          list.innerHTML = `<div class="typst-bibliography-empty">${t().editorLib.bibliographyEmpty}</div>`;
          return;
        }

        list.innerHTML = entries
          .map((entry) => {
            const author = esc(entry.author || t().editorLib.bibliographyUnknownAuthor);
            const year = esc(entry.year);
            const title = esc(entry.title);
            const yearPart = year ? ` (${year})` : '';
            return `<div class="typst-bibliography-entry">
              <span class="typst-bibliography-author">${author}${yearPart}.</span>
              <span class="typst-bibliography-title">${title}.</span>
            </div>`;
          })
          .join('');
      }

      // Initial render
      renderEntries(getCitationEntries());

      // Subscribe to updates
      const unsubscribe = onCitationEntriesUpdate(renderEntries);

      return {
        dom,
        stopEvent(event: Event) {
          return (event.target as HTMLElement)?.tagName === 'BUTTON';
        },
        ignoreMutation: () => true,
        destroy() {
          unsubscribe();
        },
      };
    };
  },
});

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
