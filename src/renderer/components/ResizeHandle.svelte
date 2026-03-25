<script lang="ts">
  let {
    orientation = 'vertical',
    onResize,
  }: {
    orientation: 'vertical' | 'horizontal';
    onResize: (delta: number) => void;
  } = $props();

  let dragging = $state(false);

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    dragging = true;
    const startPos = orientation === 'vertical' ? e.clientX : e.clientY;

    function onMouseMove(e: MouseEvent) {
      const currentPos = orientation === 'vertical' ? e.clientX : e.clientY;
      onResize(currentPos - startPos);
    }

    function onMouseUp() {
      dragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="resize-handle {orientation}"
  class:dragging
  onmousedown={onMouseDown}
></div>

<style>
  .resize-handle {
    flex-shrink: 0;
    background: transparent;
    z-index: 10;
    transition: background 0.15s;
  }

  .resize-handle.vertical {
    width: 4px;
    cursor: col-resize;
  }

  .resize-handle.horizontal {
    height: 4px;
    cursor: row-resize;
  }

  .resize-handle:hover,
  .resize-handle.dragging {
    background: var(--accent, #0066cc);
  }
</style>
