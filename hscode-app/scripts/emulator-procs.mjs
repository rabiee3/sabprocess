// Picks the Firestore emulator JVMs that belong to one emulator project.
// `firebase emulators:exec` on Windows leaves this java process running after it exits.
const FIRESTORE_JAR = /cloud-firestore-emulator-[^\\/\s]*\.jar/

export function findEmulatorPids(procs, projectId) {
  const projectFlag = new RegExp(`--project_id\\s+${projectId}(\\s|$)`)
  return procs
    .filter(({ name, cmd }) =>
      /^java(\.exe)?$/i.test(name) && cmd != null && FIRESTORE_JAR.test(cmd) && projectFlag.test(cmd))
    .map(({ pid }) => pid)
}
