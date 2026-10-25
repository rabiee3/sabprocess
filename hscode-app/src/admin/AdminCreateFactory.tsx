import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { validateFactoryFields } from '../lib/factoryValidation'
import { insideEgypt } from '../lib/geo'
import { PhotoPicker } from '../photos/PhotoPicker'
import { draftReducer, emptyDraft, toFactoryInput, type Draft, type DraftAction } from '../survey/draft'
import { StepContacts } from '../survey/steps/StepContacts'
import { Banner } from '../ui/Banner'
import { useAdmin } from './AdminContext'
import { AdminFactoryForm } from './AdminFactoryForm'
import { classify, type ActionError } from './classify'
import { displayName } from './reviewForm'
import { adminCreateFactory } from './repo'

/** Fields and contact checks, plus a pin the admin has placed by hand (a new factory has no stored one). */
function createErrors(d: Draft): string[] {
  const errs = validateFactoryFields(d)
  if (!d.location || !d.location.pinMoved) errs.push('admin.create.pinRequired')
  else if (!insideEgypt(d.location.lat, d.location.lng)) errs.push('survey.location.required')
  return errs
}

const ERROR_KEY: Record<ActionError, string> = {
  stale: 'errors.generic',
  indexFull: 'errors.indexFull',
  invalid: 'errors.generic',
  offline: 'errors.offline',
  generic: 'errors.generic',
}

/** Route element for `factories/new`: adds an approved factory straight away, optionally flagged as a sample. */
export function AdminCreateFactory() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { refreshPending } = useAdmin()
  const [draft, setDraft] = useState<Draft>(() => emptyDraft('new'))
  const dispatch = (a: DraftAction) => setDraft((d) => draftReducer(d, a))
  const [sample, setSample] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  // Area the pin was placed under: freezes the picker's key so later area changes don't reset a placed pin.
  const [frozenArea, setFrozenArea] = useState<string | null>(null)
  const [error, setError] = useState<ActionError | null>(null)

  const errors = showErrors ? createErrors(draft) : []

  async function save() {
    if (inFlight.current) return
    setShowErrors(true)
    if (createErrors(draft).length > 0) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const input = toFactoryInput(draft)
      const id = await adminCreateFactory(input, { sample })
      refreshPending()
      const name = displayName(input.name, i18n.language, id)
      navigate(`/admin/factories/${id}`, { replace: true, state: { created: name } })
    } catch (e) {
      setError(classify(e))
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/factories" className="flex min-h-touch items-center font-semibold text-blue-800">
        {t('admin.factories.detail.back')}
      </Link>
      {error && <Banner tone="danger">{t(ERROR_KEY[error])}</Banner>}
      {errors.length > 0 && <Banner tone="danger">{t('admin.factories.detail.fixErrors')}</Banner>}
      <AdminFactoryForm value={draft} errors={errors} pickerKey={frozenArea ?? draft.area}
        onChange={(next) => {
          if (next.location?.pinMoved && !draft.location?.pinMoved) setFrozenArea(draft.area)
          setDraft(next)
        }} />
      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.create.contact')}</h3>
        <StepContacts draft={draft} dispatch={dispatch} errors={errors} />
      </section>
      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.review.photos')}</h3>
        <PhotoPicker photos={draft.photos} onChange={(photos, thumb) => dispatch({ type: 'setPhotos', photos, thumb })} />
      </section>
      <label className="flex min-h-touch items-start gap-3 text-body text-ink">
        <input type="checkbox" className="mt-1 size-5" checked={sample} onChange={(e) => setSample(e.target.checked)} />
        <span>
          <span className="block font-semibold text-ink-strong">{t('admin.create.sample')}</span>
          <span className="block text-body-sm text-ink-subtle">{t('admin.create.sampleHint')}</span>
        </span>
      </label>
      <div className="border-t border-line pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="min-h-cta w-full rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-60"
        >
          {busy ? t('admin.create.saving') : t('admin.create.save')}
        </button>
      </div>
    </div>
  )
}
