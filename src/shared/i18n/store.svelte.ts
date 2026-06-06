/**
 * Reactive i18n store for the renderer + editor (Svelte 5 runes).
 *
 * The pure-data dictionaries live in ./index (main-safe); this file adds the
 * reactive `locale` layer and is ONLY ever imported by .svelte files. The main
 * process must never import this module (it would pull the Svelte runtime).
 *
 * Usage in a component:
 *   import { t } from '@shared/i18n/store.svelte';
 *   <h2>{t().design.title}</h2>
 *
 * `t()` reads `i18nState.locale` internally, so calling it inside a template or
 * $derived makes that markup re-render when the locale changes.
 */
import { dictionaries, normalizeLocale, type Locale, type Messages } from './index';

function initialLocale(): Locale {
  // Best first guess before the persisted choice arrives over IPC; avoids a
  // flash of the wrong language for the common case (OS locale == app locale).
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return normalizeLocale(navigator.language);
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

export const i18nState = $state({ locale: initialLocale() });

/** Reactive accessor: returns the active dictionary. */
export function t(): Messages {
  return dictionaries[i18nState.locale] ?? dictionaries.en;
}

export function getLocale(): Locale {
  return i18nState.locale;
}

/** Apply a locale in memory + reflect it on <html lang>. Does NOT persist. */
export function applyLocale(raw: string | null | undefined): void {
  i18nState.locale = normalizeLocale(raw);
  try {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = i18nState.locale;
    }
  } catch {
    /* non-DOM env */
  }
}

/** User-initiated locale change: apply + persist globally via IPC. */
export function setLocale(raw: string | null | undefined): void {
  applyLocale(raw);
  try {
    (
      globalThis as unknown as {
        electronAPI?: { invoke(c: string, ...a: unknown[]): Promise<unknown> };
      }
    ).electronAPI?.invoke('app:setLocale', i18nState.locale);
  } catch {
    /* ignore */
  }
}
