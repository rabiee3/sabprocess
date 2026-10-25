import { findEmulatorPids } from './emulator-procs.mjs'

const jar = 'C:\\Users\\x\\.cache\\firebase\\emulators\\cloud-firestore-emulator-v1.22.0.jar'
const firestore = (pid, project = 'demo-hscode', name = 'java.exe') => ({
  pid,
  name,
  cmd: `java -jar ${jar} --host 127.0.0.1 --port 8080 --project_id ${project}`,
})

describe('findEmulatorPids', () => {
  it('selects this project’s Firestore emulator java processes', () => {
    expect(findEmulatorPids([firestore(1), firestore(2, 'demo-hscode', 'java')], 'demo-hscode')).toEqual([1, 2])
  })

  it('ignores emulators of other projects', () => {
    expect(findEmulatorPids([firestore(1, 'demo-other')], 'demo-hscode')).toEqual([])
  })

  it('does not match a project id that only shares a prefix', () => {
    expect(findEmulatorPids([firestore(1, 'demo-hscode-staging')], 'demo-hscode')).toEqual([])
  })

  it('ignores non-java processes that mention the emulator (shells, the firebase CLI)', () => {
    const cli = { pid: 3, name: 'node.exe', cmd: `node firebase.js emulators:exec ${jar} --project_id demo-hscode` }
    expect(findEmulatorPids([cli], 'demo-hscode')).toEqual([])
  })

  it('ignores java processes that are not the Firestore emulator', () => {
    const other = { pid: 4, name: 'java.exe', cmd: 'java -jar some-app.jar --project_id demo-hscode' }
    expect(findEmulatorPids([other], 'demo-hscode')).toEqual([])
  })

  it('tolerates processes without a command line', () => {
    expect(findEmulatorPids([{ pid: 5, name: 'java.exe', cmd: null }], 'demo-hscode')).toEqual([])
  })
})
