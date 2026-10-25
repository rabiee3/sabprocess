import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../ui/BottomSheet'
import { chapters, headings, loadSubheadings, type HsSub } from '../data'
import { formatHs, normalizeHs, validateHs } from '../lib/hs'
import type { HsCode } from '../lib/types'
import { searchHeadings } from './search'
import { HsBadge } from './HsBadge'

type Props = {
  open: boolean
  productLabel: string
  value?: HsCode
  onUse: (hs: HsCode | undefined) => void
  onClose: () => void
}

const DIGIT_ONLY = /^[\d.\s-]+$/

export function HsPicker({ open, productLabel, value, onUse, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const ar = i18n.resolvedLanguage === 'ar'
  const nm = (o: { en: string; ar?: string }) => (ar && o.ar ? o.ar : o.en)

  const [heading, setHeading] = useState<string | undefined>()
  const [sub, setSub] = useState<string | undefined>()
  const [tariffRaw, setTariffRaw] = useState('')
  const [showTariff, setShowTariff] = useState(false)
  const [query, setQuery] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const [chapter, setChapter] = useState<string | undefined>()
  const [subs, setSubs] = useState<HsSub[]>([])
  const seq = useRef(0)

  useEffect(() => {
    if (!open) return
    seq.current++
    setHeading(value?.heading)
    setSub(value?.sub)
    setTariffRaw(value?.tariff ?? '')
    setShowTariff(!!value?.tariff)
    setQuery('')
    setBrowsing(false)
    setChapter(undefined)
    // reset only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!heading) {
      setSubs([])
      return
    }
    let live = true
    void loadSubheadings(heading).then((s) => {
      if (live) setSubs(s)
    })
    return () => {
      live = false
    }
  }, [heading])

  const headingInfo = useMemo(() => headings().find((h) => h.code === heading), [heading])
  const hits = useMemo(() => (query.trim() ? searchHeadings(query) : []), [query])
  const chapterHeadings = useMemo(
    () => (chapter ? headings().filter((h) => h.code.startsWith(chapter)) : []),
    [chapter],
  )

  function clearDetail() {
    setSub(undefined)
    setTariffRaw('')
    setShowTariff(false)
  }

  function chooseHeading(code: string) {
    seq.current++
    setHeading(code)
    clearDetail()
    setQuery('')
    setBrowsing(false)
  }

  function onSearch(q: string) {
    setQuery(q)
    const digits = normalizeHs(q)
    if (!DIGIT_ONLY.test(q.trim()) || (digits.length !== 6 && digits.length !== 10)) return
    const code = digits.slice(0, 4)
    if (!headings().some((h) => h.code === code)) return
    const my = ++seq.current
    void loadSubheadings(code).then((list) => {
      if (my !== seq.current) return
      const subCode = digits.slice(0, 6)
      const subOk = list.some((s) => s.code === subCode)
      const tariffOk =
        subOk && digits.length === 10 && validateHs({ heading: code, sub: subCode, tariff: digits }).ok
      setHeading(code)
      setSub(subOk ? subCode : undefined)
      setTariffRaw(tariffOk ? digits : '')
      setShowTariff(tariffOk)
      setBrowsing(false)
    })
  }

  const tariffDigits = normalizeHs(tariffRaw)
  const tariffEmpty = tariffDigits === ''
  const tariffValid =
    !tariffEmpty && !!heading && !!sub && validateHs({ heading, sub, tariff: tariffDigits }).ok
  const tariffBad = showTariff && !!sub && !tariffEmpty && !tariffValid

  let result: HsCode | undefined
  if (heading) {
    if (tariffValid && sub) result = { heading, sub, tariff: tariffDigits }
    else if (sub) result = { heading, sub }
    else result = { heading }
  }
  const deepest = result ? (result.tariff ?? result.sub ?? result.heading) : ''

  const row = 'flex min-h-touch w-full items-center gap-3 border-b border-line px-1 py-2 text-start'

  return (
    <BottomSheet open={open} title={t('hs.title')} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="py-2 text-sm text-ink-muted">{t('hs.for', { name: productLabel })}</p>

        <h3 className="mt-2 text-xs font-semibold uppercase text-ink-muted">1 · {t('hs.heading')}</h3>
        {heading ? (
          <div className="mt-2 flex items-center gap-3 rounded border border-brand-500 bg-brand-50 p-3">
            <HsBadge code={heading} variant="made" />
            <span className="min-w-0 flex-1 text-sm text-ink-strong">
              {headingInfo ? nm(headingInfo) : ''}
            </span>
            <button
              type="button"
              className="min-h-touch px-2 text-sm font-semibold text-brand-700"
              onClick={() => {
                seq.current++
                setHeading(undefined)
                clearDetail()
              }}
            >
              {t('hs.change')}
            </button>
          </div>
        ) : null}
        {!heading || query ? (
          <div className="mt-2">
            <input
              type="search"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t('hs.searchPlaceholder')}
              aria-label={t('hs.searchPlaceholder')}
              className="min-h-control w-full rounded border border-line-strong px-3"
            />
            {heading ? null : query.trim() ? (
              hits.length ? (
                <ul>
                  {hits.map((h) => (
                    <li key={h.code}>
                      <button type="button" className={row} onClick={() => chooseHeading(h.code)}>
                        <HsBadge code={h.code} variant="made" />
                        <span className="text-sm">{nm(h)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-ink-muted">{t('hs.noResults')}</p>
              )
            ) : browsing ? (
              <div>
                {chapter && (
                  <button
                    type="button"
                    className="min-h-touch text-sm font-semibold text-brand-700"
                    onClick={() => setChapter(undefined)}
                  >
                    {t('hs.back')}
                  </button>
                )}
                <ul>
                  {chapter
                    ? chapterHeadings.map((h) => (
                        <li key={h.code}>
                          <button type="button" className={row} onClick={() => chooseHeading(h.code)}>
                            <HsBadge code={h.code} variant="made" />
                            <span className="text-sm">{nm(h)}</span>
                          </button>
                        </li>
                      ))
                    : chapters().map((c) => (
                        <li key={c.code}>
                          <button type="button" className={row} onClick={() => setChapter(c.code)}>
                            <span dir="ltr" className="font-mono text-sm font-semibold">
                              {c.code}
                            </span>
                            <span className="text-sm">{nm(c)}</span>
                          </button>
                        </li>
                      ))}
                </ul>
              </div>
            ) : (
              <button
                type="button"
                className="mt-2 min-h-touch text-sm font-semibold text-brand-700"
                onClick={() => setBrowsing(true)}
              >
                {t('hs.browseChapters')}
              </button>
            )}
          </div>
        ) : null}

        {heading && subs.length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-semibold uppercase text-ink-muted">
              2 · {t('hs.moreDetail')}
            </h3>
            <div role="radiogroup" aria-label={t('hs.moreDetail')} className="mt-2">
              {subs.map((s) => (
                <label key={s.code} className={`${row} cursor-pointer`}>
                  <input
                    type="radio"
                    name="hs-sub"
                    checked={sub === s.code}
                    onChange={() => {
                      setSub(s.code)
                      setTariffRaw('')
                    }}
                    className="size-5 accent-brand-700"
                  />
                  <span dir="ltr" className="font-mono text-sm font-semibold">
                    {formatHs(s.code)}
                  </span>
                  <span className="text-sm">{s.en}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {sub && (
          <>
            <p className="mt-3 text-sm text-green-700">{t('hs.enoughHint')}</p>
            {showTariff ? (
              <div className="mt-3">
                <label htmlFor="hs-tariff" className="text-sm font-semibold text-ink-strong">
                  {t('hs.tariff')}
                </label>
                <input
                  id="hs-tariff"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={tariffRaw}
                  onChange={(e) => setTariffRaw(e.target.value)}
                  aria-invalid={tariffBad}
                  className="mt-1 min-h-control w-full rounded border border-line-strong px-3 font-mono"
                />
                <p className="mt-1 text-xs text-ink-muted">{t('hs.tariffHint')}</p>
                {tariffBad && (
                  <p role="alert" className="mt-1 text-sm text-red-700">
                    {t('hs.tariffInvalid')}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 min-h-touch text-sm font-semibold text-brand-700"
                onClick={() => setShowTariff(true)}
              >
                + {t('hs.knowTariff')}
              </button>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface p-4">
        {result && (
          <button
            type="button"
            disabled={tariffBad}
            onClick={() => onUse(result)}
            className="min-h-cta w-full rounded bg-brand-500 font-semibold text-ink-strong disabled:opacity-50"
          >
            {t('hs.use', { code: formatHs(deepest) })}
          </button>
        )}
        <button
          type="button"
          onClick={() => onUse(undefined)}
          className="mt-2 min-h-touch w-full text-sm font-semibold text-brand-700"
        >
          {t('hs.skip')}
        </button>
      </div>
    </BottomSheet>
  )
}
