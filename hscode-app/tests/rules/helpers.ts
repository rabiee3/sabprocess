import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import type { Firestore } from 'firebase/firestore'

export const ADMIN_UID = 'k0a0b8HhATfZuFcC0clBqGmtGmF3'

let env: RulesTestEnvironment | undefined

/** Lazily creates the emulator test environment (rules loaded from firestore.rules). */
export async function getEnv(): Promise<RulesTestEnvironment> {
  env ??= await initializeTestEnvironment({
    projectId: 'demo-hscode',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
  return env
}

function current(): RulesTestEnvironment {
  if (!env) throw new Error('rules test env not ready (beforeAll not run)')
  return env
}

export const asVisitor = (): Firestore =>
  current().unauthenticatedContext().firestore() as unknown as Firestore
export const asUser = (uid: string): Firestore =>
  current().authenticatedContext(uid).firestore() as unknown as Firestore
export const asAdmin = (): Firestore => asUser(ADMIN_UID)

/** Runs `fn` with security rules disabled, to seed fixtures. */
export async function seed(fn: (db: Firestore) => Promise<void>): Promise<void> {
  await current().withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore)
  })
}

beforeAll(async () => {
  await getEnv()
})
beforeEach(async () => {
  await current().clearFirestore()
})
afterAll(async () => {
  await env?.cleanup()
  env = undefined
})
