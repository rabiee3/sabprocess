const ARABIC_INDIC = /[٠-٩]/g
const EXTENDED_ARABIC_INDIC = /[۰-۹]/g

/** Strips non-digits (after converting Arabic-Indic digits) and returns the 6-char code, or null. */
export function normalizeInviteCode(input: string): string | null {
  const digits = input
    .replace(ARABIC_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}
