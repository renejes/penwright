<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  // Bundled at build time (?raw) so the handbook ships inside the app — no
  // network, no external docs site. @docs → repo `documentation/`.
  import handbookEn from '@docs/handbook.md?raw';
  import handbookDe from '@docs/handbuch.md?raw';

  let { onClose }: { onClose: () => void } = $props();

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  // Default to the user's UI language; let them flip it.
  let lang = $state<'en' | 'de'>(
    typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en',
  );

  const html = $derived(marked.parse(lang === 'de' ? handbookDe : handbookEn, { gfm: true }) as string);

  let bodyEl: HTMLDivElement;

  function slugify(s: string): string {
    return s.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  }

  // Intercept link clicks: external → open in the OS browser; in-page `#anchor`
  // → scroll to the matching heading (marked doesn't emit heading ids).
  function onBodyClick(e: MouseEvent) {
    const a = (e.target as HTMLElement)?.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    e.preventDefault();
    if (href.startsWith('#')) {
      const want = href.slice(1);
      const headings = bodyEl?.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings?.forEach((h) => {
        if (slugify(h.textContent || '') === want) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else if (/^https?:\/\//.test(href)) {
      api.invoke('app:openExternal', href);
    }
  }

  onMount(() => {
    function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    // Attach the link-interception listener programmatically so the a11y
    // analyzer doesn't flag the content container as an interactive element.
    bodyEl?.addEventListener('click', onBodyClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      bodyEl?.removeEventListener('click', onBodyClick);
    };
  });
</script>

<div class="hb-overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="hb-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" aria-modal="true" aria-label="User Guide">
    <header class="hb-header">
      <h2>User Guide</h2>
      <div class="hb-header-right">
        <div class="hb-lang" role="group" aria-label="Language">
          <button class:active={lang === 'en'} onclick={() => (lang = 'en')}>EN</button>
          <button class:active={lang === 'de'} onclick={() => (lang = 'de')}>DE</button>
        </div>
        <button class="hb-close" onclick={onClose} aria-label="Close">×</button>
      </div>
    </header>
    <div class="hb-body markdown" bind:this={bodyEl}>
      {@html html}
    </div>
  </div>
</div>

<style>
  .hb-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }

  .hb-card {
    background: #fff;
    border-radius: 14px;
    width: 780px;
    max-width: 94vw;
    height: 86vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .hb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;
  }

  .hb-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .hb-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hb-lang {
    display: flex;
    border: 1px solid #e0e0e0;
    border-radius: 7px;
    overflow: hidden;
  }

  .hb-lang button {
    border: none;
    background: #fff;
    color: #888;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    cursor: pointer;
  }

  .hb-lang button.active {
    background: #a8503a;
    color: #fff;
  }

  .hb-close {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #999;
    font-size: 20px;
    cursor: pointer;
  }

  .hb-close:hover { background: #f5f5f5; color: #555; }

  .hb-body {
    overflow-y: auto;
    padding: 8px 32px 40px;
    color: #2a2a2a;
    line-height: 1.6;
    font-size: 14px;
  }

  /* Markdown typography — scoped to the rendered handbook. */
  .hb-body :global(h1) { font-size: 24px; margin: 28px 0 12px; color: #1a1a1a; }
  .hb-body :global(h2) { font-size: 19px; margin: 26px 0 10px; padding-top: 10px; border-top: 1px solid #f0f0f0; color: #1a1a1a; }
  .hb-body :global(h3) { font-size: 16px; margin: 20px 0 8px; color: #222; }
  .hb-body :global(h4) { font-size: 14px; margin: 16px 0 6px; color: #333; }
  .hb-body :global(p) { margin: 10px 0; }
  .hb-body :global(ul), .hb-body :global(ol) { margin: 10px 0; padding-left: 22px; }
  .hb-body :global(li) { margin: 4px 0; }
  .hb-body :global(a) { color: #a8503a; text-decoration: none; }
  .hb-body :global(a:hover) { text-decoration: underline; }
  .hb-body :global(code) { background: #f4f1ec; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; font-family: 'SF Mono', 'Menlo', monospace; }
  .hb-body :global(pre) { background: #f7f5f1; border: 1px solid #eee; border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 12px 0; }
  .hb-body :global(pre code) { background: none; padding: 0; font-size: 12.5px; }
  .hb-body :global(blockquote) { margin: 12px 0; padding: 6px 14px; border-left: 3px solid #a8503a; background: #faf7f3; color: #555; }
  .hb-body :global(table) { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
  .hb-body :global(th), .hb-body :global(td) { border: 1px solid #e6e6e6; padding: 6px 10px; text-align: left; vertical-align: top; }
  .hb-body :global(th) { background: #faf7f3; font-weight: 600; }
  .hb-body :global(hr) { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  .hb-body :global(img) { max-width: 100%; }
</style>
