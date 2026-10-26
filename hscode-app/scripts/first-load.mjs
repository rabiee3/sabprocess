// The JS a first visit to a route downloads: the entry chunk and the route's lazy chunk, each with its static
// imports followed recursively, from the Vite manifest (build.manifest). Dynamic imports are left out: they load
// on demand, after first paint.
export function firstLoadFiles(manifest, route) {
  const entry = Object.keys(manifest).find((k) => manifest[k].isEntry)
  if (!entry) throw new Error('the Vite manifest has no entry chunk')
  if (!manifest[route]) throw new Error(`the Vite manifest has no chunk for ${route}`)
  const seen = new Set()
  const files = []
  const visit = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new Error(`the Vite manifest has no chunk for ${key}`)
    if (chunk.file.endsWith('.js')) files.push(chunk.file)
    for (const imp of chunk.imports ?? []) visit(imp)
  }
  visit(entry)
  visit(route)
  return files
}
