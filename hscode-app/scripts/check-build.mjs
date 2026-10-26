import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { constants, gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = resolve(appDir, '..')
const fail = (msg) => {
  console.error(`check-build FAILED: ${msg}`)
  process.exit(1)
}

const indexPath = resolve(rootDir, 'hscode', 'index.html')
if (!existsSync(indexPath)) fail('hscode/index.html does not exist - run "npm run build" first')
if (!readFileSync(indexPath, 'utf8').includes('/hscode/assets/')) {
  fail('hscode/index.html does not reference /hscode/assets/ (wrong Vite base?)')
}

const assetsDir = resolve(rootDir, 'hscode', 'assets')

// Every /hscode/assets/* file index.html references must exist on disk.
const indexHtml = readFileSync(indexPath, 'utf8')
const referenced = [...indexHtml.matchAll(/\/hscode\/assets\/([^"'\s)?#]+)/g)].map((m) => m[1])
const missing = referenced.filter((f) => !existsSync(resolve(assetsDir, f)))
if (missing.length) fail(`hscode/index.html references missing assets: ${missing.join(', ')}`)

// The production bundle must not carry emulator wiring (it would mean an emulator-mode build shipped).
const FORBIDDEN = ['127.0.0.1:8080', '127.0.0.1:9099', 'demo-hscode']
for (const f of readdirSync(assetsDir).filter((n) => n.endsWith('.js'))) {
  const js = readFileSync(resolve(assetsDir, f), 'utf8')
  const hit = FORBIDDEN.find((s) => js.includes(s))
  if (hit) fail(`hscode/assets/${f} contains emulator string "${hit}"`)
}
const css = readdirSync(assetsDir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(resolve(assetsDir, f), 'utf8')).join('')
if (!/\.rounded\{border-radius:var\(--radius\)\}/.test(css) || !css.includes('--radius:8px')) {
  fail('bare .rounded does not compile to 8px (DEFAULT radius token missing)')
}

// Entry chunk budget: the <script src> in index.html, gzipped with zlib at level 9.
// Firebase app/auth live in the entry; Firestore must stay in lazy chunks (src/firebase/db.ts).
const ENTRY_BUDGET = 330 * 1024
const entrySrc = indexHtml.match(/<script[^>]*\ssrc="\/hscode\/assets\/([^"]+\.js)"/)?.[1]
if (!entrySrc) fail('hscode/index.html has no /hscode/assets/*.js entry script')
const entryGzip = gzipSync(readFileSync(resolve(assetsDir, entrySrc)), { level: constants.Z_BEST_COMPRESSION }).length
const kb = (n) => `${(n / 1024).toFixed(2)} KB`
console.log(`check-build: entry ${entrySrc} is ${kb(entryGzip)} gzip (zlib level 9; budget ${kb(ENTRY_BUDGET)})`)
if (entryGzip > ENTRY_BUDGET) fail(`entry chunk ${entrySrc} is ${kb(entryGzip)} gzip, over the ${kb(ENTRY_BUDGET)} budget`)

// Firestore must not creep back into the entry chunk (it belongs to the lazy api/route chunks).
const FIRESTORE_MARKER = 'firestore.googleapis.com'
if (readFileSync(resolve(assetsDir, entrySrc), 'utf8').includes(FIRESTORE_MARKER)) {
  fail(`entry chunk ${entrySrc} contains Firestore (found "${FIRESTORE_MARKER}"); keep it in lazy chunks (src/firebase/db.ts)`)
}

const protectedPaths = ['index.html', 'about.html', 'contact.html', 'css', 'images']
const git = (args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' })

try {
  git(['diff', '--quiet', 'HEAD', '--', ...protectedPaths])
} catch {
  fail('root static site files differ from HEAD (index/about/contact/css/images)')
}
const status = git(['status', '--porcelain', '--', ...protectedPaths]).trim()
if (status) fail(`root static site has changes:\n${status}`)

console.log(
  `check-build OK: hscode/index.html built (${referenced.length} assets present), no emulator strings in JS, entry ${kb(entryGzip)} gzip within budget and Firestore-free, root static site untouched`,
)
