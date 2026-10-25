import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ADMIN_UID } from '../../src/firebase/config'

describe('admin UID sync', () => {
  it('firestore.rules grants isAdmin() to the same UID as ADMIN_UID in src/firebase/config.ts', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
    expect(rules).toContain(`request.auth.uid == '${ADMIN_UID}'`)
  })
})
