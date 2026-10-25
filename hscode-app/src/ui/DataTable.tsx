import { useEffect, useState, type ReactNode } from 'react'

export type Column<T> = {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

type Props<T> = {
  /** Accessible name of the table / card list. */
  label: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  /** Rows for which this returns true get a highlight (and `data-highlight="true"`). */
  highlight?: (row: T) => boolean
}

const NARROW = '(max-width: 639px)'

/** True below 640px. Without matchMedia (tests) it is false, i.e. the table layout. */
function useIsNarrow(): boolean {
  const [on, setOn] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(NARROW)
    const onChange = () => setOn(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return on
}

function cell<T>(c: Column<T>, row: T): ReactNode {
  if (c.render) return c.render(row)
  const v = (row as Record<string, unknown>)[c.key]
  return v == null ? '' : String(v)
}

const HIGHLIGHT = 'bg-brand-50'

/** A semantic table (sticky header, scrolls sideways) at >= 640px; stacked "header: value" cards below. */
export function DataTable<T>({ columns, rows, rowKey, empty, highlight, label }: Props<T>) {
  const narrow = useIsNarrow()

  if (rows.length === 0 && empty != null) {
    return <p className="rounded border border-line bg-surface p-4 text-body text-ink-subtle">{empty}</p>
  }

  if (narrow) {
    return (
      <ul aria-label={label} className="flex flex-col gap-3">
        {rows.map((row) => {
          const hl = highlight?.(row) === true
          return (
            <li
              key={rowKey(row)}
              data-highlight={hl ? 'true' : undefined}
              className={`flex flex-col gap-2 rounded border border-line p-3 ${hl ? HIGHLIGHT : 'bg-surface'}`}
            >
              {columns.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 font-semibold text-ink-subtle">{c.header}</span>
                  <span className="min-w-0 text-end text-ink">{cell(c, row)}</span>
                </div>
              ))}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="max-h-[70vh] overflow-x-auto overflow-y-auto rounded border border-line bg-surface">
      <table className="w-full border-collapse text-start text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`sticky top-0 border-b border-line bg-surface px-4 py-3 text-start text-xs font-semibold text-ink-subtle ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hl = highlight?.(row) === true
            return (
              <tr
                key={rowKey(row)}
                data-highlight={hl ? 'true' : undefined}
                className={`border-b border-line last:border-b-0 ${hl ? HIGHLIGHT : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-ink ${c.className ?? ''}`}>
                    {cell(c, row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
