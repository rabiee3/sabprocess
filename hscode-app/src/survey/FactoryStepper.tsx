import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Banner } from '../ui/Banner'
import { Stepper } from '../ui/Stepper'
import { useOnline } from '../ui/useOnline'
import {
  STEPS,
  clearDraft,
  draftFromFactory,
  draftReducer,
  emptyDraft,
  latestNewDraft,
  loadDraft,
  saveDraft,
  stepErrors,
  toFactoryInput,
  type Draft,
  type StepId,
} from './draft'
import { outbox } from './outbox'
import { useDraftAutosave } from './useDraftAutosave'
import {
  classifySubmitError,
  loadFactoryForEdit,
  newFactoryId,
  resubmitFactory,
  submitFactory,
  toSurveyError,
  type SurveyErrorCode,
} from './repo'
import { StepBasics } from './steps/StepBasics'
import { StepContacts } from './steps/StepContacts'
import { StepLocation } from './steps/StepLocation'
import { StepPhotos } from './steps/StepPhotos'
import { StepProducts } from './steps/StepProducts'
import { StepReview } from './steps/StepReview'

const LIST = '/survey'

function Form({ uid, initial, mode }: { uid: string; initial: Draft; mode: 'new' | 'edit' }) {
  const { t } = useTranslation()
  const online = useOnline()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [draft, dispatch] = useReducer(draftReducer, initial)
  const [tried, setTried] = useState<ReadonlySet<StepId>>(new Set())
  const [submitError, setSubmitError] = useState<SurveyErrorCode | null>(null)
  const submitted = useRef(false)

  const param = params.get('step')
  const step: StepId = STEPS.find((s) => s === param) ?? 'location'
  const autosave = useDraftAutosave(uid, draft, initial, step)
  const index = STEPS.indexOf(step)
  const goTo = (s: StepId) => setParams({ step: s })
  const markTried = (s: StepId) => setTried((prev) => new Set(prev).add(s))
  const errors = tried.has(step) ? stepErrors(draft, step) : []

  function next() {
    if (stepErrors(draft, step).length > 0) return markTried(step)
    goTo(STEPS[index + 1])
  }

  function submit() {
    if (submitted.current) return
    for (const s of STEPS) {
      if (stepErrors(draft, s).length > 0) {
        markTried(s)
        goTo(s)
        return
      }
    }
    let commit: Promise<void>
    try {
      const input = toFactoryInput(draft)
      // Not awaited: offline, the write is queued locally and the promise settles only on reconnect.
      commit = mode === 'edit' ? resubmitFactory(uid, draft.fid, input, draft.previousPhotoIds) : submitFactory(uid, draft.fid, input)
    } catch (e) {
      setSubmitError(toSurveyError(e))
      return
    }
    submitted.current = true
    // Keep the final draft and queue the fid; the Firestore write is queued either way.
    const draftSaved = autosave.finish(draft)
    const queued = outbox.add(uid, draft.fid, mode)
    // The draft stays until the outcome is known: a failed upload reopens it from My submissions.
    const fid = draft.fid
    commit.then(
      () => clearDraft(uid, fid),
      (e: unknown) => classifySubmitError(e, uid).then((code) => outbox.markFailed(uid, fid, code)),
    )
    navigate(LIST, draftSaved && queued ? undefined : { state: { storageFull: true } })
  }

  const props = { draft, dispatch, errors }
  const body = {
    location: <StepLocation {...props} />,
    basics: <StepBasics {...props} />,
    products: <StepProducts {...props} />,
    contacts: <StepContacts {...props} />,
    photos: <StepPhotos {...props} />,
    review: <StepReview {...props} goTo={goTo} />,
  }[step]
  const last = step === 'review'

  return (
    <Stepper
      step={index + 1}
      total={STEPS.length}
      title={t(`survey.step.${step}`)}
      onClose={() => navigate(LIST)}
      onBack={index === 0 ? () => navigate(LIST) : () => goTo(STEPS[index - 1])}
      onNext={last ? submit : next}
      nextLabel={last ? t(online ? 'survey.review.submit' : 'survey.review.saveOnPhone') : t('survey.step.next')}
    >
      {autosave.storageFull && (
        <div className="mb-3">
          <Banner tone="warning" onClose={autosave.dismissStorageFull}>
            {t('errors.storageFull')}
          </Banner>
        </div>
      )}
      {submitError && (
        <div className="mb-3">
          <Banner tone="danger" onClose={() => setSubmitError(null)}>
            {t(`errors.${submitError}`)}
          </Banner>
        </div>
      )}
      {body}
    </Stepper>
  )
}

type Loaded = { status: 'loading' } | { status: 'ready'; draft: Draft } | { status: 'missing' } | { status: 'error'; code: SurveyErrorCode }

function EditLoader({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const { fid = '' } = useParams()
  const [state, setState] = useState<{ fid: string; result: Loaded }>({ fid, result: { status: 'loading' } })

  useEffect(() => {
    let live = true
    const done = (result: Loaded) => live && setState({ fid, result })
    const saved = loadDraft(uid, fid)
    if (saved && saved.mode === 'edit') {
      done({ status: 'ready', draft: saved })
    } else {
      loadFactoryForEdit(fid).then(
        (r) => done(r ? { status: 'ready', draft: draftFromFactory(r.factory, r.contact, r.photos) } : { status: 'missing' }),
        (e: unknown) => done({ status: 'error', code: toSurveyError(e) }),
      )
    }
    return () => {
      live = false
    }
  }, [uid, fid])

  const result: Loaded = state.fid === fid ? state.result : { status: 'loading' }
  if (result.status === 'ready') return <Form key={fid} uid={uid} initial={result.draft} mode="edit" />
  return (
    <main className="mx-auto max-w-md p-4">
      {result.status === 'loading' && (
        <div role="status" aria-label={t('common.loading')} className="mx-auto size-8 animate-spin rounded-full border-4 border-line border-t-brand-600" />
      )}
      {result.status === 'error' && <Banner tone="danger">{t(`errors.${result.code}`)}</Banner>}
      {result.status === 'missing' && <p className="text-body text-ink-subtle">{t('survey.edit.notFound')}</p>}
      {result.status !== 'loading' && (
        <Link to={LIST} className="mt-3 inline-flex min-h-touch items-center font-semibold text-blue-800 underline">
          {t('survey.edit.back')}
        </Link>
      )}
    </main>
  )
}

/** The same content under a brand-new fid, as a 'new' draft; the old draft and its outbox row are dropped. */
function reissueDraft(uid: string, old: Draft): Draft {
  const fresh: Draft = { ...old, fid: newFactoryId(), mode: 'new', previousPhotoIds: [] }
  saveDraft(uid, fresh)
  clearDraft(uid, old.fid)
  outbox.remove(uid, old.fid)
  return fresh
}

function NewLoader({ uid }: { uid: string }) {
  const [params] = useSearchParams()
  const docExists = (useLocation().state as { docExists?: boolean } | null)?.docExists === true
  const [initial] = useState(() => {
    // ?resume=<fid>: reopen that draft (a failed upload from My submissions).
    const resume = params.get('resume')
    const saved = resume ? loadDraft(uid, resume) : null
    // The doc already exists on the server: submitting under its fid would be an update the rules reject.
    // Keep the content, move it to a fresh fid and drop the old draft and outbox row.
    if (saved && docExists) return reissueDraft(uid, saved)
    return (saved?.mode === 'new' ? saved : null) ?? latestNewDraft(uid) ?? emptyDraft(newFactoryId())
  })
  return <Form uid={uid} initial={initial} mode="new" />
}

export function FactoryStepper({ mode }: { mode: 'new' | 'edit' }) {
  // Drafts and the outbox are per user; a different account remounts from scratch.
  const uid = useAuth().user?.uid ?? ''
  return mode === 'edit' ? <EditLoader key={uid} uid={uid} /> : <NewLoader key={uid} uid={uid} />
}
