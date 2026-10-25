import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import type { Firestore } from 'firebase/firestore'

import { ADMIN_UID } from '../../src/firebase/config'

export { ADMIN_UID }

function emulatorHost(): { host: string; port: number } {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')
  return { host: host || '127.0.0.1', port: Number(port) || 8080 }
}

let env: RulesTestEnvironment | undefined

/** Lazily creates the emulator test environment (rules loaded from firestore.rules). */
export async function getEnv(): Promise<RulesTestEnvironment> {
  env ??= await initializeTestEnvironment({
    projectId: 'demo-hscode',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      ...emulatorHost(),
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
/** Token claims: `sign_in_provider` (google.com, password, anonymous, ...) and an optional email. */
export type TokenClaims = { provider: string; email?: string }

const contextFor = (uid: string, { provider, email }: TokenClaims): Firestore =>
  current()
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: provider },
      ...(email === undefined ? {} : { email }),
    })
    .firestore() as unknown as Firestore

/** The email every test user's token carries: `${uid}@example.com`. */
export const emailOf = (uid: string): string => `${uid}@example.com`

/** A Google-signed-in user (every non-admin user signs in with Google, spec §2). */
export const asUser = (uid: string): Firestore => contextFor(uid, { provider: 'google.com', email: emailOf(uid) })

/** Same uid/email as asUser, but another sign-in provider (negative tests). Pass `email: null` to omit it. */
export const asUserWithProvider = (uid: string, provider: string, email: string | null = emailOf(uid)): Firestore =>
  contextFor(uid, { provider, email: email ?? undefined })

/** The admin signs in with email/password; the rules trust the UID alone. */
export const asAdmin = (): Firestore => asUserWithProvider(ADMIN_UID, 'password', 'admin@example.com')

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
