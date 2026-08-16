import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { RendererErrorBoundary } from './components/RendererErrorBoundary'
import { LangProvider } from './i18n'
import { initializeCachedUiTheme } from './theme/ui-theme'
import './index.css'
import { ipc } from './lib/ipc'

initializeCachedUiTheme()

let smokeProbeStarted = false

function ElectronSmokeProbe(): null {
  useEffect(() => {
    if (
      smokeProbeStarted ||
      new URLSearchParams(window.location.search).get('electron-smoke') !== '1'
    ) {
      return
    }
    smokeProbeStarted = true
    void ipc
      .getAppVersion()
      .then(() => ipc.reportElectronSmokeReady())
      .catch((error) => console.error('[smoke] renderer IPC probe failed', error))
  }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RendererErrorBoundary>
      <LangProvider>
        <ElectronSmokeProbe />
        <HashRouter>
          <App />
        </HashRouter>
      </LangProvider>
    </RendererErrorBoundary>
  </StrictMode>
)
