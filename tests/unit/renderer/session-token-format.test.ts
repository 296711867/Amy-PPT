import { describe, expect, it } from 'vitest'
import { formatSessionTokenCount } from '../../../src/renderer/src/lib/session-token-format'

describe('formatSessionTokenCount', () => {
  it('keeps unknown historical usage distinct from an attributed zero', () => {
    expect(formatSessionTokenCount(null)).toBe('—')
    expect(formatSessionTokenCount(undefined)).toBe('—')
    expect(formatSessionTokenCount(0)).toBe('0')
  })

  it('uses compact K and M units while preserving small totals', () => {
    expect(formatSessionTokenCount(999)).toBe('999')
    expect(formatSessionTokenCount(1_234)).toBe('1.2K')
    expect(formatSessionTokenCount(1_250)).toBe('1.3K')
    expect(formatSessionTokenCount(999_950)).toBe('1M')
    expect(formatSessionTokenCount(1_250_000)).toBe('1.3M')
  })

  it('normalizes impossible fractional and negative totals', () => {
    expect(formatSessionTokenCount(12.9)).toBe('12')
    expect(formatSessionTokenCount(-12)).toBe('0')
    expect(formatSessionTokenCount(Number.NaN)).toBe('—')
  })
})
