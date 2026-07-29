declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

// CSS files imported for their side effect (Vite handles them as bundled
// stylesheets). TypeScript needs the declaration to stop flagging the import.
declare module '*.css';

/**
 * Markdown imported as raw text (`?raw`), used by the in-app handbook viewer.
 * Vite resolves these; without the declaration svelte-check reports the only
 * two errors left in the whole tree, which is enough noise to make a typecheck
 * gate feel not worth wiring in — and it was not wired in for exactly that
 * reason.
 */
declare module '*.md?raw' {
  const content: string;
  export default content;
}
