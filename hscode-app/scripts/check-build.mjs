import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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
const css = readdirSync(assetsDir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(resolve(assetsDir, f), 'utf8')).join('')
if (!/\.rounded\{border-radius:var\(--radius\)\}/.test(css) || !css.includes('--radius:8px')) {
  fail('bare .rounded does not compile to 8px (DEFAULT radius token missing)')
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

console.log('check-build OK: hscode/index.html built, root static site untouched')
