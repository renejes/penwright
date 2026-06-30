// Magazine AST nodes — Phase C keystone (web-export-feasibility-and-plan.md).
//
// The load-bearing, hand-written magazine macros (opener / lead / pull / frage /
// notiz / bildtafel / randnotiz / interlude + `#columns`) used to land as opaque
// `typstRawBlock` atoms: invisible-ish blobs that the visual editor couldn't
// touch and that the DOCX/HTML serializers either dropped or placeholdered.
// Turning them into real TipTap nodes makes them (a) round-trip losslessly to
// Typst (PDF stays compile-stable), (b) render as real HTML + Word content
// (fixing the silent `#columns` DOCX drop), and (c) edit as WYSIWYG blocks.
//
// Node model (see the plan §1.3 + the keystone synthesis):
//   • articleHeader / interlude  → block ATOMS  (named-arg / no-arg constructs)
//   • marginNote                 → inline ATOM  (sits mid-sentence, like footnote)
//   • dropCap / pullQuote /      → CONTENT nodes (editable child prose); these are
//     question / callout /         the codebase's first content-bearing custom
//     figurePanel / columns        nodes — `atom:false` + a `content` expression.
//
// renderHTML here is for the EDITOR + clipboard only (neutral `data-pw` wrappers,
// no collision with built-ins, styled by editor CSS). The *semantic* export HTML
// is produced by src/shared/htmlSerializer.ts; the Typst round-trip by
// src/editor/lib/serializer.ts. parseHTML restores attrs for in-editor paste.

import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import { t } from '../../shared/i18n/store.svelte';

/** Shared parse rule: match our neutral wrapper for node `name`. */
const pwTag = (name: string) => `div[data-pw="${name}"]`;

// ─── Shared field-editor popup (atom nodes: articleHeader, marginNote) ───────
// A small popup with one labelled <textarea> per editable string field, live-
// saving into the node's attrs. Mirrors the footnote popup pattern (plain DOM,
// no Svelte) so atoms whose data lives in attrs are still editable in-editor.

interface PopupField {
  key: string;
  label: string;
  rows?: number;
}

/** Wires a click-to-edit popup onto an atom node-view's `dom`. Returns nothing;
 *  attaches its own listeners + cleanup hook (call the returned destroy()). */
function attachFieldPopup(
  dom: HTMLElement,
  fields: PopupField[],
  getNode: () => { attrs: Record<string, unknown> },
  getPos: () => number | undefined,
  editor: Editor,
  titleText: string,
): () => void {
  let popup: HTMLDivElement | null = null;
  let backdrop: HTMLDivElement | null = null;

  const close = () => {
    popup?.remove();
    backdrop?.remove();
    popup = backdrop = null;
  };

  const save = (key: string, value: string) => {
    const pos = getPos();
    if (pos === undefined) return;
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(pos, undefined, { ...getNode().attrs, [key]: value }),
    );
  };

  const open = () => {
    if (popup) { close(); return; }
    const rect = dom.getBoundingClientRect();
    backdrop = document.createElement('div');
    backdrop.className = 'footnote-popup-backdrop';
    backdrop.addEventListener('mousedown', (e) => { e.preventDefault(); close(); });
    document.body.appendChild(backdrop);

    popup = document.createElement('div');
    popup.className = 'footnote-popup pw-macro-popup';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;

    const heading = document.createElement('div');
    heading.className = 'footnote-popup-label';
    heading.textContent = titleText;
    popup.appendChild(heading);

    for (const f of fields) {
      const label = document.createElement('label');
      label.className = 'pw-macro-popup-field-label';
      label.textContent = f.label;
      popup.appendChild(label);

      const ta = document.createElement('textarea');
      ta.className = 'footnote-popup-textarea';
      ta.rows = f.rows ?? 1;
      ta.value = String(getNode().attrs[f.key] ?? '');
      ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
        save(f.key, ta.value);
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          close();
          editor.commands.focus();
        }
      });
      popup.appendChild(ta);
    }

    const hint = document.createElement('div');
    hint.className = 'footnote-popup-hint';
    hint.textContent = t().editorLib.macroEditHint;
    popup.appendChild(hint);

    document.body.appendChild(popup);
    requestAnimationFrame(() => {
      const first = popup?.querySelector('textarea');
      first?.focus();
      popup?.querySelectorAll('textarea').forEach((el) => {
        const ta = el as HTMLTextAreaElement;
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      });
    });
  };

  const onClick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); open(); };
  dom.addEventListener('click', onClick);
  return () => { close(); dom.removeEventListener('click', onClick); };
}

// ─── articleHeader (← opener) — block atom ──────────────────────────────────
// kicker / title / standfirst / byline are named string args; the title also
// becomes the outline-visible H1 (preview-follows-chapter reads `title:`).
export const ArticleHeader = Node.create({
  name: 'articleHeader',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kicker: { default: '' },
      title: { default: '' },
      standfirst: { default: '' },
      byline: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: pwTag('articleHeader'),
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            kicker: el.getAttribute('data-kicker') ?? '',
            title: el.getAttribute('data-title') ?? '',
            standfirst: el.getAttribute('data-standfirst') ?? '',
            byline: el.getAttribute('data-byline') ?? '',
            label: el.getAttribute('data-label') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, string>;
    const kids: any[] = [];
    if (a.kicker) kids.push(['div', { class: 'pw-opener-kicker' }, a.kicker]);
    kids.push(['div', { class: 'pw-opener-title', ...(a.label ? { id: a.label } : {}) }, a.title || '']);
    if (a.standfirst) kids.push(['div', { class: 'pw-opener-standfirst' }, a.standfirst]);
    if (a.byline) kids.push(['div', { class: 'pw-opener-byline' }, a.byline]);
    return [
      'div',
      mergeAttributes({
        'data-pw': 'articleHeader',
        class: 'pw-node pw-opener',
        'data-kicker': a.kicker || '',
        'data-title': a.title || '',
        'data-standfirst': a.standfirst || '',
        'data-byline': a.byline || '',
        'data-label': a.label || '',
      }),
      ...kids,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('div');
      dom.className = 'pw-node pw-opener';
      dom.contentEditable = 'false';
      dom.setAttribute('data-pw', 'articleHeader');
      dom.title = t().editorLib.macroOpenerEditTitle;

      const render = () => {
        const a = current.attrs as Record<string, string>;
        dom.innerHTML = '';
        if (a.kicker) {
          const k = document.createElement('div');
          k.className = 'pw-opener-kicker';
          k.textContent = a.kicker;
          dom.appendChild(k);
        }
        const title = document.createElement('div');
        title.className = 'pw-opener-title';
        if (!a.title) title.classList.add('pw-opener-empty');
        title.textContent = a.title || t().editorLib.macroOpenerEmpty;
        dom.appendChild(title);
        if (a.standfirst) {
          const s = document.createElement('div');
          s.className = 'pw-opener-standfirst';
          s.textContent = a.standfirst;
          dom.appendChild(s);
        }
        if (a.byline) {
          const b = document.createElement('div');
          b.className = 'pw-opener-byline';
          b.textContent = a.byline;
          dom.appendChild(b);
        }
      };
      render();

      const pos = () => { const p = typeof getPos === 'function' ? getPos() : undefined; return typeof p === 'number' ? p : undefined; };
      const destroy = attachFieldPopup(dom, [
        { key: 'kicker', label: t().editorLib.macroLabelKicker },
        { key: 'title', label: t().editorLib.macroLabelTitle },
        { key: 'standfirst', label: t().editorLib.macroLabelStandfirst, rows: 2 },
        { key: 'byline', label: t().editorLib.macroLabelByline },
      ], () => current, pos, editor, t().editorLib.macroOpenerEditTitle);

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: () => true,
        update(updated) {
          if (updated.type.name !== 'articleHeader') return false;
          current = updated;
          render();
          return true;
        },
        destroy,
      };
    };
  },
});

/** Insert an empty article opener and open its editor popup immediately. */
export function insertArticleHeaderWithEditor(editor: Editor): void {
  editor.chain().focus().insertContent({ type: 'articleHeader', attrs: { title: '' } }).run();
  openFreshNode(editor, '.pw-opener', (el) => el.querySelector('.pw-opener-empty') !== null);
}

// ─── interlude (← interlude()) — block atom (a quiet centered divider) ───────
export const Interlude = Node.create({
  name: 'interlude',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: pwTag('interlude') }];
  },

  renderHTML() {
    return [
      'div',
      { 'data-pw': 'interlude', class: 'pw-node pw-interlude' },
      ['hr', { class: 'pw-interlude-line' }],
    ];
  },
});

// ─── marginNote (← randnotiz) — inline atom (mid-sentence, like footnote) ────
export const MarginNote = Node.create({
  name: 'marginNote',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { body: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-pw="marginNote"]',
        getAttrs: (dom) => ({ body: (dom as HTMLElement).getAttribute('data-body') ?? '' }),
      },
    ];
  },

  renderHTML({ node }) {
    const body = (node.attrs.body as string) ?? '';
    return [
      'span',
      { 'data-pw': 'marginNote', 'data-body': body, class: 'pw-margin-note', title: body },
      ['span', { class: 'pw-margin-note-marker' }, '⌧'],
      ['span', { class: 'pw-margin-note-body' }, body],
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('span');
      dom.className = 'pw-margin-note';
      dom.contentEditable = 'false';
      dom.setAttribute('data-pw', 'marginNote');
      const marker = document.createElement('span');
      marker.className = 'pw-margin-note-marker';
      marker.textContent = '⌧';
      const bodyEl = document.createElement('span');
      bodyEl.className = 'pw-margin-note-body';
      dom.appendChild(marker);
      dom.appendChild(bodyEl);

      const render = () => {
        const body = (current.attrs.body as string) ?? '';
        bodyEl.textContent = body;
        dom.title = body || t().editorLib.macroMarginNoteEditTitle;
      };
      render();

      const pos = () => { const p = typeof getPos === 'function' ? getPos() : undefined; return typeof p === 'number' ? p : undefined; };
      const destroy = attachFieldPopup(
        dom,
        [{ key: 'body', label: t().editorLib.macroLabelNote, rows: 3 }],
        () => current, pos, editor, t().editorLib.macroMarginNoteEditTitle,
      );

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: () => true,
        update(updated) {
          if (updated.type.name !== 'marginNote') return false;
          current = updated;
          render();
          return true;
        },
        destroy,
      };
    };
  },
});

/** Insert a margin note at the cursor and open its editor popup. */
export function insertMarginNoteWithEditor(editor: Editor): void {
  editor.chain().focus().insertContent({ type: 'marginNote', attrs: { body: '' } }).run();
  openFreshNode(editor, 'span.pw-margin-note', (el) => (el.getAttribute('data-body') ?? '') === '');
}

/**
 * Clicks the freshly-inserted node (to open its popup) once ProseMirror has
 * mounted the node-view. Prefers the node the `isEmpty` predicate marks as new
 * (so a second insertion in the same frame can't grab the wrong node), falling
 * back to the last match; retries a few frames in case the view isn't attached.
 */
function openFreshNode(editor: Editor, selector: string, isEmpty: (el: HTMLElement) => boolean): void {
  let attempts = 0;
  const tryOpen = () => {
    const nodes = editor.view.dom.querySelectorAll(selector);
    let target: HTMLElement | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (isEmpty(nodes[i] as HTMLElement)) { target = nodes[i] as HTMLElement; break; }
    }
    target ??= nodes[nodes.length - 1] as HTMLElement | undefined ?? null;
    if (target) { target.click(); return; }
    if (attempts++ < 5) requestAnimationFrame(tryOpen);
  };
  requestAnimationFrame(tryOpen);
}

// ─── dropCap (← lead) — content node (editable prose, dropped first letter) ──
export const DropCap = Node.create({
  name: 'dropCap',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: pwTag('dropCap') }];
  },

  renderHTML() {
    return ['div', { 'data-pw': 'dropCap', class: 'pw-node pw-dropcap' }, 0];
  },
});

// ─── question (← frage) — content node (interview question prose) ────────────
export const Question = Node.create({
  name: 'question',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: pwTag('question') }];
  },

  renderHTML() {
    return ['div', { 'data-pw': 'question', class: 'pw-node pw-question' }, 0];
  },
});

// ─── pullQuote (← pull, + who) — content node ───────────────────────────────
export const PullQuote = Node.create({
  name: 'pullQuote',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return { who: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: pwTag('pullQuote'),
        getAttrs: (dom) => ({ who: (dom as HTMLElement).getAttribute('data-who') ?? '' }),
      },
    ];
  },

  renderHTML({ node }) {
    const who = (node.attrs.who as string) ?? '';
    return [
      'div',
      { 'data-pw': 'pullQuote', class: 'pw-node pw-pull', ...(who ? { 'data-who': who } : {}) },
      0,
    ];
  },
});

// ─── callout (← notiz, + title) — content node (multi-paragraph body) ────────
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return { title: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: pwTag('callout'),
        getAttrs: (dom) => ({ title: (dom as HTMLElement).getAttribute('data-title') ?? '' }),
      },
    ];
  },

  renderHTML({ node }) {
    const title = (node.attrs.title as string) ?? '';
    return [
      'div',
      { 'data-pw': 'callout', class: 'pw-node pw-callout', ...(title ? { 'data-title': title } : {}) },
      0,
    ];
  },
});

// ─── figurePanel (← bildtafel) — content node (note body) + image attrs ──────
// path / caption are stored as attrs (the image + its caption); the framed note
// body is editable block content.
export const FigurePanel = Node.create({
  name: 'figurePanel',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      path: { default: '' },
      caption: { default: '' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: pwTag('figurePanel'),
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            path: el.getAttribute('data-path') ?? '',
            caption: el.getAttribute('data-caption') ?? '',
            title: el.getAttribute('data-title') ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, string>;
    return [
      'div',
      mergeAttributes({
        'data-pw': 'figurePanel',
        class: 'pw-node pw-figure-panel',
        'data-path': a.path || '',
        'data-caption': a.caption || '',
        'data-title': a.title || '',
      }),
      [
        'div',
        { class: 'pw-fp-media' },
        ['img', { src: a.path || '', alt: '', class: 'pw-fp-img' }],
        ...(a.caption ? [['div', { class: 'pw-fp-caption' }, a.caption]] : []),
      ],
      ['div', { class: 'pw-fp-note', ...(a.title ? { 'data-title': a.title } : {}) }, 0],
    ];
  },
});

// ─── columns (← #columns(n, gutter:)) — content node (the column flow) ───────
// `cols` + `gutter` are attrs; the children are recursively-parsed real blocks
// (questions, paragraphs, images). This is what fixes the silent `#columns`
// DOCX drop (B1): the flow is structured content, never a raw block.
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      cols: {
        default: 2,
        parseHTML: (el) => parseInt(el.getAttribute('data-cols') ?? '2', 10) || 2,
      },
      gutter: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-gutter') ?? '',
      },
    };
  },

  parseHTML() {
    return [{ tag: pwTag('columns') }];
  },

  renderHTML({ node }) {
    const cols = (node.attrs.cols as number) ?? 2;
    const gutter = (node.attrs.gutter as string) ?? '';
    return [
      'div',
      {
        'data-pw': 'columns',
        class: 'pw-node pw-columns',
        'data-cols': String(cols),
        ...(gutter ? { 'data-gutter': gutter } : {}),
      },
      0,
    ];
  },
});

/** All magazine nodes, for registration in editor.ts. */
export const MAGAZINE_NODES = [
  ArticleHeader,
  Interlude,
  MarginNote,
  DropCap,
  Question,
  PullQuote,
  Callout,
  FigurePanel,
  Columns,
];
