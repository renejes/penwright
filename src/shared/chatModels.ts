/**
 * Chat model catalogue helpers. Pure — both the host (after Cursor.models.list)
 * and the renderer (dropdown) use the same shape so Fast / thinking controls
 * don't disappear when the API omits a documented parameter.
 */
import type { ChatModelInfo, ChatModelParam, ChatModelParamDef, ChatModelVariant } from './chatTypes';

const FAST_PARAM: ChatModelParamDef = {
  id: 'fast',
  displayName: 'Fast',
  values: [
    { value: 'false', displayName: 'Off' },
    { value: 'true', displayName: 'Fast' },
  ],
};

export function normalizeChatModel(raw: {
  id: string;
  displayName?: string;
  parameters?: ChatModelParamDef[];
  variants?: ChatModelVariant[];
}): ChatModelInfo {
  const id = raw.id.trim();
  const parameters = (raw.parameters ?? []).map(p => ({
    id: p.id,
    displayName: p.displayName || p.id,
    values: (p.values ?? []).map(v => ({
      value: v.value,
      displayName: v.displayName || v.value,
    })),
  }));
  // Cursor documents Fast as `{ id: "fast", value: "true" }` on Composer.
  // Some list() responses omit `parameters` entirely — without this the
  // dropdown had nothing to show and the setting appeared broken.
  if (/composer/i.test(id) && !parameters.some(p => p.id === 'fast')) {
    parameters.unshift({
      id: FAST_PARAM.id,
      displayName: FAST_PARAM.displayName,
      values: FAST_PARAM.values.map(v => ({ ...v })),
    });
  }
  return {
    id,
    displayName: (raw.displayName ?? '').trim() || id,
    parameters,
    variants: raw.variants ?? [],
  };
}

export function isThinkingParam(p: ChatModelParamDef): boolean {
  return /think|effort|reason/i.test(p.id) || /think|effort|reason/i.test(p.displayName);
}

export function isFastParam(p: ChatModelParamDef): boolean {
  return p.id === 'fast';
}

export function upsertParam(params: ChatModelParam[], id: string, value: string): ChatModelParam[] {
  return [...params.filter(p => p.id !== id), { id, value }];
}

export function paramValue(params: ChatModelParam[], id: string, fallback: string): string {
  return params.find(p => p.id === id)?.value ?? fallback;
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1000) return String(Math.round(n));
  if (n < 100_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
