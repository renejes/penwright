/**
 * How a typed page becomes the supplement Typst stores on a citation.
 * Pure: the editor imports this, including the iPad build, which cannot
 * load Node's `path` module.
 */

/** `12` → `S. 12`, `12-14` → `S. 12–14`. Empty stays empty. `f.` / `ff.` are dropped. */
export function formatCitationPage(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/\s+f{1,2}\.?\s*$/i, '').trim();
  s = s.replace(/^(?:S\.|pp?\.)\s*/i, '').trim();
  s = s.replace(/\s*[-–—]\s*/g, '–');
  if (!/^\d+(?:–\d+)?$/.test(s)) return null;
  return `S. ${s}`;
}

/** What the page field shows for a supplement already stored on the citation. */
export function pageFieldFromSupplement(supplement: string): string {
  return supplement.replace(/^S\.\s*/i, '').trim();
}
