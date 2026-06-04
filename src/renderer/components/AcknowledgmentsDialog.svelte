<script lang="ts">
  /**
   * Acknowledgments Dialog — surfaces all bundled third-party Typst
   * packages with their license texts, so users can verify what's
   * shipped with Penwright and so we satisfy the attribution clauses
   * of MIT / Apache / LGPL / Unlicense.
   *
   * Data source: `resources/typst-packages/bundle-licenses.json`,
   * generated at build time by `scripts/audit-bundled-deps.mjs`.
   * The main process serves it over the `mcp:getBundleLicenses` IPC
   * channel — same surface across dev (repo path) and prod (.app
   * resources path).
   */

  import { onMount } from 'svelte';

  let { onClose }: { onClose: () => void } = $props();

  interface Acknowledgment {
    name: string;
    version: string;
    license: string;
    licenseNotes: string | null;
    author: string;
    repository: string;
    description: string;
    licenseText: string;
  }

  interface FontAcknowledgment {
    family: string;
    slug: string;
    category: string;
    description: string;
    license: string;
    licenseNotes: string | null;
    source: string;
    fileCount: number;
    licenseText: string;
  }

  interface BundleManifest {
    generatedAt: string;
    totalPackages: number;
    totalFonts?: number;
    packages: Acknowledgment[];
    fonts?: FontAcknowledgment[];
  }

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let manifest = $state<BundleManifest | null>(null);
  let loadError = $state<string>('');
  let expanded = $state<Record<string, boolean>>({});

  function pkgKey(p: Acknowledgment): string {
    return `${p.name}@${p.version}`;
  }

  onMount(async () => {
    try {
      const result = await api.invoke('app:getBundleLicenses') as BundleManifest | { error: string };
      if ('error' in result) {
        loadError = result.error;
      } else {
        manifest = result;
      }
    } catch (err) {
      loadError = String((err as Error).message ?? err);
    }
  });

  function openExternal(url: string) {
    api.invoke('app:openExternal', url);
  }

  // License count per type for the summary chip row.
  let licenseSummary = $derived.by(() => {
    if (!manifest) return [] as Array<{ license: string; count: number }>;
    const counts: Record<string, number> = {};
    for (const p of manifest.packages) counts[p.license] = (counts[p.license] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([license, count]) => ({ license, count }));
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ack-title">
    <header>
      <div>
        <h2 id="ack-title">Open Source Lizenzen</h2>
        <p class="subtitle">
          Penwright enthält die folgenden Typst-Pakete, jeweils unter ihrer eigenen Lizenz. Die vollständigen Lizenz-Texte siehst du beim Aufklappen.
        </p>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Schliessen">×</button>
    </header>

    {#if loadError}
      <div class="error">
        Konnte die Lizenz-Liste nicht laden: <code>{loadError}</code>
      </div>
    {:else if !manifest}
      <div class="loading">Lädt Lizenz-Informationen …</div>
    {:else}
      <div class="summary">
        <span class="total">{manifest.totalPackages} Pakete</span>
        {#if manifest.fonts && manifest.fonts.length > 0}
          <span class="total">{manifest.fonts.length} Fonts</span>
        {/if}
        {#each licenseSummary as item}
          <span class="chip">{item.license} · {item.count}</span>
        {/each}
      </div>

      {#if manifest.fonts && manifest.fonts.length > 0}
        <h3 class="section-title">Typst-Pakete</h3>
      {/if}
      <ul class="pkg-list">
        {#each manifest.packages as pkg (pkgKey(pkg))}
          <li class="pkg-card">
            <div class="pkg-head">
              <div class="pkg-id">
                <code class="pkg-name">{pkg.name}</code>
                <span class="pkg-version">v{pkg.version}</span>
                <span class="pkg-license">{pkg.license}</span>
              </div>
              <button
                class="expand-btn"
                onclick={() => (expanded[pkgKey(pkg)] = !expanded[pkgKey(pkg)])}
                aria-expanded={!!expanded[pkgKey(pkg)]}
              >
                {expanded[pkgKey(pkg)] ? 'Lizenz schliessen' : 'Lizenz anzeigen'}
              </button>
            </div>
            {#if pkg.description}
              <p class="pkg-desc">{pkg.description}</p>
            {/if}
            <div class="pkg-meta">
              {#if pkg.author}<span>{pkg.author}</span>{/if}
              {#if pkg.repository}
                <button class="repo-link" onclick={() => openExternal(pkg.repository)}>
                  Quellcode →
                </button>
              {/if}
            </div>
            {#if pkg.licenseNotes}
              <p class="pkg-note">{pkg.licenseNotes}</p>
            {/if}
            {#if expanded[pkgKey(pkg)]}
              <pre class="pkg-license-text">{pkg.licenseText}</pre>
            {/if}
          </li>
        {/each}
      </ul>

      {#if manifest.fonts && manifest.fonts.length > 0}
        <h3 class="section-title">Gebündelte Fonts</h3>
        <ul class="pkg-list">
          {#each manifest.fonts as font (font.slug)}
            <li class="pkg-card">
              <div class="pkg-head">
                <div class="pkg-id">
                  <span class="pkg-name">{font.family}</span>
                  <span class="pkg-version">{font.category}</span>
                  <span class="pkg-license">{font.license}</span>
                </div>
                <button
                  class="expand-btn"
                  onclick={() => (expanded['font:' + font.slug] = !expanded['font:' + font.slug])}
                  aria-expanded={!!expanded['font:' + font.slug]}
                >
                  {expanded['font:' + font.slug] ? 'Lizenz schliessen' : 'Lizenz anzeigen'}
                </button>
              </div>
              {#if font.description}
                <p class="pkg-desc">{font.description}</p>
              {/if}
              <div class="pkg-meta">
                <span>{font.fileCount} Schnitte</span>
                {#if font.source}
                  <button class="repo-link" onclick={() => openExternal(font.source)}>Quelle →</button>
                {/if}
              </div>
              {#if expanded['font:' + font.slug]}
                <pre class="pkg-license-text">{font.licenseText}</pre>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <footer>
      <button class="btn-primary" onclick={onClose}>Schliessen</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 400;
    padding: 20px;
  }

  .modal {
    background: #fff;
    border-radius: 14px;
    width: 720px;
    max-width: 100%;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 22px 24px 12px;
    gap: 16px;
  }
  header h2 {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 4px;
  }
  .subtitle {
    color: #6b7280;
    font-size: 13px;
    line-height: 1.55;
    margin: 0;
  }
  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .close-btn:hover { background: #f3f4f6; color: #374151; }

  .summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 24px 14px;
    flex-wrap: wrap;
  }
  .total {
    font-size: 12px;
    color: #374151;
    font-weight: 600;
  }
  .section-title {
    margin: 8px 24px 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
  }

  .chip {
    background: #eef2ff;
    color: #4f46e5;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .loading, .error {
    padding: 24px;
    color: #6b7280;
    text-align: center;
  }
  .error { color: #b91c1c; }

  .pkg-list {
    list-style: none;
    margin: 0;
    padding: 0 24px;
    overflow-y: auto;
    flex: 1;
  }

  .pkg-card {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 10px;
    background: #fafbfc;
  }
  .pkg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .pkg-id {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pkg-name {
    font-family: 'SF Mono', monospace;
    font-size: 13px;
    color: #111827;
    font-weight: 600;
  }
  .pkg-version {
    color: #6b7280;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .pkg-license {
    background: #f3f4f6;
    color: #374151;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    font-family: 'SF Mono', monospace;
  }
  .expand-btn {
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    color: #4b5563;
    font-size: 11px;
    font-family: inherit;
    padding: 4px 10px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .expand-btn:hover { background: #f9fafb; color: #111827; }

  .pkg-desc {
    margin: 8px 0 4px;
    color: #4b5563;
    font-size: 12px;
    line-height: 1.45;
  }
  .pkg-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 11px;
    color: #6b7280;
  }
  .repo-link {
    background: transparent;
    border: none;
    color: #4f46e5;
    font-size: 11px;
    font-family: inherit;
    padding: 0;
    cursor: pointer;
  }
  .repo-link:hover { text-decoration: underline; }

  .pkg-note {
    margin: 6px 0 0;
    font-size: 11px;
    color: #b45309;
    background: #fffbeb;
    border-left: 3px solid #fcd34d;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .pkg-license-text {
    margin: 10px 0 0;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 12px;
    font-family: 'SF Mono', monospace;
    font-size: 11px;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 260px;
    overflow-y: auto;
  }

  footer {
    padding: 14px 24px 20px;
    display: flex;
    justify-content: flex-end;
  }
  .btn-primary {
    background: #4f46e5;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 9px 18px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-primary:hover { background: #4338ca; }
</style>
