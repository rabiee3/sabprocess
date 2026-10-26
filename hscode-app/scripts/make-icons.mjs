// Renders the PWA icons once from the design SVGs (dev only; the PNGs are committed under public/icons/).
//   npm run icons
// Sources live in the gitignored docs/ folder, so this runs only on a machine that has the design assets.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logoDir = resolve(appDir, '..', 'docs', 'HSCode Proposed UI', 'hscode-assets', 'logo')
const outDir = resolve(appDir, 'public', 'icons')

const JOBS = [
  { src: 'app-icon-512.svg', out: 'icon-192.png', size: 192 },
  { src: 'app-icon-512.svg', out: 'icon-512.png', size: 512 },
  { src: 'app-icon-maskable-512.svg', out: 'icon-maskable-512.png', size: 512 },
]

mkdirSync(outDir, { recursive: true })
for (const { src, out, size } of JOBS) {
  const file = resolve(logoDir, src)
  if (!existsSync(file)) {
    console.error(`make-icons: missing ${file}`)
    process.exit(1)
  }
  // The "HS" text asks for IBM Plex Sans, falling back to Arial: system fonts are loaded for it.
  const png = new Resvg(readFileSync(file, 'utf8'), {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
  })
    .render()
    .asPng()
  writeFileSync(resolve(outDir, out), png)
  console.log(`make-icons: public/icons/${out} (${size}px, ${png.length} bytes)`)
}
