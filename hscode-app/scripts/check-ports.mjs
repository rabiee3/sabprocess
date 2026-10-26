// Fails fast when a leftover emulator still holds the Firestore/Auth ports.
import net from 'node:net'

const PORTS = [8180, 9099]

const inUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.setTimeout(1000)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => resolve(false))
  })

let failed = false
for (const port of PORTS) {
  if (await inUse(port)) {
    console.error(`Port ${port} is in use — stop the leftover emulator (e.g. \`taskkill /PID <pid> /F\`) and retry`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
