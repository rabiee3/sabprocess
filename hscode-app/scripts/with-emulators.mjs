// Runs a command inside `firebase emulators:exec`, then always stops leftover emulator JVMs.
// Exits with the command's own exit code.
// Usage: node scripts/with-emulators.mjs <only-list> "<command>"
import { spawnSync } from 'node:child_process'
import { stopLeftoverEmulators } from './stop-emulators.mjs'

const PROJECT_ID = 'demo-hscode'
const [only, command] = process.argv.slice(2)
if (!only || !command) {
  console.error('usage: node scripts/with-emulators.mjs <only-list> "<command>"')
  process.exit(2)
}

const ports = spawnSync('node', ['scripts/check-ports.mjs'], { stdio: 'inherit' })
if (ports.status !== 0) process.exit(ports.status ?? 1)

const run = spawnSync(
  'npx', ['firebase', 'emulators:exec', '--only', only, '--project', PROJECT_ID, JSON.stringify(command)],
  { stdio: 'inherit', shell: true },
)
stopLeftoverEmulators(PROJECT_ID)
process.exit(run.status ?? 1)
