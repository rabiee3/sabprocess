import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../ui/BottomSheet'
import { Banner } from '../ui/Banner'

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

type Props = { open: boolean; name: string; busy: boolean; onClose: () => void; onConfirm: () => void }

/** Typed-name confirmation for a permanent delete. */
export function DeleteFactorySheet({ open, name, busy, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} title={t('admin.factories.deleteTitle')} onClose={onClose}>
      <DeleteForm name={name} busy={busy} onCancel={onClose} onConfirm={onConfirm} />
    </BottomSheet>
  )
}

function DeleteForm({ name, busy, onCancel, onConfirm }: { name: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const ok = name.trim() !== '' && same(typed, name)
  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok && !busy) onConfirm()
      }}
    >
      <Banner tone="danger">{t('admin.factories.deleteBody', { name })}</Banner>
      <label className="flex flex-col gap-1 text-body text-ink">
        <span>{t('admin.factories.deleteType', { name })}</span>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="min-h-touch rounded border border-line-strong bg-surface px-3 text-body"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-cta rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong"
        >
          {t('admin.factories.cancel')}
        </button>
        <button
          type="submit"
          disabled={!ok || busy}
          className="min-h-cta flex-1 rounded bg-red-600 px-4 text-body font-semibold text-white disabled:opacity-50"
        >
          {busy ? t('admin.factories.deleteBusy') : t('admin.factories.deleteConfirm')}
        </button>
      </div>
    </form>
  )
}
