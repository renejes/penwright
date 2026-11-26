<script lang="ts">
  /**
   * Paints a model reply. The tree comes from `parseChatMarkdown`, so the
   * answer is never inserted as HTML.
   */
  import { parseChatMarkdown, type MdInline } from '../../shared/chatMarkdown';

  let { text }: { text: string } = $props();
  const blocks = $derived(parseChatMarkdown(text));

  function openLink(href: string) {
    const api = (window as unknown as {
      electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    api?.invoke('app:openExternal', href).catch(() => {});
  }
</script>

{#snippet inlines(parts: MdInline[])}
  {#each parts as part, i (i)}
    {#if part.kind === 'text'}{part.text}{:else if part.kind === 'strong'}<strong>{part.text}</strong>{:else if part.kind === 'em'}<em>{part.text}</em>{:else if part.kind === 'code'}<code>{part.text}</code>{:else if part.kind === 'link'}<button type="button" class="md-link" title={part.href} onclick={() => openLink(part.href)}>{part.text}</button>{/if}
  {/each}
{/snippet}

<div class="md">
  {#each blocks as block, bi (bi)}
    {#if block.kind === 'heading'}
      {#if block.level === 1}
        <h3>{@render inlines(block.inlines)}</h3>
      {:else if block.level === 2}
        <h4>{@render inlines(block.inlines)}</h4>
      {:else}
        <h5>{@render inlines(block.inlines)}</h5>
      {/if}
    {:else if block.kind === 'paragraph'}
      <p>
        {#each block.lines as line, li (li)}
          {#if li > 0}<br />{/if}
          {@render inlines(line)}
        {/each}
      </p>
    {:else if block.kind === 'code'}
      <pre><code>{block.text}</code></pre>
    {:else if block.kind === 'list'}
      {#if block.ordered}
        <ol>
          {#each block.items as item, ii (ii)}
            <li>{@render inlines(item)}</li>
          {/each}
        </ol>
      {:else}
        <ul>
          {#each block.items as item, ii (ii)}
            <li>{@render inlines(item)}</li>
          {/each}
        </ul>
      {/if}
    {:else if block.kind === 'quote'}
      <blockquote>
        {#each block.lines as line, li (li)}
          {#if li > 0}<br />{/if}
          {@render inlines(line)}
        {/each}
      </blockquote>
    {:else if block.kind === 'rule'}
      <hr />
    {:else if block.kind === 'table'}
      <div class="md-table">
        <table>
          <thead>
            <tr>
              {#each block.headers as cell, ci (ci)}
                <th>{@render inlines(cell)}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each block.rows as row, ri (ri)}
              <tr>
                {#each block.headers as _, ci (ci)}
                  <td>{@render inlines(row[ci] ?? [])}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/each}
</div>

<style>
  .md {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  h3, h4, h5, p, ul, ol, blockquote, pre { margin: 0; }
  h3 { font-size: 15px; font-weight: 700; }
  h4 { font-size: 14px; font-weight: 650; }
  h5 { font-size: 13px; font-weight: 650; }
  ul, ol { padding-left: 1.25rem; }
  li + li { margin-top: 0.15rem; }
  blockquote {
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    color: var(--ink-secondary);
    padding: 4px 10px;
    border-radius: 0 6px 6px 0;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
    background: var(--wash);
    padding: 1px 4px;
    border-radius: 4px;
  }
  pre {
    background: var(--wash);
    border: 1px solid var(--paper-border);
    border-radius: 8px;
    padding: 8px 10px;
    overflow-x: auto;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: 12px;
  }
  hr {
    border: none;
    border-top: 1px solid var(--paper-border);
  }
  .md-link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .md-link:hover { color: var(--accent-hover); }
  .md-table {
    overflow-x: auto;
    border: 1px solid var(--paper-border);
    border-radius: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th, td {
    text-align: left;
    vertical-align: top;
    padding: 6px 8px;
    border-bottom: 1px solid var(--paper-border);
  }
  th {
    background: var(--sidebar-bg);
    color: var(--ink-secondary);
    font-size: 11px;
  }
  tr:last-child td { border-bottom: none; }
</style>
