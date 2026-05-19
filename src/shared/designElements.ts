/**
 * Design element library — six recurring layout blocks that Phase C's
 * `vswrite_insert_design_element` MCP tool drops into a document.
 *
 * Each element is a parametric Typst snippet. The renderer fills the
 * `{placeholder}` slots with caller-supplied values, escapes them as
 * Typst content, and inserts the result after an anchor in main.typ.
 *
 * Why a separate file: keeps the snippets reviewable in one place, and
 * lets us share them between the MCP tool, a future "Insert element"
 * slash-command, and (down the road) the Design panel's "Insert" picker.
 *
 * Convention: every snippet references `style-colors.<slot>` so the
 * element automatically picks up the project's palette. Inserting a
 * "Banner" into a Marketing-Brochure theme gives a navy banner; the
 * same banner in Modern-Tech gives a slate banner — no edits needed.
 */

export type DesignElementId =
  | 'banner'
  | 'sidebar'
  | 'pull-quote'
  | 'callout'
  | 'hero'
  | 'divider'
  | 'drop-cap'
  | 'divider-asterisks'
  | 'divider-ornament'
  | 'pull-quote-display'
  | 'pull-quote-block'
  | 'article-opener'
  | 'section-opener'
  | 'gallery-2up'
  | 'gallery-3up'
  | 'gallery-asymmetric'
  | 'image-overlay'
  | 'stats-box'
  | 'photo-caption-wrap'
  | 'magazine-cover';

export interface DesignElementParam {
  /** Field name in the params object the caller passes. */
  name: string;
  description: string;
  required: boolean;
  /** Default if the caller omits the field. */
  defaultValue?: string;
}

export interface DesignElement {
  id: DesignElementId;
  name: string;
  description: string;
  params: DesignElementParam[];
  /** Typst source with `{name}` placeholders for each param. */
  template: string;
}

export const DESIGN_ELEMENTS: DesignElement[] = [
  {
    id: 'banner',
    name: 'Banner',
    description: 'Full-width bar with bold inverted text. Use as section opener or strong divider.',
    params: [
      { name: 'title', description: 'Banner text', required: true, defaultValue: 'Section Title' },
    ],
    template: `
#block(width: 100%, fill: style-colors.primary, inset: (x: 1em, y: 0.7em), radius: 3pt)[
  #text(fill: style-colors.background, size: 1.4em, weight: "bold")[{title}]
]
`.trim(),
  },

  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Right-floating callout box with accent border. Good for definitions, side notes, or quick references.',
    params: [
      { name: 'title', description: 'Sidebar heading', required: false, defaultValue: '' },
      { name: 'content', description: 'Sidebar body — supports Typst markup', required: true, defaultValue: 'Sidebar content.' },
    ],
    template: `
#block(
  width: 30%,
  inset: 0.8em,
  fill: style-colors.muted.lighten(85%),
  stroke: (left: 3pt + style-colors.accent),
  radius: 2pt,
)[
  {title-block}#text(fill: style-colors.text)[{content}]
]
`.trim(),
  },

  {
    id: 'pull-quote',
    name: 'Pull-Quote',
    description: 'Large centered quote with a thin accent divider underneath. Used to highlight a striking sentence from the body text.',
    params: [
      { name: 'text', description: 'The quoted text (no surrounding quotation marks needed)', required: true, defaultValue: 'A striking sentence.' },
      { name: 'attribution', description: 'Optional attribution shown below the quote', required: false, defaultValue: '' },
    ],
    template: `
#align(center)[
  #text(size: 1.5em, weight: "semibold", fill: style-colors.primary, style: "italic")["{text}"]
  {attribution-block}
  #v(0.4em)
  #line(length: 25%, stroke: 1pt + style-colors.accent)
]
`.trim(),
  },

  {
    id: 'callout',
    name: 'Callout',
    description: 'Boxed info / warning / tip note with an accent border. Defaults to "info" style; pass kind=warning or kind=tip for variants.',
    params: [
      { name: 'kind', description: 'One of "info" | "warning" | "tip" | "note". Controls the icon and accent.', required: false, defaultValue: 'info' },
      { name: 'title', description: 'Bold headline above the body. Empty = no headline.', required: false, defaultValue: '' },
      { name: 'body', description: 'Callout body text', required: true, defaultValue: 'Callout body.' },
    ],
    template: `
#block(
  fill: style-colors.accent.lighten(85%),
  stroke: (left: 4pt + style-colors.accent),
  inset: (x: 1em, y: 0.7em),
  radius: 3pt,
)[
  {title-block}#text(fill: style-colors.text)[{body}]
]
`.trim(),
  },

  {
    id: 'hero',
    name: 'Hero',
    description: 'Large centered title + subtitle block. Use as a cover-section opener on the first page.',
    params: [
      { name: 'title', description: 'Hero headline', required: true, defaultValue: 'Title' },
      { name: 'subtitle', description: 'Subtitle / tagline shown beneath', required: false, defaultValue: '' },
    ],
    template: `
#v(2em)
#align(center)[
  #text(size: 2.8em, weight: "bold", fill: style-colors.primary)[{title}]
  {subtitle-block}
]
#v(2em)
`.trim(),
  },

  {
    id: 'divider',
    name: 'Section divider',
    description: 'Thin centered horizontal rule with vertical breathing room. Drops into a body to mark a soft section break without a heading.',
    params: [],
    template: `
#v(1.5em)
#align(center)[
  #line(length: 25%, stroke: 0.5pt + style-colors.muted)
]
#v(1.5em)
`.trim(),
  },

  {
    id: 'stats-box',
    name: 'Stats / "By the numbers" box',
    description: 'A magazine-style sidebar of 3 or 4 large numbers with short labels — the classic "By the numbers" infographic that appears next to a feature article. Each number renders large in the primary colour with a muted label beneath. Optional header strip at the top.',
    params: [
      { name: 'header', description: 'Optional uppercase header above the stats — e.g. "BY THE NUMBERS", "THE FACTS". Empty = no header.', required: false, defaultValue: 'BY THE NUMBERS' },
      { name: 'number1', description: 'First big number — short string, anything that fits visually (e.g. "42", "1.8M", "87%").', required: true, defaultValue: '42' },
      { name: 'label1', description: 'Short label beneath the first number.', required: true, defaultValue: 'Years on the job' },
      { name: 'number2', description: 'Second big number.', required: true, defaultValue: '1.8M' },
      { name: 'label2', description: 'Short label beneath the second number.', required: true, defaultValue: 'Households reached' },
      { name: 'number3', description: 'Third big number.', required: true, defaultValue: '87%' },
      { name: 'label3', description: 'Short label beneath the third number.', required: true, defaultValue: 'Satisfaction rate' },
      { name: 'number4', description: 'Optional fourth big number. Empty = only three rows.', required: false, defaultValue: '' },
      { name: 'label4', description: 'Optional fourth label.', required: false, defaultValue: '' },
    ],
    template: `
#block(
  fill: style-colors.muted.lighten(90%),
  stroke: (top: 4pt + style-colors.accent),
  inset: (x: 1.2em, y: 1.2em),
  radius: 3pt,
)[
  {header-block}
  #text(size: 2.4em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{number1}]
  #v(-0.4em)
  #text(size: 0.85em, fill: style-colors.muted)[{label1}]

  #v(0.8em)
  #text(size: 2.4em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{number2}]
  #v(-0.4em)
  #text(size: 0.85em, fill: style-colors.muted)[{label2}]

  #v(0.8em)
  #text(size: 2.4em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{number3}]
  #v(-0.4em)
  #text(size: 0.85em, fill: style-colors.muted)[{label3}]
  {row4-block}
]
`.trim(),
  },

  {
    id: 'image-overlay',
    name: 'Image with text overlay',
    description: 'A photo at full column-width with a dark gradient at the bottom and title + optional subtitle rendered in white over the gradient. The editorial "section opener with photo" pattern — also works as an inline visual break that carries a headline. Image path must resolve relative to the document.',
    params: [
      { name: 'image', description: 'Relative path to the background image (e.g. "assets/hero.jpg").', required: true, defaultValue: 'assets/hero.jpg' },
      { name: 'title', description: 'Headline text rendered in white over the photo, near the bottom.', required: true, defaultValue: 'Headline Over the Photo' },
      { name: 'subtitle', description: 'Optional smaller text beneath the title. Empty = no subtitle.', required: false, defaultValue: '' },
      { name: 'height', description: 'Block height as a Typst length (e.g. "12cm", "60%"). Defaults to 12cm — tall enough for impact, short enough to leave room for body text.', required: false, defaultValue: '12cm' },
    ],
    template: `
#block(
  width: 100%,
  height: {height},
  clip: true,
  radius: 3pt,
)[
  #place(top + left, image("{image}", width: 100%, height: 100%, fit: "cover"))
  #place(bottom + left, dx: 0pt, dy: 0pt,
    block(
      width: 100%,
      height: 50%,
      fill: gradient.linear(rgb(0, 0, 0, 0%), rgb(0, 0, 0, 70%), angle: 90deg),
    )
  )
  #place(bottom + left, dx: 1.2em, dy: -1em,
    block(width: 90%)[
      #text(size: 2em, weight: "bold", fill: white, font: style-fonts.heading)[{title}]
      {subtitle-block}
    ]
  )
]
`.trim(),
  },

  {
    id: 'gallery-asymmetric',
    name: 'Image Gallery (asymmetric)',
    description: 'One large image on the left at ~2/3 width plus two smaller images stacked on the right — the classic editorial "hero + two supporting shots" pattern. Optional captions under each. All three paths must resolve relative to the document.',
    params: [
      { name: 'imageMain', description: 'Relative path to the large hero image on the left (e.g. "assets/main.jpg").', required: true, defaultValue: 'assets/photo-1.jpg' },
      { name: 'imageTop', description: 'Relative path to the upper-right supporting image.', required: true, defaultValue: 'assets/photo-2.jpg' },
      { name: 'imageBottom', description: 'Relative path to the lower-right supporting image.', required: true, defaultValue: 'assets/photo-3.jpg' },
      { name: 'captionMain', description: 'Optional caption beneath the main image.', required: false, defaultValue: '' },
      { name: 'captionTop', description: 'Optional caption beneath the upper-right image.', required: false, defaultValue: '' },
      { name: 'captionBottom', description: 'Optional caption beneath the lower-right image.', required: false, defaultValue: '' },
    ],
    template: `
#grid(
  columns: (2fr, 1fr),
  column-gutter: 0.8em,
  row-gutter: 0.4em,
  // left column: main image + its caption beneath
  [
    #image("{imageMain}", width: 100%)
    {captionMain-cell}
  ],
  // right column: two stacked images with their captions
  [
    #image("{imageTop}", width: 100%)
    {captionTop-cell}
    #v(0.6em)
    #image("{imageBottom}", width: 100%)
    {captionBottom-cell}
  ],
)
`.trim(),
  },

  {
    id: 'magazine-cover',
    name: 'Magazine Cover',
    description: 'Full-page magazine cover block: masthead title at the top, small uppercase issue label, large cover headline mid-page, optional subhead, date at the bottom. Optional background image fills the page edge-to-edge. Uses Typst\'s `#page(margin: 0pt)` so the cover gets zero margins for one page only — the rest of the document keeps its configured margins. Drop at the very top of main.typ before any chapter includes.',
    params: [
      { name: 'issue', description: 'Issue identifier — e.g. "ISSUE 42", "VOL. III · 2026", "AUTUMN 2026".', required: true, defaultValue: 'ISSUE 1' },
      { name: 'title', description: 'Magazine masthead title — e.g. "NEUES LERNEN", "THE LOCAL PROJECT".', required: true, defaultValue: 'MAGAZINE' },
      { name: 'headline', description: 'Cover-line — the main story-pull. 2–8 words.', required: true, defaultValue: 'The Quiet Architect' },
      { name: 'subhead', description: 'Smaller cover-line beneath the headline. Empty = no subhead.', required: false, defaultValue: '' },
      { name: 'date', description: 'Cover date — e.g. "November 2026".', required: false, defaultValue: 'November 2026' },
      { name: 'image', description: 'Optional path to a cover image (relative to the document). If provided, fills the page behind the type. Empty = no background image.', required: false, defaultValue: '' },
    ],
    template: `
#page(margin: 0pt)[
  {image-bg}
  #pad(x: 2cm, y: 2cm)[
    #text(size: 4em, weight: "bold", tracking: 0.05em, fill: style-colors.primary, font: style-fonts.heading)[{title}]
    #v(0.4em)
    #text(size: 0.9em, weight: "bold", tracking: 0.15em, fill: style-colors.muted)[{issue}]

    #v(1fr)

    #text(size: 3em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{headline}]
    {subhead-block}

    #v(1fr)

    #text(size: 0.9em, fill: style-colors.muted)[{date}]
  ]
]
#pagebreak(weak: true)
`.trim(),
  },

  {
    id: 'gallery-2up',
    name: 'Image Gallery (2-up)',
    description: 'Two images side-by-side at equal column width, with optional captions below each. Use for paired photographs (before / after, two perspectives). Both image paths must resolve relative to the document (typically inside `assets/`).',
    params: [
      { name: 'image1', description: 'Relative path to the first image, e.g. "assets/photo-1.jpg".', required: true, defaultValue: 'assets/photo-1.jpg' },
      { name: 'image2', description: 'Relative path to the second image.', required: true, defaultValue: 'assets/photo-2.jpg' },
      { name: 'caption1', description: 'Optional caption beneath the first image. Empty = no caption.', required: false, defaultValue: '' },
      { name: 'caption2', description: 'Optional caption beneath the second image. Empty = no caption.', required: false, defaultValue: '' },
    ],
    template: `
#grid(
  columns: (1fr, 1fr),
  column-gutter: 1em,
  row-gutter: 0.4em,
  image("{image1}", width: 100%),
  image("{image2}", width: 100%),
  {caption1-cell},
  {caption2-cell},
)
`.trim(),
  },

  {
    id: 'gallery-3up',
    name: 'Image Gallery (3-up)',
    description: 'Three images side-by-side at equal column width. Use for triptychs or short series. All three image paths must resolve relative to the document.',
    params: [
      { name: 'image1', description: 'Relative path to the first image.', required: true, defaultValue: 'assets/photo-1.jpg' },
      { name: 'image2', description: 'Relative path to the second image.', required: true, defaultValue: 'assets/photo-2.jpg' },
      { name: 'image3', description: 'Relative path to the third image.', required: true, defaultValue: 'assets/photo-3.jpg' },
      { name: 'caption1', description: 'Optional caption beneath the first image.', required: false, defaultValue: '' },
      { name: 'caption2', description: 'Optional caption beneath the second image.', required: false, defaultValue: '' },
      { name: 'caption3', description: 'Optional caption beneath the third image.', required: false, defaultValue: '' },
    ],
    template: `
#grid(
  columns: (1fr, 1fr, 1fr),
  column-gutter: 0.8em,
  row-gutter: 0.4em,
  image("{image1}", width: 100%),
  image("{image2}", width: 100%),
  image("{image3}", width: 100%),
  {caption1-cell}, {caption2-cell}, {caption3-cell},
)
`.trim(),
  },

  {
    id: 'section-opener',
    name: 'Section Opener',
    description: 'Full-page typographic moment between articles or major sections. Inserts a pagebreak before, centers a small uppercase title plus a large subtitle plus a short accent rule, then a pagebreak after. The result is a single dedicated page you would see in a magazine between feature sections.',
    params: [
      { name: 'title', description: 'Small uppercase label at the top of the page. E.g. "PART TWO", "CHAPTER III", "FEATURE".', required: false, defaultValue: 'PART TWO' },
      { name: 'subtitle', description: 'Large display text — the actual title of the section. Usually 2–5 words.', required: true, defaultValue: 'After the Storm' },
    ],
    template: `
#pagebreak(weak: true)

#v(1fr)
#align(center)[
  #text(size: 0.85em, weight: "bold", tracking: 0.12em, fill: style-colors.muted)[{title}]
  #v(0.6em)
  #text(size: 3.5em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{subtitle}]
  #v(0.8em)
  #line(length: 12%, stroke: 1pt + style-colors.accent)
]
#v(1fr)

#pagebreak(weak: true)
`.trim(),
  },

  {
    id: 'article-opener',
    name: 'Article Opener',
    description: 'The masthead block at the top of an article: small uppercase kicker (category label), large display headline, lead paragraph (standfirst), byline. Drop in at the very top of an article to give it the magazine-magazine feel. NOTE: the headline is wrapped in a level-1 heading so it still appears in the outline / TOC. Don\'t pair with a separate H1.',
    params: [
      { name: 'kicker', description: 'Small uppercase category label above the headline. E.g. "PROFILE", "INTERVIEW", "ESSAY", "REPORT". Empty = no kicker.', required: false, defaultValue: '' },
      { name: 'headline', description: 'The article title. Renders large in the heading font / primary color, AND becomes the article\'s H1 so it shows up in the outline.', required: true, defaultValue: 'Article Title' },
      { name: 'standfirst', description: 'The lead paragraph — usually 1–3 sentences. Renders in italics at ~1.25em.', required: false, defaultValue: '' },
      { name: 'byline', description: 'Author + photographer credit. E.g. "By Sam Cooper, Photography by Maya Reidt". Empty = no byline.', required: false, defaultValue: '' },
    ],
    template: `
{kicker-block}
#heading(level: 1, outlined: true, numbering: none)[
  #text(size: 2.4em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[{headline}]
]
{standfirst-block}
{byline-block}
#v(1em)
`.trim(),
  },

  {
    id: 'pull-quote-display',
    name: 'Display Pull-Quote',
    description: 'Very large centered quote — no border, no italic. A monumental visual break in long-form articles, often a single striking sentence pulled from earlier in the body. Bigger and bolder than `pull-quote`; no decorative line.',
    params: [
      { name: 'text', description: 'The quoted text (no surrounding quotation marks needed).', required: true, defaultValue: 'A striking sentence.' },
    ],
    template: `
#v(1.5em)
#align(center)[
  #text(size: 2.2em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[
    "{text}"
  ]
]
#v(1.5em)
`.trim(),
  },

  {
    id: 'pull-quote-block',
    name: 'Block Pull-Quote',
    description: 'Boxed pull-quote with subtle background fill and an accent-colored left bar. Use when the quote should feel "set apart" rather than monumentally large — fits 2-column magazine layouts particularly well.',
    params: [
      { name: 'text', description: 'The quoted text.', required: true, defaultValue: 'A striking sentence.' },
      { name: 'attribution', description: 'Optional attribution shown below the quote. Empty = no attribution.', required: false, defaultValue: '' },
    ],
    template: `
#v(1em)
#block(
  fill: style-colors.muted.lighten(85%),
  stroke: (left: 4pt + style-colors.accent),
  inset: (x: 1.2em, y: 1em),
  radius: 3pt,
)[
  #text(size: 1.15em, style: "italic", fill: style-colors.text)["{text}"]
  {attribution-block}
]
#v(1em)
`.trim(),
  },

  {
    id: 'divider-asterisks',
    name: 'Divider (Asterisks)',
    description: 'Centered three-asterisk ornament. Use for soft section breaks within long-form articles where a thin rule would be too utilitarian — the classic editorial choice.',
    params: [],
    template: `
#v(1.5em)
#align(center)[
  #text(size: 1.4em, fill: style-colors.muted, tracking: 0.4em)[\\* \\* \\*]
]
#v(1.5em)
`.trim(),
  },

  {
    id: 'divider-ornament',
    name: 'Divider (Ornament)',
    description: 'Centered single-character typographic ornament (❦ by default). Use sparingly — at most once per article — as a visual signature for major scene transitions.',
    params: [
      { name: 'glyph', description: 'The ornament character. Default ❦. Other good choices: ※, ✦, ☙, ⁂.', required: false, defaultValue: '❦' },
    ],
    template: `
#v(1.5em)
#align(center)[
  #text(size: 1.6em, fill: style-colors.accent)[{glyph}]
]
#v(1.5em)
`.trim(),
  },

  {
    id: 'drop-cap',
    name: 'Drop Cap',
    description: 'Large decorative initial letter wrapping the first lines of a paragraph. Use sparingly — one per long-form opener, never multiple in the same section. Uses the bundled `droplet` package; the first character of `body` automatically becomes the cap.',
    params: [
      { name: 'body', description: 'The full opening paragraph (including the leading letter). Plain text or Typst markup; droplet extracts the first character as the cap.', required: true, defaultValue: 'This is the opening paragraph after the drop cap.' },
      { name: 'height', description: 'How many lines tall the cap is. 3 is the editorial default; 2 reads softer.', required: false, defaultValue: '3' },
    ],
    template: `
#import "@preview/droplet:0.3.1": dropcap

#dropcap(
  height: {height},
  font: style-fonts.heading,
  fill: style-colors.primary,
  weight: "bold",
)[{body}]
`.trim(),
  },
];

/** Get a single element by id. */
export function getDesignElement(id: string): DesignElement | null {
  return DESIGN_ELEMENTS.find(e => e.id === id) ?? null;
}

/**
 * Renders an element's template with the caller-supplied params. Any
 * required param that's missing gets its `defaultValue`. Unknown params
 * are ignored. Special `{<name>-block}` placeholders render optional
 * sub-blocks conditionally — empty value = empty replacement.
 */
export function renderDesignElement(
  element: DesignElement,
  params: Record<string, string>,
): string {
  const values: Record<string, string> = {};
  for (const p of element.params) {
    const supplied = params[p.name];
    values[p.name] = (supplied !== undefined && supplied !== '')
      ? supplied
      : (p.defaultValue ?? '');
  }

  let out = element.template;

  // Conditional sub-blocks. Each element decides how to render the
  // optional pieces; we centralize here so the templates stay readable.
  // The names match `{<param>-block}` placeholders in the template.
  const conditionals: Record<DesignElementId, Record<string, string>> = {
    banner: {},
    sidebar: {
      'title-block': values.title
        ? `#text(fill: style-colors.primary, weight: "bold")[${values.title}] \\\n  \\\n  `
        : '',
    },
    'pull-quote': {
      'attribution-block': values.attribution
        ? `\n  #v(0.3em)\n  #text(size: 0.9em, fill: style-colors.muted)[— ${values.attribution}]`
        : '',
    },
    callout: {
      'title-block': values.title
        ? `*${values.title}*\\\n  \\\n  `
        : '',
    },
    hero: {
      'subtitle-block': values.subtitle
        ? `\n  #v(0.4em)\n  #text(size: 1.2em, fill: style-colors.muted)[${values.subtitle}]`
        : '',
    },
    divider: {},
    'drop-cap': {},
    'divider-asterisks': {},
    'divider-ornament': {},
    'pull-quote-display': {},
    'pull-quote-block': {
      'attribution-block': values.attribution
        ? `\n  #v(0.4em)\n  #align(right)[#text(size: 0.9em, fill: style-colors.muted)[— ${values.attribution}]]`
        : '',
    },
    'article-opener': {
      'kicker-block': values.kicker
        ? `#text(size: 0.85em, weight: "bold", tracking: 0.12em, fill: style-colors.accent)[${values.kicker}]\n#v(0.6em)\n`
        : '',
      'standfirst-block': values.standfirst
        ? `\n#v(0.5em)\n#text(size: 1.25em, style: "italic", fill: style-colors.text)[${values.standfirst}]`
        : '',
      'byline-block': values.byline
        ? `\n#v(0.6em)\n#text(size: 0.85em, fill: style-colors.muted)[${values.byline}]`
        : '',
    },
    'section-opener': {},
    'gallery-2up': {
      'caption1-cell': values.caption1
        ? `text(size: 0.85em, fill: style-colors.muted, "${values.caption1.replace(/"/g, '\\"')}")`
        : '[]',
      'caption2-cell': values.caption2
        ? `text(size: 0.85em, fill: style-colors.muted, "${values.caption2.replace(/"/g, '\\"')}")`
        : '[]',
    },
    'gallery-3up': {
      'caption1-cell': values.caption1
        ? `text(size: 0.85em, fill: style-colors.muted, "${values.caption1.replace(/"/g, '\\"')}")`
        : '[]',
      'caption2-cell': values.caption2
        ? `text(size: 0.85em, fill: style-colors.muted, "${values.caption2.replace(/"/g, '\\"')}")`
        : '[]',
      'caption3-cell': values.caption3
        ? `text(size: 0.85em, fill: style-colors.muted, "${values.caption3.replace(/"/g, '\\"')}")`
        : '[]',
    },
    'gallery-asymmetric': {
      // Asymmetric layout's captions sit inline INSIDE markup blocks
      // (not in their own grid cell), so the conditional form is a
      // markup-content snippet rather than a positional grid argument.
      'captionMain-cell': values.captionMain
        ? `\n    #text(size: 0.85em, fill: style-colors.muted)[${values.captionMain}]`
        : '',
      'captionTop-cell': values.captionTop
        ? `\n    #text(size: 0.85em, fill: style-colors.muted)[${values.captionTop}]`
        : '',
      'captionBottom-cell': values.captionBottom
        ? `\n    #text(size: 0.85em, fill: style-colors.muted)[${values.captionBottom}]`
        : '',
    },
    'image-overlay': {
      'subtitle-block': values.subtitle
        ? `\n      #v(0.4em)\n      #text(size: 1.1em, fill: white)[${values.subtitle}]`
        : '',
    },
    'stats-box': {
      'header-block': values.header
        ? `#text(size: 0.8em, weight: "bold", tracking: 0.15em, fill: style-colors.accent)[${values.header}]\n  #v(0.6em)\n  `
        : '',
      'row4-block': (values.number4 && values.label4)
        ? `\n\n  #v(0.8em)\n  #text(size: 2.4em, weight: "bold", fill: style-colors.primary, font: style-fonts.heading)[${values.number4}]\n  #v(-0.4em)\n  #text(size: 0.85em, fill: style-colors.muted)[${values.label4}]`
        : '',
    },
    'photo-caption-wrap': {},
    'magazine-cover': {
      'image-bg': values.image
        ? `#place(top + left, image("${values.image}", width: 100%, height: 100%, fit: "cover"))`
        : '',
      'subhead-block': values.subhead
        ? `\n    #v(0.5em)\n    #text(size: 1.3em, style: "italic", fill: style-colors.text)[${values.subhead}]`
        : '',
    },
  };

  // Substitute conditional blocks first (some contain {placeholder}-style
  // syntax themselves, but their values are pre-rendered above).
  for (const [k, v] of Object.entries(conditionals[element.id])) {
    out = out.split(`{${k}}`).join(v);
  }

  // Substitute the plain {param} placeholders.
  for (const [k, v] of Object.entries(values)) {
    out = out.split(`{${k}}`).join(v);
  }

  return out;
}
