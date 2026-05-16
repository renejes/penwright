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
