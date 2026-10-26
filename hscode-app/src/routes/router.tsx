import { createBrowserRouter } from 'react-router'

export const routes = [
  { path: '/', HydrateFallback: () => null, lazy: () => import('../home/Splash') },
  { path: '/map', HydrateFallback: () => null, lazy: () => import('../client/MapHome') },
  { path: '/f/:id', HydrateFallback: () => null, lazy: () => import('../client/FactoryPage') },
  { path: '/survey/*', HydrateFallback: () => null, lazy: () => import('../survey/SurveyRoute') },
  { path: '/admin/*', HydrateFallback: () => null, lazy: () => import('../admin/AdminRoute') },
  { path: '*', HydrateFallback: () => null, lazy: () => import('./HomePlaceholder') },
]

export const router = createBrowserRouter(routes, { basename: '/hscode' })
