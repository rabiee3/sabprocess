import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import searchIcon from '../assets/icons/search.svg?raw'
import closeIcon from '../assets/icons/close.svg?raw'
import { formatHs } from '../lib/hs'
import type { Engine } from '../search/engine'
import { suggest, type Suggestions } from '../search/suggest'
import type { Lang } from './labels'
import type { MapStatePatch } from './useMapState'

type Option = { key: string; group: string; label: string; hint?: string; patch: MapStatePatch }

type Props = {
  engine: Engine | null
  lang: Lang
  /** The text shown when idle (the committed query, or the HS code filter). */
  value: string
  onApply: (patch: MapStatePatch) => void
  onClear: () => void
}

const EMPTY: Suggestions = { products: [], hs: [], sectors: [], areas: [] }

export function SearchBar({ engine, lang, value, onApply, onClear }: Props) {
  const { t } = useTranslation()
  const uid = useId()
  const listId = `${uid}-list`
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [sug, setSug] = useState<Suggestions>(EMPTY)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => setText(value), [value])

  // Suggestions are debounced; the engine is built once elsewhere.
  useEffect(() => {
    if (!engine || !text.trim() || text === value) {
      setSug(EMPTY)
      return
    }
    const h = setTimeout(() => setSug(suggest(engine, text, lang)), 150)
    return () => clearTimeout(h)
  }, [engine, text, lang, value])

  const options = useMemo<Option[]>(() => {
    const q = text.trim()
    if (!q || text === value) return []
    const o: Option[] = [{ key: 'q', group: '', label: t('map.searchFor', { q }), patch: { q, hs: '' } }]
    for (const p of sug.products) o.push({ key: `p-${p.q}`, group: t('map.sugProducts'), label: p.label, patch: { q: p.q, hs: '' } })
    for (const h of sug.hs) o.push({ key: `h-${h.code}`, group: t('map.sugHs'), label: h.label, hint: formatHs(h.code), patch: { hs: h.code, q: '' } })
    for (const s of sug.sectors) o.push({ key: `s-${s.id}`, group: t('map.sugSectors'), label: s.label, patch: { sector: s.id, q: '', hs: '' } })
    for (const a of sug.areas) o.push({ key: `a-${a.id}`, group: t('map.sugAreas'), label: a.label, patch: { area: a.id, q: '', hs: '' } })
    return o
  }, [sug, text, value, t])

  const show = open && options.length > 0
  const pick = (o: Option) => {
    onApply(o.patch)
    setOpen(false)
    setActive(-1)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setActive(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (show && active >= 0) pick(options[active])
      else {
        onApply({ q: text.trim(), hs: '' })
        setOpen(false)
      }
    }
  }

  const groups: { name: string; items: { o: Option; i: number }[] }[] = []
  options.forEach((o, i) => {
    let g = groups.find((x) => x.name === o.group)
    if (!g) groups.push((g = { name: o.group, items: [] }))
    g.items.push({ o, i })
  })

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
      <div className="flex min-h-control items-center gap-2 rounded-lg border border-line bg-surface px-3 shadow-md">
        <span aria-hidden="true" className="size-5 shrink-0 text-ink-muted" dangerouslySetInnerHTML={{ __html: searchIcon }} />
        <input
          ref={input}
          type="search"
          role="combobox"
          enterKeyHint="search"
          aria-label={t('map.searchLabel')}
          aria-autocomplete="list"
          aria-expanded={show}
          aria-controls={listId}
          aria-activedescendant={show && active >= 0 ? `${uid}-o${active}` : undefined}
          placeholder={t('map.searchPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          className="min-h-control min-w-0 flex-1 bg-transparent text-body outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {(text || value) && (
          <button
            type="button"
            aria-label={t('map.clear')}
            onClick={() => {
              setText('')
              onClear()
              input.current?.focus()
            }}
            className="-me-2 flex min-h-touch min-w-11 items-center justify-center"
          >
            <span aria-hidden="true" className="size-5" dangerouslySetInnerHTML={{ __html: closeIcon }} />
          </button>
        )}
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={t('map.searchLabel')}
        hidden={!show}
        className="absolute inset-x-0 top-full z-10 mt-1 max-h-[60vh] overflow-auto rounded-lg border border-line bg-surface py-1 shadow-md"
      >
        {show &&
          groups.map((g) => (
            <div key={g.name} role="group" aria-label={g.name || t('map.searchLabel')}>
              {g.name && <p aria-hidden="true" className="px-3 pt-2 text-caption font-semibold uppercase text-ink-muted">{g.name}</p>}
              {g.items.map(({ o, i }) => (
                <div
                  key={o.key}
                  id={`${uid}-o${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  className={`flex min-h-touch cursor-pointer items-center justify-between gap-3 px-3 text-body-sm ${i === active ? 'bg-brand-50' : ''}`}
                >
                  <bdi>{o.label}</bdi>
                  {o.hint && <span dir="ltr" className="font-mono text-caption text-ink-muted">{o.hint}</span>}
                </div>
              ))}
            </div>
          ))}
      </div>
    </form>
  )
}
