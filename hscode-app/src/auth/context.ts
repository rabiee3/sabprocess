import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type Role = 'visitor' | 'client' | 'surveyor' | 'admin'
export interface AuthState {
  user: User | null
  role: Role
  active: boolean
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  user: null,
  role: 'visitor',
  active: false,
  loading: true,
})
