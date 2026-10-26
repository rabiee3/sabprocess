import { normalizeDigits } from '../survey/draft'

/** http(s) links only; a bare host gets https://. Anything with another scheme (javascript:, data:) is not linked. */
export function safeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const url = /^https?:\/\//i.test(v) ? v : /^[a-z][a-z0-9+.-]*:/i.test(v) ? null : `https://${v}`
  if (!url) return null
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/** wa.me wants digits with the country code; Egyptian local numbers start with 0. */
export function whatsappHref(raw: string): string | null {
  let digits = normalizeDigits(raw).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `20${digits.slice(1)}`
  return digits ? `https://wa.me/${digits}` : null
}
