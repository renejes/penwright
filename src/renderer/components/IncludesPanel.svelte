<script lang="ts">
  let {
    content = '',
    currentFile = '',
  }: {
    content: string;
    currentFile: string;
  } = $props();

  interface IncludeEntry {
    path: string;
    displayName: string;
    exists: boolean;
    lineIndex: number;
  }

  let includes: IncludeEntry[] = $state([]);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    send(channel: string, data: unknown): void;
  } }).electronAPI;

  $effect(() => {
    if (content && currentFile) parseIncludes();
    else includes = [];
  });

  async function parseIncludes() {
    const lines = content.split('\n');
    const parsed: IncludeEntry[] = [];
    lines.forEach((line, i) => {
      const match = line.match(/^#include\s+"([^"]+)"/);
      if (match) {
        parsed.push({
          path: match[1],
          displayName: match[1].replace(/^chapters\//, '').replace(/\.typ$/, ''),
          exists: true,
          lineIndex: i,
        });
      }
    });
    if (parsed.length > 0) {
      try {
        const result = await api.invoke('includes:validate', parsed.map(p => p.path)) as boolean[];
        parsed.forEach((entry, i) => { entry.exists = result[i] ?? true; });
      } catch {}
    }
    includes = parsed;
  }

  function openInclude(entry: IncludeEntry) {
    api.invoke('includes:open', entry.path);
  }

  async function addInclude() {
    await api.invoke('includes:add');
  }

  function moveInclude(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= includes.length) return;
    const lines = content.split('\n');
    const lineA = includes[index].lineIndex;
    const lineB = includes[target].lineIndex;
    const temp = lines[lineA];
    lines[lineA] = lines[lineB];
    lines[lineB] = temp;
    const newContent = lines.join('\n');
    api.send('penwright', { type: 'edit', content: newContent });

    // Swap in local state immediately for instant UI feedback
    const swapped = [...includes];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
    // Update lineIndex references
    swapped[index].lineIndex = lineA;
    swapped[target].lineIndex = lineB;
    includes = swapped;
  }

  function removeInclude(index: number) {
    const lines = content.split('\n');
    lines.splice(includes[index].lineIndex, 1);
    api.send('penwright', { type: 'edit', content: lines.join('\n') });

    // Remove from local state immediately
    includes = includes.filter((_, i) => i !== index);
  }
</script>

<div class="includes">
  {#if includes.length === 0}
    <div class="includes-empty">
      <p>No #include statements</p>
    </div>
  {:else}
    <div class="includes-label">Chapters</div>
    <ul class="includes-list">
      {#each includes as entry, i}
        <li class="include-row" class:missing={!entry.exists}>
          <button class="include-name" onclick={() => openInclude(entry)} title={entry.path}>
            <span class="include-dot" class:warn={!entry.exists}></span>
            {entry.displayName}
          </button>
          <div class="include-actions">
            {#if i > 0}
              <button class="move-btn" onclick={() => moveInclude(i, 'up')} title="Move up">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            {/if}
            {#if i < includes.length - 1}
              <button class="move-btn" onclick={() => moveInclude(i, 'down')} title="Move down">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 4v8M4 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            {/if}
            <button class="move-btn remove" onclick={() => removeInclude(i)} title="Remove">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="includes-footer">
    <button class="add-btn" onclick={addInclude}>+ Add Chapter</button>
  </div>
</div>

<style>
  .includes {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .includes-label {
    padding: 12px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #bbb;
  }

  .includes-empty {
    padding: 24px 16px;
    color: #ccc;
    font-size: 13px;
    text-align: center;
  }

  .includes-list {
    list-style: none;
    margin: 0;
    padding: 0 0 8px;
    flex: 1;
    overflow-y: auto;
  }

  .include-row {
    display: flex;
    align-items: center;
    padding: 0 8px 0 0;
  }

  .include-row:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  .include-row:hover .include-actions {
    opacity: 1;
  }

  .include-name {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border: none;
    background: transparent;
    color: #555;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .include-name:hover {
    color: #333;
  }

  .include-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4f7df9;
    flex-shrink: 0;
  }

  .include-dot.warn {
    background: #e88a3a;
  }

  .include-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .move-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #bbb;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .move-btn:hover {
    background: #f0f0f0;
    color: #555;
  }

  .move-btn.remove:hover {
    color: #e55;
  }

  .includes-footer {
    padding: 8px 12px;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;
  }

  .add-btn {
    width: 100%;
    padding: 7px 14px;
    border: 1px dashed #ddd;
    border-radius: 8px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.15s;
  }

  .add-btn:hover {
    border-color: #bbb;
    color: #666;
    background: rgba(0, 0, 0, 0.01);
  }
</style>
