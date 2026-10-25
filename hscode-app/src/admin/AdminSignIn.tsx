import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { signInAdmin } from '../auth/api'
import { Banner } from '../ui/Banner'
import { DarkBackdrop } from '../ui/DarkBackdrop'
import { LangToggle } from '../ui/LangToggle'
import { Logo } from '../ui/Logo'

const INVALID_CODES = [
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-email',
]

/** Maps a sign-in failure to an i18n key. Never says which field was wrong. */
function signInErrorKey(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (INVALID_CODES.includes(code)) return 'admin.signIn.invalid'
  if (code === 'auth/too-many-requests') return 'admin.signIn.tooMany'
  if (code === 'auth/network-request-failed') return 'errors.offline'
  return 'errors.generic'
}

const INPUT = 'min-h-control w-full rounded border border-line bg-surface px-3 text-body text-ink-strong'

export function AdminSignIn() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInAdmin(email.trim(), password)
    } catch (e) {
      setError(signInErrorKey(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DarkBackdrop className="min-h-dvh">
    <main className="relative flex flex-1 flex-col items-center justify-center gap-5 p-4 pt-16">
      <div className="absolute top-3 end-3">
        <LangToggle />
      </div>
      <div className="w-full max-w-sm">
        <Logo variant="dark" className="h-auto w-full" />
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="flex w-full max-w-sm flex-col gap-4 rounded border border-line bg-surface p-6"
      >
        <h1 className="text-xl font-semibold text-ink-strong">{t('admin.signIn.title')}</h1>
        {error && <Banner tone="danger">{t(error)}</Banner>}
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-strong">
          {t('admin.signIn.email')}
          <input
            type="email"
            autoComplete="username"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-strong">
          {t('admin.signIn.password')}
          <input
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-cta rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-60"
        >
          {t('admin.signIn.submit')}
        </button>
      </form>
    </main>
    </DarkBackdrop>
  )
}
