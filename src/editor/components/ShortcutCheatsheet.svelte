<script lang="ts">
  let { onClose }: { onClose: () => void } = $props();

  interface ShortcutEntry {
    action: string;
    shortcut: string;
  }

  interface ShortcutGroup {
    title: string;
    entries: ShortcutEntry[];
  }

  const groups: ShortcutGroup[] = [
    {
      title: 'Formatting',
      entries: [
        { action: 'Bold', shortcut: 'Cmd+B' },
        { action: 'Italic', shortcut: 'Cmd+I' },
        { action: 'Strikethrough', shortcut: 'Cmd+Shift+X' },
        { action: 'Inline Code', shortcut: 'Cmd+E' },
        { action: 'Link', shortcut: 'Cmd+K' },
      ],
    },
    {
      title: 'Blocks',
      entries: [
        { action: 'Heading 1', shortcut: 'Cmd+Alt+1' },
        { action: 'Heading 2', shortcut: 'Cmd+Alt+2' },
        { action: 'Heading 3', shortcut: 'Cmd+Alt+3' },
        { action: 'Bullet List', shortcut: 'Cmd+Shift+8' },
        { action: 'Numbered List', shortcut: 'Cmd+Shift+7' },
        { action: 'Quote', shortcut: 'Cmd+Shift+B' },
        { action: 'Code Block', shortcut: 'Cmd+Alt+C' },
      ],
    },
    {
      title: 'General',
      entries: [
        { action: 'Undo', shortcut: 'Cmd+Z' },
        { action: 'Redo', shortcut: 'Cmd+Shift+Z' },
        { action: 'Slash Commands', shortcut: '/' },
      ],
    },
  ];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="shortcut-overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="shortcut-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <div class="shortcut-header">
      <h2>Keyboard Shortcuts</h2>
      <button class="shortcut-close" onclick={onClose}>&times;</button>
    </div>
    <div class="shortcut-body">
      {#each groups as group}
        <div class="shortcut-group">
          <h3>{group.title}</h3>
          {#each group.entries as entry}
            <div class="shortcut-row">
              <span class="shortcut-action">{entry.action}</span>
              <span class="shortcut-keys">{entry.shortcut}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
