const ARABIC_INDIC = /[٠-٩]/g
const EXTENDED_ARABIC_INDIC = /[۰-۹]/g

/** Converts Arabic-Indic digits to ASCII and strips everything that is not a digit. */
export function toAsciiDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
}

/** Returns the 6-char code (after digit normalization), or null. */
export function normalizeInviteCode(input: string): string | null {
  const digits = toAsciiDigits(input)
  return digits.length === 6 ? digits : null
}
