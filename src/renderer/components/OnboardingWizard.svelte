<script lang="ts">
  /**
   * Onboarding Wizard — first-run guided tour.
   *
   * Shown once (tracked via the `onboardingSeen` electron-store flag) on the
   * Start Screen. A handful of steps that point at the real features — the
   * project model, the editor, the three design surfaces (esp. the
   * non-obvious "Design with AI" right-click), and the Claude Desktop link —
   * ending with an "Open Sample Project" CTA so the user lands on real
   * material. Static, in-component content (no network / project data), so the
   * {@html} bold markup is safe.
   */

  import { t } from '@shared/i18n/store.svelte';

  let { onClose }: { onClose: () => void } = $props();

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  interface Step {
    icon: string;
    title: string;
    body: string;        // may contain <strong>/<code> (static, trusted)
    bullets?: string[];  // optional list (also static/trusted)
  }

  const steps = $derived<Step[]>([
    { icon: '✍️', title: t().onboarding.steps.welcome.title, body: t().onboarding.steps.welcome.body },
    { icon: '📁', title: t().onboarding.steps.project.title, body: t().onboarding.steps.project.body },
    { icon: '⌨️', title: t().onboarding.steps.writing.title, body: t().onboarding.steps.writing.body },
    { icon: '➕', title: t().onboarding.steps.insert.title, body: t().onboarding.steps.insert.body },
    {
      icon: '✨',
      title: t().onboarding.steps.design.title,
      body: t().onboarding.steps.design.body,
      bullets: t().onboarding.steps.design.bullets,
    },
    { icon: '🤖', title: t().onboarding.steps.claude.title, body: t().onboarding.steps.claude.body },
    { icon: '🚀', title: t().onboarding.steps.ready.title, body: t().onboarding.steps.ready.body },
  ]);

  let i = $state(0);
  const isLast = $derived(i === steps.length - 1);

  async function markSeen() {
    try { await api.invoke('persist:setOnboardingSeen', true); } catch {}
  }

  function next() {
    if (i < steps.length - 1) i++;
  }
  function back() {
    if (i > 0) i--;
  }

  async function finish() {
    await markSeen();
    onClose();
  }

  async function openSample() {
    await markSeen();
    try { await api.invoke('project:openSample'); } catch {}
    onClose();
  }
</script>

<div class="ob-overlay" role="presentation" onclick={finish}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="ob-card" role="dialog" aria-modal="true" aria-label={t().onboarding.ariaLabel} onclick={(e) => e.stopPropagation()}>
    <button class="ob-skip" onclick={finish}>{t().common.skip}</button>

    <div class="ob-body">
      <div class="ob-icon">{steps[i].icon}</div>
      <h2 class="ob-title">{steps[i].title}</h2>
      <p class="ob-text">{@html steps[i].body}</p>
      {#if steps[i].bullets}
        <ul class="ob-bullets">
          {#each steps[i].bullets as b}
            <li>{@html b}</li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="ob-dots">
      {#each steps as _, d}
        <button
          class="ob-dot"
          class:active={d === i}
          aria-label={t().onboarding.stepAria(d + 1)}
          onclick={() => (i = d)}
        ></button>
      {/each}
    </div>

    <div class="ob-nav">
      <button class="ob-btn ghost" onclick={back} disabled={i === 0}>{t().common.back}</button>
      <div class="ob-nav-right">
        {#if isLast}
          <button class="ob-btn" onclick={finish}>{t().common.finish}</button>
          <button class="ob-btn primary" onclick={openSample}>{t().onboarding.openSample}</button>
        {:else}
          <button class="ob-btn primary" onclick={next}>{t().common.next}</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .ob-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(33, 30, 26, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
  }

  .ob-card {
    position: relative;
    width: 540px;
    max-width: calc(100vw - 48px);
    background: #fbfaf7;
    border: 1px solid #ece6dd;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(33, 30, 26, 0.25);
    padding: 28px 28px 20px;
    font-size: 13px;
    color: #3a352e;
  }

  .ob-skip {
    position: absolute;
    top: 14px;
    right: 16px;
    border: none;
    background: transparent;
    color: #998f7f;
    font-size: 11.5px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
  }
  .ob-skip:hover { background: rgba(0, 0, 0, 0.05); color: #6b6356; }

  .ob-body {
    text-align: center;
    min-height: 200px;
    padding: 8px 4px 4px;
  }

  .ob-icon {
    font-size: 44px;
    line-height: 1;
    margin: 8px 0 14px;
  }

  .ob-title {
    margin: 0 0 10px;
    font-size: 20px;
    font-weight: 700;
    color: #211e1a;
    letter-spacing: -0.01em;
  }

  .ob-text {
    margin: 0 auto;
    max-width: 420px;
    line-height: 1.55;
    color: #5c554a;
    font-size: 13.5px;
  }
  .ob-text :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(168, 80, 58, 0.1);
    color: #a8503a;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
  .ob-text :global(strong) { color: #3a352e; }

  .ob-bullets {
    text-align: left;
    max-width: 430px;
    margin: 14px auto 0;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .ob-bullets li {
    position: relative;
    padding-left: 22px;
    line-height: 1.45;
    color: #5c554a;
  }
  .ob-bullets li::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 7px;
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: #a8503a;
  }
  .ob-bullets :global(strong) { color: #211e1a; }

  .ob-dots {
    display: flex;
    justify-content: center;
    gap: 7px;
    margin: 18px 0 16px;
  }
  .ob-dot {
    width: 8px;
    height: 8px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #d8cfc1;
    cursor: pointer;
    transition: background 0.15s, width 0.15s;
  }
  .ob-dot.active {
    background: #a8503a;
    width: 20px;
    border-radius: 4px;
  }

  .ob-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ob-nav-right {
    display: flex;
    gap: 8px;
  }

  .ob-btn {
    padding: 8px 16px;
    border: 1px solid #d8cfc1;
    border-radius: 6px;
    background: #fff;
    color: #3a352e;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
  }
  .ob-btn:hover { background: #f4f1ec; }
  .ob-btn:disabled { opacity: 0; pointer-events: none; }

  .ob-btn.ghost {
    border-color: transparent;
    background: transparent;
    color: #8a8174;
  }
  .ob-btn.ghost:hover { background: rgba(0, 0, 0, 0.04); color: #5c554a; }

  .ob-btn.primary {
    background: #a8503a;
    border-color: #a8503a;
    color: #fff;
  }
  .ob-btn.primary:hover { background: #95462f; }
</style>
