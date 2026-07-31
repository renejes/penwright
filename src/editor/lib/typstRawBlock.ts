import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { t } from '../../shared/i18n/store.svelte';
import { attachFieldPopup, type PopupField } from './fieldPopup';
import { getProjectMacros, PROJECT_MACROS_EVENT } from './projectMacroStore';
import {
  findMacroForBlock,
  macroFormFields,
  readMacroField,
  writeMacroField,
  type MacroFormField,
  type ProjectMacro,
} from '../../shared/macroCall';

/**
 * A raw block that is exactly one call to a building block THIS project defines
 * gets a card with a form instead of a wall of code — the point of Stufe 2.
 * Everything else keeps the textarea, and the card keeps a `</>` escape hatch
 * back to it.
 *
 * The form's logic — which fields exist, what they read, what an edit splices —
 * lives in `shared/macroCall.ts` and is pure, so `scripts/macro-edit-test.mts`
 * can drive it against the real corpus and compile the result. Only the labels
 * and the DOM are here.
 */
function labelledFields(macro: ProjectMacro, content: string): (MacroFormField & { label: string; hint?: string; rows?: number })[] {
  const m = t().editorLib;
  return macroFormFields(macro, content).map(f => ({
    ...f,
    label: f.isBody ? (macro.bodyParam ?? m.macroLabelBody) : f.paramName,
    rows: f.isBody ? 4 : undefined,
    hint: f.isPath ? m.macroPathHint : (!f.present && !f.isBody ? m.macroDefaultHint : undefined),
  }));
}

/**
 * Custom TipTap node for Typst code that can't be rendered as WYSIWYG.
 * Displays as a styled code block with an editable textarea.
 * Content is passed through 1:1 during serialization (roundtrip-safe).
 */
export const TypstRawBlock = Node.create({
  name: 'typstRawBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      content: { default: '' },
      blockType: { default: 'unknown' }, // math | config | code | comment | unknown
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-typst-raw]',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            content: el.getAttribute('data-content') ?? '',
            blockType: el.getAttribute('data-block-type') ?? 'unknown',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-typst-raw': '',
        'data-content': node.attrs.content,
        'data-block-type': node.attrs.blockType,
        class: `typst-raw-block typst-raw-${node.attrs.blockType}`,
      },
      node.attrs.content,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;

      // Container
      const dom = document.createElement('div');
      dom.classList.add('typst-raw-block', `typst-raw-${node.attrs.blockType}`);

      // Label
      const label = document.createElement('div');
      label.classList.add('typst-raw-label');
      label.textContent = getBlockLabel(node.attrs.blockType);
      dom.appendChild(label);

      // ─── The building-block card ────────────────────────────────────────
      //
      // Shown when this block is exactly one call to a macro the project
      // defines AND that macro is visible here. Both conditions matter: the
      // parser refuses anything it does not fully understand (a form that
      // splices into a span it guessed at is worse than a code block), and a
      // macro not visible in this file could not compile here anyway.
      let showRaw = false;

      /**
       * The block's content as the DOCUMENT has it, not as this closure last
       * saw it. Every keystroke in the form is a dispatch, and splicing into a
       * copy that lags one dispatch behind would drop a character each time.
       * `typstImage.applyAttrs` reads the node the same way, for the same reason.
       */
      const liveContent = (): string => {
        if (typeof getPos !== 'function') return String(current.attrs.content ?? '');
        const pos = getPos();
        if (pos === undefined) return String(current.attrs.content ?? '');
        const live = editor.view.state.doc.nodeAt(pos);
        return String(live?.attrs.content ?? current.attrs.content ?? '');
      };

      // The ONE recognition call — see `findMacroForBlock`'s doc comment.
      const matchedMacro = (): ProjectMacro | null =>
        findMacroForBlock(liveContent(), getProjectMacros())?.macro ?? null;

      const card = document.createElement('div');
      card.className = 'pw-macro-card';
      card.contentEditable = 'false';
      card.draggable = false;
      dom.appendChild(card);

      /**
       * Asks main to place a picked file and hand back the path to write —
       * request/response, because a form field needs the string. The existing
       * image path is fire-and-forget (it inserts a node), so it cannot serve
       * this. Both route through the same `placeAssetFromPath`.
       */
      const pickAssetPath = async (): Promise<string | null> => {
        const api = (window as unknown as {
          electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
        }).electronAPI;
        if (!api) return null;
        try {
          const res = await api.invoke('project:pickAsset', {}) as { src?: string } | null;
          return res?.src ?? null;
        } catch {
          return null;
        }
      };

      const writeContent = (next: string): void => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (pos === undefined) return;
        const { tr } = editor.view.state;
        const live = tr.doc.nodeAt(pos);
        if (!live) return;
        tr.setNodeMarkup(pos, undefined, { ...live.attrs, content: next });
        editor.view.dispatch(tr);
      };

      const renderCard = (macro: ProjectMacro): void => {
        card.replaceChildren();
        const content = liveContent();

        const head = document.createElement('div');
        head.className = 'pw-macro-card-head';
        const name = document.createElement('span');
        name.className = 'pw-macro-card-name';
        name.textContent = macro.label || `#${macro.name}`;
        head.appendChild(name);

        const toggle = document.createElement('button');
        toggle.className = 'pw-macro-card-toggle';
        toggle.type = 'button';
        toggle.textContent = t().editorLib.macroShowCode;
        toggle.title = t().editorLib.macroShowCodeTooltip;
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showRaw = true;
          render();
        });
        head.appendChild(toggle);
        card.appendChild(head);

        const rows = document.createElement('div');
        rows.className = 'pw-macro-card-rows';
        const fields = labelledFields(macro, content);
        for (const f of fields) {
          const value = readMacroField(content, f.key).trim().replace(/\s+/g, ' ');
          const row = document.createElement('div');
          row.className = 'pw-macro-card-row';
          const k = document.createElement('span');
          k.className = 'pw-macro-card-key';
          k.textContent = f.label;
          const v = document.createElement('span');
          v.className = value ? 'pw-macro-card-value' : 'pw-macro-card-value pw-macro-card-empty';
          v.textContent = value || t().editorLib.macroDefaultValue;
          row.append(k, v);
          rows.appendChild(row);
        }
        card.appendChild(rows);

        if (!fields.length) {
          const none = document.createElement('div');
          none.className = 'pw-macro-card-row pw-macro-card-empty';
          none.textContent = t().editorLib.macroNoFields;
          card.appendChild(none);
        }
      };

      // One popup for the card's lifetime; it asks for its fields on each open,
      // so it always reflects the CURRENT content rather than a stale snapshot.
      const destroyPopup = attachFieldPopup(card, () => {
        const macro = matchedMacro();
        const content = liveContent();
        const fields = macro ? labelledFields(macro, content) : [];
        return {
          title: macro ? (macro.label || `#${macro.name}`) : '',
          wide: true,
          fields: fields.map((f): PopupField => ({
            key: f.key,
            label: f.label,
            rows: f.rows,
            code: f.kind === 'expr',
            hint: f.hint,
            action: f.isPath ? { label: t().editorLib.macroPickFile, run: pickAssetPath } : undefined,
          })),
          read: (key) => readMacroField(liveContent(), key),
          write: (key, value) => {
            const field = fields.find(x => x.key === key);
            if (!field) return;
            const before = liveContent();
            const next = writeMacroField(before, key, field.kind, value);
            // A refused edit writes NOTHING. Half-applying it would leave a call
            // the parser can no longer read, and the user with no way back.
            if (next === null || next === before) return;
            writeContent(next);
          },
        };
      });

      // Editable textarea for raw Typst content
      const textarea = document.createElement('textarea');
      textarea.classList.add('typst-raw-textarea');
      textarea.value = node.attrs.content;
      textarea.spellcheck = false;
      textarea.rows = 1;

      /**
       * Grows the textarea to its content's REAL height.
       *
       * `rows` counts newlines, so a single long line that WRAPS still asked for
       * one row — and with `overflow: hidden` the rest was simply cut off. A
       * one-line `#bildnachweis("assets/feature.png", "Die Stunde am Fenster —
       * Platzhalter")` showed its first half and hid the rest, with nothing to
       * scroll and no hint that anything was missing.
       *
       * Measured from `scrollHeight`, which is the only thing that knows how the
       * text actually wrapped at this width.
       */
      const autosize = (): void => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };

      textarea.addEventListener('input', () => {
        writeContent(textarea.value);
        autosize();
      });

      // Leave the block: insert a paragraph right after it and move the cursor
      // there. Shared by the "Done" button and the keyboard shortcuts below
      // (plain Enter stays inside the textarea as a newline).
      const exitBlock = () => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (pos === undefined) return;
        const endPos = pos + current.nodeSize;
        const tr = editor.view.state.tr.insert(
          endPos,
          editor.view.state.schema.nodes.paragraph.create()
        );
        tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)));
        editor.view.dispatch(tr);
        editor.view.focus();
      };

      // Esc or Cmd/Ctrl+Enter exits the block without reaching for the mouse.
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
          e.preventDefault();
          exitBlock();
        }
      });

      // "Done" button to exit the block and create a new line below
      const doneBtn = document.createElement('button');
      doneBtn.classList.add('typst-raw-done');
      doneBtn.textContent = t().editorLib.blockDone;
      doneBtn.title = t().editorLib.rawBlockDoneTooltip;
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exitBlock();
      });

      // Back from the code view to the form. Without it `</>` is a one-way
      // door and the form is unreachable for the rest of the session.
      const backBtn = document.createElement('button');
      backBtn.className = 'pw-macro-card-toggle pw-macro-back';
      backBtn.type = 'button';
      backBtn.textContent = t().editorLib.macroShowCard;
      backBtn.title = t().editorLib.macroShowCardTooltip;
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showRaw = false;
        render();
      });
      dom.appendChild(backBtn);

      // Card or code — one of the two, never both. `showRaw` is the user's
      // explicit choice via the `</>` toggle and survives re-renders.
      const render = (): void => {
        const macro = showRaw ? null : matchedMacro();
        if (macro) {
          renderCard(macro);
          card.style.display = '';
          textarea.style.display = 'none';
          doneBtn.style.display = 'none';
          backBtn.style.display = 'none';
          dom.classList.add('pw-has-macro-card');
        } else {
          card.style.display = 'none';
          textarea.style.display = '';
          doneBtn.style.display = '';
          // Offered only when there IS a form to go back to.
          backBtn.style.display = showRaw && matchedMacro() ? '' : 'none';
          dom.classList.remove('pw-has-macro-card');
          if (textarea.value !== String(current.attrs.content ?? '')) {
            textarea.value = String(current.attrs.content ?? '');
          }
          // Always, not only on a value change: the block may have been hidden
          // when it was last measured, and a hidden element has no scrollHeight.
          autosize();
        }
      };

      dom.appendChild(textarea);
      dom.appendChild(doneBtn);
      render();
      // `scrollHeight` is 0 until the element is laid out.
      requestAnimationFrame(autosize);

      // The catalogue arrives over IPC, after this view already asked for it and
      // got nothing. Re-render when it lands, or the card never appears.
      const onMacros = (): void => render();
      window.addEventListener(PROJECT_MACROS_EVENT, onMacros);

      return {
        dom,
        // Let the textarea and done button handle their own events
        stopEvent(event: Event) {
          const target = event.target as HTMLElement | null;
          const tag = target?.tagName;
          return tag === 'TEXTAREA' || tag === 'BUTTON' || !!target?.closest('.pw-macro-card');
        },
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'typstRawBlock') return false;
          current = updatedNode;
          dom.className = `typst-raw-block typst-raw-${updatedNode.attrs.blockType}`;
          label.textContent = getBlockLabel(updatedNode.attrs.blockType);
          // Not while the user is typing in the textarea: replacing its value
          // on our own dispatch would reset the caret to the end on every
          // keystroke. `render()` only writes it back when it differs.
          if (document.activeElement !== textarea) render();
          return true;
        },
        destroy() {
          window.removeEventListener(PROJECT_MACROS_EVENT, onMacros);
          destroyPopup();
        },
      };
    };
  },
});

function getBlockLabel(blockType: string): string {
  const m = t().editorLib;
  switch (blockType) {
    case 'math':
      return m.rawBlockMath;
    case 'config':
      return m.rawBlockConfig;
    case 'code':
      return m.rawBlockCode;
    case 'comment':
      return m.rawBlockComment;
    case 'text':
      return m.rawBlockText;
    default:
      return m.rawBlockDefault;
  }
}
