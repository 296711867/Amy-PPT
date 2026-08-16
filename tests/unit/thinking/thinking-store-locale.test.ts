import { describe, expect, it } from 'vitest'
import { getThinkingConnectionStepSummary } from '../../../src/renderer/src/store/thinkingStore'
import { en } from '../../../src/renderer/src/i18n/en'
import { zh } from '../../../src/renderer/src/i18n/zh'

describe('thinking store connection step locale', () => {
  it('uses the localized connecting and reconnecting summaries', () => {
    expect(getThinkingConnectionStepSummary(false, 'zh')).toBe(zh.thinking.connectionConnecting)
    expect(getThinkingConnectionStepSummary(true, 'zh')).toBe(zh.thinking.connectionRetrying)
    expect(getThinkingConnectionStepSummary(false, 'en')).toBe(en.thinking.connectionConnecting)
    expect(getThinkingConnectionStepSummary(true, 'en')).toBe(en.thinking.connectionRetrying)
  })
})
