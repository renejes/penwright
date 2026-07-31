/**
 * A small click-to-edit popup with one labelled field per editable value.
 *
 * Plain DOM, no Svelte, mirroring the footnote popup — the pattern this
 * codebase uses for atoms whose data lives somewhere the caret cannot reach.
 *
 * Extracted from `typstMagazine.ts`, where it edited a node's `attrs` directly,
 * and generalised over HOW a value is read and written. The magazine nodes still
 * write attrs; a project macro instance writes BYTE RANGES into the raw block's
 * `content` (see `shared/macroCall.ts`), and both are the same popup.
 *
 * Reads `t()` when the DOM is built, so an already-open popup does not follow a
 * language switch — it rebuilds on reopen, which is the convention here.
 */

import { t } from '../../shared/i18n/store.svelte';

export interface PopupField {
  key: string;
  label: string;
  rows?: number;
  /**
   * The value is Typst code, not prose — rendered monospace and written back
   * verbatim. A parameter like `breite: 44%` has no plain-text form, and
   * pretending otherwise would silently quote an expression into a string.
   */
  code?: boolean;
  /** Shown under the field, for what the label cannot say. */
  hint?: string;
  /**
   * An action that produces the value instead of typing it — the file picker
   * for a `path` parameter. Without it such a field is a text box asking a
   * non-Typst user to type a relative path, which is the one thing the form
   * exists to avoid.
   */
  action?: { label: string; run: () => Promise<string | null> };
}

export interface FieldPopupOptions {
  fields: PopupField[];
  read: (key: string) => string;
  write: (key: string, value: string) => void;
  title: string;
  /** Extra controls under the fields — the raw-code escape hatch, say. */
  footer?: (close: () => void) => HTMLElement | null;
  /** Widens the popup for fields that hold paragraphs rather than labels. */
  wide?: boolean;
}

/**
 * Wires the popup onto a node view's `dom`. Returns a destroy function the node
 * view must call, or the listener and any open popup outlive the node.
 */
export function attachFieldPopup(dom: HTMLElement, options: () => FieldPopupOptions): () => void {
  let popup: HTMLDivElement | null = null;
  let backdrop: HTMLDivElement | null = null;

  const close = (): void => {
    popup?.remove();
    backdrop?.remove();
    popup = backdrop = null;
  };

  const open = (): void => {
    if (popup) { close(); return; }
    const opts = options();
    if (!opts.fields.length && !opts.footer) return;

    const rect = dom.getBoundingClientRect();
    backdrop = document.createElement('div');
    backdrop.className = 'footnote-popup-backdrop';
    backdrop.addEventListener('mousedown', (e) => { e.preventDefault(); close(); });
    document.body.appendChild(backdrop);

    popup = document.createElement('div');
    popup.className = `footnote-popup pw-macro-popup${opts.wide ? ' pw-macro-popup-wide' : ''}`;
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;

    const heading = document.createElement('div');
    heading.className = 'footnote-popup-label';
    heading.textContent = opts.title;
    popup.appendChild(heading);

    for (const f of opts.fields) {
      const label = document.createElement('label');
      label.className = 'pw-macro-popup-field-label';
      label.textContent = f.label;
      popup.appendChild(label);

      const ta = document.createElement('textarea');
      ta.className = `footnote-popup-textarea${f.code ? ' pw-macro-popup-code' : ''}`;
      ta.rows = f.rows ?? 1;
      ta.spellcheck = !f.code;
      ta.value = opts.read(f.key);
      ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
        opts.write(f.key, ta.value);
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          close();
        }
      });
      popup.appendChild(ta);

      if (f.action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-macro-popup-action';
        btn.textContent = f.action.label;
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const picked = await f.action!.run();
          if (picked === null) return;
          ta.value = picked;
          opts.write(f.key, picked);
        });
        popup.appendChild(btn);
      }

      if (f.hint) {
        const hint = document.createElement('div');
        hint.className = 'pw-macro-popup-field-hint';
        hint.textContent = f.hint;
        popup.appendChild(hint);
      }
    }

    const footer = opts.footer?.(close);
    if (footer) popup.appendChild(footer);

    const hint = document.createElement('div');
    hint.className = 'footnote-popup-hint';
    hint.textContent = t().editorLib.macroEditHint;
    popup.appendChild(hint);

    document.body.appendChild(popup);
    requestAnimationFrame(() => {
      const first = popup?.querySelector('textarea') as HTMLTextAreaElement | null;
      first?.focus();
      popup?.querySelectorAll('textarea').forEach((el) => {
        const ta = el as HTMLTextAreaElement;
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
      });
    });
  };

  const onClick = (e: MouseEvent): void => { e.preventDefault(); e.stopPropagation(); open(); };
  dom.addEventListener('click', onClick);
  return () => { close(); dom.removeEventListener('click', onClick); };
}
