import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { attachElectronSmokeMonitor } from '../../../src/main/app/smoke-monitor'

describe('Electron smoke monitor', () => {
  it('reports success only after the renderer confirms mount and IPC readiness', () => {
    const webContents = new EventEmitter()
    const onResult = vi.fn()

    const monitor = attachElectronSmokeMonitor(webContents as never, { enabled: true, onResult })
    webContents.emit('did-finish-load')
    expect(onResult).not.toHaveBeenCalled()
    expect(monitor.reportReady()).toBe(true)

    expect(onResult).toHaveBeenCalledWith({
      code: 0,
      reason: 'renderer-mounted-and-ipc-ready'
    })
    expect(monitor.reportReady()).toBe(false)
    expect(webContents.listenerCount('did-fail-load')).toBe(0)
  })

  it('ignores cancelled and subframe failures but fails a main-frame load', () => {
    const webContents = new EventEmitter()
    const onResult = vi.fn()

    attachElectronSmokeMonitor(webContents as never, { enabled: true, onResult })
    webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'file:///cancelled', true)
    webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://asset', false)
    expect(onResult).not.toHaveBeenCalled()

    webContents.emit('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND', 'file:///missing', true)
    expect(onResult).toHaveBeenCalledWith({
      code: 1,
      reason: 'renderer-load-failed:-6:ERR_FILE_NOT_FOUND:file:///missing'
    })
  })

  it('stays inert outside explicit smoke mode', () => {
    const webContents = new EventEmitter()
    const onResult = vi.fn()

    const monitor = attachElectronSmokeMonitor(webContents as never, {
      enabled: false,
      onResult
    })
    webContents.emit('did-finish-load')

    expect(onResult).not.toHaveBeenCalled()
    expect(monitor.reportReady()).toBe(false)
    expect(webContents.eventNames()).toEqual([])
  })
})
