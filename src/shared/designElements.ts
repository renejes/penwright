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
    'gallery-2up': {},
    'gallery-3up': {},
    'magazine-cover': {},
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
