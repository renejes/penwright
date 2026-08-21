/** First-run onboarding wizard — guided tour shown once on the Start Screen. */
export const onboarding = {
  ariaLabel: 'Penwright — Introduction',
  stepAria: (n: number) => `Step ${n}`,
  openSample: 'Open Sample Project',

  steps: {
    welcome: {
      title: 'Welcome to Penwright',
      body: 'Write beautiful documents — academic, editorial, magazine-style — entirely <strong>without code</strong>. Penwright is a WYSIWYG editor on top of Typst. Everything is bundled: just get started, nothing to install.',
    },
    project: {
      title: 'Everything in one project folder',
      body: 'Every document lives in its own <strong>project</strong>. Versions, auto-backups and settings live right inside it — copy the folder and you take the whole state with you.',
    },
    writing: {
      title: 'Write as usual',
      body: 'Format with the toolbar at the top — bold, italic, headings, lists. The Typst source stays clean the whole time.',
    },
    insert: {
      title: 'Insert anything — the ＋ button',
      body: 'Click <strong>＋</strong> on the left of the toolbar to insert headings, lists, images, tables, formulas, footnotes, citations, page breaks or raw Typst blocks. The same menu opens when you type <code>/</code> in the text — and <code>@</code> jumps straight to citations &amp; cross-references.',
    },
    design: {
      title: 'Design — separate from writing',
      body: 'Write first, design later. You shape the <strong>Look</strong> wherever it should apply:',
      bullets: [
        '<strong>Direct formatting</strong> — the buttons in the toolbar at the top, just like in Word.',
        '<strong>The Look</strong> — open <code>style.typ</code> for the visual designer (the whole document), or pick a per-chapter Look in the status bar below.',
        '<strong>Chat</strong> — describe what you need, or select text, right-click <strong>Insert into Chat</strong>, and say what should happen at that spot.',
      ],
    },
    claude: {
      title: 'Optional: Cursor or Claude',
      body: 'The in-app chat (View → Chat) uses your Cursor account. You can still connect an external MCP host under <strong>Help → MCP Connection</strong> if you prefer Cursor IDE or Claude Desktop.',
    },
    ready: {
      title: 'Ready to get started?',
      body: 'The best way to begin is the <strong>sample project</strong> — it shows chapters, comments, citations and design on real material. Or create a new project right away.',
    },
  },
};

export type OnboardingMessages = typeof onboarding;
