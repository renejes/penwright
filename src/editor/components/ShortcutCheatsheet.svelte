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

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const mod = isMac ? 'Cmd' : 'Ctrl';
  const alt = isMac ? 'Alt' : 'Alt';

  const groups: ShortcutGroup[] = [
    {
      title: 'Project & Files',
      entries: [
        { action: 'New Project', shortcut: `${mod}+N` },
        { action: 'Open Project', shortcut: `${mod}+O` },
        { action: 'Close Project', shortcut: `${mod}+Shift+W` },
        { action: 'Save', shortcut: `${mod}+S` },
        { action: 'Save As', shortcut: `${mod}+Shift+S` },
      ],
    },
    {
      title: 'Search',
      entries: [
        { action: 'Find in Current File', shortcut: `${mod}+F` },
        { action: 'Find & Replace (Current File)', shortcut: `${mod}+H` },
        { action: 'Find in Project', shortcut: `${mod}+Shift+F` },
      ],
    },
    {
      title: 'Writer Features',
      entries: [
        { action: 'Add Comment', shortcut: `${mod}+${alt}+M` },
        { action: 'Insert Cross-Reference', shortcut: `${mod}+${alt}+L` },
        { action: 'Reading Mode', shortcut: `${mod}+${alt}+R` },
      ],
    },
    {
      title: 'Formatting',
      entries: [
        { action: 'Bold', shortcut: `${mod}+B` },
        { action: 'Italic', shortcut: `${mod}+I` },
        { action: 'Strikethrough', shortcut: `${mod}+Shift+X` },
        { action: 'Inline Code', shortcut: `${mod}+E` },
        { action: 'Link', shortcut: `${mod}+K` },
      ],
    },
    {
      title: 'Blocks',
      entries: [
        { action: 'Heading 1 / 2 / 3', shortcut: `${mod}+${alt}+1 / 2 / 3` },
        { action: 'Bullet List', shortcut: `${mod}+Shift+8` },
        { action: 'Numbered List', shortcut: `${mod}+Shift+7` },
        { action: 'Code Block', shortcut: `${mod}+${alt}+C` },
      ],
    },
    {
      title: 'View',
      entries: [
        { action: 'Toggle Sidebar', shortcut: `${mod}+B` },
        { action: 'Toggle Preview', shortcut: `${mod}+Shift+P` },
        { action: 'Toggle Terminal', shortcut: `${mod}+\`` },
        { action: 'Exit Focus Mode', shortcut: 'Esc' },
      ],
    },
    {
      title: 'General',
      entries: [
        { action: 'Undo', shortcut: `${mod}+Z` },
        { action: 'Redo', shortcut: `${mod}+Shift+Z` },
        { action: 'Slash Commands', shortcut: '/' },
        { action: 'Citation Autocomplete', shortcut: '@' },
        { action: 'This Cheat Sheet', shortcut: `${mod}+/` },
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
