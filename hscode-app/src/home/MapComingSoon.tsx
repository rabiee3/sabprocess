import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Bdi } from '../ui/Bdi'
import { DarkBackdrop } from '../ui/DarkBackdrop'
import { LangToggle } from '../ui/LangToggle'
import { Logo } from '../ui/Logo'

/** The public index is readable by anyone; any failure just hides the counter. */
async function countFactories(): Promise<number | null> {
  try {
    const snap = await getDoc(doc(db, 'searchIndex/shard-0'))
    const entries = snap.exists() ? snap.data().entries : null
    return Array.isArray(entries) ? entries.length : null
  } catch {
    return null
  }
}

export function Component() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const [n, setN] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    void countFactories().then((c) => {
      if (live) setN(c)
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <DarkBackdrop className="min-h-dvh">
      <header className="flex items-center gap-2 px-4 pt-3 lg:px-10 lg:pt-6">
        <Logo variant="dark" />
        <div className="ms-auto">
          <LangToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
        <h1 className="text-4xl font-bold leading-tight text-white">{t('map.title')}</h1>
        <p className="text-body text-white/85">{t('map.body')}</p>
        {n !== null && (
          <p className="rounded bg-brand-500 px-4 py-2 text-body font-semibold text-ink-strong">
            {t('map.count', { count: n })}
          </p>
        )}
        {q && (
          <p className="text-body text-white/85">
            {t('map.searchedFor')} <Bdi>{q}</Bdi>
          </p>
        )}
        <Link
          to="/"
          className="mt-2 inline-flex min-h-cta items-center justify-center rounded border border-white/60 px-8 text-body font-semibold text-white"
        >
          {t('map.back')}
        </Link>
      </main>
    </DarkBackdrop>
  )
}
