<script lang="ts">
  import { t } from '@shared/i18n/store.svelte';

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

  const groups: ShortcutGroup[] = $derived([
    {
      title: t().editor.shortcutsGroupProject,
      entries: [
        { action: t().editor.shortcutNewProject, shortcut: `${mod}+N` },
        { action: t().editor.shortcutOpenProject, shortcut: `${mod}+O` },
        { action: t().editor.shortcutCloseProject, shortcut: `${mod}+Shift+W` },
        { action: t().editor.shortcutSave, shortcut: `${mod}+S` },
        { action: t().editor.shortcutSaveAs, shortcut: `${mod}+Shift+S` },
      ],
    },
    {
      title: t().editor.shortcutsGroupSearch,
      entries: [
        { action: t().editor.shortcutFindInFile, shortcut: `${mod}+F` },
        { action: t().editor.shortcutFindReplaceFile, shortcut: `${mod}+H` },
        { action: t().editor.shortcutFindInProject, shortcut: `${mod}+Shift+F` },
      ],
    },
    {
      title: t().editor.shortcutsGroupWriter,
      entries: [
        { action: t().editor.shortcutAddComment, shortcut: `${mod}+${alt}+M` },
        { action: t().editor.shortcutInsertCrossRef, shortcut: `${mod}+${alt}+L` },
      ],
    },
    {
      title: t().editor.shortcutsGroupFormatting,
      entries: [
        { action: t().editor.shortcutBold, shortcut: `${mod}+B` },
        { action: t().editor.shortcutItalic, shortcut: `${mod}+I` },
        { action: t().editor.shortcutStrikethrough, shortcut: `${mod}+Shift+X` },
        { action: t().editor.shortcutInlineCode, shortcut: `${mod}+E` },
        { action: t().editor.shortcutLink, shortcut: `${mod}+K` },
      ],
    },
    {
      title: t().editor.shortcutsGroupBlocks,
      entries: [
        { action: t().editor.shortcutHeadings, shortcut: `${mod}+${alt}+1 / 2 / 3` },
        { action: t().editor.shortcutBulletList, shortcut: `${mod}+Shift+8` },
        { action: t().editor.shortcutNumberedList, shortcut: `${mod}+Shift+7` },
        { action: t().editor.shortcutCodeBlock, shortcut: `${mod}+${alt}+C` },
      ],
    },
    {
      title: t().editor.shortcutsGroupView,
      entries: [
        { action: t().editor.shortcutToggleSidebar, shortcut: `${mod}+B` },
        { action: t().editor.shortcutTogglePreview, shortcut: `${mod}+Shift+P` },
      ],
    },
    {
      title: t().editor.shortcutsGroupZoom,
      entries: [
        { action: t().editor.shortcutEditorZoom, shortcut: `${mod}+${alt}+= / − / 0` },
        { action: t().editor.shortcutPreviewZoom, shortcut: `${mod}+Shift+= / − / 0` },
      ],
    },
    {
      title: t().editor.shortcutsGroupGeneral,
      entries: [
        { action: t().editor.shortcutUndo, shortcut: `${mod}+Z` },
        { action: t().editor.shortcutRedo, shortcut: `${mod}+Shift+Z` },
        { action: t().editor.shortcutSlashCommands, shortcut: '/' },
        { action: t().editor.shortcutCitationAutocomplete, shortcut: '@' },
        { action: t().editor.shortcutCheatSheet, shortcut: `${mod}+/` },
      ],
    },
  ]);

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
      <h2>{t().editor.shortcutsTitle}</h2>
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
