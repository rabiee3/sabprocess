import type { HsCode } from './types';

export function normalizeHs(input: string): string {
  return input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

const DIGIT_QUERY = /^[\d٠-٩۰-۹.\s-]+$/;

/** True when the raw query is only digits/dots/spaces/dashes and has at least 2 digits. */
export function isHsQuery(q: string): boolean {
  return DIGIT_QUERY.test(q) && normalizeHs(q).length >= 2;
}

export function validateHs(hs: HsCode): { ok: true } | { ok: false; error: 'heading' | 'sub' | 'tariff' } {
  if (!/^\d{4}$/.test(hs.heading)) return { ok: false, error: 'heading' };
  if (hs.sub !== undefined && !(/^\d{6}$/.test(hs.sub) && hs.sub.startsWith(hs.heading))) {
    return { ok: false, error: 'sub' };
  }
  if (hs.tariff !== undefined) {
    if (hs.sub === undefined || !/^\d{10}$/.test(hs.tariff) || !hs.tariff.startsWith(hs.sub)) {
      return { ok: false, error: 'tariff' };
    }
  }
  return { ok: true };
}

export function hsString(hs?: HsCode): string | undefined {
  if (!hs) return undefined;
  return hs.tariff ?? hs.sub ?? hs.heading;
}

export function hsMatchesPrefix(code: string, query: string): boolean {
  const q = normalizeHs(query);
  if (!q) return false;
  return code.startsWith(q);
}

export function formatHs(code: string): string {
  switch (code.length) {
    case 4: return code;
    case 6: return `${code.slice(0, 4)}.${code.slice(4)}`;
    case 8: return `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}`;
    case 10: return `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6, 8)}.${code.slice(8)}`;
    default: return code;
  }
}
