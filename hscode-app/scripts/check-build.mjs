import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { constants, gzipSync } from 'node:zlib'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = resolve(appDir, '..')
const fail = (msg) => {
  console.error(`check-build FAILED: ${msg}`)
  process.exit(1)
}

// Optional `--dir <path>` (relative to hscode-app/) checks another build, e.g. the PWA e2e scratch
// build in .pwa-preview; the default is the committed output, ../hscode.
const dirArg = process.argv.indexOf('--dir')
if (dirArg !== -1 && !process.argv[dirArg + 1]) fail('--dir needs a path')
const outDir = dirArg === -1 ? resolve(rootDir, 'hscode') : resolve(appDir, process.argv[dirArg + 1])
const out = relative(rootDir, outDir).replaceAll('\\', '/') || '.'

const indexPath = resolve(outDir, 'index.html')
if (!existsSync(indexPath)) fail(`${out}/index.html does not exist - run "npm run build" first`)
if (!readFileSync(indexPath, 'utf8').includes('/hscode/assets/')) {
  fail(`${out}/index.html does not reference /hscode/assets/ (wrong Vite base?)`)
}

const assetsDir = resolve(outDir, 'assets')

// Every /hscode/assets/* file index.html references must exist on disk.
const indexHtml = readFileSync(indexPath, 'utf8')
const referenced = [...indexHtml.matchAll(/\/hscode\/assets\/([^"'\s)?#]+)/g)].map((m) => m[1])
const missing = referenced.filter((f) => !existsSync(resolve(assetsDir, f)))
if (missing.length) fail(`${out}/index.html references missing assets: ${missing.join(', ')}`)

// The production bundle must not carry emulator wiring (it would mean an emulator-mode build shipped).
const FORBIDDEN = ['127.0.0.1:8180', '127.0.0.1:8080', '127.0.0.1:9099', 'demo-hscode']
for (const f of readdirSync(assetsDir).filter((n) => n.endsWith('.js'))) {
  const js = readFileSync(resolve(assetsDir, f), 'utf8')
  const hit = FORBIDDEN.find((s) => js.includes(s))
  if (hit) fail(`${out}/assets/${f} contains emulator string "${hit}"`)
}
const css = readdirSync(assetsDir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(resolve(assetsDir, f), 'utf8')).join('')
if (!/\.rounded\{border-radius:var\(--radius\)\}/.test(css) || !css.includes('--radius:8px')) {
  fail('bare .rounded does not compile to 8px (DEFAULT radius token missing)')
}

// Entry chunk budget: the <script src> in index.html, gzipped with zlib at level 9.
// Firebase app/auth live in the entry; Firestore must stay in lazy chunks (src/firebase/db.ts).
const ENTRY_BUDGET = 330 * 1024
const entrySrc = indexHtml.match(/<script[^>]*\ssrc="\/hscode\/assets\/([^"]+\.js)"/)?.[1]
if (!entrySrc) fail(`${out}/index.html has no /hscode/assets/*.js entry script`)
const entryGzip = gzipSync(readFileSync(resolve(assetsDir, entrySrc)), { level: constants.Z_BEST_COMPRESSION }).length
const kb = (n) => `${(n / 1024).toFixed(2)} KB`
console.log(`check-build: entry ${entrySrc} is ${kb(entryGzip)} gzip (zlib level 9; budget ${kb(ENTRY_BUDGET)})`)
if (entryGzip > ENTRY_BUDGET) fail(`entry chunk ${entrySrc} is ${kb(entryGzip)} gzip, over the ${kb(ENTRY_BUDGET)} budget`)

// Firestore must not creep back into the entry chunk (it belongs to the lazy api/route chunks).
const FIRESTORE_MARKER = 'firestore.googleapis.com'
if (readFileSync(resolve(assetsDir, entrySrc), 'utf8').includes(FIRESTORE_MARKER)) {
  fail(`entry chunk ${entrySrc} contains Firestore (found "${FIRESTORE_MARKER}"); keep it in lazy chunks (src/firebase/db.ts)`)
}

// PWA (spec §7): the manifest and the service worker exist and are scoped to /hscode/, every manifest
// icon is on disk, and the service worker never routes Firestore or Google auth traffic.
const manifestPath = resolve(outDir, 'manifest.webmanifest')
if (!existsSync(manifestPath)) fail(`${out}/manifest.webmanifest does not exist`)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.scope !== '/hscode/') fail(`manifest scope is ${JSON.stringify(manifest.scope)}, not "/hscode/"`)
if (manifest.start_url !== '/hscode/') fail(`manifest start_url is ${JSON.stringify(manifest.start_url)}, not "/hscode/"`)
if (!indexHtml.includes('href="/hscode/manifest.webmanifest"')) fail(`${out}/index.html does not link /hscode/manifest.webmanifest`)
const ICONS = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']
const manifestIcons = (manifest.icons ?? []).map((i) => i.src)
for (const icon of ICONS) {
  if (!manifestIcons.includes(icon)) fail(`manifest does not list ${icon}`)
}
for (const icon of manifestIcons) {
  if (!existsSync(resolve(outDir, icon))) fail(`manifest icon ${out}/${icon} does not exist`)
}
const swPath = resolve(outDir, 'sw.js')
if (!existsSync(swPath)) fail(`${out}/sw.js does not exist`)
const sw = readFileSync(swPath, 'utf8')
// Global constraints: never Firestore, Google auth (identitytoolkit, securetoken, /__/auth/), reCAPTCHA or Analytics.
const SW_FORBIDDEN = ['firestore.googleapis.com', 'identitytoolkit', 'securetoken', '__/auth', 'recaptcha', 'google-analytics', 'googletagmanager']
for (const s of SW_FORBIDDEN) {
  if (sw.includes(s)) fail(`${out}/sw.js mentions "${s}": the service worker must never route Firestore, Google auth, reCAPTCHA or Analytics`)
}
// Scope /hscode/, asserted directly: the registration (virtual:pwa-register) is
// new Workbox('/hscode/sw.js', { scope: '/hscode/' }) (the quote style varies with minification), and
// navigations fall back to the shell only under /hscode/.
const appJs = readdirSync(assetsDir).filter((n) => n.endsWith('.js')).map((f) => readFileSync(resolve(assetsDir, f), 'utf8')).join('\n')
const REGISTER = /["'`]\/hscode\/sw\.js["'`]\s*,\s*\{\s*scope\s*:\s*["'`]\/hscode\/["'`]/
if (!REGISTER.test(appJs)) fail('no JS asset registers /hscode/sw.js with scope "/hscode/"')
if (!sw.includes('allowlist:[/^\\/hscode\\//]')) fail(`${out}/sw.js navigation fallback is not limited to /hscode/`)
// The root site must never get a service worker (it would control all of sabprocess.com).
for (const f of ['sw.js', 'service-worker.js']) {
  if (existsSync(resolve(rootDir, f))) fail(`${f} exists at the site root: only /hscode/sw.js is allowed`)
}
// Precache = the app shell only (spec §7): every precached assets/*.js is one index.html loads; lazy route
// chunks are runtime-cached instead.
const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1])
if (!precached.includes('index.html')) fail(`${out}/sw.js does not precache index.html`)
const shellJs = new Set(referenced.filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`))
const lazyPrecached = precached.filter((u) => u.startsWith('assets/') && u.endsWith('.js') && !shellJs.has(u))
if (lazyPrecached.length) fail(`${out}/sw.js precaches lazy chunks: ${lazyPrecached.join(', ')}`)
if (!shellJs.has(`assets/${entrySrc}`) || !precached.includes(`assets/${entrySrc}`)) fail(`${out}/sw.js does not precache the entry ${entrySrc}`)

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
  `check-build OK: ${out}/index.html built (${referenced.length} assets present), no emulator strings in JS, entry ${kb(entryGzip)} gzip within budget and Firestore-free, manifest + sw.js scoped to /hscode/ with ${manifestIcons.length} icons, root static site untouched`,
)
