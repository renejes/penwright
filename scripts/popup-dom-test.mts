/**
 * Popup placement, measured in a real browser — the first test in this repo
 * that reaches the DOM layer.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `CLAUDE.md` names the blind spot: "no test reaches a ProseMirror node view",
 * so whether a popup appears, lands where it should, or is cleaned up was
 * unproven however green `npm test` was. Two regressions shipped through that
 * gap in one session, and both were invisible to every other gate:
 *
 *   - A popup positioned once and never again, over a page that cannot scroll.
 *   - `Math.max(rect.height, scrollHeight)` handed to the placement. For the
 *     two menus that cap themselves in CSS (`.slash-menu`, `.citation-menu` at
 *     320 px) that is the SCROLL height — 586 and 762 — so the placement
 *     concluded "fits nowhere" and pinned the menu to the top of the window.
 *     Typing `/` mid-document opened the command list above the line being
 *     typed. `clampPopup` was correct throughout; the wrong number reached it.
 *
 * That second one is the shape this suite is built around: the geometry is pure
 * and asserted in `css-integrity-test.mts`, but WHICH NUMBERS the DOM layer
 * feeds it cannot be checked without a DOM. So this drives the real
 * `popupAnchor.ts` against the real `style.css` in a real Chromium, and judges
 * the measurements here.
 *
 * ── Deliberately not flaky ──────────────────────────────────────────────────
 *
 * "Ein Gate, das zufällig rot wird, ist ausgeschaltet." Every assertion is
 * synchronous: placement is forced with `handle.update()` rather than waited
 * for, and events are dispatched rather than provoked. Nothing here depends on
 * `requestAnimationFrame` firing, which a hidden window does not guarantee.
 * The window is a fixed size and expectations are computed from the viewport
 * the page reports, never from hardcoded pixels.
 *
 * And it does not skip quietly: no Electron means exit 1, like both compile
 * suites, unless `--allow-skip` is passed. A skip that reads as a pass buys
 * confidence it did not earn.
 *
 * Run: npx tsx scripts/popup-dom-test.mts [--allow-skip]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowSkip = process.argv.includes('--allow-skip');

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail !== undefined ? JSON.stringify(detail) : ''); }
}

function bin(name: string): string | null {
  const p = path.join(REPO, 'node_modules', '.bin', name);
  return fs.existsSync(p) ? p : null;
}

const electron = bin('electron');
const esbuild = bin('esbuild');
if (!electron || !esbuild) {
  const missing = [!electron && 'electron', !esbuild && 'esbuild'].filter(Boolean).join(', ');
  if (allowSkip) {
    console.log(`\n(skipped: ${missing} not installed — --allow-skip)\n`);
    process.exit(0);
  }
  console.log(`\n✗ ${missing} not installed. This suite exists to measure a real DOM, so that is a failure.`);
  console.log('  Pass --allow-skip if you genuinely mean to run without it.\n');
  process.exit(1);
}

// ─── Harness ────────────────────────────────────────────────────────────────
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-popup-dom-'));

// The REAL module, bundled — not a copy of its logic. `popupAnchor` pulls in
// `shared/popupPlacement` and nothing else, so no i18n rune store comes with it.
execFileSync(esbuild, [
  path.join(REPO, 'src/editor/lib/popupAnchor.ts'),
  '--bundle', '--format=iife', '--global-name=PA',
  `--outfile=${path.join(dir, 'pa.js')}`,
  '--log-level=error',
], { stdio: 'pipe' });

// The REAL stylesheet: the whole point is that `.slash-menu` caps itself at
// 320 px here and the placement has to respect that.
fs.copyFileSync(path.join(REPO, 'src/editor/style.css'), path.join(dir, 'style.css'));

fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'pw-popup-dom', main: 'main.js' }));

fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="style.css">
<style>
  /* Mirrors index.html: the page itself cannot scroll, which is why a popup
     that overflows the viewport is unreachable rather than merely below. */
  html, body { height: 100%; overflow: hidden; margin: 0; }
</style></head><body><script src="pa.js"></script></body></html>`);

/**
 * Runs in the renderer. Returns raw measurements only — every judgement is made
 * back in Node, so a failure reports numbers rather than a boolean.
 */
const PROBE = `(() => {
  const R = { viewport: { w: innerWidth, h: innerHeight }, cases: {} };
  const M = 12;   // popupPlacement.POPUP_MARGIN
  const GAP = 4;

  const el = (cls, html) => {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  };
  const rowsFor = (n) => Array.from({ length: n }, (_, i) =>
    '<div class="slash-menu-item"><span class="slash-menu-icon">B</span>'
    + '<div class="slash-menu-text"><span class="slash-menu-title">Eintrag ' + i + '</span>'
    + '<span class="slash-menu-desc">Eine Beschreibung dazu</span></div></div>').join('');
  const box = (h) => '<div style="height:' + h + 'px"></div>';
  const rect = (n) => { const r = n.getBoundingClientRect(); return { top: r.top, left: r.left, h: r.height, w: r.width }; };

  // ── 1. A caret-anchored menu opens AT the caret ──────────────────────────
  // The regression: fed its scroll height instead of its rendered one, the menu
  // was pinned to the top margin instead of following the caret.
  {
    const menu = el('slash-menu', rowsFor(10));
    const measured = { rendered: menu.getBoundingClientRect().height, scroll: menu.scrollHeight };
    const at = (caretTop) => {
      const anchor = { left: 400, top: caretTop, bottom: caretTop + 20, width: 0, height: 20 };
      const h = PA.attachFloating(menu, () => anchor, {});
      const r = rect(menu);
      h.stop();
      return { caretBottom: caretTop + 20, top: r.top, h: r.h };
    };
    R.cases.caret = {
      measured,
      // Three carets down the page. A menu that ignores its CSS cap lands on the
      // same spot for all three.
      places: [0.25, 0.4, 0.55].map(f => at(Math.round(R.viewport.h * f))),
    };
    menu.remove();
  }

  // ── 2. A capped popup stays inside a viewport that GREW ──────────────────
  // The cap must be written before the element is measured, or the height used
  // is one placement stale and the popup renders taller than it was placed.
  {
    const pop = el('footnote-popup', box(2000));
    const anchor = { left: 300, top: 200, bottom: 240, width: 10, height: 40 };
    const h = PA.attachFloating(pop, () => anchor, { cap: true });
    const before = rect(pop);
    // Simulate the viewport growing (Cmd+−, maximise) without resizing the
    // window: shrink the page's own idea of the cap by re-running placement
    // against a taller viewport is not possible from here, so instead start
    // from a DELIBERATELY stale cap — exactly the state the ordering bug left.
    pop.style.maxHeight = Math.round(R.viewport.h / 2) + 'px';
    h.update();
    const after = rect(pop);
    h.stop();
    R.cases.grow = { before, after, cap: pop.style.maxHeight };
    pop.remove();
  }

  // ── 3. A tall form is fully reachable ────────────────────────────────────
  {
    const pop = el('footnote-popup', box(2000));
    const anchor = { left: 300, top: Math.round(R.viewport.h * 0.8), bottom: Math.round(R.viewport.h * 0.8) + 20, width: 10, height: 20 };
    const h = PA.attachFloating(pop, () => anchor, { cap: true });
    R.cases.tall = rect(pop);
    h.stop();
    pop.remove();
  }

  // ── 4. An anchor with no box does not drag the popup to the corner ───────
  {
    const anchorEl = el('', 'anchor');
    anchorEl.style.cssText = 'position:fixed;left:500px;top:300px;width:40px;height:20px';
    const pop = el('footnote-popup', box(120));
    const h = PA.attachFloating(pop, () => (anchorEl.isConnected ? anchorEl.getBoundingClientRect() : null), {});
    const placed = rect(pop);
    anchorEl.style.display = 'none';   // what the </> toggle does to a card
    h.update();
    const afterHidden = rect(pop);
    h.stop();
    R.cases.anchorGone = { placed, afterHidden };
    pop.remove(); anchorEl.remove();
  }

  // ── 5. stop() takes its listeners with it ────────────────────────────────
  {
    let live = 0;
    const addD = document.addEventListener.bind(document);
    const remD = document.removeEventListener.bind(document);
    const addW = window.addEventListener.bind(window);
    const remW = window.removeEventListener.bind(window);
    document.addEventListener = (...a) => { live++; return addD(...a); };
    document.removeEventListener = (...a) => { live--; return remD(...a); };
    window.addEventListener = (...a) => { live++; return addW(...a); };
    window.removeEventListener = (...a) => { live--; return remW(...a); };

    const pop = el('footnote-popup', box(120));
    const anchor = { left: 300, top: 200, bottom: 240, width: 10, height: 40 };
    const h = PA.attachFloating(pop, () => anchor, {});
    const unbind = PA.closeOnOutside(() => [pop], () => {});
    const whileOpen = live;
    h.stop(); unbind();
    R.cases.listeners = { whileOpen, afterStop: live };

    document.addEventListener = addD; document.removeEventListener = remD;
    window.addEventListener = addW; window.removeEventListener = remW;
    pop.remove();
  }

  // ── 6. closeOnOutside fires outside and stays quiet inside ───────────────
  {
    const pop = el('footnote-popup', box(120));
    let closed = 0;
    const unbind = PA.closeOnOutside(() => [pop], () => { closed++; });
    const down = (target) => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    down(pop);
    const afterInside = closed;
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    R.cases.outside = { afterInside, afterOutside: closed, defaultPrevented: ev.defaultPrevented };
    unbind();
    pop.remove();
  }

  // ── 7. No rule in the shipped stylesheet paints a full-window sheet ──────
  // The backdrops were removed because "position:fixed; inset:0" makes itself
  // the wheel target on a page whose body cannot scroll, so the editor could
  // not be scrolled while any popup was open. (No backticks in this probe —
  // the whole thing is a template literal.)
  {
    const sheets = [...document.styleSheets].filter(s => { try { return !!s.cssRules; } catch { return false; } });
    const full = [];
    for (const s of sheets) for (const r of s.cssRules) {
      if (!(r instanceof CSSStyleRule)) continue;
      const st = r.style;
      if (st.position === 'fixed' && (st.inset === '0px' || (st.top === '0px' && st.bottom === '0px'))) {
        full.push(r.selectorText);
      }
    }
    R.cases.fullScreenSheets = full;
  }

  return R;
})()`;

fs.writeFileSync(path.join(dir, 'main.js'), `const { app, BrowserWindow } = require('electron');
const path = require('path');
// A hung window must not hang the suite.
const bail = setTimeout(() => { console.log(JSON.stringify({ error: 'timeout' })); app.exit(0); }, 30000);
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let out;
  try {
    const w = new BrowserWindow({
      width: 1200, height: 800, show: false,
      webPreferences: { offscreen: true },
    });
    await w.loadFile(path.join(__dirname, 'index.html'));
    out = await w.webContents.executeJavaScript(${JSON.stringify(PROBE)});
  } catch (e) {
    out = { error: String((e && e.message) || e) };
  }
  clearTimeout(bail);
  console.log('@@RESULT@@' + JSON.stringify(out));
  app.exit(0);
});
`);

// ─── Run ────────────────────────────────────────────────────────────────────
console.log('\n── Popup placement, measured in Chromium ──');

let raw = '';
try {
  raw = execFileSync(electron, [dir], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 60_000,
    // GUI apps launched from a VS Code / Cursor terminal inherit
    // ELECTRON_RUN_AS_NODE, which turns Electron into plain Node and no window
    // is ever created. The app has the same note in CLAUDE.md.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  const e = err as { stdout?: string; stderr?: string; message?: string };
  raw = e.stdout ?? '';
  if (!raw.includes('@@RESULT@@')) {
    console.log('  ✗ Electron produced no result');
    console.log('     ', (e.stderr || e.message || '').split('\n').slice(0, 4).join(' | '));
    fs.rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }
}

const marker = raw.indexOf('@@RESULT@@');
if (marker === -1) {
  console.log('  ✗ Electron produced no result\n', raw.slice(0, 400));
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
const R = JSON.parse(raw.slice(marker + '@@RESULT@@'.length).split('\n')[0]);
if (R.error) {
  console.log(`  ✗ harness failed: ${R.error}`);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}

const M = 12;
const GAP = 4;
const VP = R.viewport;
console.log(`   viewport ${VP.w}×${VP.h}`);

// ─── 1. The caret ───────────────────────────────────────────────────────────
{
  const c = R.cases.caret;
  // The premise: this menu really does cap itself, and its scroll height really
  // is bigger. If that ever stops being true the case below proves nothing.
  check(
    'the slash menu caps itself in CSS and overflows it',
    c.measured.rendered > 0 && c.measured.scroll > c.measured.rendered,
    c.measured,
  );
  for (const p of c.places) {
    check(
      `a 10-item menu opens at a caret ${Math.round(p.caretBottom)}px down`,
      Math.abs(p.top - (p.caretBottom + GAP)) <= 1,
      { wanted: p.caretBottom + GAP, got: p.top, renderedHeight: p.h },
    );
  }
  // The failure mode had every caret land on the same row.
  const tops = new Set(c.places.map((p: { top: number }) => Math.round(p.top)));
  check('…and follows the caret rather than sticking to one spot', tops.size === c.places.length, [...tops]);
}

// ─── 2. A stale cap ─────────────────────────────────────────────────────────
{
  const g = R.cases.grow;
  check(
    'a popup measured under a stale cap is still placed inside the window',
    g.after.top >= M - 1 && g.after.top + g.after.h <= VP.h - M + 1,
    { ...g, allowedBottom: VP.h - M },
  );
}

// ─── 3. Reachability ────────────────────────────────────────────────────────
{
  const t = R.cases.tall;
  check('a form taller than the window is fully on screen', t.top >= M - 1, t);
  check('…and its bottom edge is inside it', t.top + t.h <= VP.h - M + 1, { ...t, allowedBottom: VP.h - M });
}

// ─── 4. A vanished anchor ───────────────────────────────────────────────────
{
  const a = R.cases.anchorGone;
  check(
    'a hidden anchor leaves the popup where it was',
    Math.abs(a.afterHidden.top - a.placed.top) < 1 && Math.abs(a.afterHidden.left - a.placed.left) < 1,
    a,
  );
  check('…and not in the window corner', a.afterHidden.top > M + 1 || a.afterHidden.left > M + 1, a);
}

// ─── 5. Listeners ───────────────────────────────────────────────────────────
{
  const l = R.cases.listeners;
  check('an open popup registers listeners', l.whileOpen > 0, l);
  check('…and stop() removes every one of them', l.afterStop === 0, l);
}

// ─── 6. Outside click ───────────────────────────────────────────────────────
{
  const o = R.cases.outside;
  check('a click inside the popup does not close it', o.afterInside === 0, o);
  check('a click outside does', o.afterOutside === 1, o);
  // The backdrop used to absorb the click; the replacement must let it land.
  check('…and the click still reaches what was clicked', o.defaultPrevented === false, o);
}

// ─── 7. No full-window sheet over a popup anchored in the document ──────────
//
// A `position: fixed; inset: 0` element makes ITSELF the wheel target, and on
// this page the scroll chain ends at `body { overflow: hidden }` — so while one
// is up, the editor cannot be scrolled at all (measured: 480 px → 0 px).
//
// That is disqualifying for a popup anchored to document CONTENT, where reading
// the rest of the document is exactly what the user wants to do — the field
// popup, the footnote editor and the table gear all lost theirs for that reason.
// It is fine for a modal (the editor is not meant to be reachable) and for a
// toolbar dropdown (a menu you opened and will pick from in a moment).
//
// So this is an allowlist rather than a ban, and the line is *where the thing is
// anchored*. Adding to it means arguing that case.
const SHEET_ALLOWED = new Set([
  // Modal dialogs — full-screen cover is the point.
  '.settings-overlay',
  '.shortcut-overlay',
  '.welcome-overlay',
  '.typst-image-dialog-backdrop',
  // Toolbar dropdowns — anchored to a button in the chrome, not to the text.
  '.insert-menu-backdrop',
  '.color-picker-backdrop',
  '.table-picker-backdrop',
]);
{
  const f: string[] = R.cases.fullScreenSheets;
  const rogue = f.filter(s => !s.split(',').every(part => SHEET_ALLOWED.has(part.trim())));
  check(
    'no full-window sheet covers a popup anchored in the document',
    rogue.length === 0,
    rogue.length
      ? `${rogue.join(', ')} — position:fixed inset:0 becomes the wheel target, so the editor stops scrolling `
        + 'while it is up. Allowed for modals and toolbar dropdowns; add to SHEET_ALLOWED with a reason.'
      : '',
  );
  // The allowlist must not rot: an entry whose rule is gone should be removed,
  // or it quietly protects nothing.
  const stale = [...SHEET_ALLOWED].filter(s => !f.includes(s));
  check(
    'every allowlisted sheet still exists',
    stale.length === 0,
    stale.length ? `${stale.join(', ')} — rule gone, drop it from SHEET_ALLOWED` : '',
  );
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n──────────\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
