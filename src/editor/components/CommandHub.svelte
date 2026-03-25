<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import type { VsCodeApi, WebviewMessage } from '../lib/messages';

  let {
    editor,
    vscode,
    onShowShortcuts,
    onShowSettings,
    onToggleFocusMode,
    onToggleTypewriterMode,
    onShowSearch,
  }: {
    editor: Editor;
    vscode: VsCodeApi;
    onShowShortcuts: () => void;
    onShowSettings: () => void;
    onToggleFocusMode: () => void;
    onToggleTypewriterMode: () => void;
    onShowSearch: () => void;
  } = $props();

  let open = $state(false);
  let activeSubmenu = $state<string | null>(null);
  let submenuTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let submenuStyle = $state('');

  interface MenuItem {
    label: string;
    shortcut?: string;
    icon: string;
    action?: () => void;
    submenu?: MenuItem[];
    dividerBefore?: boolean;
  }

  interface MenuGroup {
    title: string;
    items: MenuItem[];
  }

  const groups: MenuGroup[] = [
    {
      title: 'Insert',
      items: [
        {
          label: 'Heading 1',
          shortcut: 'Cmd+Alt+1',
          icon: 'H1',
          action: () =>
            editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          label: 'Heading 2',
          shortcut: 'Cmd+Alt+2',
          icon: 'H2',
          action: () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: 'Heading 3',
          shortcut: 'Cmd+Alt+3',
          icon: 'H3',
          action: () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          label: 'Bullet List',
          shortcut: 'Cmd+Shift+8',
          icon: '\u2022',
          action: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: 'Numbered List',
          shortcut: 'Cmd+Shift+7',
          icon: '1.',
          action: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: 'Quote',
          shortcut: 'Cmd+Shift+B',
          icon: '\u201C',
          action: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: 'Code Block',
          shortcut: 'Cmd+Alt+C',
          icon: '{ }',
          action: () => editor.chain().focus().toggleCodeBlock().run(),
        },
        {
          label: 'Math Formula',
          icon: '\u03A3',
          action: () =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'typstRawBlock',
                attrs: { content: '$ $', blockType: 'math' },
              })
              .run(),
        },
        {
          label: 'Typst Code',
          icon: '#',
          action: () =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'typstRawBlock',
                attrs: { content: '#', blockType: 'code' },
              })
              .run(),
        },
        {
          label: 'Table',
          icon: '\u25A6',
          action: () =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run(),
        },
        {
          label: 'Citation',
          icon: '@',
          action: () => {
            // Insert @ to trigger citation autocomplete
            editor.chain().focus().insertContent('@').run();
          },
        },
        {
          label: 'Image',
          icon: '\uD83D\uDDBC',
          action: () =>
            vscode.postMessage({
              type: 'pickImage',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Divider',
          icon: '\u2014',
          action: () => editor.chain().focus().setHorizontalRule().run(),
        },
        {
          label: 'Page Break',
          icon: '\u23CE',
          action: () =>
            editor.chain().focus().insertContent({ type: 'pagebreak' }).run(),
        },
      ],
    },
    {
      title: 'Format',
      items: [
        {
          label: 'Bold',
          shortcut: 'Cmd+B',
          icon: 'B',
          action: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: 'Italic',
          shortcut: 'Cmd+I',
          icon: 'I',
          action: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: 'Strikethrough',
          shortcut: 'Cmd+Shift+X',
          icon: 'S',
          action: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          label: 'Inline Code',
          shortcut: 'Cmd+E',
          icon: '</>',
          action: () => editor.chain().focus().toggleCode().run(),
        },
        {
          label: 'Link',
          shortcut: 'Cmd+K',
          icon: '\uD83D\uDD17',
          action: () => {
            const previousUrl = editor.getAttributes('link').href;
            const url = window.prompt('URL:', previousUrl || 'https://');
            if (url === null) return;
            if (url === '') {
              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .unsetLink()
                .run();
            } else {
              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run();
            }
          },
        },
        {
          label: 'Align Left',
          shortcut: 'Cmd+Shift+L',
          icon: '\u2261',
          action: () => editor.chain().focus().setTextAlign('left').run(),
        },
        {
          label: 'Align Center',
          shortcut: 'Cmd+Shift+E',
          icon: '\u2261',
          action: () => editor.chain().focus().setTextAlign('center').run(),
        },
        {
          label: 'Align Right',
          shortcut: 'Cmd+Shift+R',
          icon: '\u2261',
          action: () => editor.chain().focus().setTextAlign('right').run(),
        },
        {
          label: 'Justify',
          shortcut: 'Cmd+Shift+J',
          icon: '\u2261',
          action: () => editor.chain().focus().setTextAlign('justify').run(),
        },
      ],
    },
    {
      title: 'View',
      items: [
        {
          label: 'Focus Mode',
          icon: '\u25CE',
          action: () => onToggleFocusMode(),
        },
        {
          label: 'Typewriter Mode',
          icon: '\u2026',
          action: () => onToggleTypewriterMode(),
        },
        {
          label: 'Search & Replace',
          shortcut: 'Cmd+F',
          icon: '\uD83D\uDD0D',
          action: () => onShowSearch(),
        },
      ],
    },
    {
      title: 'File',
      items: [
        {
          label: 'Undo AI Edit',
          icon: '\u21B6',
          action: () =>
            vscode.postMessage({ type: 'undoLastAiEdit' } as unknown as WebviewMessage),
        },
        {
          label: 'Export as PDF',
          icon: '\uD83D\uDCC4',
          action: () =>
            vscode.postMessage({ type: 'exportPdf' } as unknown as WebviewMessage),
        },
        {
          label: 'Export as DOCX',
          icon: '\uD83D\uDCDD',
          action: () =>
            vscode.postMessage({ type: 'exportDocx' } as unknown as WebviewMessage),
        },
        {
          label: 'Document Settings',
          icon: '\u2699',
          action: () => onShowSettings(),
        },
        {
          label: 'Style Templates',
          icon: '\uD83C\uDFA8',
          submenu: [
            {
              label: 'Classic Academic',
              icon: '\uD83C\uDFDB',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'classic',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Modern Clean',
              icon: '\u2B2C',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'modern',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Minimal',
              icon: '\u25FB',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'minimal',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Vibrant',
              icon: '\u2B50',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'vibrant',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Elegant',
              icon: '\u2766',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'elegant',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Professional Report',
              icon: '\u25A0',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'professional',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Artsy',
              icon: '\u2728',
              action: () =>
                vscode.postMessage({
                  type: 'applyStyle',
                  styleId: 'artsy',
                } as unknown as WebviewMessage),
            },
            {
              label: 'Import Custom Template...',
              icon: '\uD83D\uDCC2',
              action: () =>
                vscode.postMessage({
                  type: 'importStyleTemplate',
                } as unknown as WebviewMessage),
              dividerBefore: true,
            },
          ],
        },
        {
          label: 'Merge Document',
          icon: '\uD83D\uDD17',
          action: () =>
            vscode.postMessage({
              type: 'mergeDocument',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Split into Chapters',
          icon: '\u2702',
          action: () =>
            vscode.postMessage({
              type: 'splitDocument',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Open as Typst Source',
          icon: '\uD83D\uDCDD',
          action: () =>
            vscode.postMessage({
              type: 'openSource',
            } as unknown as WebviewMessage),
        },
        {
          label: 'New Project',
          icon: '\uD83D\uDCC1',
          action: () =>
            vscode.postMessage({
              type: 'newProject',
            } as unknown as WebviewMessage),
        },
        {
          label: 'New Typst File',
          icon: '\uD83D\uDCC4',
          action: () =>
            vscode.postMessage({
              type: 'newFile',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Import Markdown…',
          icon: '\uD83D\uDCDD',
          action: () =>
            vscode.postMessage({
              type: 'importMarkdown',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Link Zotero Library…',
          icon: '\uD83D\uDCD6',
          action: () =>
            vscode.postMessage({
              type: 'linkZotero',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Import Sources',
          icon: '\uD83D\uDCDA',
          action: () =>
            vscode.postMessage({
              type: 'importSources',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Add Citation Manually',
          icon: '\u270D',
          action: () =>
            vscode.postMessage({
              type: 'addCitationManually',
            } as unknown as WebviewMessage),
        },
      ],
    },
    {
      title: 'Help',
      items: [
        {
          label: 'User Guide',
          icon: '\uD83D\uDCD6',
          action: () =>
            vscode.postMessage({
              type: 'openUserGuide',
            } as unknown as WebviewMessage),
        },
        {
          label: 'Keyboard Shortcuts',
          icon: '\u2328',
          action: () => onShowShortcuts(),
        },
      ],
    },
  ];

  function toggle() {
    open = !open;
    activeSubmenu = null;
  }

  function select(item: MenuItem) {
    if (item.submenu) {
      // Toggle submenu on click
      activeSubmenu = activeSubmenu === item.label ? null : item.label;
      return;
    }
    open = false;
    activeSubmenu = null;
    item.action?.();
  }

  function selectSubmenuItem(item: MenuItem) {
    open = false;
    activeSubmenu = null;
    item.action?.();
  }

  function handleSubmenuEnter(label: string, event: MouseEvent) {
    if (submenuTimeout) {
      clearTimeout(submenuTimeout);
      submenuTimeout = null;
    }
    activeSubmenu = label;

    // Calculate fixed position based on the hovered wrapper element
    const wrapper = (event.currentTarget as HTMLElement);
    const rect = wrapper.getBoundingClientRect();
    let left = rect.right + 2;
    let top = rect.top;

    // If the submenu would overflow the right edge, show it on the left side
    const submenuWidth = 240; // approximate min-width + padding
    if (left + submenuWidth > window.innerWidth) {
      left = rect.left - submenuWidth - 2;
    }

    // If it would overflow the bottom, shift it up
    const submenuHeight = 300; // approximate max height
    if (top + submenuHeight > window.innerHeight) {
      top = Math.max(4, window.innerHeight - submenuHeight);
    }

    submenuStyle = `top: ${top}px; left: ${left}px;`;
  }

  function handleSubmenuLeave() {
    submenuTimeout = setTimeout(() => {
      activeSubmenu = null;
      submenuTimeout = null;
    }, 200);
  }

  function handleSubmenuPanelEnter() {
    if (submenuTimeout) {
      clearTimeout(submenuTimeout);
      submenuTimeout = null;
    }
  }

  function handleSubmenuPanelLeave() {
    submenuTimeout = setTimeout(() => {
      activeSubmenu = null;
      submenuTimeout = null;
    }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (activeSubmenu) {
        activeSubmenu = null;
      } else {
        open = false;
      }
    }
  }

  function handleBackdropClick() {
    open = false;
    activeSubmenu = null;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="command-hub">
  <button
    class="command-hub-trigger"
    class:open
    onclick={toggle}
    title="Menu"
  >
    <span class="hamburger-icon">&#9776;</span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="command-hub-backdrop" onclick={handleBackdropClick} role="presentation"></div>
    <div class="command-hub-dropdown">
      {#each groups as group, gi}
        {#if gi > 0}
          <div class="command-hub-divider"></div>
        {/if}
        <div class="command-hub-group-title">{group.title}</div>
        {#each group.items as item}
          {#if item.submenu}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="command-hub-submenu-wrapper"
              onmouseenter={(e) => handleSubmenuEnter(item.label, e)}
              onmouseleave={handleSubmenuLeave}
            >
              <button
                class="command-hub-item command-hub-item-has-submenu"
                onclick={() => select(item)}
              >
                <span class="command-hub-item-icon">{item.icon}</span>
                <span class="command-hub-item-label">{item.label}</span>
                <span class="command-hub-submenu-arrow">&#x203A;</span>
              </button>
              {#if activeSubmenu === item.label}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="command-hub-submenu"
                  style={submenuStyle}
                  onmouseenter={handleSubmenuPanelEnter}
                  onmouseleave={handleSubmenuPanelLeave}
                >
                  {#each item.submenu as subitem}
                    {#if subitem.dividerBefore}
                      <div class="command-hub-divider"></div>
                    {/if}
                    <button
                      class="command-hub-item"
                      onclick={() => selectSubmenuItem(subitem)}
                    >
                      <span class="command-hub-item-icon">{subitem.icon}</span>
                      <span class="command-hub-item-label">{subitem.label}</span>
                      {#if subitem.shortcut}
                        <span class="command-hub-item-shortcut">{subitem.shortcut}</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <button
              class="command-hub-item"
              onclick={() => select(item)}
            >
              <span class="command-hub-item-icon">{item.icon}</span>
              <span class="command-hub-item-label">{item.label}</span>
              {#if item.shortcut}
                <span class="command-hub-item-shortcut">{item.shortcut}</span>
              {/if}
            </button>
          {/if}
        {/each}
      {/each}
    </div>
  {/if}
</div>
