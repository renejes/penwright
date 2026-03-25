/**
 * Bridge to use the webview deserializer in the main process.
 * The deserializer is pure TypeScript (no DOM dependencies), so it works in Node.js.
 */

export { deserializeTypst } from '../editor/lib/deserializer';
