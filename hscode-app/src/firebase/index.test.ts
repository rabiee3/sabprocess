describe('firebase/index', () => {
  it('imports without throwing when indexedDB is unavailable (jsdom)', async () => {
    expect(typeof indexedDB).toBe('undefined')
    const mod = await import('./index')
    expect(mod.db).toBeDefined()
    expect(mod.auth).toBeDefined()
  })
})
