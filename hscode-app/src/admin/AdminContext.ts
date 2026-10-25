import { createContext, useContext } from 'react'

export interface AdminState {
  /** Pending submissions; `null` while unknown or when the count failed (badge hidden). */
  pending: number | null
  /** Re-queries the pending count (call after approve/reject). */
  refreshPending: () => void
}

export const AdminContext = createContext<AdminState>({ pending: null, refreshPending: () => {} })

export function useAdmin(): AdminState {
  return useContext(AdminContext)
}
