import type { WebContents } from 'electron'

export const ELECTRON_SMOKE_ENV = 'AMY_PPT_SMOKE_TEST'

export interface ElectronSmokeResult {
  code: 0 | 1
  reason: string
}

interface ElectronSmokeOptions {
  enabled: boolean
  timeoutMs?: number
  onResult: (result: ElectronSmokeResult) => void
}

export interface ElectronSmokeMonitor {
  reportReady(): boolean
  dispose(): void
}

export function attachElectronSmokeMonitor(
  webContents: Pick<WebContents, 'on' | 'once' | 'removeListener'>,
  options: ElectronSmokeOptions
): ElectronSmokeMonitor {
  if (!options.enabled) {
    return { reportReady: () => false, dispose: () => undefined }
  }

  let settled = false
  const timeoutMs = options.timeoutMs ?? 60_000

  const cleanup = (): void => {
    clearTimeout(timeout)
    webContents.removeListener('did-fail-load', handleFailed)
  }
  const settle = (result: ElectronSmokeResult): void => {
    if (settled) return
    settled = true
    cleanup()
    options.onResult(result)
  }
  const handleFailed = (
    _event: Electron.Event,
    errorCode: number,
    errorDescription: string,
    validatedUrl: string,
    isMainFrame: boolean
  ): void => {
    if (!isMainFrame || errorCode === -3) return
    settle({
      code: 1,
      reason: `renderer-load-failed:${errorCode}:${errorDescription}:${validatedUrl}`
    })
  }

  webContents.on('did-fail-load', handleFailed)
  const timeout = setTimeout(
    () => settle({ code: 1, reason: `renderer-load-timeout:${timeoutMs}` }),
    timeoutMs
  )
  timeout.unref?.()

  return {
    reportReady: (): boolean => {
      if (settled) return false
      settle({ code: 0, reason: 'renderer-mounted-and-ipc-ready' })
      return true
    },
    dispose: cleanup
  }
}
