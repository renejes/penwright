import { Extension } from '@tiptap/core';

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: TextAlignValue) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
  }
}

/**
 * Custom TextAlign extension for TipTap.
 * Adds a `textAlign` attribute to paragraph and heading nodes.
 * Renders as a `style="text-align: ..."` attribute in the DOM.
 */
export const TextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph'],
        attributes: {
          textAlign: {
            default: 'left',
            parseHTML: (element) =>
              element.style.textAlign || 'left',
            renderHTML: (attributes) => {
              if (!attributes.textAlign || attributes.textAlign === 'left') {
                return {};
              }
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment: TextAlignValue) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          let applied = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  textAlign: alignment,
                });
              }
              applied = true;
            }
          });

          return applied;
        },
      unsetTextAlign:
        () =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          let applied = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  textAlign: 'left',
                });
              }
              applied = true;
            }
          });

          return applied;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
      'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
      'Mod-Shift-r': () => this.editor.commands.setTextAlign('right'),
      'Mod-Shift-j': () => this.editor.commands.setTextAlign('justify'),
    };
  },
});
