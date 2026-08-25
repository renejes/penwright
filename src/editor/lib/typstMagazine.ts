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
// no collision with built-ins, styled by editor CSS as a manuscript: a kind chip
// names the block; colour and page geometry stay in the PDF). The *semantic*
// export HTML is produced by src/shared/htmlSerializer.ts; the Typst round-trip
// by src/editor/lib/serializer.ts. parseHTML restores attrs for in-editor paste.

import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { t } from '../../shared/i18n/store.svelte';
import { attachFieldPopup } from './fieldPopup';
import { resolveImageSrc } from './typstImage';
import { getProjectMacros } from './projectMacroStore';

/** Shared parse rule: match our neutral wrapper for node `name`. */
const pwTag = (name: string) => `div[data-pw="${name}"]`;

/**
 * Kind chip on a magazine node. The editor is a manuscript, not the PDF: a
 * name says what the block is, the project style does not leak in as colour.
 * Slash titles are the same words the insert menu already uses.
 */
function kindAttr(
  key:
    | 'slashOpenerTitle'
    | 'slashDropCapTitle'
    | 'slashPullQuoteTitle'
    | 'slashQuestionTitle'
    | 'slashCalloutTitle'
    | 'slashFigurePanelTitle'
    | 'slashInterludeTitle',
): string {
  return t().editorLib[key];
}

function posOf(getPos: () => number | undefined): number | undefined {
  const p = typeof getPos === 'function' ? getPos() : undefined;
  return typeof p === 'number' ? p : undefined;
}

function patchAttrs(
  editor: Editor,
  getPos: () => number | undefined,
  patch: Record<string, unknown>,
): void {
  const at = posOf(getPos);
  if (at === undefined) return;
  const live = editor.view.state.doc.nodeAt(at);
  if (!live) return;
  editor.view.dispatch(
    editor.view.state.tr.setNodeMarkup(at, undefined, { ...live.attrs, ...patch }),
  );
}

function makeKind(text: string, asButton: boolean, hint: string): HTMLElement {
  const el = document.createElement(asButton ? 'button' : 'div');
  if (asButton) (el as HTMLButtonElement).type = 'button';
  el.className = 'pw-kind';
  el.textContent = text;
  el.title = hint;
  return el;
}

async function pickPathRelativeTo(basedOn: string | null): Promise<string | null> {
  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;
  if (!api) return null;
  try {
    const res = await api.invoke('project:pickAsset', { targetFile: basedOn }) as { src?: string } | null;
    return res?.src ?? null;
  } catch {
    return null;
  }
}

function bildtafelMacro() {
  return getProjectMacros().find((m) => m.name === 'bildtafel') ?? null;
}

function attrField(opts: {
  className: string;
  placeholder: string;
  value: string;
  rows?: number;
  code?: boolean;
  onInput: (value: string) => void;
}): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.className = `pw-attr ${opts.className}${opts.code ? ' pw-attr-code' : ''}`;
  ta.rows = opts.rows ?? 1;
  ta.placeholder = opts.placeholder;
  ta.value = opts.value;
  ta.spellcheck = !opts.code;
  const grow = (): void => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 18)}px`;
  };
  ta.addEventListener('input', () => {
    opts.onInput(ta.value);
    grow();
  });
  queueMicrotask(grow);
  return ta;
}

function syncAttr(el: HTMLTextAreaElement, value: string): void {
  if (document.activeElement === el) return;
  if (el.value === value) return;
  el.value = value;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 18)}px`;
}

/**
 * Content-bearing magazine node: a kind bar names the block, the body is a
 * ProseMirror content hole. Extra attrs (who, title, path) are fields IN the
 * card — a popup would only repeat them in another font.
 */
function contentNodeView(opts: {
  name: string;
  className: string;
  kind: (node: PmNode) => string;
  bodyClass?: string;
  framed?: boolean;
  setup?: (args: {
    dom: HTMLElement;
    contentDOM: HTMLElement;
    editor: Editor;
    getPos: () => number | undefined;
  }) => { update: (node: PmNode) => void };
}): (ctx: { node: PmNode; getPos: () => number | undefined; editor: Editor }) => {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  stopEvent: (event: Event) => boolean;
  ignoreMutation: (m: { target: globalThis.Node }) => boolean;
  update: (node: PmNode) => boolean;
  destroy: () => void;
} {
  return ({ node, getPos, editor }) => {
    let current = node;
    const framed = opts.framed ?? false;
    const lib = t().editorLib;
    const dom = document.createElement('div');
    dom.className = `pw-node ${opts.className} ${framed ? 'pw-has-form' : 'pw-is-write'}`;
    dom.setAttribute('data-pw', opts.name);
    const kindEl = makeKind(opts.kind(current), false, framed ? '' : lib.kindHintWrite);
    const contentDOM = document.createElement('div');
    contentDOM.className = opts.bodyClass
      ? `pw-node-body ${opts.bodyClass}`
      : 'pw-node-body';
    dom.append(kindEl, contentDOM);
    const chrome = opts.setup?.({ dom, contentDOM, editor, getPos });
    chrome?.update(current);

    const inChrome = (target: EventTarget | null): boolean => {
      if (!(target instanceof globalThis.Node)) return false;
      if (kindEl.contains(target)) return true;
      const el = target instanceof Element ? target : target.parentElement;
      return !!el?.closest('.pw-attr, .pw-chrome, .pw-fp-pick');
    };

    return {
      dom,
      contentDOM,
      stopEvent: (event: Event) => inChrome(event.target),
      ignoreMutation: (m: { target: globalThis.Node }) => !contentDOM.contains(m.target),
      update(updated: PmNode) {
        if (updated.type.name !== opts.name) return false;
        current = updated;
        kindEl.textContent = opts.kind(current);
        chrome?.update(current);
        return true;
      },
      destroy: () => undefined,
    };
  };
}

// ─── Shared field-editor popup (atom nodes: articleHeader, marginNote) ───────
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
        class: 'pw-node pw-opener pw-has-form',
        'data-kind': kindAttr('slashOpenerTitle'),
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
      const lib = t().editorLib;
      const dom = document.createElement('div');
      dom.className = 'pw-node pw-opener pw-has-form';
      dom.contentEditable = 'false';
      dom.setAttribute('data-pw', 'articleHeader');

      const kindEl = makeKind(kindAttr('slashOpenerTitle'), false, '');
      const kicker = attrField({
        className: 'pw-opener-kicker',
        placeholder: lib.macroLabelKicker,
        value: String(node.attrs.kicker ?? ''),
        onInput: (v) => patchAttrs(editor, getPos, { kicker: v }),
      });
      const title = attrField({
        className: 'pw-opener-title',
        placeholder: lib.macroLabelTitle,
        value: String(node.attrs.title ?? ''),
        rows: 2,
        onInput: (v) => patchAttrs(editor, getPos, { title: v }),
      });
      const standfirst = attrField({
        className: 'pw-opener-standfirst',
        placeholder: lib.macroLabelStandfirst,
        value: String(node.attrs.standfirst ?? ''),
        rows: 2,
        onInput: (v) => patchAttrs(editor, getPos, { standfirst: v }),
      });
      const byline = attrField({
        className: 'pw-opener-byline',
        placeholder: lib.macroLabelByline,
        value: String(node.attrs.byline ?? ''),
        onInput: (v) => patchAttrs(editor, getPos, { byline: v }),
      });
      const fields = document.createElement('div');
      fields.className = 'pw-opener-fields';
      fields.append(kicker, title, standfirst, byline);
      dom.append(kindEl, fields);

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: () => true,
        update(updated: PmNode) {
          if (updated.type.name !== 'articleHeader') return false;
          current = updated;
          syncAttr(kicker, String(current.attrs.kicker ?? ''));
          syncAttr(title, String(current.attrs.title ?? ''));
          syncAttr(standfirst, String(current.attrs.standfirst ?? ''));
          syncAttr(byline, String(current.attrs.byline ?? ''));
          return true;
        },
        destroy: () => undefined,
      };
    };
  },
});

/** Insert an empty article opener and put the caret in the title field. */
export function insertArticleHeaderWithEditor(editor: Editor): void {
  editor.chain().focus().insertContent({ type: 'articleHeader', attrs: { title: '' } }).run();
  requestAnimationFrame(() => {
    const el = editor.view.dom.querySelector('.pw-opener .pw-opener-title') as HTMLTextAreaElement | null;
    el?.focus();
  });
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
      {
        'data-pw': 'interlude',
        class: 'pw-node pw-interlude pw-is-rule',
        'data-kind': kindAttr('slashInterludeTitle'),
      },
      ['hr', { class: 'pw-interlude-line' }],
    ];
  },

  addNodeView() {
    return () => {
      const lib = t().editorLib;
      const dom = document.createElement('div');
      dom.className = 'pw-node pw-interlude pw-is-rule';
      dom.contentEditable = 'false';
      dom.setAttribute('data-pw', 'interlude');
      const kindEl = makeKind(kindAttr('slashInterludeTitle'), false, lib.kindHintRule);
      const hr = document.createElement('hr');
      hr.className = 'pw-interlude-line';
      dom.append(kindEl, hr);
      return {
        dom,
        ignoreMutation: () => true,
      };
    };
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
      const popup = attachFieldPopup(dom, () => ({
        fields: [{ key: 'body', label: t().editorLib.macroLabelNote, rows: 3 }],
        read: (key) => String(current.attrs[key] ?? ''),
        write: (key, value) => {
          const at = pos();
          if (at === undefined) return;
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(at, undefined, { ...current.attrs, [key]: value }),
          );
        },
        title: t().editorLib.macroMarginNoteEditTitle,
      }));

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
        destroy: popup.destroy,
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

// ─── dropCap (← lead) — content node (editable prose; drop-cap itself is PDF) ─
export const DropCap = Node.create({
  name: 'dropCap',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: pwTag('dropCap') }];
  },

  renderHTML() {
    return [
      'div',
      {
        'data-pw': 'dropCap',
        class: 'pw-node pw-dropcap pw-is-write',
        'data-kind': kindAttr('slashDropCapTitle'),
      },
      0,
    ];
  },

  addNodeView() {
    return contentNodeView({
      name: 'dropCap',
      className: 'pw-dropcap',
      kind: () => kindAttr('slashDropCapTitle'),
    });
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
    return [
      'div',
      {
        'data-pw': 'question',
        class: 'pw-node pw-question pw-is-write',
        'data-kind': kindAttr('slashQuestionTitle'),
      },
      0,
    ];
  },

  addNodeView() {
    return contentNodeView({
      name: 'question',
      className: 'pw-question',
      kind: () => kindAttr('slashQuestionTitle'),
    });
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
      {
        'data-pw': 'pullQuote',
        class: 'pw-node pw-pull pw-has-form',
        'data-kind': kindAttr('slashPullQuoteTitle'),
        ...(who ? { 'data-who': who } : {}),
      },
      0,
    ];
  },

  addNodeView() {
    return contentNodeView({
      name: 'pullQuote',
      className: 'pw-pull',
      framed: true,
      kind: () => kindAttr('slashPullQuoteTitle'),
      setup: ({ contentDOM, editor, getPos }) => {
        const who = attrField({
          className: 'pw-pull-who',
          placeholder: t().editorLib.macroLabelWho,
          value: '',
          onInput: (v) => patchAttrs(editor, getPos, { who: v }),
        });
        contentDOM.after(who);
        return {
          update: (node) => syncAttr(who, String(node.attrs.who ?? '')),
        };
      },
    });
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
      {
        'data-pw': 'callout',
        class: 'pw-node pw-callout pw-has-form',
        'data-kind': kindAttr('slashCalloutTitle'),
        ...(title ? { 'data-title': title } : {}),
      },
      0,
    ];
  },

  addNodeView() {
    return contentNodeView({
      name: 'callout',
      className: 'pw-callout',
      framed: true,
      kind: () => kindAttr('slashCalloutTitle'),
      setup: ({ contentDOM, editor, getPos }) => {
        const title = attrField({
          className: 'pw-callout-title',
          placeholder: t().editorLib.macroLabelTitle,
          value: '',
          onInput: (v) => patchAttrs(editor, getPos, { title: v }),
        });
        contentDOM.before(title);
        return {
          update: (node) => syncAttr(title, String(node.attrs.title ?? '')),
        };
      },
    });
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
        class: 'pw-node pw-figure-panel pw-has-form',
        'data-kind': kindAttr('slashFigurePanelTitle'),
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

  addNodeView() {
    return contentNodeView({
      name: 'figurePanel',
      className: 'pw-figure-panel',
      bodyClass: 'pw-fp-note',
      framed: true,
      kind: () => kindAttr('slashFigurePanelTitle'),
      setup: ({ contentDOM, editor, getPos }) => {
        const lib = t().editorLib;
        const media = document.createElement('div');
        media.className = 'pw-chrome pw-fp-media';
        const img = document.createElement('img');
        img.className = 'pw-fp-img';
        img.alt = '';
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'pw-fp-pick';
        pick.textContent = lib.macroPickFile;
        pick.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const src = await pickPathRelativeTo(bildtafelMacro()?.filePath ?? null);
          if (src) patchAttrs(editor, getPos, { path: src });
        });
        const caption = attrField({
          className: 'pw-fp-caption',
          placeholder: lib.macroLabelCaption,
          value: '',
          rows: 2,
          onInput: (v) => patchAttrs(editor, getPos, { caption: v }),
        });
        media.append(img, pick, caption);

        const title = attrField({
          className: 'pw-fp-note-title',
          placeholder: lib.macroLabelTitle,
          value: '',
          onInput: (v) => patchAttrs(editor, getPos, { title: v }),
        });
        const noteCol = document.createElement('div');
        noteCol.className = 'pw-fp-col';
        contentDOM.before(media);
        contentDOM.before(noteCol);
        noteCol.append(title, contentDOM);

        return {
          update: (node) => {
            const a = node.attrs as Record<string, string>;
            img.src = resolveImageSrc(a.path || '');
            img.hidden = !a.path;
            syncAttr(caption, a.caption || '');
            syncAttr(title, a.title || '');
          },
        };
      },
    });
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
        class: 'pw-node pw-columns pw-has-form',
        'data-kind': t().editorLib.kindColumns(cols),
        'data-cols': String(cols),
        ...(gutter ? { 'data-gutter': gutter } : {}),
      },
      0,
    ];
  },

  addNodeView() {
    return contentNodeView({
      name: 'columns',
      className: 'pw-columns',
      framed: true,
      kind: () => t().editorLib.slashColumnsTitle,
      setup: ({ contentDOM, editor, getPos }) => {
        const lib = t().editorLib;
        const bar = document.createElement('div');
        bar.className = 'pw-chrome pw-columns-bar';
        const cols = attrField({
          className: 'pw-columns-cols pw-attr-code',
          placeholder: lib.macroLabelCols,
          value: '2',
          onInput: (v) => {
            const n = parseInt(v, 10);
            if (!Number.isFinite(n) || n < 1) return;
            patchAttrs(editor, getPos, { cols: n });
          },
        });
        const gutter = attrField({
          className: 'pw-columns-gutter',
          placeholder: lib.macroLabelGutter,
          value: '',
          code: true,
          onInput: (v) => patchAttrs(editor, getPos, { gutter: v }),
        });
        const kind = contentDOM.previousElementSibling;
        if (kind) {
          kind.replaceWith(bar);
          bar.append(kind, cols, gutter);
        }
        return {
          update: (node) => {
            syncAttr(cols, String(node.attrs.cols ?? 2));
            syncAttr(gutter, String(node.attrs.gutter ?? ''));
          },
        };
      },
    });
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
