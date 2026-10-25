import { formatHs } from '../lib/hs'

export function HsBadge({ code, variant }: { code: string; variant: 'made' | 'needed' }) {
  const tone = variant === 'made' ? 'bg-brand-50 text-brand-900' : 'bg-blue-50 text-blue-800'
  return (
    <span dir="ltr" className={`inline-block rounded-sm px-2 py-0.5 font-mono text-xs font-semibold ${tone}`}>
      {formatHs(code)}
    </span>
  )
}
