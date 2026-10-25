import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { claimInvite } from '../auth/api'
import { normalizeInviteCode } from '../auth/invite'
import { useAuth } from '../auth/useAuth'
import { Banner } from '../ui/Banner'
import { DigitInput } from '../ui/DigitInput'
import { useOnline } from '../ui/useOnline'

type Status = 'idle' | 'busy' | 'unlocking' | 'invalid' | 'error'

export function InviteCodeScreen() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const online = useOnline()
  const [digits, setDigits] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const inFlight = useRef(false)
  const code = normalizeInviteCode(digits)
  const locked = status === 'busy' || status === 'unlocking'

  async function submit() {
    if (!user || !code || !online || inFlight.current) return
    inFlight.current = true
    setStatus('busy')
    try {
      // Decide only on the claim's return value; the role flips later via the auth snapshot.
      const result = await claimInvite(user, code)
      setStatus(result === 'ok' ? 'unlocking' : 'invalid')
    } catch {
      setStatus('error')
    } finally {
      inFlight.current = false
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-4">
      <div>
        <h1 className="text-title font-semibold text-ink-strong">{t('survey.invite.title')}</h1>
        <p className="mt-2 text-body text-ink-subtle">{t('survey.invite.body')}</p>
        {user?.email && (
          <p className="mt-1 text-caption text-ink-muted">
            <bdi>{t('survey.invite.signedInAs', { email: user.email, interpolation: { escapeValue: false } })}</bdi>
          </p>
        )}
      </div>
      <DigitInput
        length={6}
        value={digits}
        onChange={(v) => {
          if (locked) return
          setDigits(v)
          if (status !== 'idle') setStatus('idle')
        }}
        error={status === 'invalid'}
      />
      {!online && <Banner tone="warning">{t('errors.offline')}</Banner>}
      {status === 'invalid' && <Banner tone="danger">{t('survey.invite.invalid')}</Banner>}
      {status === 'error' && <Banner tone="danger">{t(online ? 'errors.generic' : 'errors.offline')}</Banner>}
      {status === 'unlocking' && <Banner tone="success">{t('survey.invite.unlocking')}</Banner>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!code || !online || locked}
        className="min-h-cta rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-50"
      >
        {t('survey.invite.unlock')}
      </button>
    </main>
  )
}
