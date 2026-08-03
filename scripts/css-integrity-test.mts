/**
 * CSS integrity test — a stylesheet that still parses as the author meant it.
 *
 * This exists because of a one-character regression that shipped.
 *
 * `ba291d0` deleted the closing `}` of `.typst-raw-block.pw-is-spacer` in
 * `src/editor/style.css`. CSS Nesting is not an error: Chromium happily read
 * the remaining 1554 lines — 219 rules, 66 % of the file — as rules nested
 * INSIDE that spacer, and auto-closed the block at EOF. So `.footnote-popup`
 * silently became `.pw-is-spacer .footnote-popup` and stopped applying
 * anywhere else. Measured against the built bundle: 109 top-level rules
 * instead of 328; every field popup rendered `position: static`, no z-index,
 * no width, and landed outside the viewport of a page whose body is
 * `overflow: hidden`. Popups, the slash menu, citation badges, macro cards,
 * magazine nodes and the table gear menu were all unstyled and unreachable.
 *
 * Nothing caught it. `npm test` was green: no suite reads CSS, `typecheck`
 * does not either, and no test in this repo reaches a ProseMirror node view.
 * The corpus and pixel gates compare Typst output, which a stylesheet cannot
 * affect. It was found by reading the file, three sessions later.
 *
 * ── What this checks, and why each one ──────────────────────────────────────
 *
 * A brace count alone can be gamed, and an adversarial pass found four ways to
 * break the stylesheet exactly as badly while keeping a naive version green.
 * Each is now its own assertion:
 *
 *   1. Nothing is left open at EOF — the original bug.
 *   2. No STRAY closing brace either. One `}` too many in the middle of a rule
 *      ends it early; the declarations after it become garbage and take the
 *      next rule with them. `stack.pop()` on an empty stack is a no-op, so a
 *      pure depth count reports 0 and calls that healthy.
 *   3. No unterminated `/* comment`. It swallows the rest of the file in the
 *      browser AND in any scanner that mimics the browser — so it has to be
 *      reported as its own fault rather than measured.
 *   4. No rule nested inside another rule.
 *   5. Load-bearing selectors apply document-wide — compared in FULL, and at
 *      absolute depth 0. A shortened comparison let a missing comma through
 *      (`.editor-container⏎.footnote-popup` is a descendant selector, not a
 *      list), and ignoring at-rule ancestors let the whole file be wrapped in
 *      `@media print` with every check still green.
 *
 * Deliberately dependency-free (postcss is only a transitive Vite dep, and the
 * repo's convention is that a gate does not rely on one).
 *
 * Run: npx tsx scripts/css-integrity-test.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { clampPopup } from '../src/shared/popupPlacement.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

interface Block {
  /** Everything before the `{`, whitespace normalised to single spaces. */
  prelude: string;
  /** Selector ancestors only — an at-rule does not make a rule "nested". */
  depth: number;
  /** ALL ancestors, at-rules included. What "applies document-wide" needs. */
  absDepth: number;
  line: number;
}

interface Scan {
  blocks: Block[];
  /** Blocks still open at EOF. */
  unbalanced: number;
  /** Line of the outermost block still open at EOF, if any. */
  openedAt: number | null;
  /** Lines carrying a `}` that closed nothing. */
  stray: number[];
  /** Line of a `/*` that is never closed, if any. */
  unterminatedComment: number | null;
}

/**
 * Walks the stylesheet tracking brace depth, skipping comments and strings.
 *
 * At-rule preludes (`@media`, `@supports`, `@layer`, `@container`) are counted
 * separately rather than ignored: a rule inside a media query is not "nested"
 * in the sense assertion 4 cares about, but it is emphatically not
 * document-wide either, which is what assertion 5 cares about.
 */
function scan(css: string): Scan {
  const blocks: Block[] = [];
  const stack: { atRule: boolean; line: number }[] = [];
  const stray: number[] = [];
  let unterminatedComment: number | null = null;
  let prelude = '';
  let line = 1;
  let i = 0;

  while (i < css.length) {
    const c = css[i];
    const next = css[i + 1];

    if (c === '\n') { line++; prelude += c; i++; continue; }

    // Comment — never contributes a brace.
    if (c === '/' && next === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1 && unterminatedComment === null) unterminatedComment = line;
      const stop = end === -1 ? css.length : end + 2;
      for (let k = i; k < stop; k++) if (css[k] === '\n') line++;
      i = stop;
      continue;
    }

    // String — `content: "}"` must not close a block.
    if (c === '"' || c === "'") {
      let k = i + 1;
      while (k < css.length) {
        if (css[k] === '\\') { k += 2; continue; }
        if (css[k] === c || css[k] === '\n') break;
        k++;
      }
      i = k + 1;
      continue;
    }

    if (c === '{') {
      const text = prelude.trim().replace(/\s+/g, ' ');
      const atRule = text.startsWith('@');
      if (!atRule) {
        blocks.push({
          prelude: text,
          depth: stack.filter(s => !s.atRule).length,
          absDepth: stack.length,
          line,
        });
      }
      stack.push({ atRule, line });
      prelude = '';
      i++;
      continue;
    }

    if (c === '}') {
      // A `}` with nothing open closed nothing. `pop()` would silently swallow
      // it and leave the depth count looking healthy.
      if (stack.length === 0) stray.push(line);
      else stack.pop();
      prelude = '';
      i++;
      continue;
    }

    if (c === ';') { prelude = ''; i++; continue; }

    prelude += c;
    i++;
  }

  return {
    blocks,
    unbalanced: stack.length,
    openedAt: stack.length ? stack[0].line : null,
    stray,
    unterminatedComment,
  };
}

/**
 * Selectors that must reach the whole document.
 *
 * Chosen to straddle the break: `.toolbar` sits at line 31, far above it, and
 * proves the scanner is not simply reporting everything as fine. The rest are
 * the surfaces that actually went dark — every one of them lives after line
 * 801, and each is the entry point of a feature a user can otherwise not
 * reach at all.
 */
const CANARIES = [
  '.toolbar',
  '.pw-spacer',
  '.typst-citation',
  '.footnote-popup',
  '.citation-menu',
  '.slash-menu',
  '.table-settings-dropdown',
  '.pw-macro-card',
];

const files = ['src/editor/style.css'];

for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  console.log(`\n${rel}`);
  const css = fs.readFileSync(abs, 'utf8');
  const s = scan(css);

  check(
    'no comment runs to the end of the file',
    s.unterminatedComment === null,
    s.unterminatedComment !== null
      ? `/* opened at ${rel}:${s.unterminatedComment} is never closed — everything after it is commented out, `
        + 'in the browser exactly as here'
      : '',
  );

  check(
    'every block is closed',
    s.unbalanced === 0,
    `${s.unbalanced} block(s) still open at EOF; outermost opened at ${rel}:${s.openedAt}. `
      + 'Chromium does NOT report this — it reads the rest of the file as nested rules.',
  );

  check(
    'no closing brace without a block',
    s.stray.length === 0,
    s.stray.length
      ? `stray } at ${s.stray.slice(0, 5).map(l => `${rel}:${l}`).join(', ')} — ends its rule early and `
        + 'the declarations after it are parsed as garbage'
      : '',
  );

  const nested = s.blocks.filter(b => b.depth > 0);
  check(
    'no rule is nested inside another rule',
    nested.length === 0,
    nested.length
      ? `${nested.length} nested: ` + nested.slice(0, 5)
          .map(b => `${rel}:${b.line} "${b.prelude}" (depth ${b.depth})`)
          .join(', ') + (nested.length > 5 ? ', …' : '')
      : '',
  );

  // The assertions with teeth. A second missing brace balances the file and a
  // pure count goes green again; these do not, because the canaries have still
  // fallen inside an ancestor.
  for (const sel of CANARIES) {
    // FULL comparison. Matching only the tail let `.editor-container⏎.footnote-popup`
    // — what a dropped list comma produces — read as `.footnote-popup` and pass.
    const found = s.blocks.filter(b => b.prelude.split(',').some(part => part.trim() === sel));
    if (!found.length) {
      // Not a silent pass: a renamed or accidentally-qualified selector must be
      // noticed here, or the canary quietly stops guarding anything.
      check(
        `${sel} exists`,
        false,
        'no rule with this exact selector. Either it was renamed (update CANARIES) or it '
          + 'picked up an ancestor — check for a missing comma in a multi-line selector list.',
      );
      continue;
    }
    check(
      `${sel} applies document-wide`,
      // absDepth, not depth: a rule inside `@media print` is at selector depth 0
      // and still applies nowhere on screen.
      found.every(b => b.absDepth === 0),
      `nested at depth ${found.map(b => b.absDepth).join('/')} — it only applies inside some ancestor`,
    );
  }

  console.log(`  · ${s.blocks.length} rules, max depth ${Math.max(0, ...s.blocks.map(b => b.absDepth))}`);
}

// ─── Popup placement ────────────────────────────────────────────────────────
//
// The other half of the same problem: the stylesheet decides how big a popup
// is, `clampPopup` decides whether it lands anywhere a user can reach. It is
// pure for exactly this reason — everything else about a node view popup
// (does it appear, does a click arrive, does it follow the scroll) is DOM
// behaviour no suite in this repo can touch.
//
// The numbers are the measured ones, not invented: the real window default is
// 1200×800, which leaves a 772 px viewport, and the `#cover` card in two client
// projects opens a 7-field popup 824 px tall.
console.log('\nclampPopup');
{
  const VP = { w: 1200, h: 772 };
  const M = 12;

  // Fits below: placed just under the anchor, left edge aligned.
  const easy = clampPopup({ left: 293, top: 180, bottom: 220 }, { w: 340, h: 167 }, VP);
  check(
    'a short popup opens under its anchor',
    easy.top === 224 && easy.left === 293 && easy.side === 'below',
    JSON.stringify(easy),
  );

  // Too tall for below, room above: flips.
  const flip = clampPopup({ left: 293, top: 520, bottom: 560 }, { w: 340, h: 435 }, VP);
  check('a tall popup flips above the anchor', flip.top === 520 - 4 - 435 && flip.side === 'above', JSON.stringify(flip));

  // The measured worst case: 824 px in a 772 px viewport fits nowhere. It must
  // still land fully on screen and cap its own height.
  const cover = clampPopup({ left: 293, top: 560, bottom: 600 }, { w: 340, h: 824 }, VP);
  // `top >= M` alone would pass ungated too — it has to be the clamped value.
  check('the tallest form is pinned to the top margin', cover.top === M, JSON.stringify(cover));
  check('…and is capped to the viewport', cover.maxHeight === VP.h - 2 * M, JSON.stringify(cover));

  // An inline anchor at the end of a line (marginNote is `display: inline`) is
  // the only case that overflowed horizontally — up to ~220 px off-screen.
  const inline = clampPopup({ left: 1100, top: 300, bottom: 320 }, { w: 300, h: 164 }, VP);
  check('an inline anchor near the right edge pulls back', inline.left === VP.w - 300 - M, JSON.stringify(inline));

  // Never off the left edge, even when the popup is wider than the window.
  const huge = clampPopup({ left: 10, top: 300, bottom: 320 }, { w: 1400, h: 200 }, VP);
  check('a popup wider than the window starts at the margin', huge.left === M, JSON.stringify(huge));

  // An anchor scrolled off the TOP has a negative `bottom`, which satisfies
  // "fits below" trivially — so the popup followed it out of the window and sat
  // there invisible, still focused and still writing into the node on every
  // keypress. It has to stay on screen whatever the anchor does.
  const goneUp = clampPopup({ left: 293, top: -900, bottom: -860 }, { w: 340, h: 300 }, VP);
  check('an anchor scrolled off the top does not drag it away', goneUp.top >= M, JSON.stringify(goneUp));
  const goneDown = clampPopup({ left: 293, top: 2000, bottom: 2040 }, { w: 340, h: 300 }, VP);
  check(
    'nor does one scrolled off the bottom',
    goneDown.top >= M && goneDown.top + 300 <= VP.h - M,
    JSON.stringify(goneDown),
  );

  // The caret-anchored menus cap themselves at 320 px in CSS and are the case
  // that broke: fed their SCROLL height instead of their rendered one, they were
  // pinned to the top margin instead of opening at the caret. The measurement
  // itself lives in `popupAnchor.place` and no suite can reach it — this only
  // fixes the contract that placement gets the rendered height.
  const caret = clampPopup({ left: 500, top: 300, bottom: 320 }, { w: 220, h: 320 }, VP);
  check('a 320 px menu opens at a mid-document caret', caret.top === 324, JSON.stringify(caret));

  // ── Hysteresis ────────────────────────────────────────────────────────────
  //
  // Placement is recomputed on every keystroke, so a threshold with no memory
  // flips the popup over the anchor on ONE character and back on the backspace,
  // taking the focused field out from under the cursor.
  //
  // These three assertions are written so that deleting the `prefer` branch
  // makes them RED. An earlier pair did not: both the with- and without-memory
  // paths happened to land in the same fallback, so the whole feature could have
  // been removed in a later refactor with `npm test` still green.

  // 1. Where BOTH sides fit, the remembered side is what decides. Without
  //    `prefer` this returns 'below' and the check fails.
  const roomy = { left: 293, top: 400, bottom: 440 };
  const kept = clampPopup(roomy, { w: 340, h: 300 }, VP, { prefer: 'above' });
  check('with room on both sides, the remembered side wins', kept.side === 'above', JSON.stringify(kept));
  const fresh = clampPopup(roomy, { w: 340, h: 300 }, VP);
  check('…and with no memory it opens below', fresh.side === 'below', JSON.stringify(fresh));

  // 2. Growing past the point where neither side fits must be a SMALL step, not
  //    a jump across the anchor. Measured before the fix: 257 px per character
  //    at an anchor of y=496, and 257 px back on the backspace.
  const tight = { left: 293, top: 496, bottom: 536 };
  const above9 = clampPopup(tight, { w: 340, h: 476 }, VP);
  const above10 = clampPopup(tight, { w: 340, h: 515 }, VP, { prefer: above9.side });
  check('a form near the bottom opens above', above9.side === 'above', JSON.stringify(above9));
  check(
    'one line past the fit is a small step, not a jump over the anchor',
    Math.abs(above10.top - above9.top) < 40,
    `${above9.top} → ${above10.top} (${Math.abs(above10.top - above9.top)} px)`,
  );

  // 3. The SAME thing on the other side. The fallback clamps to the edge the
  //    popup is already on, and only the 'above' half of that was asserted:
  //    replacing the whole branch with `top = margin` left all checks green
  //    while a below-anchored form jumped 92 px per character.
  const low = { left: 293, top: 60, bottom: 100 };
  const below9 = clampPopup(low, { w: 340, h: 644 }, VP);
  const below10 = clampPopup(low, { w: 340, h: 657 }, VP, { prefer: below9.side });
  check('a form near the top opens below', below9.side === 'below', JSON.stringify(below9));
  check(
    'and growing past the fit keeps it there, not at the top margin',
    below10.side === 'below' && below10.top === VP.h - 657 - M && Math.abs(below10.top - below9.top) < 40,
    `${JSON.stringify(below9)} → ${JSON.stringify(below10)}`,
  );
  // …but a preference cannot pin it somewhere it no longer fits.
  const cannot = clampPopup({ left: 293, top: 40, bottom: 80 }, { w: 340, h: 400 }, VP, { prefer: 'above' });
  check('a preference yields when that side stops working', cannot.side === 'below', JSON.stringify(cannot));

  // The table gear menu opens upward by design, so that it does not cover the
  // table it edits. `prefer: 'above'` is how that survives the move off the old
  // hardcoded `bottom:` — with the fallback the hardcoded version never had.
  const gear = clampPopup({ left: 600, top: 500, bottom: 520 }, { w: 180, h: 300 }, VP, { prefer: 'above' });
  check('the gear menu opens upward when there is room', gear.side === 'above' && gear.top === 500 - 4 - 300, JSON.stringify(gear));
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
