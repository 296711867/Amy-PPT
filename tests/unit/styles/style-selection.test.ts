import { describe, expect, it } from 'vitest'
import {
  findStableDefaultStyleId,
  resolveStyleIdOrStableDefault
} from '../../../src/renderer/src/lib/style-selection'

describe('style selection defaults', () => {
  it('chooses minimal-white by style key instead of the first sorted option', () => {
    expect(
      findStableDefaultStyleId([
        { id: 'recent-custom', styleKey: 'custom-style' },
        { id: 'minimal-white-id', styleKey: 'minimal-white' },
        { id: 'older-style', styleKey: 'older-style' }
      ])
    ).toBe('minimal-white-id')
  })

  it('recognizes minimal-white when the style key is omitted', () => {
    expect(
      findStableDefaultStyleId([
        { id: 'recent-custom' },
        { id: 'minimal-white' },
        { id: 'older-style' }
      ])
    ).toBe('minimal-white')
  })

  it('does not guess a sorted first option when the stable fallback is unavailable', () => {
    expect(
      findStableDefaultStyleId([
        { id: 'recent-custom', styleKey: 'custom-style' },
        { id: 'older-style', styleKey: 'older-style' }
      ])
    ).toBe('')
  })

  it('preserves an explicit prepared style instead of applying the automatic fallback', () => {
    expect(
      resolveStyleIdOrStableDefault('prepared-style', [
        { id: 'recent-custom', styleKey: 'custom-style' },
        { id: 'minimal-white', styleKey: 'minimal-white' }
      ])
    ).toBe('prepared-style')
  })
})
