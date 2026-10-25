import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataTable } from './DataTable'

type Row = { id: string; a: string; b: string }
const columns = [
  { key: 'a', header: 'Alpha' },
  { key: 'b', header: 'Beta', render: (r: Row) => <b>{r.b}!</b> },
]
const rows: Row[] = [{ id: '1', a: 'x', b: 'y' }]

function mockWidth(narrow: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: narrow && q.includes('max-width'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('DataTable', () => {
  it('renders a semantic table at wide widths', () => {
    mockWidth(false)
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Alpha', 'Beta'])
    expect(screen.getByText('y!')).toBeInTheDocument()
  })
  it('renders header: value cards at 375px', () => {
    mockWidth(true)
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('y!')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
  it('shows the empty node when there are no rows', () => {
    mockWidth(false)
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty="Nothing" />)
    expect(screen.getByText('Nothing')).toBeInTheDocument()
  })
})
