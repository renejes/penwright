import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { attachFloating, type FloatingHandle } from './popupAnchor';
import { formatCitationPage } from '../../shared/citationPage';
import { t } from '../../shared/i18n/store.svelte';

export interface CitationEntry {
  citekey: string;
  author: string;
  title: string;
  year: string;
  type: string;
}

// Module-level citation store — updated via messages from extension
let citationEntries: CitationEntry[] = [];

type CitationUpdateListener = (entries: CitationEntry[]) => void;
const listeners: CitationUpdateListener[] = [];

export function updateCitationEntries(entries: CitationEntry[]): void {
  citationEntries = entries;
  for (const listener of listeners) listener(entries);
}

export function getCitationEntries(): CitationEntry[] {
  return citationEntries;
}

/** Subscribe to citation entry updates. Returns an unsubscribe function. */
export function onCitationEntriesUpdate(listener: CitationUpdateListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * TipTap extension providing @-trigger autocomplete for inserting citations.
 * Uses @tiptap/suggestion with char: '@'.
 */
export const CitationSuggestion = Extension.create({
  name: 'citationSuggestion',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('citationSuggestion'),
        editor: this.editor,
        char: '@',
        // Only trigger after whitespace or start of node
        allowSpaces: false,
        items: ({ query }: { query: string }) => {
          if (citationEntries.length === 0) return [];
          const q = query.toLowerCase();
          return citationEntries
            .filter(
              (e) =>
                e.citekey.toLowerCase().includes(q) ||
                e.author.toLowerCase().includes(q) ||
                e.title.toLowerCase().includes(q) ||
                e.year.includes(q),
            )
            .slice(0, 10);
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: unknown;
        }) => {
          const picked = props as { entry: CitationEntry; page: string };
          const entry = picked.entry ?? (props as CitationEntry);
          const page = picked.entry ? picked.page : '';
          const firstAuthor = entry.author.split(',')[0].split(' and ')[0].trim();
          const label = entry.year
            ? `${firstAuthor} (${entry.year})`
            : firstAuthor;
          const supplement = formatCitationPage(page) ?? '';

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'citation',
              attrs: {
                citekey: entry.citekey,
                label,
                supplement,
              },
            })
            .run();
        },
        render: () => {
          let popup: CitationPopup | null = null;

          return {
            onStart(props: unknown) {
              popup = new CitationPopup(props as Record<string, unknown>);
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

class CitationPopup {
  private el: HTMLElement;
  private selected = 0;
  private items: CitationEntry[] = [];
  private commandFn: ((props: unknown) => void) | null = null;
  private floating: FloatingHandle | null = null;
  private anchor: (() => DOMRect | null) | null = null;
  private pageFor: CitationEntry | null = null;

  constructor(props: Record<string, unknown>) {
    this.el = document.createElement('div');
    this.el.className = 'citation-menu';
    document.body.appendChild(this.el);
    this.applyProps(props);
  }

  update(props: Record<string, unknown>) {
    if (this.pageFor) return;
    this.applyProps(props);
  }

  onKeyDown(props: Record<string, unknown>): boolean {
    const event = props.event as KeyboardEvent;
    if (this.pageFor) return true;
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
    // Before the element goes: the tracker holds document-level listeners and
    // would keep placing a detached node for the rest of the session.
    this.floating?.stop();
    this.floating = null;
    this.el.remove();
  }

  private applyProps(props: Record<string, unknown>) {
    this.items = (props.items ?? []) as CitationEntry[];
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
    if (!item) return;
    this.pageFor = item;
    this.renderPage();
  }

  private commitPage() {
    const entry = this.pageFor;
    if (!entry || !this.commandFn) return;
    const input = this.el.querySelector('input') as HTMLInputElement | null;
    this.commandFn({ entry, page: input?.value ?? '' });
  }

  /**
   * Same rules as the slash menu — see `slashCommands.ts`. Caret-anchored,
   * clamped, no `cap` (`.citation-menu` caps itself at 320 px in CSS), and the
   * tracker is created once rather than per keystroke.
   */
  private position(clientRect: (() => DOMRect | null) | null) {
    if (!clientRect) return;
    this.anchor = clientRect;
    if (!this.floating) {
      this.floating = attachFloating(this.el, () => this.anchor?.() ?? null, {});
    } else {
      this.floating.update();
    }
  }

  private render() {
    if (this.pageFor) {
      this.renderPage();
      return;
    }
    const truncate = (s: string, max: number) =>
      s.length > max ? s.slice(0, max) + '\u2026' : s;

    this.el.innerHTML = this.items
      .map(
        (item, i) => `
      <div class="citation-menu-item${i === this.selected ? ' selected' : ''}" data-index="${i}">
        <div class="citation-menu-main">
          <span class="citation-menu-author">${this.esc(truncate(item.author, 40))}</span>
          <span class="citation-menu-year">${this.esc(item.year)}</span>
        </div>
        <div class="citation-menu-title">${this.esc(truncate(item.title, 60))}</div>
        <div class="citation-menu-key">@${this.esc(item.citekey)}</div>
      </div>`,
      )
      .join('');

    this.el.querySelectorAll('.citation-menu-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset.index || '0');
        this.selectItem(idx);
      });
    });
  }

  private renderPage() {
    const entry = this.pageFor;
    if (!entry) return;
    const lib = t().editorLib;
    this.el.innerHTML = `
      <div class="citation-menu-page">
        <div class="citation-menu-key">@${this.esc(entry.citekey)}</div>
        <label class="citation-menu-page-label">${this.esc(lib.citationPageLabel)}</label>
        <input class="citation-menu-page-input" type="text" placeholder="12" />
        <div class="citation-menu-page-hint">${this.esc(lib.citationPageHint)}</div>
      </div>`;
    const input = this.el.querySelector('input') as HTMLInputElement;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitPage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.pageFor = null;
        this.render();
      }
    });
    input.focus();
    requestAnimationFrame(() => input.focus());
  }

  private esc(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
