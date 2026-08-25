import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { t } from '../../shared/i18n/store.svelte';
import { getProjectMacros, PROJECT_MACROS_EVENT } from './projectMacroStore';
import { describeRawBlock, bareSpacer } from '../../shared/rawBlockDescription';
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
    // `=== false` on purpose: `undefined` means the scanner did not establish it
    // (an older payload, a caller that cannot read the body), and that is not the
    // same claim as "this macro passes the path on".
    hint: f.isPath
      ? (macro.resolvesPathsHere === false
          ? m.macroPathHintIndirect(macro.relPath)
          : m.macroPathHint(macro.relPath))
      : (!f.present && !f.isBody ? m.macroDefaultHint : undefined),
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
      dom.classList.add('typst-raw-block', `typst-raw-${node.attrs.blockType}`, 'pw-is-source');

      // Label
      const label = document.createElement('div');
      label.classList.add('typst-raw-label');
      label.textContent = getBlockLabel(String(node.attrs.content ?? ''), node.attrs.blockType);
      label.title = t().editorLib.kindHintSource;
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
       *
       * `basedOn` is the file the path must be relative to, and it is NOT this
       * chapter. Typst resolves a path against the file holding the `image()`
       * call, so for a macro argument that is the macro's DEFINING file. Passing
       * the open chapter wrote `../assets/…` into a call whose `image()` lives in
       * `macros.typ`, and the document stopped compiling outright:
       * `path "../assets/x.png" would escape the project root`. Measured against
       * the bundled 0.15.1, not reasoned about.
       */
      const pickAssetPath = async (basedOn: string | null): Promise<string | null> => {
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
        if (card.contains(document.activeElement)) return;
        card.replaceChildren();
        const content = liveContent();
        const m = t().editorLib;

        const head = document.createElement('div');
        head.className = 'pw-macro-card-head';
        const name = document.createElement('span');
        name.className = 'pw-macro-card-name';
        name.textContent = macro.label || `#${macro.name}`;
        head.appendChild(name);

        const toggle = document.createElement('button');
        toggle.className = 'pw-macro-card-toggle';
        toggle.type = 'button';
        toggle.textContent = m.macroShowCode;
        toggle.title = m.macroShowCodeTooltip;
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
          const row = document.createElement('div');
          row.className = 'pw-macro-card-row';
          const k = document.createElement('span');
          k.className = 'pw-macro-card-key';
          k.textContent = f.label;
          const ta = document.createElement('textarea');
          ta.className = `pw-attr pw-macro-card-value${f.kind === 'expr' ? ' pw-attr-code' : ''}`;
          ta.rows = f.rows ?? 1;
          ta.spellcheck = f.kind !== 'expr';
          ta.placeholder = f.isBody ? m.macroBodyPlaceholder : m.macroDefaultValue;
          ta.value = readMacroField(content, f.key);
          const grow = (): void => {
            ta.style.height = 'auto';
            ta.style.height = `${Math.max(ta.scrollHeight, 18)}px`;
          };
          ta.addEventListener('input', () => {
            const before = liveContent();
            const next = writeMacroField(before, f.key, f.kind, ta.value);
            if (next === null || next === before) return;
            writeContent(next);
            grow();
          });
          queueMicrotask(grow);
          row.append(k, ta);
          if (f.isPath) {
            const pick = document.createElement('button');
            pick.type = 'button';
            pick.className = 'pw-fp-pick';
            pick.textContent = m.macroPickFile;
            pick.addEventListener('click', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const src = await pickAssetPath(macro.filePath);
              if (src === null) return;
              const before = liveContent();
              const next = writeMacroField(before, f.key, f.kind, src);
              if (next === null || next === before) return;
              writeContent(next);
            });
            row.append(pick);
          }
          if (f.hint) {
            const hint = document.createElement('div');
            hint.className = 'pw-macro-card-hint';
            hint.textContent = f.hint;
            row.append(hint);
          }
          rows.appendChild(row);
        }
        card.appendChild(rows);

        if (!fields.length) {
          const none = document.createElement('div');
          none.className = 'pw-macro-card-row pw-macro-card-empty';
          none.textContent = m.macroNoFields;
          card.appendChild(none);
        }
      };

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

      // ─── A bare spacer is not worth a box ───────────────────────────────
      //
      // `#v(0.4em)` is 60 of the corpus's raw blocks — the single largest group
      // — and every one of them was a full code box with a label and a Done
      // button, for one number. It reads as clutter between the paragraphs it
      // separates, which is the opposite of what a spacer is for.
      //
      // Shown instead as a thin gap carrying its own measurement. Still a real
      // node: selectable, deletable, draggable, and clicking it opens the same
      // field popup to change the amount. `</>` is reachable from there.
      const spacerEl = document.createElement('div');
      spacerEl.className = 'pw-spacer';
      spacerEl.contentEditable = 'false';
      const spacerRuleA = document.createElement('span');
      spacerRuleA.className = 'pw-spacer-rule';
      const spacerRuleB = document.createElement('span');
      spacerRuleB.className = 'pw-spacer-rule';
      const spacerAmount = document.createElement('input');
      spacerAmount.type = 'text';
      spacerAmount.className = 'pw-attr pw-attr-code pw-spacer-value';
      spacerAmount.spellcheck = false;
      spacerAmount.addEventListener('input', () => {
        const v = spacerAmount.value.trim();
        if (!v) return;
        if (bareSpacer(liveContent()) === null) return;
        writeContent(`#v(${v})`);
      });
      spacerEl.append(spacerRuleA, spacerAmount, spacerRuleB);

      const syncSpacer = (amount: string): void => {
        spacerEl.title = t().editorLib.spacerTooltip;
        if (document.activeElement === spacerAmount) return;
        if (spacerAmount.value !== amount) spacerAmount.value = amount;
      };

      dom.appendChild(spacerEl);

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
        const amount = showRaw ? null : bareSpacer(liveContent());
        if (amount !== null) {
          syncSpacer(amount);
          spacerEl.style.display = '';
          label.style.display = 'none';
          card.style.display = 'none';
          textarea.style.display = 'none';
          doneBtn.style.display = 'none';
          backBtn.style.display = 'none';
          dom.classList.add('pw-is-spacer');
          return;
        }
        spacerEl.style.display = 'none';
        label.style.display = '';
        dom.classList.remove('pw-is-spacer');
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
          return tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'INPUT'
            || !!target?.closest('.pw-macro-card, .pw-spacer');
        },
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'typstRawBlock') return false;
          current = updatedNode;
          dom.className = `typst-raw-block typst-raw-${updatedNode.attrs.blockType} pw-is-source`;
          label.textContent = getBlockLabel(String(updatedNode.attrs.content ?? ''), updatedNode.attrs.blockType);
          label.title = t().editorLib.kindHintSource;
          // Not while the user is typing in the textarea: replacing its value
          // on our own dispatch would reset the caret to the end on every
          // keystroke. `render()` only writes it back when it differs.
          if (
            document.activeElement !== textarea
            && !card.contains(document.activeElement)
            && document.activeElement !== spacerAmount
          ) render();
          return true;
        },
        destroy() {
          window.removeEventListener(PROJECT_MACROS_EVENT, onMacros);
        },
      };
    };
  },
});

/**
 * The one-line name a block shows.
 *
 * Every raw block gets one, because the alternative — the same word "typst" on a
 * page setup, a spacer, an imported stylesheet and a paragraph of prose — makes
 * reading the code the only way to tell them apart, which is what this app
 * exists to avoid. The classification is in `shared/rawBlockDescription.ts` and
 * returns a KIND; the language belongs here.
 */
function getBlockLabel(content: string, blockType: string): string {
  const m = t().editorLib;
  const d = describeRawBlock(content, blockType);
  switch (d.kind) {
    case 'comment': return m.rawKindComment;
    case 'include': return m.rawKindInclude;
    case 'text': return m.rawKindText;
    case 'math': return m.rawKindMath;
    case 'import': return m.rawKindImport;
    case 'setting': return m.rawKindSetting;
    case 'rule': return m.rawKindRule;
    case 'pageSetup': return m.rawKindPageSetup;
    case 'binding': return m.rawKindBinding;
    case 'spacing': return m.rawKindSpacing(d.detail ?? '');
    case 'pagebreak': return m.rawKindPagebreak;
    case 'colbreak': return m.rawKindColbreak;
    case 'line': return m.rawKindLine;
    case 'call': return m.rawKindCall(d.detail ?? '');
    default: return m.rawKindCode;
  }
}

