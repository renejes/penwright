/**
 * i18n — pure data layer (main-safe, no Svelte runes).
 *
 * `en` is the source of truth for the message shape; `de` is type-checked
 * against it. The renderer/editor consume these through the reactive store in
 * ./store.svelte.ts; the main process imports `resolveDict` / `normalizeLocale`
 * directly (relative path) for the native menu and dialogs.
 */
import { en } from './en';
import { de } from './de';

export type Locale = 'en' | 'de';
export type Messages = typeof en;

export const dictionaries: Record<Locale, Messages> = { en, de };

/** Map any OS / stored locale string ('de-DE', 'en_US', null…) to a supported Locale. */
export function normalizeLocale(raw: string | null | undefined): Locale {
  if (!raw) return 'en';
  return raw.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function resolveDict(locale: string | null | undefined): Messages {
  return dictionaries[normalizeLocale(locale)];
}

export { en, de };
