import { Mark } from '@tiptap/core';

/**
 * Text color mark — serializes to #text(fill: color)[content]
 */
export const TextColor = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-text-color]',
        getAttrs(dom) {
          return { color: (dom as HTMLElement).getAttribute('data-text-color') };
        },
      },
    ];
  },

  renderHTML({ mark }) {
    return [
      'span',
      {
        'data-text-color': mark.attrs.color,
        style: `color: ${cssColor(mark.attrs.color)}`,
      },
      0,
    ];
  },
});

/**
 * Highlight mark — serializes to #highlight(fill: color)[content]
 */
export const Highlight = Mark.create({
  name: 'highlight',

  addAttributes() {
    return {
      color: { default: 'yellow' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-highlight]',
        getAttrs(dom) {
          return { color: (dom as HTMLElement).getAttribute('data-highlight') };
        },
      },
    ];
  },

  renderHTML({ mark }) {
    return [
      'span',
      {
        'data-highlight': mark.attrs.color,
        style: `background-color: ${cssColor(mark.attrs.color)}; padding: 0 2px; border-radius: 2px`,
      },
      0,
    ];
  },
});

/**
 * Underline mark — serializes to #underline[content]
 */
export const Underline = Mark.create({
  name: 'underline',

  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration: underline' }];
  },

  renderHTML() {
    return ['u', 0];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-u': () => this.editor.chain().focus().toggleMark('underline').run(),
    };
  },
});

/**
 * Superscript mark — serializes to #super[content]
 */
export const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',

  parseHTML() {
    return [{ tag: 'sup' }];
  },

  renderHTML() {
    return ['sup', 0];
  },
});

/**
 * Subscript mark — serializes to #sub[content]
 */
export const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',

  parseHTML() {
    return [{ tag: 'sub' }];
  },

  renderHTML() {
    return ['sub', 0];
  },
});

/**
 * Smallcaps mark — serializes to #smallcaps[content]
 */
export const Smallcaps = Mark.create({
  name: 'smallcaps',

  parseHTML() {
    return [{ style: 'font-variant: small-caps' }];
  },

  renderHTML() {
    return ['span', { style: 'font-variant: small-caps' }, 0];
  },
});

/**
 * Map Typst color names to CSS colors for rendering in the editor.
 */
function cssColor(typstColor: string): string {
  const map: Record<string, string> = {
    red: '#e74c3c',
    blue: '#3498db',
    green: '#27ae60',
    yellow: '#f1c40f',
    orange: '#e67e22',
    purple: '#9b59b6',
    navy: '#2c3e50',
    gray: '#7f8c8d',
    black: '#000000',
    white: '#ffffff',
  };
  // Typst `rgb("#RRGGBB")` expression → the plain CSS hex inside it. The pink
  // highlight stores this form; passing it through verbatim produced invalid
  // CSS (`background-color: rgb("#FFD1DC")`) — an invisible highlight.
  const rgbHex = typstColor.match(/^rgb\("(#[0-9a-fA-F]{3,8})"\)$/);
  if (rgbHex) return rgbHex[1];
  // If it's a named color, map it. Otherwise pass through (luma, hex, …).
  return map[typstColor] || typstColor;
}
