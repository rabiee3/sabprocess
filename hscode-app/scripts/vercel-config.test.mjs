import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Unit tests run from hscode-app/ (jsdom: import.meta.url is not a file URL here).
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'vercel.json'), 'utf8'))

/** Vercel path-to-regexp source to a RegExp, for the patterns used here (:name, :name* and :name(regex)). */
const toRegExp = (source) =>
  new RegExp(
    `^${source
      .replace(/:(\w+)\(((?:[^()]|\([^()]*\))*)\)/g, '($2)')
      .replace(/:(\w+)\*/g, '(.*)')
      .replace(/:(\w+)/g, '([^/]+)')}$`,
  )
const spa = () => vercel.rewrites.find((r) => r.destination === '/hscode/index.html')

describe('vercel.json', () => {
  it('rewrites /hscode/ app routes to the SPA', () => {
    const re = toRegExp(spa().source)
    for (const p of ['/hscode/', '/hscode/f/abc', '/hscode/survey/new', '/hscode/admin']) expect(re.test(p), p).toBe(true)
  })

  it('never rewrites /hscode/assets/* to index.html: a missing chunk is a 404, not HTML under a JS URL', () => {
    const re = toRegExp(spa().source)
    expect(re.test('/hscode/assets/MapHome-OLD.js')).toBe(false)
    expect(re.test('/hscode/assets/x.css')).toBe(false)
  })

  it('308-redirects /hscode to /hscode/ (inside the service worker scope)', () => {
    expect(vercel.redirects).toContainEqual({ source: '/hscode', destination: '/hscode/', permanent: true })
  })

  it('keeps the /__/auth proxy unchanged', () => {
    expect(vercel.rewrites).toContainEqual({
      source: '/__/auth/:path*',
      destination: 'https://hscode-egypt.firebaseapp.com/__/auth/:path*',
    })
  })
})
