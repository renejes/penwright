import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { insertFootnoteWithEditor } from './typstFootnote';
import { t } from '../../shared/i18n/store.svelte';

/** Logical grouping for the toolbar "Insert" dropdown (the slash menu ignores it). */
export type InsertGroup = 'text' | 'blocks' | 'refs';

export interface SlashItem {
  title: string;
  description: string;
  icon: string;
  group: InsertGroup;
  command: (editor: Editor) => void;
}

/**
 * Builds the insert-command list using the active locale. Shared by the slash
 * menu (`/`) AND the toolbar "Insert" dropdown, so both stay in sync. Called
 * fresh each time a menu opens so titles/descriptions reflect the language.
 */
export function getCommands(): SlashItem[] {
  const m = t().editorLib;
  return [
    {
      title: m.slashHeading1Title,
      description: m.slashHeading1Desc,
      icon: 'H1',
      group: 'text',
      command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: m.slashHeading2Title,
      description: m.slashHeading2Desc,
      icon: 'H2',
      group: 'text',
      command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: m.slashHeading3Title,
      description: m.slashHeading3Desc,
      icon: 'H3',
      group: 'text',
      command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: m.slashBulletListTitle,
      description: m.slashBulletListDesc,
      icon: '•',
      group: 'text',
      command: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      title: m.slashNumberedListTitle,
      description: m.slashNumberedListDesc,
      icon: '1.',
      group: 'text',
      command: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      title: m.slashQuoteTitle,
      description: m.slashQuoteDesc,
      icon: '“',
      group: 'text',
      command: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      title: m.slashCodeBlockTitle,
      description: m.slashCodeBlockDesc,
      icon: '{}',
      group: 'blocks',
      command: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: m.slashDividerTitle,
      description: m.slashDividerDesc,
      icon: '—',
      group: 'blocks',
      command: (e) => e.chain().focus().setHorizontalRule().run(),
    },
    {
      title: m.slashPageBreakTitle,
      description: m.slashPageBreakDesc,
      icon: '⏎',
      group: 'blocks',
      command: (e) =>
        e.chain().focus().insertContent({ type: 'pagebreak' }).run(),
    },
    {
      title: m.slashTocTitle,
      description: m.slashTocDesc,
      icon: '📋',
      group: 'blocks',
      command: (e) =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'typstRawBlock',
            attrs: { content: '#outline()', blockType: 'config' },
          })
          .run(),
    },
    {
      title: m.slashMathTitle,
      description: m.slashMathDesc,
      icon: 'Σ',
      group: 'blocks',
      command: (e) =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'typstRawBlock',
            attrs: { content: '$ $', blockType: 'math' },
          })
          .run(),
    },
    {
      title: m.slashTypstCodeTitle,
      description: m.slashTypstCodeDesc,
      icon: '#',
      group: 'blocks',
      command: (e) =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'typstRawBlock',
            attrs: { content: '#', blockType: 'code' },
          })
          .run(),
    },
    {
      title: m.slashTableTitle,
      description: m.slashTableDesc,
      icon: '▦',
      group: 'blocks',
      command: (e) =>
        e
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      title: m.slashFootnoteTitle,
      description: m.slashFootnoteDesc,
      icon: '†',
      group: 'refs',
      command: (e) => insertFootnoteWithEditor(e),
    },
    {
      title: m.slashCitationTitle,
      description: m.slashCitationDesc,
      icon: '@',
      group: 'refs',
      command: (e) => {
        // Insert @ character to trigger the citation suggestion
        e.chain().focus().insertContent('@').run();
      },
    },
    {
      title: m.slashReferenceTitle,
      description: m.slashReferenceDesc,
      icon: '↳',
      group: 'refs',
      command: () => {
        // Picker is owned by App.svelte; we just open it via a window event.
        window.dispatchEvent(new CustomEvent('penwright:open-reference-picker'));
      },
    },
    {
      title: m.slashImageTitle,
      description: m.slashImageDesc,
      icon: '🖼',
      group: 'refs',
      command: () => {
        // Trigger file picker via extension message
        const vscodeApi = (window as unknown as { penwrightApi: { postMessage(msg: unknown): void } }).penwrightApi;
        if (vscodeApi) {
          vscodeApi.postMessage({ type: 'pickImage' });
        }
      },
    },
  ];
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('slashCommands'),
        editor: this.editor,
        char: '/',
        items: ({ query }: { query: string }) =>
          getCommands()
            .filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 10),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: unknown;
        }) => {
          editor.chain().focus().deleteRange(range).run();
          (props as SlashItem).command(editor);
        },
        render: () => {
          let popup: SlashPopup | null = null;

          return {
            onStart(props: unknown) {
              popup = new SlashPopup(props as Record<string, unknown>);
            },
            onUpdate(props: unknown) {
              popup?.update(props as Record<string, unknown>);
            },
            onKeyDown(props: unknown) {
              return popup?.onKeyDown(props as Record<string, unknown>) ?? false;
            },
            onExit() {
              popup?.destroy();
              popup = null;
            },
          };
        },
      }),
    ];
  },
});

class SlashPopup {
  private el: HTMLElement;
  private selected = 0;
  private items: SlashItem[] = [];
  private commandFn: ((props: unknown) => void) | null = null;

  constructor(props: Record<string, unknown>) {
    this.el = document.createElement('div');
    this.el.className = 'slash-menu';
    document.body.appendChild(this.el);
    this.applyProps(props);
  }

  update(props: Record<string, unknown>) {
    this.applyProps(props);
  }

  onKeyDown(props: Record<string, unknown>): boolean {
    const event = props.event as KeyboardEvent;
    if (event.key === 'ArrowDown') {
      this.selected = (this.selected + 1) % this.items.length;
      this.render();
      return true;
    }
    if (event.key === 'ArrowUp') {
      this.selected =
        (this.selected - 1 + this.items.length) % this.items.length;
      this.render();
      return true;
    }
    if (event.key === 'Enter') {
      this.selectItem(this.selected);
      return true;
    }
    return false;
  }

  destroy() {
    this.el.remove();
  }

  private applyProps(props: Record<string, unknown>) {
    this.items = (props.items ?? []) as SlashItem[];
    this.commandFn = props.command as (props: unknown) => void;
    this.selected = 0;

    if (this.items.length === 0) {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = '';

    this.render();
    this.position(props.clientRect as (() => DOMRect | null) | null);
  }

  private selectItem(index: number) {
    const item = this.items[index];
    if (item && this.commandFn) {
      this.commandFn(item);
    }
  }

  private position(clientRect: (() => DOMRect | null) | null) {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    this.el.style.left = `${rect.left}px`;
    this.el.style.top = `${rect.bottom + 4}px`;
  }

  private render() {
    this.el.innerHTML = this.items
      .map(
        (item, i) => `
      <div class="slash-menu-item${i === this.selected ? ' selected' : ''}" data-index="${i}">
        <span class="slash-menu-icon">${item.icon}</span>
        <div class="slash-menu-text">
          <span class="slash-menu-title">${item.title}</span>
          <span class="slash-menu-desc">${item.description}</span>
        </div>
      </div>`,
      )
      .join('');

    this.el.querySelectorAll('.slash-menu-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset.index || '0');
        this.selectItem(idx);
      });
    });
  }
}
