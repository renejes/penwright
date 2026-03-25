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
    pos: number;
  }

  let headings: HeadingEntry[] = $derived.by(() => {
    const _ = editorVersion;
    if (!editor) return [];
    const result: HeadingEntry[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        result.push({
          level: node.attrs.level as number,
          title: node.textContent.trim() || '(untitled)',
          pos,
        });
      }
    });
    return result;
  });

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
</script>

<div class="outline">
  {#if headings.length === 0}
    <div class="outline-empty">No headings</div>
  {:else}
    <div class="outline-label">Outline</div>
    <ul class="outline-list">
      {#each headings as heading}
        <li>
          <button
            class="outline-item level-{heading.level}"
            onclick={() => scrollTo(heading)}
          >
            {heading.title}
          </button>
        </li>
      {/each}
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

  .outline-item {
    display: block;
    width: 100%;
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
