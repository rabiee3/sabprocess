/** localStorage that never throws (private mode, blocked or full storage). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  /** False when the write did not stick (storage blocked or full). */
  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // storage blocked: nothing to remove
    }
  },
  keys(): string[] {
    try {
      const out: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i)
        if (k !== null) out.push(k)
      }
      return out
    } catch {
      return []
    }
  },
}
