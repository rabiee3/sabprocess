import { ADMIN_UID, authDomainFor, firebaseConfig } from './config'

describe('firebase config', () => {
  it('targets the hscode-egypt project', () => {
    expect(firebaseConfig.projectId).toBe('hscode-egypt')
  })
  it('has a 28-char admin uid', () => {
    expect(ADMIN_UID).toHaveLength(28)
  })
})

describe('authDomainFor', () => {
  it('uses the site host on the production hosts so the auth handler is same-origin', () => {
    expect(authDomainFor('sabprocess.com')).toBe('sabprocess.com')
    expect(authDomainFor('www.sabprocess.com')).toBe('www.sabprocess.com')
    expect(authDomainFor('sabprocess.vercel.app')).toBe('sabprocess.vercel.app')
  })
  it('falls back to the firebaseapp.com domain elsewhere', () => {
    expect(authDomainFor('localhost:5174')).toBe('hscode-egypt.firebaseapp.com')
  })
})
