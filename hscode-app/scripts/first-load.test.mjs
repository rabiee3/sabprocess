import { describe, expect, it } from 'vitest'
import { firstLoadFiles } from './first-load.mjs'

const manifest = {
  'index.html': { file: 'assets/index-a.js', isEntry: true, imports: ['_vendor-b.js'], dynamicImports: ['src/client/MapHome.tsx', 'src/admin/AdminRoute.tsx'] },
  '_vendor-b.js': { file: 'assets/vendor-b.js' },
  'src/client/MapHome.tsx': { file: 'assets/MapHome-c.js', isDynamicEntry: true, imports: ['_shared-d.js', '_vendor-b.js'], dynamicImports: ['src/data/hsTable.ts'] },
  '_shared-d.js': { file: 'assets/shared-d.js', imports: ['_vendor-b.js'] },
  'src/data/hsTable.ts': { file: 'assets/hsTable-e.js', isDynamicEntry: true },
  'src/admin/AdminRoute.tsx': { file: 'assets/AdminRoute-f.js', isDynamicEntry: true, imports: ['_shared-d.js'] },
}

describe('firstLoadFiles', () => {
  it('collects the entry and the route chunk with their static imports, deduplicated, never dynamic imports', () => {
    expect(firstLoadFiles(manifest, 'src/client/MapHome.tsx').sort()).toEqual(
      ['assets/MapHome-c.js', 'assets/index-a.js', 'assets/shared-d.js', 'assets/vendor-b.js'],
    )
  })

  it('throws when the route is not in the manifest', () => {
    expect(() => firstLoadFiles(manifest, 'src/nope.tsx')).toThrow(/nope/)
  })
})
