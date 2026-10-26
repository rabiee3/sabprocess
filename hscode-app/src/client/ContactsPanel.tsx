import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from '../ui/GoogleButton'
import { Banner } from '../ui/Banner'
import { safeUrl, whatsappHref } from '../lib/contactLinks'
import { normalizeDigits } from '../survey/draft'
import type { ContactDraft } from '../survey/types'
import { loadContact } from './publicRepo'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; contact: ContactDraft | null }

const row = 'flex min-h-touch items-center justify-between gap-3 border-b border-line py-1 last:border-b-0'
const link = 'inline-flex min-h-touch items-center text-sm font-semibold text-blue-800 underline'
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const

const telHref = (raw: string) => {
  const v = normalizeDigits(raw).replace(/[^\d+]/g, '')
  return v ? `tel:${v}` : null
}

function Locked() {
  const { t } = useTranslation()
  const { signIn, failed, clearError } = useGoogleSignIn()
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden="true" className="flex select-none flex-col gap-2 blur-sm">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-4 rounded bg-surface-alt" style={{ width: `${80 - n * 15}%` }} />
        ))}
      </div>
      <p className="font-semibold text-ink-strong">{t('factory.lockedTitle')}</p>
      <p className="text-sm text-ink-muted">{t('factory.lockedBody')}</p>
      {failed && <Banner tone="danger" onClose={clearError}>{t('errors.generic')}</Banner>}
      <GoogleButton onClick={signIn} label={t('auth.continueWithGoogle')} />
    </div>
  )
}

function Details({ c }: { c: ContactDraft }) {
  const { t } = useTranslation()
  const phone = c.phone?.trim()
  const wa = c.whatsappSameAsPhone ? phone : c.whatsapp?.trim()
  const site = c.website ? safeUrl(c.website) : null
  const fb = c.facebook ? safeUrl(c.facebook) : null
  const phoneHref = phone ? telHref(phone) : null
  const waHref = wa ? whatsappHref(wa) : null
  const person = c.contactPerson?.trim()
  if (!person && !phoneHref && !waHref && !site && !fb) return <p className="text-sm text-ink-muted">{t('factory.noContacts')}</p>
  return (
    <div className="flex flex-col">
      {person && (
        <div className={row}>
          <span className="text-sm text-ink-muted">{t('factory.contactPerson')}</span>
          <bdi className="font-semibold">{person}</bdi>
        </div>
      )}
      {phoneHref && (
        <div className={row}>
          <span className="text-sm text-ink-muted">{t('factory.phone')}</span>
          <a dir="ltr" href={phoneHref} className={link}>{phone}</a>
        </div>
      )}
      {waHref && (
        <div className={row}>
          <span className="text-sm text-ink-muted">{t('factory.whatsapp')}</span>
          <a dir="ltr" href={waHref} {...ext} aria-label={`${t('factory.whatsapp')} ${wa}`} className={link}>{wa}</a>
        </div>
      )}
      {site && (
        <div className={row}>
          <span className="text-sm text-ink-muted">{t('factory.website')}</span>
          <a dir="ltr" href={site} {...ext} className={link}>{c.website}</a>
        </div>
      )}
      {fb && (
        <div className={row}>
          <span className="text-sm text-ink-muted">{t('factory.facebook')}</span>
          <a dir="ltr" href={fb} {...ext} className={link}>{c.facebook}</a>
        </div>
      )}
    </div>
  )
}

/** Contacts are read only after a Google sign-in; signed out there is no data in the DOM. */
export function ContactsPanel({ factoryId }: { factoryId: string }) {
  const { user } = useAuth()
  // Keyed by uid so one user's contact data never survives a sign-out or account switch.
  return <ContactsInner key={user?.uid ?? ''} factoryId={factoryId} uid={user?.uid} />
}

function ContactsInner({ factoryId, uid }: { factoryId: string; uid?: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!uid) return
    let live = true
    setState({ status: 'loading' })
    loadContact(factoryId).then(
      (contact) => live && setState({ status: 'ready', contact }),
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
  }, [factoryId, uid, attempt])

  return (
    <section aria-labelledby="contacts-h" className="rounded-lg border border-line p-3">
      <h2 id="contacts-h" className="mb-2 text-body-sm font-semibold text-ink-strong">{t('factory.contacts')}</h2>
      {!uid ? (
        <Locked />
      ) : state.status === 'ready' && !state.contact ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-ink-muted">{t('factory.contactsUnavailable')}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex min-h-touch items-center justify-center rounded border-2 border-ink-strong px-4 text-sm font-semibold"
          >
            {t('factory.retry')}
          </button>
        </div>
      ) : state.status === 'loading' ? (
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      ) : state.status === 'error' ? (
        <div className="flex flex-col gap-2">
          <Banner tone="danger">{t('errors.generic')}</Banner>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex min-h-touch items-center justify-center rounded border-2 border-ink-strong px-4 text-sm font-semibold"
          >
            {t('factory.retry')}
          </button>
        </div>
      ) : (
        <Details c={state.contact ?? {}} />
      )}
    </section>
  )
}
