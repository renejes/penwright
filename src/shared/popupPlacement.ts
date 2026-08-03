/**
 * Where a click-to-edit popup goes, so that it lands somewhere a user can reach.
 *
 * Pure and in `shared/` for the reason `macroFormFields` is: nothing that lives
 * in a ProseMirror node view can be tested here — importing `fieldPopup.ts`
 * pulls in the i18n rune store and `$state` does not exist outside the Svelte
 * compiler. Everything about a popup EXCEPT this is DOM behaviour no suite in
 * this repo reaches, so the one piece that can be asserted is kept where it can
 * be.
 *
 * Placement was a single `left = rect.left; top = rect.bottom + 4`, written once
 * when the popup opened and never revisited. Measured against the real window
 * (1200×800 default → 772 px of viewport):
 *
 *   #cover    7 fields   824 px tall   fits at NO position on screen
 *   #modul    4 fields   494 px        only in the top ~26 % of the editor
 *   #opener   4 fields   435 px        ~35 %
 *   marginNote / spacer  ~165 px       ~78 %
 *
 * and `.footnote-popup` had `overflow: hidden` over a page that cannot scroll
 * (`html, body { overflow: hidden }`), so whatever fell past the edge was
 * simply gone. An inline anchor — `marginNote` is `display: inline` — could
 * also sit at x≈1100 and push a 300 px popup ~220 px off the right edge.
 */

/** Which side of the anchor the popup ended up on. */
export type PopupSide = 'below' | 'above';

/** Where the popup goes, and how tall it may be. */
export interface PopupPlacement {
  left: number;
  top: number;
  /** Never larger than the viewport allows; the popup scrolls inside it. */
  maxHeight: number;
  /** Feed back as `prefer` on the next call to stop it oscillating. */
  side: PopupSide;
}

/** The gap kept between a popup and every edge of the window. */
export const POPUP_MARGIN = 12;

/**
 * The tallest a popup may be in this viewport.
 *
 * Exported because the caller has to apply it BEFORE it measures the element,
 * not after. It depends only on the viewport — never on the placement — so
 * there is no circularity in doing so, and doing it the other way round meant
 * measuring under the PREVIOUS cap: grow the window (Cmd+−, maximise) and the
 * height fed to `clampPopup` was one placement stale, so the popup was placed
 * short and then rendered tall, hanging out of the bottom of a window that
 * cannot scroll.
 */
export function viewportCap(viewportH: number, margin: number = POPUP_MARGIN): number {
  return Math.max(0, viewportH - 2 * margin);
}

export interface ClampOptions {
  margin?: number;
  gap?: number;
  /**
   * The side the popup is currently on.
   *
   * Placement is recomputed on every keystroke (the textarea grows as it is
   * typed into), and a threshold with no memory flips the whole popup over the
   * anchor on ONE character and back on a backspace — with the focused field
   * travelling out from under the cursor. So a popup already above stays above
   * while above still works. The first placement has no preference and simply
   * takes the better side.
   */
  prefer?: PopupSide;
}

/**
 * Places a popup of `size` under `anchor` without leaving the viewport.
 *
 * Below the anchor by preference, flipped above when the space below is too
 * small, and clamped to the margin when neither side fits — which is the real
 * case for the tallest forms, not a theoretical one. `maxHeight` is what makes
 * that last branch honest: without it the overflow is not moved, only hidden.
 *
 * `CitationHoverCard.svelte` is the repo's other clamping popup and it is NOT
 * the same rule — it prefers the right of its anchor, drops below only when the
 * width does not fit, and clamps against a hardcoded 220 px with no max-height.
 * That suits a hover card of fixed size; a form whose height depends on its
 * content needs the vertical flip and the cap. Stated because claiming they
 * match would send the next reader to the wrong file.
 */
export function clampPopup(
  anchor: { left: number; top: number; bottom: number },
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  opts: ClampOptions = {},
): PopupPlacement {
  const { margin = POPUP_MARGIN, gap = 4, prefer } = opts;

  const maxHeight = viewportCap(viewport.h, margin);
  const h = Math.min(size.h, maxHeight);

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - h;
  const fitsBelow = below + h + margin <= viewport.h;
  const fitsAbove = above >= margin;

  let top: number;
  let side: PopupSide;
  if (prefer === 'above' && fitsAbove) { top = above; side = 'above'; }
  else if (fitsBelow) { top = below; side = 'below'; }
  else if (fitsAbove) { top = above; side = 'above'; }
  else {
    // Neither side fits. Clamp against the edge the popup is already on, and
    // KEEP that side — a fallback that always reports 'below' throws away the
    // preference, so the next keystroke flips back and the pair oscillates.
    // Measured: an anchor at y=496 with a growing body field jumped 257 px per
    // character and 257 px back on the backspace. Clamping to the near edge
    // makes the same transition a 4 px step.
    side = prefer ?? 'below';
    top = side === 'above' ? margin : viewport.h - h - margin;
  }

  // Last word, whatever the branch decided: the popup stays in the viewport.
  //
  // `fitsBelow` is true for an anchor that has scrolled off the TOP — its
  // `bottom` is negative, so `below + h + margin <= viewport.h` holds trivially
  // and the popup followed it out of the window: invisible, still in the DOM,
  // still holding keyboard focus, still writing into the node on every keypress.
  top = Math.max(margin, Math.min(top, viewport.h - h - margin));

  // A popup wider than the viewport still starts at the margin rather than off
  // the left edge — `max` runs last for that reason.
  const left = Math.max(margin, Math.min(anchor.left, viewport.w - size.w - margin));

  return { left, top, maxHeight, side };
}
