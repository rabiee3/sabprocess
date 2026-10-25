import { createBrowserRouter } from 'react-router'

export const routes = [
  { path: '/', HydrateFallback: () => null, lazy: () => import('./HomePlaceholder') },
  { path: '/survey/*', HydrateFallback: () => null, lazy: () => import('./SurveyPlaceholder') },
  { path: '/admin/*', HydrateFallback: () => null, lazy: () => import('./AdminPlaceholder') },
  { path: '*', HydrateFallback: () => null, lazy: () => import('./HomePlaceholder') },
]

export const router = createBrowserRouter(routes, { basename: '/hscode' })
