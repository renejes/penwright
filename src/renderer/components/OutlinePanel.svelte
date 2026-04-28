<script lang="ts">
  import type { Editor } from '@tiptap/core';

  let {
    editor,
    editorVersion = 0,
  }: {
    editor: Editor | null;
    editorVersion: number;
  } = $props();

  interface HeadingEntry {
    level: number;
    title: string;
    pos: number;       // pos right before the heading node (PM block boundary)
    nodeSize: number;  // size of the heading node itself
  }

  let headings: HeadingEntry[] = $derived.by(() => {
    void editorVersion;
    if (!editor) return [];
    const result: HeadingEntry[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        result.push({
          level: node.attrs.level as number,
          title: node.textContent.trim() || '(untitled)',
          pos,
          nodeSize: node.nodeSize,
        });
      }
    });
    return result;
  });

  // Drag state. dragSource is the index of the heading being moved.
  // dropIndex is the index in the headings array where the moved block
  // should be inserted ABOVE — `headings.length` means "at the end".
  let dragSource = $state<number | null>(null);
  let dropIndex = $state<number | null>(null);

  function scrollTo(heading: HeadingEntry) {
    if (!editor) return;
    editor.commands.setTextSelection(heading.pos + 1);
    const domNode = editor.view.domAtPos(heading.pos + 1);
    if (domNode.node) {
      const el = domNode.node instanceof HTMLElement
        ? domNode.node
        : domNode.node.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    editor.commands.focus();
  }

  function findBacklinks(heading: HeadingEntry, e: MouseEvent) {
    e.stopPropagation();
    if (!heading.title || heading.title === '(untitled)') return;
    window.dispatchEvent(new CustomEvent('vswrite:find-backlinks', {
      detail: { query: heading.title, wholeWord: false, caseSensitive: false },
    }));
  }

  // Range of the heading "block" — from the heading itself up to (but not
  // including) the next heading at the SAME or HIGHER level (i.e. lower
  // numerical level value). Anything in between belongs to this section
  // and travels with it on a move.
  function blockRange(i: number): { from: number; to: number } | null {
    const h = headings[i];
    if (!h || !editor) return null;
    const docSize = editor.state.doc.content.size;
    let to = docSize;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) {
        to = headings[j].pos;
        break;
      }
    }
    return { from: h.pos, to };
  }

  function onDragStart(i: number, e: DragEvent) {
    if (!e.dataTransfer) return;
    dragSource = i;
    e.dataTransfer.effectAllowed = 'move';
    // Required for some browsers to start the drag
    try {
      e.dataTransfer.setData('text/plain', `outline:${i}`);
    } catch {
      // ignore — dataTransfer setup not strictly needed in Electron
    }
  }

  function onRowDragOver(targetIdx: number, e: DragEvent) {
    if (dragSource == null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const row = e.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Top half of the row → insert above. Bottom half → insert below.
    const insertBelow = y > rect.height / 2;
    dropIndex = insertBelow ? targetIdx + 1 : targetIdx;
  }

  function onListDragLeave(e: DragEvent) {
    // Only clear if we're really leaving the list (not entering a child row)
    const related = e.relatedTarget as Node | null;
    if (!related || !(e.currentTarget as Node).contains(related)) {
      dropIndex = null;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const src = dragSource;
    const dst = dropIndex;
    dragSource = null;
    dropIndex = null;
    if (src == null || dst == null || !editor) return;

    // No-op cases: dropping where the block already is.
    // src maps to (src, src+1) in the headings array; dropping at src or
    // src+1 leaves the block unchanged.
    if (dst === src || dst === src + 1) return;

    const range = blockRange(src);
    if (!range) return;
    const { from, to } = range;

    // Target position in the document (insertion point at a block boundary).
    const docSize = editor.state.doc.content.size;
    const target = dst >= headings.length ? docSize : headings[dst].pos;

    // Reject drops that fall inside the source range — would move-into-self.
    if (target > from && target < to) return;

    const slice = editor.state.doc.slice(from, to);
    const tr = editor.state.tr;
    tr.delete(from, to);
    // After the delete, anything past `to` shifts left by (to - from).
    let adjTarget = target;
    if (target >= to) adjTarget -= (to - from);
    tr.replace(adjTarget, adjTarget, slice);
    editor.view.dispatch(tr);

    // Scroll the moved heading into view so the user sees the result.
    requestAnimationFrame(() => {
      try {
        const domNode = editor.view.domAtPos(adjTarget + 1);
        if (domNode.node) {
          const el = domNode.node instanceof HTMLElement
            ? domNode.node
            : domNode.node.parentElement;
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        /* heading may have been re-rendered already */
      }
    });
  }

  function onDragEnd() {
    dragSource = null;
    dropIndex = null;
  }
</script>

<div class="outline">
  {#if headings.length === 0}
    <div class="outline-empty">No headings</div>
  {:else}
    <div class="outline-label">Outline</div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <ul
      class="outline-list"
      ondragleave={onListDragLeave}
      ondragover={(e) => {
        if (dragSource != null) {
          e.preventDefault();
          // Default drop target = end of list, in case no row dragover fired
          if (dropIndex == null) dropIndex = headings.length;
        }
      }}
      ondrop={onDrop}
    >
      {#each headings as heading, i}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <li
          class="outline-row"
          class:dragging={dragSource === i}
          class:drop-above={dropIndex === i}
          draggable="true"
          ondragstart={(e) => onDragStart(i, e)}
          ondragover={(e) => onRowDragOver(i, e)}
          ondragend={onDragEnd}
        >
          <button
            class="outline-item level-{heading.level}"
            onclick={() => scrollTo(heading)}
          >
            {heading.title}
          </button>
          <button
            class="outline-backlinks"
            onclick={(e) => findBacklinks(heading, e)}
            title="Find references to this heading"
            aria-label="Find references to {heading.title}"
          >
            &#x21AA;
          </button>
        </li>
      {/each}
      <li
        class="outline-end"
        class:drop-above={dropIndex === headings.length}
        aria-hidden="true"
      ></li>
    </ul>
  {/if}
</div>

<style>
  .outline {
    padding: 8px 0;
    overflow-y: auto;
    height: 100%;
  }

  .outline-label {
    padding: 4px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #bbb;
  }

  .outline-empty {
    padding: 24px 16px;
    color: #ccc;
    font-size: 13px;
    text-align: center;
  }

  .outline-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .outline-row {
    display: flex;
    align-items: stretch;
    position: relative;
  }
  .outline-row:hover .outline-backlinks {
    opacity: 1;
  }

  .outline-row.dragging {
    opacity: 0.4;
  }

  .outline-row.drop-above::before,
  .outline-end.drop-above::before {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    top: -1px;
    height: 2px;
    background: #4f7df9;
    border-radius: 1px;
    pointer-events: none;
  }

  .outline-end {
    height: 4px;
    position: relative;
  }

  .outline-item {
    flex: 1;
    min-width: 0;
    padding: 4px 16px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.5;
    border-radius: 0;
    transition: all 0.1s;
    border-left: 2px solid transparent;
  }

  .outline-item:hover {
    background: rgba(0, 0, 0, 0.03);
    color: #333;
  }

  .outline-backlinks {
    flex-shrink: 0;
    width: 22px;
    border: none;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 12px;
    opacity: 0;
    transition: all 0.15s;
    padding: 0;
  }
  .outline-backlinks:hover {
    color: #4f7df9;
    background: rgba(79, 125, 249, 0.08);
  }

  .outline-item.level-1 {
    font-weight: 600;
    color: #333;
    padding-left: 16px;
    font-size: 13px;
  }

  .outline-item.level-2 {
    padding-left: 28px;
    color: #555;
  }

  .outline-item.level-3 {
    padding-left: 40px;
    font-size: 12px;
    color: #888;
  }

  .outline-item.level-4,
  .outline-item.level-5,
  .outline-item.level-6 {
    padding-left: 52px;
    font-size: 12px;
    color: #aaa;
  }

  .outline-item:hover {
    border-left-color: #4f7df9;
  }
</style>
