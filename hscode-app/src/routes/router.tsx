import { createBrowserRouter } from 'react-router'
import { RouteError } from '../ui/RouteError'

const base = [
  { path: '/', HydrateFallback: () => null, lazy: () => import('../client/MapHome') },
  { path: '/map', HydrateFallback: () => null, lazy: () => import('./RedirectToRoot') },
  { path: '/f/:id', HydrateFallback: () => null, lazy: () => import('../client/FactoryPage') },
  { path: '/survey/*', HydrateFallback: () => null, lazy: () => import('../survey/SurveyRoute') },
  { path: '/admin/*', HydrateFallback: () => null, lazy: () => import('../admin/AdminRoute') },
  { path: '*', HydrateFallback: () => null, lazy: () => import('./HomePlaceholder') },
]

export const routes = base.map((r) => ({ ...r, errorElement: <RouteError /> }))

/**
 * With a trailing slash, so the root map is /hscode/ (and /hscode/?q=…): inside the service worker and
 * manifest scope (/hscode/), and a URL the server serves as the app. With '/hscode' the root would be
 * /hscode, which is out of scope and, on the Vite dev and preview servers, not the app at all on reload.
 */
export const BASENAME = '/hscode/'

/** A hard load of /hscode (no slash) is outside BASENAME: the same URL with the slash, else null. */
export function withBaseSlash({ pathname, search, hash }: Pick<Location, 'pathname' | 'search' | 'hash'>): string | null {
  return pathname === BASENAME.slice(0, -1) ? `${BASENAME}${search}${hash}` : null
}

// Before the router reads the URL: a /hscode bookmark or typed address still opens the map.
const canonical = withBaseSlash(window.location)
if (canonical) window.history.replaceState(window.history.state, '', canonical)

export const router = createBrowserRouter(routes, { basename: BASENAME })
