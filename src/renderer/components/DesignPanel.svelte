<script lang="ts">
  /**
   * DesignPanel — Phase B sidebar tab for the visual style editor.
   *
   * Round 1 (Sessions 21–22): Color palette + font browser. Each control writes
   * back into the project's `.vswrite/style.json` via `style:save` IPC, which
   * regenerates `style.typ` and kicks off the compiler — the PDF preview reflects
   * the change within ~300 ms of the user releasing the slider.
   *
   * The panel intentionally caches its own copy of `ProjectStyle` and debounces
   * saves: hooking each color-slider tick straight to the compiler would burn
   * CPU and produce flicker. The debounce lives here, not in the IPC handler,
   * because save semantics from menus (Settings dialog) should remain immediate.
   */

  import { onMount, onDestroy } from 'svelte';
  import Coloris from '@melloware/coloris';
  import '@melloware/coloris/dist/coloris.css';
  import {
    type ProjectStyle,
    type StyleColors,
    type StyleHeadings,
    DEFAULT_PROJECT_STYLE,
    COLOR_SLOTS,
    HEADING_LEVELS,
    cloneProjectStyle,
  } from '../../shared/styleTypes';
  import { PALETTE_PRESETS } from '../../shared/palettePresets';
  import { THEME_PRESETS } from '../../shared/themePresets';
  import CodeEditor from './CodeEditor.svelte';

  type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  type FontSlot = keyof ProjectStyle['fonts'];

  interface BundledFont {
    family: string;
    slug: string;
    category: 'sans' | 'serif' | 'mono' | string;
    description: string;
    files: string[];      // populated from manifest.json; ordered Regular / Italic / Bold / BoldItalic
  }

  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let style: ProjectStyle = $state(cloneProjectStyle(DEFAULT_PROJECT_STYLE));
  let initialized = $state(false);
  let status: Status = $state('idle');
  let fonts: BundledFont[] = $state([]);
  let fontFaceStyles = $state('');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  // Set when we mutate `style` programmatically (preset / extraction). Keeps
  // the $effect-driven save from firing during the initial load.
  let suppressSave = true;

  // ─── Slot labels — short user-facing names for each semantic slot.
  const SLOT_LABEL: Record<keyof StyleColors, string> = {
    primary: 'Primary',
    accent: 'Accent',
    text: 'Text',
    background: 'Background',
    muted: 'Muted',
  };

  const SLOT_HINT: Record<keyof StyleColors, string> = {
    primary: 'Headings, dominant brand color',
    accent: 'Links, emphasis, callouts',
    text: 'Body copy',
    background: 'Page fill',
    muted: 'Captions, secondary info',
  };

  onMount(async () => {
    if (!api) return;
    status = 'loading';

    try {
      const result = await api.invoke('style:get') as
        { style: ProjectStyle; initialized: boolean } | null;
      if (result?.style) {
        style = cloneProjectStyle(result.style);
        initialized = result.initialized;
      }
    } catch (err) {
      console.warn('[DesignPanel] style:get failed:', err);
    }

    // Load the bundled fonts manifest so the font browser shows real
    // names + lets us @font-face the preview text in each card.
    try {
      const bundle = await api.invoke('app:getBundleLicenses') as
        { fonts?: BundledFont[] } | { error: string };
      if (bundle && 'fonts' in bundle && Array.isArray(bundle.fonts)) {
        fonts = bundle.fonts.map(f => ({
          family: f.family,
          slug: f.slug,
          category: f.category,
          description: f.description,
          files: f.files ?? [],
        }));
        // Generate @font-face rules so font cards render their own family
        // for preview. We register the first .ttf/.otf per family as the
        // regular weight — that's enough for the card heading + body line.
        fontFaceStyles = fonts.map(f => {
          const regular = f.files.find(name => /-Regular\.(ttf|otf)$/i.test(name)) ?? f.files[0];
          if (!regular) return '';
          const url = `vswrite-font://${encodeURIComponent(f.slug)}/${encodeURIComponent(regular)}`;
          return `@font-face { font-family: ${JSON.stringify(f.family)}; src: url("${url}"); font-display: swap; }`;
        }).join('\n');
      }
    } catch (err) {
      console.warn('[DesignPanel] app:getBundleLicenses failed:', err);
    }

    // Coloris attaches itself to inputs matching the selector. We pass an
    // onChange that writes back into our state — Svelte's $state proxy is
    // mutation-aware, so the $effect below picks the change up and triggers
    // the debounced save.
    try {
      Coloris.init();
      Coloris({
        el: '.coloris-slot',
        themeMode: 'auto',
        alpha: false,
        format: 'hex',
        margin: 6,
        swatches: [
          '#0f172a', '#1e293b', '#3b82f6', '#0ea5e9', '#10b981',
          '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#ffffff',
        ],
        onChange: (color: string, el: HTMLElement | undefined) => {
          const slot = el?.dataset.slot as keyof StyleColors | undefined;
          if (slot && COLOR_SLOTS.includes(slot)) {
            style.colors[slot] = color.toLowerCase();
          }
        },
      });
    } catch (err) {
      console.warn('[DesignPanel] Coloris init failed:', err);
    }

    // Allow the auto-save effect to fire from here on.
    suppressSave = false;
    status = 'idle';
  });

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
  });

  $effect(() => {
    // Touch every leaf so Svelte tracks all of them.
    const touched = JSON.stringify(style);
    if (suppressSave) return;
    scheduleSave(touched);
  });

  let lastSavedSerialized = '';

  function scheduleSave(serialized: string): void {
    if (!api) return;
    if (serialized === lastSavedSerialized) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      status = 'saving';
      try {
        // Spread to detach from the $state proxy (structured-clone safety).
        await api!.invoke('style:save', JSON.parse(serialized));
        lastSavedSerialized = serialized;
        status = 'saved';
        // Drop the "saved" pill after a moment so the panel feels quiet.
        setTimeout(() => { if (status === 'saved') status = 'idle'; }, 1500);
      } catch (err) {
        console.warn('[DesignPanel] style:save failed:', err);
        status = 'error';
      }
    }, 300);
  }

  function applyPreset(presetId: string): void {
    const preset = PALETTE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    style.colors = { ...preset.colors };
  }

  /**
   * Applies a full theme — overwrites every branch of `style` except
   * `custom.preamble`, which we preserve because the user's escape-hatch
   * code is project-specific and not part of any theme. Custom code is
   * additive (appended below generated rules), so keeping it works with
   * any theme.
   */
  function applyTheme(themeId: string): void {
    const t = THEME_PRESETS.find(p => p.id === themeId);
    if (!t) return;
    const preservedCustom = style.custom?.preamble ?? '';
    style = cloneProjectStyle({
      ...t.style,
      custom: { preamble: preservedCustom },
    });
  }

  function setFont(slot: FontSlot, family: string): void {
    style.fonts[slot] = family;
  }

  // Group fonts for display by category so the user sees sans / serif / mono
  // in a stable order; cards inside each group keep manifest order.
  const FONT_CATEGORIES: ReadonlyArray<{ id: 'sans' | 'serif' | 'mono'; label: string }> = [
    { id: 'sans',  label: 'Sans-Serif' },
    { id: 'serif', label: 'Serif' },
    { id: 'mono',  label: 'Monospace' },
  ];

  function fontsIn(category: 'sans' | 'serif' | 'mono'): BundledFont[] {
    return fonts.filter(f => f.category === category);
  }

  // Compact label for the slot-pill that shows which font is currently
  // assigned to each role.
  const SLOT_PILL_LABEL: Record<FontSlot, string> = {
    body: 'Body',
    heading: 'Heading',
    code: 'Code',
  };

  function activeSlotsFor(family: string): FontSlot[] {
    const result: FontSlot[] = [];
    (['body', 'heading', 'code'] as FontSlot[]).forEach(slot => {
      if (style.fonts[slot] === family) result.push(slot);
    });
    return result;
  }

  type HeadingLevelKey = keyof Pick<StyleHeadings, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>;

  // Track which heading cards are open. Default H1+H2 expanded (the
  // 80 % case) and H3-H6 collapsed so the section doesn't dominate the panel.
  let headingExpanded = $state<Record<HeadingLevelKey, boolean>>({
    h1: true, h2: true, h3: false, h4: false, h5: false, h6: false,
  });

  function toggleHeading(level: HeadingLevelKey): void {
    headingExpanded[level] = !headingExpanded[level];
  }

  // Compact summary line shown on collapsed cards — gives the user a quick
  // read of what the level looks like without expanding everything.
  function headingSummary(level: HeadingLevelKey): string {
    const h = style.headings[level];
    return `${h.size} · ${h.weight} · ${h.color}`;
  }

  // ─── Elements (Blockquote / Code-Block / Figure / Table) ─────
  type ElementKey = 'blockquote' | 'codeBlock' | 'figure' | 'table';

  const ELEMENT_LABELS: Record<ElementKey, string> = {
    blockquote: 'Blockquote',
    codeBlock:  'Code-Block',
    figure:     'Figure',
    table:      'Table',
  };

  let elementsExpanded = $state<Record<ElementKey, boolean>>({
    blockquote: false, codeBlock: false, figure: false, table: false,
  });

  function toggleElement(key: ElementKey): void {
    elementsExpanded[key] = !elementsExpanded[key];
  }

  // One-line collapsed summary per element — gives a quick at-a-glance
  // read of the configured key so users don't have to expand to remember.
  // Each case pulls its element through the typed key so TypeScript narrows
  // correctly (a single `style.elements[key]` lookup keeps the union type).
  function elementSummary(key: ElementKey): string {
    switch (key) {
      case 'blockquote': {
        const el = style.elements.blockquote;
        return `${el.borderWidth} ${el.borderColor}${el.italic ? ' · italic' : ''}`;
      }
      case 'codeBlock': {
        const el = style.elements.codeBlock;
        return el.background ? `bg ${el.background}` : 'no background';
      }
      case 'figure': {
        const el = style.elements.figure;
        return `${el.captionPosition} · ${el.captionAlign}`;
      }
      case 'table': {
        const el = style.elements.table;
        return `header ${el.headerBackground}${el.alternateRowFill ? ' · zebra' : ''}`;
      }
    }
  }

  function onCustomCodeChange(value: string): void {
    if (style.custom) {
      style.custom.preamble = value;
    } else {
      style.custom = { preamble: value };
    }
  }

  let customExpanded = $state(false);

  // The hex-input keeps a synchronized text representation. We accept any
  // three- or six-digit hex; longer strings get truncated.
  function onHexInput(slot: keyof StyleColors, raw: string): void {
    const trimmed = raw.trim();
    if (/^#?[0-9a-fA-F]{3,6}$/.test(trimmed)) {
      const hex = trimmed.startsWith('#') ? trimmed : '#' + trimmed;
      style.colors[slot] = hex.toLowerCase();
    }
  }
</script>

<div class="design-panel">
  <div class="design-header">
    <div class="design-title">Design</div>
    {#if status === 'saving'}
      <span class="design-status saving">Speichere…</span>
    {:else if status === 'saved'}
      <span class="design-status saved">Gespeichert</span>
    {:else if status === 'error'}
      <span class="design-status error">Fehler</span>
    {/if}
  </div>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Farbpalette</h3>
      {#if !initialized}
        <span class="design-section-hint">Defaults aktiv — beim ersten Speichern wird <code>style.json</code> angelegt.</span>
      {/if}
    </header>

    <div class="palette-grid">
      {#each COLOR_SLOTS as slot}
        <div class="palette-slot">
          <div class="palette-slot-label">
            <span class="palette-slot-name">{SLOT_LABEL[slot]}</span>
            <span class="palette-slot-hint">{SLOT_HINT[slot]}</span>
          </div>
          <div class="palette-slot-controls">
            <input
              type="text"
              class="coloris-slot palette-color-input"
              data-coloris
              data-slot={slot}
              value={style.colors[slot]}
              spellcheck="false"
              autocomplete="off"
              aria-label={`${SLOT_LABEL[slot]} color`}
              oninput={(e) => onHexInput(slot, e.currentTarget.value)}
            />
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Paletten-Presets</h3>
      <span class="design-section-hint">Klick = nur die fünf Farb-Slots übernehmen. Fonts und Layout bleiben unverändert.</span>
    </header>

    <div class="preset-grid">
      {#each PALETTE_PRESETS as preset}
        <button
          type="button"
          class="preset-card"
          onclick={() => applyPreset(preset.id)}
          title={preset.description}
        >
          <div class="preset-swatches">
            <span style="background: {preset.colors.primary}"></span>
            <span style="background: {preset.colors.accent}"></span>
            <span style="background: {preset.colors.text}"></span>
            <span style="background: {preset.colors.muted}"></span>
            <span style="background: {preset.colors.background}; border: 1px solid #ddd"></span>
          </div>
          <div class="preset-name">{preset.name}</div>
        </button>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Themes</h3>
      <span class="design-section-hint">Klick = komplettes Design übernehmen (Farben + Fonts + Scale + Layout + Headings + Elements). Dein Custom-Code-Block bleibt erhalten.</span>
    </header>

    <div class="theme-grid">
      {#each THEME_PRESETS as preset}
        <button
          type="button"
          class="theme-card"
          onclick={() => applyTheme(preset.id)}
          title={preset.description}
        >
          <div class="theme-swatches">
            <span style="background: {preset.style.colors.primary}"></span>
            <span style="background: {preset.style.colors.accent}"></span>
            <span style="background: {preset.style.colors.text}"></span>
            <span style="background: {preset.style.colors.muted}"></span>
            <span style="background: {preset.style.colors.background}; border: 1px solid #ddd"></span>
          </div>
          <div class="theme-name">{preset.name}</div>
          <div class="theme-fonts">
            <span style="font-family: {JSON.stringify(preset.style.fonts.body)}">Aa</span>
            <span style="font-family: {JSON.stringify(preset.style.fonts.heading)}; font-weight: 600">H</span>
            <span class="theme-fonts-code" style="font-family: {JSON.stringify(preset.style.fonts.code)}">{'{}'}</span>
          </div>
          <div class="theme-best">{preset.bestFor}</div>
        </button>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Fonts</h3>
      <span class="design-section-hint">
        Sieben OFL-Schriften sind gebündelt — kein System-Install nötig. Jede Karte hat drei Buttons, um sie auf Body, Heading oder Code zu mappen.
      </span>
    </header>

    <div class="font-active">
      <div class="font-active-row">
        <span class="font-active-label">Body</span>
        <span class="font-active-value" style="font-family: {style.fonts.body}">{style.fonts.body}</span>
      </div>
      <div class="font-active-row">
        <span class="font-active-label">Heading</span>
        <span class="font-active-value" style="font-family: {style.fonts.heading}">{style.fonts.heading}</span>
      </div>
      <div class="font-active-row">
        <span class="font-active-label">Code</span>
        <span class="font-active-value font-active-code" style="font-family: {style.fonts.code}">{style.fonts.code}</span>
      </div>
    </div>

    {#each FONT_CATEGORIES as category}
      {@const list = fontsIn(category.id)}
      {#if list.length > 0}
        <div class="font-category">
          <div class="font-category-label">{category.label}</div>

          {#each list as font}
            {@const activeSlots = activeSlotsFor(font.family)}
            <div class="font-card" class:font-card-active={activeSlots.length > 0}>
              <div class="font-card-head">
                <div class="font-card-name" style="font-family: {JSON.stringify(font.family)}">{font.family}</div>
                {#if activeSlots.length > 0}
                  <div class="font-card-pills">
                    {#each activeSlots as slot}
                      <span class="font-card-pill">{SLOT_PILL_LABEL[slot]}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="font-card-sample" style="font-family: {JSON.stringify(font.family)}">
                The quick brown fox jumps over the lazy dog.
              </div>
              <div class="font-card-actions">
                <button type="button" class="font-action" onclick={() => setFont('body', font.family)}>Body</button>
                <button type="button" class="font-action" onclick={() => setFont('heading', font.family)}>Heading</button>
                {#if category.id === 'mono'}
                  <button type="button" class="font-action" onclick={() => setFont('code', font.family)}>Code</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/each}

    {#if fonts.length === 0}
      <div class="design-section-hint">
        Konnte die gebündelten Fonts nicht laden. Stelle sicher, dass <code>npm run fetch:fonts</code> einmal lief.
      </div>
    {/if}
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Scale</h3>
    </header>

    <div class="design-fields">
      <label class="design-field">
        <span>Base size</span>
        <input
          type="text"
          bind:value={style.scale.base}
          placeholder="11pt"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>Leading</span>
        <input
          type="text"
          bind:value={style.scale.leading}
          placeholder="0.65em"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>Paragraph spacing</span>
        <input
          type="text"
          bind:value={style.scale.paragraphSpacing}
          placeholder="z.B. 1.2em (leer = default)"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>First-line indent</span>
        <input
          type="text"
          bind:value={style.scale.firstLineIndent}
          placeholder="z.B. 1em (leer = kein Einzug)"
          spellcheck="false"
        />
      </label>
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Layout</h3>
      <span class="design-section-hint">Seite, Margins, Header/Footer, Seitenzahlen. Header/Footer akzeptieren Typst-Markup wie <code>*Bold*</code> oder <code>#counter(page).display()</code>.</span>
    </header>

    <div class="design-fields">
      <label class="design-field">
        <span>Paper</span>
        <select bind:value={style.layout.paper}>
          <option value="a4">a4</option>
          <option value="a5">a5</option>
          <option value="a3">a3</option>
          <option value="us-letter">us-letter</option>
          <option value="us-legal">us-legal</option>
        </select>
      </label>

      <label class="design-field">
        <span>Margin</span>
        <input
          type="text"
          bind:value={style.layout.margin}
          placeholder="2.5cm"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>Columns</span>
        <select bind:value={style.layout.columns}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>

      <label class="design-field">
        <span>Page numbering</span>
        <select bind:value={style.layout.pageNumbering}>
          <option value="">None</option>
          <option value="1">1, 2, 3</option>
          <option value="1 / 1">1 / 1 (with total)</option>
          <option value="— 1 —">— 1 —</option>
          <option value="i">i, ii, iii (roman)</option>
          <option value="I">I, II, III (Roman)</option>
        </select>
      </label>

      <label class="design-field">
        <span>Header</span>
        <input
          type="text"
          bind:value={style.layout.pageHeader}
          placeholder="z.B. My Document Title"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>Footer</span>
        <input
          type="text"
          bind:value={style.layout.pageFooter}
          placeholder="z.B. #counter(page).display()"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>Page background</span>
        <select bind:value={style.layout.pageFill}>
          <option value="">— Background color slot —</option>
          <option value="luma(252)">Light gray</option>
          <option value="luma(245)">Medium gray</option>
          <option value="rgb(&quot;#FFFFF0&quot;)">Ivory</option>
          <option value="rgb(&quot;#FFF8F0&quot;)">Warm cream</option>
          <option value="rgb(&quot;#F0F4FF&quot;)">Cool blue</option>
        </select>
      </label>
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Headings</h3>
    </header>

    <div class="design-fields">
      <label class="design-field">
        <span>Numbering</span>
        <select bind:value={style.headings.numbering}>
          <option value="">None</option>
          <option value="1.">1. 2. 3.</option>
          <option value="1.1">1.1 1.2 2.1</option>
          <option value="1.a">1.a 1.b 2.a</option>
          <option value="I.">I. II. III.</option>
        </select>
      </label>

      {#each HEADING_LEVELS as level (level)}
        {@const h = style.headings[level]}
        {@const isOpen = headingExpanded[level]}
        <div class="heading-card" class:open={isOpen}>
          <button
            type="button"
            class="heading-card-head"
            onclick={() => toggleHeading(level)}
            aria-expanded={isOpen}
          >
            <span class="heading-card-chev">{isOpen ? '▾' : '▸'}</span>
            <span class="heading-card-level">{level.toUpperCase()}</span>
            <span
              class="heading-card-preview"
              style="font-family: {JSON.stringify(style.fonts.heading)}; font-weight: {h.weight === 'bold' ? 700 : h.weight === 'semibold' ? 600 : h.weight === 'extrabold' ? 800 : h.weight === 'medium' ? 500 : 400}; color: {style.colors[h.color]}"
            >Heading sample</span>
            {#if !isOpen}
              <span class="heading-card-summary">{headingSummary(level)}</span>
            {/if}
          </button>

          {#if isOpen}
            <div class="heading-card-body">
              <label class="design-field">
                <span>Size</span>
                <input type="text" bind:value={h.size} placeholder="24pt" spellcheck="false" />
              </label>
              <label class="design-field">
                <span>Weight</span>
                <select bind:value={h.weight}>
                  <option value="regular">Regular</option>
                  <option value="medium">Medium</option>
                  <option value="semibold">Semi-Bold</option>
                  <option value="bold">Bold</option>
                  <option value="extrabold">Extra Bold</option>
                </select>
              </label>
              <label class="design-field">
                <span>Color</span>
                <select bind:value={h.color}>
                  {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
                </select>
              </label>
              <label class="design-field">
                <span>Margin top</span>
                <input type="text" bind:value={h.marginTop} placeholder="2em" spellcheck="false" />
              </label>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>Elements</h3>
      <span class="design-section-hint">Blockquote, Code-Block, Figure, Table. Komplexere Effekte (Callouts, Pull-Quotes, etc.) gehen in den Custom-Code-Block unten — das Paket <code>gentle-clues</code> deckt z.B. Info/Warning/Tip-Boxen ab.</span>
    </header>

    <div class="design-fields">
      <!-- Blockquote -->
      <div class="heading-card" class:open={elementsExpanded.blockquote}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('blockquote')}
          aria-expanded={elementsExpanded.blockquote}
        >
          <span class="heading-card-chev">{elementsExpanded.blockquote ? '▾' : '▸'}</span>
          <span class="heading-card-level">BQ</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.blockquote}</span>
          {#if !elementsExpanded.blockquote}
            <span class="heading-card-summary">{elementSummary('blockquote')}</span>
          {/if}
        </button>
        {#if elementsExpanded.blockquote}
          <div class="heading-card-body">
            <label class="design-field">
              <span>Border color</span>
              <select bind:value={style.elements.blockquote.borderColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>Border width</span>
              <input type="text" bind:value={style.elements.blockquote.borderWidth} placeholder="3pt" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>Padding left</span>
              <input type="text" bind:value={style.elements.blockquote.paddingLeft} placeholder="1em" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>Text color</span>
              <select bind:value={style.elements.blockquote.textColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field design-field-checkbox">
              <span>Italic</span>
              <input type="checkbox" bind:checked={style.elements.blockquote.italic} />
            </label>
          </div>
        {/if}
      </div>

      <!-- Code Block -->
      <div class="heading-card" class:open={elementsExpanded.codeBlock}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('codeBlock')}
          aria-expanded={elementsExpanded.codeBlock}
        >
          <span class="heading-card-chev">{elementsExpanded.codeBlock ? '▾' : '▸'}</span>
          <span class="heading-card-level">CB</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.codeBlock}</span>
          {#if !elementsExpanded.codeBlock}
            <span class="heading-card-summary">{elementSummary('codeBlock')}</span>
          {/if}
        </button>
        {#if elementsExpanded.codeBlock}
          <div class="heading-card-body">
            <label class="design-field">
              <span>Background</span>
              <select bind:value={style.elements.codeBlock.background}>
                <option value="">— none —</option>
                <option value="luma(245)">Light gray</option>
                <option value="luma(240)">Medium gray</option>
                <option value="luma(232)">Darker gray</option>
                <option value="rgb(&quot;#f5f5f5&quot;)">Neutral 50</option>
                <option value="rgb(&quot;#fef9c3&quot;)">Highlight yellow</option>
                <option value="rgb(&quot;#dbeafe&quot;)">Cool blue</option>
                <option value="style-colors.muted.lighten(80%)">Muted (tinted)</option>
              </select>
            </label>
            <label class="design-field">
              <span>Padding X</span>
              <input type="text" bind:value={style.elements.codeBlock.paddingX} placeholder="1em" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>Padding Y</span>
              <input type="text" bind:value={style.elements.codeBlock.paddingY} placeholder="0.6em" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>Corner radius</span>
              <input type="text" bind:value={style.elements.codeBlock.borderRadius} placeholder="4pt" spellcheck="false" />
            </label>
          </div>
        {/if}
      </div>

      <!-- Figure -->
      <div class="heading-card" class:open={elementsExpanded.figure}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('figure')}
          aria-expanded={elementsExpanded.figure}
        >
          <span class="heading-card-chev">{elementsExpanded.figure ? '▾' : '▸'}</span>
          <span class="heading-card-level">FIG</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.figure}</span>
          {#if !elementsExpanded.figure}
            <span class="heading-card-summary">{elementSummary('figure')}</span>
          {/if}
        </button>
        {#if elementsExpanded.figure}
          <div class="heading-card-body">
            <label class="design-field">
              <span>Caption position</span>
              <select bind:value={style.elements.figure.captionPosition}>
                <option value="bottom">Below figure</option>
                <option value="top">Above figure</option>
              </select>
            </label>
            <label class="design-field">
              <span>Caption size</span>
              <input type="text" bind:value={style.elements.figure.captionSize} placeholder="9pt" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>Caption color</span>
              <select bind:value={style.elements.figure.captionColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>Caption align</span>
              <select bind:value={style.elements.figure.captionAlign}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label class="design-field">
              <span>Separator</span>
              <input type="text" bind:value={style.elements.figure.captionSeparator} placeholder=": " spellcheck="false" />
            </label>
          </div>
        {/if}
      </div>

      <!-- Table -->
      <div class="heading-card" class:open={elementsExpanded.table}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('table')}
          aria-expanded={elementsExpanded.table}
        >
          <span class="heading-card-chev">{elementsExpanded.table ? '▾' : '▸'}</span>
          <span class="heading-card-level">TBL</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.table}</span>
          {#if !elementsExpanded.table}
            <span class="heading-card-summary">{elementSummary('table')}</span>
          {/if}
        </button>
        {#if elementsExpanded.table}
          <div class="heading-card-body">
            <label class="design-field">
              <span>Header bg</span>
              <select bind:value={style.elements.table.headerBackground}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>Header text</span>
              <select bind:value={style.elements.table.headerTextColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field design-field-checkbox">
              <span>Zebra rows</span>
              <input type="checkbox" bind:checked={style.elements.table.alternateRowFill} />
            </label>
            <label class="design-field">
              <span>Border color</span>
              <select bind:value={style.elements.table.borderColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>Cell padding</span>
              <input type="text" bind:value={style.elements.table.cellPadding} placeholder="6pt" spellcheck="false" />
            </label>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <button
        type="button"
        class="custom-toggle"
        onclick={() => (customExpanded = !customExpanded)}
        aria-expanded={customExpanded}
      >
        <span class="custom-toggle-chev">{customExpanded ? '▾' : '▸'}</span>
        <h3>Custom Typst-Code</h3>
        {#if style.custom?.preamble && style.custom.preamble.trim().length > 0}
          <span class="custom-toggle-badge">{style.custom.preamble.split(/\r?\n/).length} Zeilen</span>
        {/if}
      </button>
      {#if customExpanded}
        <span class="design-section-hint">
          Wird ans Ende von <code>style.typ</code> angehängt — überschreibt alles oben. Hier kommen <code>#show heading.where(level: 1): it =&gt; …</code> mit Linien, <code>#import</code>-Statements und alles, was der Designer noch nicht kann.
        </span>
      {/if}
    </header>

    {#if customExpanded}
      <div class="custom-editor-wrap">
        <CodeEditor
          content={style.custom?.preamble ?? ''}
          fileExt="typ"
          onChange={onCustomCodeChange}
        />
      </div>
    {/if}
  </section>
</div>

<!-- @font-face injection for the bundled fonts. Lives outside the panel
     element so it isn't scoped — Svelte's <style> blocks only allow static
     CSS, and we need this dynamic at runtime. -->
{#if fontFaceStyles}
  {@html `<style>${fontFaceStyles}</style>`}
{/if}

<style>
  .design-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 12px;
    gap: 16px;
    font-size: 12px;
    color: #1a1a1a;
  }

  .design-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #eee;
  }

  .design-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #666;
  }

  .design-status {
    margin-left: auto;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
  }

  .design-status.saving { background: #f0f4ff; color: #3b82f6; }
  .design-status.saved  { background: #f0fdf4; color: #16a34a; }
  .design-status.error  { background: #fef2f2; color: #dc2626; }

  .design-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .design-section-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .design-section-header h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
  }

  .design-section-hint {
    font-size: 10.5px;
    color: #999;
    line-height: 1.4;
  }

  .design-section-hint code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }

  /* Palette */

  .palette-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .palette-slot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .palette-slot-label {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .palette-slot-name {
    font-size: 12px;
    font-weight: 500;
  }

  .palette-slot-hint {
    font-size: 10.5px;
    color: #999;
    line-height: 1.3;
  }

  .palette-slot-controls {
    flex-shrink: 0;
  }

  .palette-color-input {
    width: 96px;
    height: 28px;
    padding: 4px 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: #333;
    background: #fff;
  }

  .palette-color-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: transparent;
  }

  /* Presets */

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .preset-card {
    appearance: none;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .preset-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .preset-swatches {
    display: flex;
    gap: 0;
    height: 18px;
    border-radius: 3px;
    overflow: hidden;
  }

  .preset-swatches span {
    flex: 1 1 0;
    display: block;
  }

  .preset-name {
    font-size: 11px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Theme cards (full ProjectStyle apply) — wider than palette cards
     because each one needs to fit a font preview and a "best for" line. */

  .theme-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .theme-card {
    appearance: none;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "swatches name"
      "swatches fonts"
      "best     best";
    gap: 4px 10px;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
  }

  .theme-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .theme-swatches {
    grid-area: swatches;
    display: flex;
    gap: 0;
    height: 36px;
    width: 36px;
    flex-direction: column;
    border-radius: 4px;
    overflow: hidden;
  }

  .theme-swatches span {
    flex: 1 1 0;
    display: block;
    width: 100%;
  }

  .theme-name {
    grid-area: name;
    font-size: 12px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .theme-fonts {
    grid-area: fonts;
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    color: #4b5563;
  }

  .theme-fonts-code {
    font-size: 11px;
    color: #6b7280;
  }

  .theme-best {
    grid-area: best;
    font-size: 10.5px;
    color: #999;
    line-height: 1.4;
    padding-top: 2px;
    border-top: 1px solid #f0f0f0;
    margin-top: 2px;
  }

  /* Fonts */

  .font-active {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: #f9fafb;
    border: 1px solid #eee;
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .font-active-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 11px;
  }

  .font-active-label {
    width: 56px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    color: #999;
    font-size: 10px;
  }

  .font-active-value {
    flex: 1 1 auto;
    color: #1a1a1a;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-active-code {
    font-size: 12px;
  }

  .font-category {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .font-category-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #999;
    margin-top: 4px;
  }

  .font-card {
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 8px 10px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .font-card-active {
    border-color: #3b82f6;
    background: #f5f9ff;
  }

  .font-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .font-card-name {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-card-pills {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .font-card-pill {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1d4ed8;
    background: #dbeafe;
    border-radius: 3px;
    padding: 2px 5px;
    font-weight: 600;
  }

  .font-card-sample {
    font-size: 13px;
    color: #4b5563;
    line-height: 1.45;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-card-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .font-action {
    appearance: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    color: #555;
    font-size: 10px;
    padding: 3px 7px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }

  .font-action:hover {
    border-color: #3b82f6;
    color: #1d4ed8;
    background: #eff6ff;
  }

  /* Generic design-field rows (used by Scale / Layout / Headings) */

  .design-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .design-field {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
  }

  .design-field > span {
    flex: 0 0 96px;
    color: #4b5563;
    font-size: 11px;
  }

  .design-field input[type="text"],
  .design-field select {
    flex: 1 1 auto;
    min-width: 0;
    padding: 5px 7px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    color: #1a1a1a;
    background: #fff;
    font-family: inherit;
  }

  .design-field input[type="text"]:focus,
  .design-field select:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: transparent;
  }

  .design-field-checkbox input[type="checkbox"] {
    margin-left: 0;
    cursor: pointer;
    flex: 0 0 auto;
  }

  .design-subgroup {
    border-left: 2px solid #eee;
    padding-left: 10px;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .design-subgroup-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 2px;
  }

  /* Heading cards (H1–H6 in the Headings section) */

  .heading-card {
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    background: #fff;
    overflow: hidden;
    margin-top: 4px;
    transition: border-color 0.15s ease;
  }

  .heading-card.open {
    border-color: #cbd5f5;
    background: #f8fafc;
  }

  .heading-card-head {
    appearance: none;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .heading-card-chev {
    color: #999;
    font-size: 11px;
    width: 12px;
    flex-shrink: 0;
  }

  .heading-card-level {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #6b7280;
    width: 22px;
    flex-shrink: 0;
  }

  .heading-card-preview {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .heading-card-summary {
    font-size: 10px;
    color: #999;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    flex-shrink: 0;
  }

  .heading-card-body {
    border-top: 1px solid #e5e7eb;
    padding: 8px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Custom code section */

  .custom-toggle {
    appearance: none;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
    width: 100%;
    text-align: left;
  }

  .custom-toggle h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
  }

  .custom-toggle-chev {
    color: #999;
    font-size: 11px;
    width: 12px;
    flex-shrink: 0;
  }

  .custom-toggle-badge {
    margin-left: auto;
    font-size: 10px;
    color: #1d4ed8;
    background: #dbeafe;
    padding: 2px 7px;
    border-radius: 3px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .custom-editor-wrap {
    height: 280px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    overflow: hidden;
    background: #fafafa;
    font-size: 12px;
  }

  /* Coloris theme override — vswrite uses a slightly lighter chrome than the
     Coloris default so the popover doesn't feel out of place. */

  :global(.clr-picker) {
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  }

  :global(.clr-field) {
    width: 100%;
  }

  :global(.clr-field button) {
    border-radius: 3px;
    width: 22px;
    height: 22px;
    top: 3px;
    right: 3px;
  }
</style>
