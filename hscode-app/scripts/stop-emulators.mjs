// Stops Firestore emulator JVMs left behind by `firebase emulators:exec` on Windows.
import { execFileSync } from 'node:child_process'
import { findEmulatorPids } from './emulator-procs.mjs'

function listJavaProcesses() {
  const json = execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    'Get-CimInstance Win32_Process -Filter "Name like \'java%\'" | ' +
      'Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress',
  ], { encoding: 'utf8' }).trim()
  if (!json) return []
  return [].concat(JSON.parse(json)).map((r) => ({ pid: r.ProcessId, name: r.Name, cmd: r.CommandLine }))
}

export function stopLeftoverEmulators(projectId) {
  if (process.platform !== 'win32') return
  try {
    for (const pid of findEmulatorPids(listJavaProcesses(), projectId)) {
      execFileSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' })
      console.log(`stop-emulators: stopped leftover Firestore emulator (PID ${pid})`)
    }
  } catch (e) {
    console.error(`stop-emulators: cleanup failed: ${e.message}`)
  }
}
