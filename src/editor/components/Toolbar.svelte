<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { insertFootnoteWithEditor } from '../lib/typstFootnote';

  let { editor }: { editor: Editor } = $props();

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

  const colorOptions = [
    { label: 'Red', value: 'red', css: '#e74c3c' },
    { label: 'Blue', value: 'blue', css: '#3498db' },
    { label: 'Green', value: 'green', css: '#27ae60' },
    { label: 'Orange', value: 'orange', css: '#e67e22' },
    { label: 'Purple', value: 'purple', css: '#9b59b6' },
    { label: 'Navy', value: 'navy', css: '#2c3e50' },
    { label: 'Gray', value: 'gray', css: '#7f8c8d' },
  ];

  const highlightOptions = [
    { label: 'Yellow', value: 'yellow', css: '#f1c40f' },
    { label: 'Green', value: 'green', css: '#2ecc71' },
    { label: 'Blue', value: 'blue', css: '#3498db' },
    { label: 'Pink', value: 'rgb("#FFD1DC")', css: '#FFD1DC' },
    { label: 'Orange', value: 'orange', css: '#e67e22' },
    { label: 'Purple', value: 'purple', css: '#9b59b6' },
  ];

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
    const url = window.prompt('URL:', previousUrl || 'https://');
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

<div class="toolbar-buttons" role="toolbar" aria-label="Formatting toolbar">
  <button
    class:active={editor.isActive('bold')}
    onclick={() => editor.chain().focus().toggleBold().run()}
    title="Bold (Cmd+B)"
    aria-label="Bold"
    aria-pressed={editor.isActive('bold')}
  >
    <strong>B</strong>
  </button>

  <button
    class:active={editor.isActive('italic')}
    onclick={() => editor.chain().focus().toggleItalic().run()}
    title="Italic (Cmd+I)"
    aria-label="Italic"
    aria-pressed={editor.isActive('italic')}
  >
    <em>I</em>
  </button>

  <button
    class:active={editor.isActive('strike')}
    onclick={() => editor.chain().focus().toggleStrike().run()}
    title="Strikethrough (Cmd+Shift+X)"
    aria-label="Strikethrough"
    aria-pressed={editor.isActive('strike')}
  >
    <s>S</s>
  </button>

  <button
    class:active={editor.isActive('code')}
    onclick={() => editor.chain().focus().toggleCode().run()}
    title="Inline Code (Cmd+E)"
    aria-label="Inline code"
    aria-pressed={editor.isActive('code')}
  >
    &lt;/&gt;
  </button>

  <button
    class:active={editor.isActive('link')}
    onclick={setLink}
    title="Link (Cmd+K)"
    aria-label="Insert link"
    aria-pressed={editor.isActive('link')}
  >
    &#128279;
  </button>

  <button
    class:active={editor.isActive('underline')}
    onclick={() => editor.chain().focus().toggleMark('underline').run()}
    title="Underline (Cmd+U)"
    aria-label="Underline"
    aria-pressed={editor.isActive('underline')}
  >
    <u>U</u>
  </button>

  <!-- Text color picker -->
  <button
    bind:this={textColorBtnEl}
    class:active={editor.isActive('textColor')}
    onclick={openTextColorPicker}
    title="Text Color"
    aria-label="Text color"
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
    title="Highlight"
    aria-label="Highlight text"
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
    title="Heading 1 (Cmd+Alt+1)"
    aria-label="Heading 1"
    aria-pressed={editor.isActive('heading', { level: 1 })}
  >
    H1
  </button>

  <button
    class:active={editor.isActive('heading', { level: 2 })}
    onclick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
    title="Heading 2 (Cmd+Alt+2)"
    aria-label="Heading 2"
    aria-pressed={editor.isActive('heading', { level: 2 })}
  >
    H2
  </button>

  <button
    class:active={editor.isActive('heading', { level: 3 })}
    onclick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
    title="Heading 3 (Cmd+Alt+3)"
    aria-label="Heading 3"
    aria-pressed={editor.isActive('heading', { level: 3 })}
  >
    H3
  </button>

  <div class="separator" role="separator"></div>

  <button
    class:active={editor.isActive('bulletList')}
    onclick={() => editor.chain().focus().toggleBulletList().run()}
    title="Bullet List (Cmd+Shift+8)"
    aria-label="Bullet list"
    aria-pressed={editor.isActive('bulletList')}
  >
    &bull;
  </button>

  <button
    class:active={editor.isActive('orderedList')}
    onclick={() => editor.chain().focus().toggleOrderedList().run()}
    title="Ordered List (Cmd+Shift+7)"
    aria-label="Ordered list"
    aria-pressed={editor.isActive('orderedList')}
  >
    1.
  </button>

  <button
    class:active={editor.isActive('blockquote')}
    onclick={() => editor.chain().focus().toggleBlockquote().run()}
    title="Quote (Cmd+Shift+B)"
    aria-label="Block quote"
    aria-pressed={editor.isActive('blockquote')}
  >
    &ldquo;
  </button>

  <button
    class:active={editor.isActive('codeBlock')}
    onclick={() => editor.chain().focus().toggleCodeBlock().run()}
    title="Code Block (Cmd+Alt+C)"
    aria-label="Code block"
    aria-pressed={editor.isActive('codeBlock')}
  >
    &#123; &#125;
  </button>

  <button
    class:active={editor.isActive('superscript')}
    onclick={() => editor.chain().focus().toggleMark('superscript').run()}
    title="Superscript"
    aria-label="Superscript"
    aria-pressed={editor.isActive('superscript')}
  >
    x<sup>2</sup>
  </button>

  <button
    class:active={editor.isActive('subscript')}
    onclick={() => editor.chain().focus().toggleMark('subscript').run()}
    title="Subscript"
    aria-label="Subscript"
    aria-pressed={editor.isActive('subscript')}
  >
    x<sub>2</sub>
  </button>

  <button
    class:active={editor.isActive('smallcaps')}
    onclick={() => editor.chain().focus().toggleMark('smallcaps').run()}
    title="Small Caps"
    aria-label="Small caps"
    aria-pressed={editor.isActive('smallcaps')}
  >
    <span style="font-variant: small-caps; font-size: 0.85em">Sc</span>
  </button>

  <button
    onclick={() => insertFootnoteWithEditor(editor)}
    title="Footnote"
    aria-label="Insert footnote"
  >
    <span style="font-size: 0.9em">Fn</span>
  </button>

  <button
    onclick={() => window.dispatchEvent(new CustomEvent('vswrite:add-comment'))}
    title="Comment hinzufügen"
    aria-label="Add comment to selection"
  >
    <span style="font-size: 0.9em">Cm</span>
  </button>

  <div class="separator" role="separator"></div>

  <button
    class:active={editor.isActive({ textAlign: 'left' })}
    onclick={() => editor.chain().focus().setTextAlign('left').run()}
    title="Align Left (Cmd+Shift+L)"
    aria-label="Align left"
    aria-pressed={editor.isActive({ textAlign: 'left' })}
  >
    <span class="align-icon align-left"></span>
  </button>

  <button
    class:active={editor.isActive({ textAlign: 'center' })}
    onclick={() => editor.chain().focus().setTextAlign('center').run()}
    title="Align Center (Cmd+Shift+E)"
    aria-label="Align center"
    aria-pressed={editor.isActive({ textAlign: 'center' })}
  >
    <span class="align-icon align-center"></span>
  </button>

  <button
    class:active={editor.isActive({ textAlign: 'right' })}
    onclick={() => editor.chain().focus().setTextAlign('right').run()}
    title="Align Right (Cmd+Shift+R)"
    aria-label="Align right"
    aria-pressed={editor.isActive({ textAlign: 'right' })}
  >
    <span class="align-icon align-right"></span>
  </button>

  <button
    class:active={editor.isActive({ textAlign: 'justify' })}
    onclick={() => editor.chain().focus().setTextAlign('justify').run()}
    title="Justify (Cmd+Shift+J)"
    aria-label="Justify"
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
      title="Insert Table"
      aria-label="Insert table"
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
          {pickerRows > 0 ? `${pickerRows} x ${pickerCols}` : 'Select size'}
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
    title="Horizontal Rule"
    aria-label="Insert horizontal rule"
  >
    &mdash;
  </button>

  <div class="separator" role="separator"></div>

  <button
    onclick={() => editor.chain().focus().undo().run()}
    disabled={!editor.can().undo()}
    title="Undo (Cmd+Z)"
    aria-label="Undo"
  >
    &#8617;
  </button>

  <button
    onclick={() => editor.chain().focus().redo().run()}
    disabled={!editor.can().redo()}
    title="Redo (Cmd+Shift+Z)"
    aria-label="Redo"
  >
    &#8618;
  </button>
</div>

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
      Remove
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
      Remove
    </button>
  </div>
{/if}
