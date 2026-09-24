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

export function sameChatParams(a: ChatModelParam[], b: ChatModelParam[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(b.map(p => [p.id, p.value]));
  return a.every(p => map.get(p.id) === p.value);
}

/**
 * Params actually sent for one model. Requested values survive only when
 * that model declares the id and lists the value. Anything left over from
 * the previous model is dropped. Declared params fall back to the default
 * variant, then to the first listed value, so the payload matches the dropdown.
 */
export function paramsForModel(model: ChatModelInfo | undefined, requested: ChatModelParam[]): ChatModelParam[] {
  if (!model) return [];
  const allowed = new Map(model.parameters.map(p => [p.id, new Set(p.values.map(v => v.value))]));
  const known = (p: ChatModelParam): boolean => {
    const values = allowed.get(p.id);
    if (values) return values.size === 0 || values.has(p.value);
    if (model.parameters.length > 0) return false;
    return model.variants.some(v => v.params.some(vp => vp.id === p.id && vp.value === p.value));
  };
  const keep = (list: ChatModelParam[]) => list.filter(known);
  const variant = model.variants.find(v => v.isDefault) ?? model.variants[0];

  if (model.parameters.length === 0) {
    const requestedOk = keep(requested);
    if (requestedOk.length > 0) return requestedOk;
    return variant?.params ?? [];
  }

  const merged = new Map<string, string>();
  for (const p of model.parameters) {
    if (p.values[0]) merged.set(p.id, p.values[0].value);
  }
  for (const p of keep(variant?.params ?? [])) merged.set(p.id, p.value);
  for (const p of keep(requested)) merged.set(p.id, p.value);
  return [...merged.entries()].map(([id, value]) => ({ id, value }));
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1000) return String(Math.round(n));
  if (n < 100_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
