<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { insertFootnoteWithEditor } from '../lib/typstFootnote';
  import { getCommands, type SlashItem } from '../lib/slashCommands';
  import { t } from '@shared/i18n/store.svelte';

  let { editor }: { editor: Editor } = $props();

  // "Insert" dropdown — same command list as the slash ("/") menu, grouped.
  let showInsertMenu = $state(false);
  let insertBtnEl: HTMLButtonElement;
  let insertMenuStyle = $state('');

  const insertGroups = $derived.by(() => {
    const cmds = getCommands();
    return [
      { label: t().editor.insertGroupText, items: cmds.filter((c) => c.group === 'text') },
      { label: t().editor.insertGroupBlocks, items: cmds.filter((c) => c.group === 'blocks') },
      { label: t().editor.insertGroupRefs, items: cmds.filter((c) => c.group === 'refs') },
    ];
  });

  function toggleInsertMenu() {
    showInsertMenu = !showInsertMenu;
    if (showInsertMenu && insertBtnEl) {
      const rect = insertBtnEl.getBoundingClientRect();
      insertMenuStyle = `position:fixed; left:${rect.left}px; top:${rect.bottom + 4}px;`;
    }
  }

  function runInsert(item: SlashItem) {
    showInsertMenu = false;
    item.command(editor);
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showInsertMenu) showInsertMenu = false;
  }

  let showTablePicker = $state(false);
  let pickerRows = $state(0);
  let pickerCols = $state(0);
  let showTextColorPicker = $state(false);
  let showHighlightPicker = $state(false);
  let textColorBtnEl: HTMLButtonElement;
  let highlightBtnEl: HTMLButtonElement;
  let colorPickerStyle = $state('');
  let highlightPickerStyle = $state('');

  function openTextColorPicker() {
    showHighlightPicker = false;
    showTextColorPicker = !showTextColorPicker;
    if (showTextColorPicker && textColorBtnEl) {
      const rect = textColorBtnEl.getBoundingClientRect();
      colorPickerStyle = `position:fixed; left:${rect.left}px; top:${rect.bottom + 4}px;`;
    }
  }

  function openHighlightPicker() {
    showTextColorPicker = false;
    showHighlightPicker = !showHighlightPicker;
    if (showHighlightPicker && highlightBtnEl) {
      const rect = highlightBtnEl.getBoundingClientRect();
      highlightPickerStyle = `position:fixed; left:${rect.left}px; top:${rect.bottom + 4}px;`;
    }
  }

  const colorOptions = $derived([
    { label: t().editor.colorRed, value: 'red', css: '#e74c3c' },
    { label: t().editor.colorBlue, value: 'blue', css: '#3498db' },
    { label: t().editor.colorGreen, value: 'green', css: '#27ae60' },
    { label: t().editor.colorOrange, value: 'orange', css: '#e67e22' },
    { label: t().editor.colorPurple, value: 'purple', css: '#9b59b6' },
    { label: t().editor.colorNavy, value: 'navy', css: '#2c3e50' },
    { label: t().editor.colorGray, value: 'gray', css: '#7f8c8d' },
  ]);

  const highlightOptions = $derived([
    { label: t().editor.colorYellow, value: 'yellow', css: '#f1c40f' },
    { label: t().editor.colorGreen, value: 'green', css: '#2ecc71' },
    { label: t().editor.colorBlue, value: 'blue', css: '#3498db' },
    { label: t().editor.colorPink, value: 'rgb("#FFD1DC")', css: '#FFD1DC' },
    { label: t().editor.colorOrange, value: 'orange', css: '#e67e22' },
    { label: t().editor.colorPurple, value: 'purple', css: '#9b59b6' },
  ]);

  function applyTextColor(color: string) {
    editor.chain().focus().setMark('textColor', { color }).run();
    showTextColorPicker = false;
  }

  function removeTextColor() {
    editor.chain().focus().unsetMark('textColor').run();
    showTextColorPicker = false;
  }

  function applyHighlight(color: string) {
    editor.chain().focus().setMark('highlight', { color }).run();
    showHighlightPicker = false;
  }

  function removeHighlight() {
    editor.chain().focus().unsetMark('highlight').run();
    showHighlightPicker = false;
  }

  function setLink() {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt(t().editor.toolbarLinkPrompt, previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
    }
  }

  function insertTable(rows: number, cols: number) {
    showTablePicker = false;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  }

  function handlePickerHover(r: number, c: number) {
    pickerRows = r;
    pickerCols = c;
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="toolbar-buttons" role="toolbar" aria-label={t().editor.toolbarLabel}>
  <!-- Insert dropdown — discoverable entry point for everything the "/" menu offers -->
  <button
    bind:this={insertBtnEl}
    class="toolbar-insert-btn"
    class:active={showInsertMenu}
    onclick={toggleInsertMenu}
    title={t().editor.toolbarInsert}
    aria-label={t().editor.toolbarInsert}
    aria-haspopup="true"
    aria-expanded={showInsertMenu}
  >
    +
  </button>

  <div class="separator" role="separator"></div>

  <button
    class:active={editor.isActive('bold')}
    onclick={() => editor.chain().focus().toggleBold().run()}
    title={t().editor.toolbarBold}
    aria-label={t().editor.toolbarBoldAria}
    aria-pressed={editor.isActive('bold')}
  >
    <strong>B</strong>
  </button>

  <button
    class:active={editor.isActive('italic')}
    onclick={() => editor.chain().focus().toggleItalic().run()}
    title={t().editor.toolbarItalic}
    aria-label={t().editor.toolbarItalicAria}
    aria-pressed={editor.isActive('italic')}
  >
    <em>I</em>
  </button>

  <button
    class:active={editor.isActive('strike')}
    onclick={() => editor.chain().focus().toggleStrike().run()}
    title={t().editor.toolbarStrike}
    aria-label={t().editor.toolbarStrikeAria}
    aria-pressed={editor.isActive('strike')}
  >
    <s>S</s>
  </button>

  <button
    class:active={editor.isActive('code')}
    onclick={() => editor.chain().focus().toggleCode().run()}
    title={t().editor.toolbarInlineCode}
    aria-label={t().editor.toolbarInlineCodeAria}
    aria-pressed={editor.isActive('code')}
  >
    &lt;/&gt;
  </button>

  <button
    class:active={editor.isActive('link')}
    onclick={setLink}
    title={t().editor.toolbarLink}
    aria-label={t().editor.toolbarLinkAria}
    aria-pressed={editor.isActive('link')}
  >
    &#128279;
  </button>

  <button
    class:active={editor.isActive('underline')}
    onclick={() => editor.chain().focus().toggleMark('underline').run()}
    title={t().editor.toolbarUnderline}
    aria-label={t().editor.toolbarUnderlineAria}
    aria-pressed={editor.isActive('underline')}
  >
    <u>U</u>
  </button>

  <!-- Text color picker -->
  <button
    bind:this={textColorBtnEl}
    class:active={editor.isActive('textColor')}
    onclick={openTextColorPicker}
    title={t().editor.toolbarTextColor}
    aria-label={t().editor.toolbarTextColorAria}
    aria-expanded={showTextColorPicker}
    aria-haspopup="true"
  >
    <span class="color-btn-label">A</span>
    <span class="color-btn-bar" style="background: {editor.getAttributes('textColor').color ? editor.getAttributes('textColor').color : '#e74c3c'}"></span>
  </button>

  <!-- Highlight picker -->
  <button
    bind:this={highlightBtnEl}
    class:active={editor.isActive('highlight')}
    onclick={openHighlightPicker}
    title={t().editor.toolbarHighlight}
    aria-label={t().editor.toolbarHighlightAria}
    aria-expanded={showHighlightPicker}
    aria-haspopup="true"
  >
    <span class="highlight-btn-label">H</span>
    <span class="color-btn-bar" style="background: #f1c40f"></span>
  </button>

  <div class="separator" role="separator"></div>

  <button
    class:active={editor.isActive('heading', { level: 1 })}
    onclick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
    title={t().editor.toolbarHeading1}
    aria-label={t().editor.toolbarHeading1Aria}
    aria-pressed={editor.isActive('heading', { level: 1 })}
  >
    H1
  </button>

  <button
    class:active={editor.isActive('heading', { level: 2 })}
    onclick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
    title={t().editor.toolbarHeading2}
    aria-label={t().editor.toolbarHeading2Aria}
    aria-pressed={editor.isActive('heading', { level: 2 })}
  >
    H2
  </button>

  <button
    class:active={editor.isActive('heading', { level: 3 })}
    onclick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
    title={t().editor.toolbarHeading3}
    aria-label={t().editor.toolbarHeading3Aria}
    aria-pressed={editor.isActive('heading', { level: 3 })}
  >
    H3
  </button>

  <div class="separator" role="separator"></div>

  <button
    class:active={editor.isActive('bulletList')}
    onclick={() => editor.chain().focus().toggleBulletList().run()}
    title={t().editor.toolbarBulletList}
    aria-label={t().editor.toolbarBulletListAria}
    aria-pressed={editor.isActive('bulletList')}
  >
    &bull;
  </button>

  <button
    class:active={editor.isActive('orderedList')}
    onclick={() => editor.chain().focus().toggleOrderedList().run()}
    title={t().editor.toolbarOrderedList}
    aria-label={t().editor.toolbarOrderedListAria}
    aria-pressed={editor.isActive('orderedList')}
  >
    1.
  </button>

  <button
    class:active={editor.isActive('blockquote')}
    onclick={() => editor.chain().focus().toggleBlockquote().run()}
    title={t().editor.toolbarQuote}
    aria-label={t().editor.toolbarQuoteAria}
    aria-pressed={editor.isActive('blockquote')}
  >
    &ldquo;
  </button>

  <button
    class:active={editor.isActive('codeBlock')}
    onclick={() => editor.chain().focus().toggleCodeBlock().run()}
    title={t().editor.toolbarCodeBlock}
    aria-label={t().editor.toolbarCodeBlockAria}
    aria-pressed={editor.isActive('codeBlock')}
  >
    &#123; &#125;
  </button>

  <button
    class:active={editor.isActive('superscript')}
    onclick={() => editor.chain().focus().toggleMark('superscript').run()}
    title={t().editor.toolbarSuperscript}
    aria-label={t().editor.toolbarSuperscriptAria}
    aria-pressed={editor.isActive('superscript')}
  >
    x<sup>2</sup>
  </button>

  <button
    class:active={editor.isActive('subscript')}
    onclick={() => editor.chain().focus().toggleMark('subscript').run()}
    title={t().editor.toolbarSubscript}
    aria-label={t().editor.toolbarSubscriptAria}
    aria-pressed={editor.isActive('subscript')}
  >
    x<sub>2</sub>
  </button>

  <button
    class:active={editor.isActive('smallcaps')}
    onclick={() => editor.chain().focus().toggleMark('smallcaps').run()}
    title={t().editor.toolbarSmallCaps}
    aria-label={t().editor.toolbarSmallCapsAria}
    aria-pressed={editor.isActive('smallcaps')}
  >
    <span style="font-variant: small-caps; font-size: 0.85em">Sc</span>
  </button>

  <button
    onclick={() => insertFootnoteWithEditor(editor)}
    title={t().editor.toolbarFootnote}
    aria-label={t().editor.toolbarFootnoteAria}
  >
    <span style="font-size: 0.9em">Fn</span>
  </button>

  <button
    onclick={() => window.dispatchEvent(new CustomEvent('penwright:add-comment'))}
    title={t().editor.toolbarComment}
    aria-label={t().editor.toolbarCommentAria}
  >
    <span style="font-size: 0.9em">Cm</span>
  </button>

  <div class="separator" role="separator"></div>

  <button
    class:active={editor.isActive({ textAlign: 'left' })}
    onclick={() => editor.chain().focus().setTextAlign('left').run()}
    title={t().editor.toolbarAlignLeft}
    aria-label={t().editor.toolbarAlignLeftAria}
    aria-pressed={editor.isActive({ textAlign: 'left' })}
  >
    <span class="align-icon align-left"></span>
  </button>

  <button
    class:active={editor.isActive({ textAlign: 'center' })}
    onclick={() => editor.chain().focus().setTextAlign('center').run()}
    title={t().editor.toolbarAlignCenter}
    aria-label={t().editor.toolbarAlignCenterAria}
    aria-pressed={editor.isActive({ textAlign: 'center' })}
  >
    <span class="align-icon align-center"></span>
  </button>

  <button
    class:active={editor.isActive({ textAlign: 'right' })}
    onclick={() => editor.chain().focus().setTextAlign('right').run()}
    title={t().editor.toolbarAlignRight}
    aria-label={t().editor.toolbarAlignRightAria}
    aria-pressed={editor.isActive({ textAlign: 'right' })}
  >
    <span class="align-icon align-right"></span>
  </button>

  <button
    class:active={editor.isActive({ textAlign: 'justify' })}
    onclick={() => editor.chain().focus().setTextAlign('justify').run()}
    title={t().editor.toolbarJustify}
    aria-label={t().editor.toolbarJustifyAria}
    aria-pressed={editor.isActive({ textAlign: 'justify' })}
  >
    <span class="align-icon align-justify"></span>
  </button>

  <div class="separator" role="separator"></div>

  <!-- Table insert -->
  <div class="table-btn-group">
    <button
      class:active={editor.isActive('table')}
      onclick={() => {
        if (editor.isActive('table')) {
          // Already in table — don't show picker, just highlight
        } else {
          showTablePicker = !showTablePicker;
        }
      }}
      title={t().editor.toolbarInsertTable}
      aria-label={t().editor.toolbarInsertTableAria}
      aria-expanded={showTablePicker}
      aria-haspopup="true"
    >
      &#9638;
    </button>

    {#if showTablePicker}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="table-picker-backdrop" onclick={() => (showTablePicker = false)} role="presentation"></div>
      <div class="table-picker">
        <div class="table-picker-label">
          {pickerRows > 0 ? `${pickerRows} x ${pickerCols}` : t().editor.toolbarTablePickerSize}
        </div>
        <div class="table-picker-grid">
          {#each Array(6) as _, r}
            {#each Array(6) as _, c}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="table-picker-cell"
                class:active={r < pickerRows && c < pickerCols}
                onmouseenter={() => handlePickerHover(r + 1, c + 1)}
                onmousedown={(e) => { e.preventDefault(); insertTable(r + 1, c + 1); }}
                role="button"
                tabindex="-1"
              ></div>
            {/each}
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <button
    onclick={() => editor.chain().focus().setHorizontalRule().run()}
    title={t().editor.toolbarHorizontalRule}
    aria-label={t().editor.toolbarHorizontalRuleAria}
  >
    &mdash;
  </button>

  <div class="separator" role="separator"></div>

  <button
    onclick={() => editor.chain().focus().undo().run()}
    disabled={!editor.can().undo()}
    title={t().editor.toolbarUndo}
    aria-label={t().editor.toolbarUndoAria}
  >
    &#8617;
  </button>

  <button
    onclick={() => editor.chain().focus().redo().run()}
    disabled={!editor.can().redo()}
    title={t().editor.toolbarRedo}
    aria-label={t().editor.toolbarRedoAria}
  >
    &#8618;
  </button>
</div>

{#if showInsertMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="insert-menu-backdrop" onclick={() => (showInsertMenu = false)} role="presentation"></div>
  <div class="insert-menu" style={insertMenuStyle} role="menu">
    {#each insertGroups as group}
      {#if group.items.length}
        <div class="insert-menu-group-label">{group.label}</div>
        {#each group.items as item}
          <button class="insert-menu-item" role="menuitem" onclick={() => runInsert(item)}>
            <span class="slash-menu-icon">{item.icon}</span>
            <span class="slash-menu-text">
              <span class="slash-menu-title">{item.title}</span>
              <span class="slash-menu-desc">{item.description}</span>
            </span>
          </button>
        {/each}
      {/if}
    {/each}
  </div>
{/if}

{#if showTextColorPicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="color-picker-backdrop" onclick={() => (showTextColorPicker = false)} role="presentation"></div>
  <div class="color-picker-dropdown" style={colorPickerStyle}>
    {#each colorOptions as co}
      <button
        class="color-swatch"
        style="background: {co.css}"
        title={co.label}
        onmousedown={(e) => { e.preventDefault(); applyTextColor(co.value); }}
      ></button>
    {/each}
    <button class="color-remove" onmousedown={(e) => { e.preventDefault(); removeTextColor(); }}>
      {t().common.remove}
    </button>
  </div>
{/if}

{#if showHighlightPicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="color-picker-backdrop" onclick={() => (showHighlightPicker = false)} role="presentation"></div>
  <div class="color-picker-dropdown" style={highlightPickerStyle}>
    {#each highlightOptions as ho}
      <button
        class="color-swatch"
        style="background: {ho.css}"
        title={ho.label}
        onmousedown={(e) => { e.preventDefault(); applyHighlight(ho.value); }}
      ></button>
    {/each}
    <button class="color-remove" onmousedown={(e) => { e.preventDefault(); removeHighlight(); }}>
      {t().common.remove}
    </button>
  </div>
{/if}
