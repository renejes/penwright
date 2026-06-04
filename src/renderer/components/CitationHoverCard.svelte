<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCitationEntries, type CitationEntry } from '../../editor/lib/citationSuggestion';

  let {
    citekey,
    rect,
    onClose,
    onOpenPdf,
  }: {
    citekey: string;
    rect: { left: number; right: number; top: number; bottom: number; width: number; height: number };
    onClose: () => void;
    onOpenPdf: (path: string) => void;
  } = $props();

  let entry = $derived<CitationEntry | null>(
    getCitationEntries().find((e) => e.citekey === citekey) ?? null,
  );

  let pdfPath = $state<string | null>(null);
  let pdfChecked = $state(false);
  let cardEl: HTMLDivElement;

  // Position card to the right of the badge, but clamp into the viewport.
  // Falls back to below the badge if there isn't horizontal room.
  let style = $derived.by(() => {
    const cardWidth = 320;
    const margin = 12;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

    let left = rect.right + 8;
    let top = rect.top;
    if (left + cardWidth + margin > viewportW) {
      // not enough room to the right — show below the badge instead
      left = Math.min(rect.left, viewportW - cardWidth - margin);
      top = rect.bottom + 6;
    }
    if (top + 220 > viewportH) {
      top = Math.max(margin, viewportH - 220 - margin);
    }
    if (left < margin) left = margin;
    return `position: fixed; left: ${left}px; top: ${top}px; width: ${cardWidth}px;`;
  });

  let leaveTimer: number | null = null;

  function startCloseTimer() {
    if (leaveTimer != null) window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      onClose();
    }, 250);
  }

  function cancelCloseTimer() {
    if (leaveTimer != null) {
      window.clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  }

  function handleCitationLeave() {
    // The badge fired a leave — start the close timer. If the user moves into
    // the card, the card's mouseenter cancels it.
    startCloseTimer();
  }

  function handleCitationHover(e: Event) {
    const detail = (e as CustomEvent<{ citekey: string }>).detail;
    if (detail?.citekey === citekey) {
      cancelCloseTimer();
    }
  }

  onMount(() => {
    window.addEventListener('penwright:citation-leave', handleCitationLeave);
    window.addEventListener('penwright:citation-hover', handleCitationHover);

    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    api.invoke('project:findSourceForCitation', citekey).then((p) => {
      pdfPath = (p as string | null) ?? null;
      pdfChecked = true;
    }).catch(() => {
      pdfChecked = true;
    });
  });

  onDestroy(() => {
    if (leaveTimer != null) window.clearTimeout(leaveTimer);
    window.removeEventListener('penwright:citation-leave', handleCitationLeave);
    window.removeEventListener('penwright:citation-hover', handleCitationHover);
  });

  function handleOpenPdf() {
    if (pdfPath) {
      onOpenPdf(pdfPath);
      onClose();
    }
  }

  function truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="citation-card"
  bind:this={cardEl}
  style={style}
  onmouseenter={cancelCloseTimer}
  onmouseleave={startCloseTimer}
  role="tooltip"
>
  {#if entry}
    <div class="citation-card-author">
      {truncate(entry.author || '(no author)', 60)}
      {#if entry.year}
        <span class="citation-card-year">({entry.year})</span>
      {/if}
    </div>
    <div class="citation-card-title">{truncate(entry.title || '(no title)', 140)}</div>
    <div class="citation-card-key">@{entry.citekey}</div>
  {:else}
    <div class="citation-card-author">@{citekey}</div>
    <div class="citation-card-title citation-card-missing">
      Not in references.bib
    </div>
  {/if}

  <div class="citation-card-actions">
    {#if !pdfChecked}
      <span class="citation-card-pdf-checking">Suche Quelle&hellip;</span>
    {:else if pdfPath}
      <button class="citation-card-btn primary" onclick={handleOpenPdf}>
        PDF öffnen
      </button>
      <span class="citation-card-pdf-name" title={pdfPath}>
        {pdfPath.split('/').pop()}
      </span>
    {:else}
      <span class="citation-card-pdf-missing">
        Keine PDF in <code>sources/</code>
      </span>
    {/if}
  </div>
</div>

<style>
  .citation-card {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.4;
    color: #2a2a2a;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
    z-index: 10000;
    pointer-events: auto;
    user-select: text;
  }

  .citation-card-author {
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 4px;
    font-size: 13px;
  }

  .citation-card-year {
    font-weight: 400;
    color: #888;
    margin-left: 4px;
  }

  .citation-card-title {
    color: #444;
    margin-bottom: 6px;
  }

  .citation-card-missing {
    color: #b88;
    font-style: italic;
  }

  .citation-card-key {
    color: #4f7df9;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    font-size: 11px;
    margin-bottom: 10px;
  }

  .citation-card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    padding-top: 8px;
  }

  .citation-card-btn {
    background: #4f7df9;
    color: #fff;
    border: none;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .citation-card-btn:hover {
    background: #3964e8;
  }

  .citation-card-pdf-name {
    color: #888;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .citation-card-pdf-missing,
  .citation-card-pdf-checking {
    color: #aaa;
    font-size: 11px;
    font-style: italic;
  }

  .citation-card-pdf-missing code {
    background: rgba(0, 0, 0, 0.05);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }
</style>
