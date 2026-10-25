import { ADMIN_UID, firebaseConfig } from './config'

describe('firebase config', () => {
  it('targets the hscode-egypt project', () => {
    expect(firebaseConfig.projectId).toBe('hscode-egypt')
  })
  it('has a 28-char admin uid', () => {
    expect(ADMIN_UID).toHaveLength(28)
  })
})
