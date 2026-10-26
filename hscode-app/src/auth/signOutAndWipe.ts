import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

export type SignOutDeps = {
  db: Firestore
  auth: Auth
  reload: () => void
  /** Runs right after signOut, on every path (wiped or kept), before terminate and reload. */
  onSignedOut?: () => void
}

/** How long queued writes (a surveyor's offline submissions) get to reach the server before sign-out. */
export const PENDING_WRITES_TIMEOUT_MS = 5000

/**
 * Signs out and wipes the Firestore cache (spec §9 M7), so contact details read on a shared phone do not stay
 * on it. Queued writes are never destroyed: unless they all reach the server within 5 s, it signs out WITHOUT
 * wiping and returns 'kept' (the caller shows `nav.signOutKeptData`). Otherwise: signOut, terminate, clear,
 * reload, and 'wiped'. A failed clear (in-memory cache, another tab still open) still reloads.
 *
 * Firestore and the db are loaded with import(): this module is reached from the headers, and the entry
 * chunk must stay free of firebase/firestore.
 */
export async function signOutAndWipe(deps: Partial<SignOutDeps> = {}): Promise<'wiped' | 'kept'> {
  const [fs, { signOut }] = await Promise.all([import('firebase/firestore'), import('firebase/auth')])
  const db = deps.db ?? (await import('../firebase/db')).db
  const auth = deps.auth ?? (await import('../firebase/app')).auth
  const reload = deps.reload ?? (() => window.location.reload())

  let timer: ReturnType<typeof setTimeout> | undefined
  const synced = await Promise.race([
    fs.waitForPendingWrites(db).then(
      () => true,
      () => false,
    ),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), PENDING_WRITES_TIMEOUT_MS)
    }),
  ])
  clearTimeout(timer)

  await signOut(auth)
  deps.onSignedOut?.()
  if (!synced) return 'kept'

  try {
    await fs.terminate(db)
    await fs.clearIndexedDbPersistence(db)
  } catch {
    // Nothing more to wipe here: the reload still drops everything held in memory.
  } finally {
    reload()
  }
  return 'wiped'
}
