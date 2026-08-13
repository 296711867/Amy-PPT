import { describe, expect, it } from 'vitest'
import { canRecoverThinkingStreamError } from '../../../src/main/thinking/stream-error-recovery'

const formatError = new TypeError("Cannot read properties of undefined (reading 'map')")

describe('thinking stream error recovery', () => {
  it('recovers a response format error after workflow files were updated', () => {
    expect(
      canRecoverThinkingStreamError(formatError, {
        contextUpdated: true,
        thinkingUpdated: true,
        thinkingStaged: false
      })
    ).toBe(true)
  })

  it('does not hide a response format error before any workflow work completed', () => {
    expect(
      canRecoverThinkingStreamError(formatError, {
        contextUpdated: false,
        thinkingUpdated: false,
        thinkingStaged: false
      })
    ).toBe(false)
  })

  it('does not hide unrelated failures even after a workflow update', () => {
    expect(
      canRecoverThinkingStreamError(new Error('401 Unauthorized'), {
        contextUpdated: true,
        thinkingUpdated: true,
        thinkingStaged: false
      })
    ).toBe(false)
  })
})
