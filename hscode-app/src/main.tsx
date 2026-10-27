import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { initI18n } from './i18n'
import { AuthProvider } from './auth/AuthProvider'
import App from './App.tsx'
import { FloatingBanners } from './ui/FloatingBanners'
import { installErrorReporting } from './telemetry/reportError'

initI18n()
// Uncaught errors and unhandled rejections go to Analytics (never in the emulator).
installErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
    {/* Outside the router: shown on every route, including error pages. */}
    <FloatingBanners />
  </StrictMode>,
)
