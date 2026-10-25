export type Invite = {
  code: string
  label?: string
  usedBy: string | null
  usedAt?: Date
  cancelled: boolean
  createdAt: Date
}

export type Surveyor = {
  uid: string
  name: string
  email: string
  active: boolean
  inviteCode?: string
  createdAt: Date
}
