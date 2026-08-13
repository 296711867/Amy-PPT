import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  attachBrokenPipeGuard,
  canUseConsoleTransport,
  installLoggingStreamGuards
} from '../../../src/main/app/logging-stream-guard'

describe('logging stream guard', () => {
  it('uses console logging only when every target stream is a TTY', () => {
    expect(canUseConsoleTransport([{ isTTY: true, on: vi.fn() }, { isTTY: true, on: vi.fn() }])).toBe(
      true
    )
    expect(
      canUseConsoleTransport([{ isTTY: true, on: vi.fn() }, { isTTY: false, on: vi.fn() }])
    ).toBe(false)
    expect(canUseConsoleTransport([{ on: vi.fn() }, { on: vi.fn() }])).toBe(false)
  })

  it('disables the console transport once when stdout or stderr reports EPIPE', () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const disableConsoleTransport = vi.fn()

    installLoggingStreamGuards([stdout, stderr], disableConsoleTransport)

    stdout.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }))
    stderr.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }))

    expect(disableConsoleTransport).toHaveBeenCalledTimes(1)
  })

  it('does not swallow unrelated stream errors', () => {
    const stream = new EventEmitter()
    attachBrokenPipeGuard(stream, vi.fn())
    const error = Object.assign(new Error('permission denied'), { code: 'EACCES' })

    expect(() => stream.emit('error', error)).toThrow(error)
  })
})
