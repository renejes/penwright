/**
 * Keeps a floating element placed against an anchor — one mechanism, every
 * popup in the editor.
 *
 * There were five copies of `left = rect.left; top = rect.bottom + 4`, written
 * once when the thing opened and never revisited: the field popup, the footnote
 * editor, the slash menu, the citation suggester and the table gear menu. None
 * clamped, none followed a scroll, and two of them covered the window with a
 * backdrop that stopped the editor scrolling at all. This repo has paid for
 * scattered copies of one rule before (seven separate bracket scanners in
 * `deserializer.ts`); this is that shape, so it gets one implementation.
 *
 * The geometry itself is `shared/popupPlacement.clampPopup` — pure, and tested
 * in `scripts/css-integrity-test.mts`. What lives here is only what needs a
 * DOM: measuring, listening, and knowing when the anchor has gone away.
 */

import { clampPopup, viewportCap, type PopupSide } from '../../shared/popupPlacement';

export interface FloatingOptions {
  /**
   * Which side to try first. The table gear menu opens upward by design, so it
   * passes `'above'`; it still drops below when there is no room up there.
   */
  prefer?: PopupSide;
  /**
   * Apply the viewport height cap as an inline `max-height`.
   *
   * Off by default, and that default is load-bearing: `.slash-menu` and
   * `.citation-menu` already cap themselves at 320 px in CSS, so an inline
   * `max-height` computed from the viewport would RAISE their limit to ~748 px
   * and make them taller than they have ever been. Only elements with no cap of
   * their own ask for one.
   */
  cap?: boolean;
  /**
   * An element whose size changes should re-place the popup — the anchor, where
   * there is one. Catches the editor zoom, which is a native menu accelerator
   * and fires no DOM event of its own.
   */
  observe?: Element;
}

export interface FloatingHandle {
  /** Re-place now. Coalesced to one placement per frame. */
  update(): void;
  /** Unwire every listener. Callers MUST call this when the popup closes. */
  stop(): void;
}

/**
 * Places `el` against whatever `getAnchor` currently reports, and keeps it there.
 *
 * `getAnchor` returns a viewport rect or null. Null — and a rect with no size at
 * all — means "no usable anchor right now", and the element is LEFT WHERE IT IS
 * rather than moved to the top-left corner. That case is not hypothetical: a
 * building-block card is hidden the moment a code field holds an unfinished
 * expression (typing the `(` of `(100% - 2cm)`), and following the resulting
 * 0×0 rect threw the open form into the window corner mid-keystroke.
 *
 * A collapsed caret is width 0 with real height, so "no size" tests BOTH
 * dimensions — the slash menu is anchored to exactly such a rect.
 */
export function attachFloating(
  el: HTMLElement,
  getAnchor: () => DOMRect | null,
  opts: FloatingOptions = {},
): FloatingHandle {
  let frame = 0;
  // The last placement, for hysteresis only. The caller's standing preference
  // lives in `opts.prefer` and is never overwritten — see `place()`.
  let side: PopupSide | undefined;

  const place = (): void => {
    const a = getAnchor();
    if (!a || (a.width === 0 && a.height === 0)) return;

    // The cap goes on BEFORE the measurement, not after it.
    //
    // It depends only on the viewport, so writing it first is not circular —
    // and writing it last meant the rect was read under the PREVIOUS cap. Grow
    // the window (Cmd+−, or maximise) and the height handed to `clampPopup` was
    // one placement stale: an 824 px form measured 748, was placed as if it were
    // 748, then rendered 822 — 74 px of it below the bottom edge of a window
    // that cannot scroll, and its own scroller cannot help because it is the
    // BOX that overflows, not the content. Nothing re-placed it either: the
    // ResizeObserver watches the anchor, whose box a vertical resize does not
    // change.
    if (opts.cap) el.style.maxHeight = `${viewportCap(window.innerHeight)}px`;

    const r = el.getBoundingClientRect();
    // The RENDERED height. Not `scrollHeight`, and not `max(height, scrollHeight)`.
    //
    // That was here, justified as "the natural height, or a capped rect would let
    // the popup creep upward". Both halves were wrong, and measured so in a real
    // Electron window:
    //
    //   - It does not help. The cap this module writes is the constant
    //     `viewport.h - 2 * margin`, so `clampPopup` clamps to the same value
    //     whether it is handed the natural height or the already-capped one.
    //     Four consecutive placements of an 824 px form: identical tops either
    //     way. Nothing crept.
    //   - It broke the two menus that cap themselves in CSS. `.slash-menu` and
    //     `.citation-menu` render 320 px tall with `scrollHeight` 586 and 762.
    //     Fed 586, `clampPopup` concludes it fits nowhere and pins it to the top
    //     margin — so a `/` typed mid-document opened the menu well ABOVE the
    //     caret, covering the line being typed, and `@` opened it at the top of
    //     the window regardless of where the caret was.
    //
    // An element is as tall as it renders. If it scrolls inside itself, that is
    // the point of the scroller.
    const h = r.height;
    const p = clampPopup(
      { left: a.left, top: a.top, bottom: a.bottom },
      { w: r.width, h },
      { w: window.innerWidth, h: window.innerHeight },
      // A caller's `prefer` is a standing DESIGN choice — the table gear opens
      // upward so it does not cover the table it edits — while `side` is only
      // the last placement, remembered to stop the popup oscillating as a field
      // grows. Keeping both in one variable lost the first: scroll the anchor
      // out of the window once, and the forced 'below' overwrote the intent for
      // the rest of the popup's life, so the gear menu came back BELOW the gear.
      { prefer: opts.prefer ?? side },
    );
    side = p.side;
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    // `bottom` would fight `top`; anything switching to this helper from a
    // bottom-anchored placement has to have it cleared.
    el.style.bottom = '';
  };

  /** One placement per frame, however many events arrive. */
  const schedule = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; place(); });
  };

  // Capture, because `scroll` does not bubble and the container that actually
  // scrolls is `.editor-container`, never the window.
  const onScroll = (): void => schedule();
  const onResize = (): void => schedule();
  const ro = opts.observe && typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => schedule())
    : null;

  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);
  if (ro && opts.observe) ro.observe(opts.observe);

  place();

  return {
    update: place,
    stop: () => {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    },
  };
}

/**
 * Closes on a mousedown outside a set of elements — the replacement for a
 * full-screen backdrop.
 *
 * A `position: fixed; inset: 0` backdrop is the obvious way to catch an outside
 * click and it has one measured, disqualifying side effect: the wheel target
 * becomes the backdrop, whose scroll chain is body/html, and `index.html` sets
 * `overflow: hidden` on both. With real wheel events, `.editor-container`
 * scrolled 480 px without a backdrop and 0 px with one. So while any such popup
 * was open the document could not be scrolled at all — which is also why
 * "the popup does not follow the scroll" was never reachable as a complaint.
 *
 * Deliberately does not `preventDefault()`: the click lands where the user aimed
 * instead of being absorbed by an invisible sheet.
 */
export function closeOnOutside(inside: () => (Element | null | undefined)[], close: () => void): () => void {
  const onDown = (e: Event): void => {
    const target = e.target as Node | null;
    if (!target) return;
    if (inside().some(el => el?.contains(target))) return;
    close();
  };
  document.addEventListener('mousedown', onDown, true);
  return () => document.removeEventListener('mousedown', onDown, true);
}
