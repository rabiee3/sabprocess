describe('firebase/index', () => {
  it('imports without throwing when indexedDB is unavailable (jsdom)', async () => {
    expect(typeof indexedDB).toBe('undefined')
    const mod = await import('./index')
    expect(mod.db).toBeDefined()
    expect(mod.auth).toBeDefined()
  })

  // Guard: tests must never talk to the production project (hscode-egypt).
  it('runs in emulator mode against the demo-hscode project', async () => {
    expect(import.meta.env.VITE_USE_EMULATOR).toBe('true')
    const mod = await import('./index')
    expect(mod.useEmulator).toBe(true)
    expect(mod.db.app.options.projectId).toBe('demo-hscode')
  })

  // Firestore rejects `undefined` field values unless this is on (e.g. an optional field left unset).
  it('ignores undefined properties on write', async () => {
    const { db } = await import('./index')
    const settings = (db as unknown as { _getSettings(): { ignoreUndefinedProperties: boolean } })._getSettings()
    expect(settings.ignoreUndefinedProperties).toBe(true)
  })
})
