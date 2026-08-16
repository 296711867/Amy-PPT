import { useCallback, useEffect, useState } from 'react'

export interface WebviewLoadErrorState {
  error: string | null
  clearError: () => void
  retry: () => void
}

const DEFAULT_LOAD_ERROR = 'Webview failed to load'

/** Keep webview navigation failures visible without treating aborted reloads as errors. */
export function useWebviewLoadError(
  webview: Electron.WebviewTag | null,
  source: string | undefined
): WebviewLoadErrorState {
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  useEffect(() => {
    setError(null)
    if (!webview) return

    const handleStartLoading = (): void => {
      setError(null)
    }
    const handleDomReady = (): void => {
      setError(null)
    }
    const handleFailLoad = (rawEvent: Event): void => {
      const event = rawEvent as Electron.DidFailLoadEvent
      if (event.isMainFrame === false || event.errorCode === -3) return
      setError(event.errorDescription?.trim() || DEFAULT_LOAD_ERROR)
    }

    webview.addEventListener('did-start-loading', handleStartLoading as EventListener)
    webview.addEventListener('dom-ready', handleDomReady as EventListener)
    webview.addEventListener('did-fail-load', handleFailLoad as EventListener)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading as EventListener)
      webview.removeEventListener('dom-ready', handleDomReady as EventListener)
      webview.removeEventListener('did-fail-load', handleFailLoad as EventListener)
    }
  }, [source, webview])

  const retry = useCallback((): void => {
    setError(null)
    if (!webview) return
    try {
      webview.reload()
    } catch {
      // The webview can be detached between the click and reload call.
    }
  }, [webview])

  return { error, clearError, retry }
}
