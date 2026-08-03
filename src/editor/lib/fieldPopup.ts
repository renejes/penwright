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
 *
 * ── Placement, and why it is more than "follow the scroll" ──────────────────
 *
 * The popup was positioned once, from `getBoundingClientRect()`, and never
 * again. Three separate faults sat on top of each other:
 *
 *   - It never clamped. Measured against the real window (1200×800, so 772 px
 *     of viewport): the `#cover` card in two client projects opens a popup 824
 *     px tall. There is no position on the screen where it fits, and
 *     `overflow: hidden` with a page that cannot scroll meant the fields past
 *     the edge were simply unreachable. Even `#modul` (494 px) only fits in the
 *     top quarter of the editor.
 *   - The backdrop killed scrolling. `position: fixed; inset: 0` put the wheel
 *     target on an element whose scroll chain is body/html, both
 *     `overflow: hidden`. Measured with real wheel events: `.editor-container`
 *     scrolled 480 px without it and 0 px with it. So "the popup does not
 *     follow the scroll" was not even reachable — nothing scrolled.
 *   - Nothing recomputed. Not one popup in the codebase re-positioned itself
 *     after opening — there were listeners (`CodeEditor.svelte` observes its own
 *     size, `PdfPreviewPanel.svelte` binds `onscroll`) but none that moved a
 *     popup, so any layout change left it behind its anchor.
 *
 * Fixed here in that order: clamp into the viewport with a real `max-height`,
 * drop the backdrop for an outside-click listener that does not eat the wheel,
 * then track the anchor. The geometry itself lives in `shared/popupPlacement.ts`
 * — pure, and therefore the one part of this file a test can drive.
 *
 * The popup stays `position: fixed` on `document.body` on purpose: under
 * `.editor { zoom: var(--editor-zoom) }` a bounding rect already comes back in
 * scaled viewport coordinates, so pairing it with `fixed` is correct. Moving
 * the popup inside the editor subtree would apply the zoom a second time.
 */

import { t } from '../../shared/i18n/store.svelte';
import { attachFloating, closeOnOutside, type FloatingHandle } from './popupAnchor';

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

/** What a node view gets back, and must hold on to. */
export interface FieldPopupHandle {
  /** Unwires everything. The node view MUST call this in `destroy()`. */
  destroy: () => void;
  /**
   * Closes an open popup without unwiring.
   *
   * For the caller that stops SHOWING the anchor while the node lives on — the
   * `</>` toggle swaps the card for a textarea, and a form still hovering over
   * a block whose card is gone edits something the user can no longer see.
   */
  close: () => void;
}

/**
 * Wires the popup onto a node view's `dom`. The returned handle must be kept:
 * without `destroy()` the listeners and any open popup outlive the node.
 */
export function attachFieldPopup(dom: HTMLElement, options: () => FieldPopupOptions): FieldPopupHandle {
  let popup: HTMLDivElement | null = null;
  let floating: FloatingHandle | null = null;
  let unbindOutside: (() => void) | null = null;

  const close = (): void => {
    // Both handles die with the popup: a tracker left running would keep placing
    // a removed element, and the outside listener would outlive the node it
    // belongs to. Also resets the remembered side, so a popup opened next at the
    // top of the document does not inherit "above" from this one.
    floating?.stop();
    floating = null;
    unbindOutside?.();
    unbindOutside = null;
    popup?.remove();
    popup = null;
  };

  const open = (): void => {
    if (popup) { close(); return; }
    const opts = options();
    if (!opts.fields.length && !opts.footer) return;

    popup = document.createElement('div');
    popup.className = `footnote-popup pw-macro-popup${opts.wide ? ' pw-macro-popup-wide' : ''}`;
    // Measured before it is seen, so the first paint is already in the right
    // place rather than a jump from the top-left corner.
    popup.style.visibility = 'hidden';

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
        // The popup just grew; without this it grows straight out of the
        // viewport, which is how a field can walk off the bottom while it is
        // being typed into.
        floating?.update();
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
    // `cap` because this popup has no max-height of its own and the tallest form
    // in the corpus (`#cover`, 7 fields, 824 px) is taller than the viewport.
    // `observe` catches the editor zoom, which is a native accelerator and fires
    // no DOM event.
    floating = attachFloating(
      popup,
      () => (dom.isConnected ? dom.getBoundingClientRect() : null),
      { cap: true, observe: dom },
    );
    unbindOutside = closeOnOutside(() => [popup, dom], close);

    requestAnimationFrame(() => {
      const first = popup?.querySelector('textarea') as HTMLTextAreaElement | null;
      popup?.querySelectorAll('textarea').forEach((el) => {
        const ta = el as HTMLTextAreaElement;
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
      });
      // Only now is the height final — placing before the autosize measures a
      // height the popup no longer has.
      floating?.update();
      if (popup) popup.style.visibility = '';
      first?.focus();
    });
  };

  const onClick = (e: MouseEvent): void => { e.preventDefault(); e.stopPropagation(); open(); };
  dom.addEventListener('click', onClick);
  return {
    close,
    destroy: () => { close(); dom.removeEventListener('click', onClick); },
  };
}
