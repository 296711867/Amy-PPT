import { describe, expect, it } from 'vitest'
import {
  buildSessionStyleSelection,
  normalizeAiStyleDescription,
  normalizeAiThemeColors,
  normalizeHexColor
} from '../../../src/renderer/src/lib/ai-style-selection'

describe('AI style selection', () => {
  it('normalizes valid hex colors and drops invalid or duplicate values', () => {
    expect(normalizeHexColor(' #ABC ')).toBe('#aabbcc')
    expect(normalizeHexColor('not-a-color')).toBeNull()
    expect(normalizeAiThemeColors(['#ABC', '#aabbcc', '#123456', 'rgb(1, 2, 3)'])).toEqual([
      '#aabbcc',
      '#123456'
    ])
  })

  it('builds a preset selection without requiring AI fields', () => {
    expect(
      buildSessionStyleSelection({
        mode: 'preset',
        styleId: 'minimal-white',
        description: '',
        themeColors: []
      })
    ).toEqual({ mode: 'preset', styleId: 'minimal-white' })
  })

  it('builds an AI selection with trimmed description and normalized colors', () => {
    expect(
      buildSessionStyleSelection({
        mode: 'ai',
        styleId: '',
        description: '  editorial system  ',
        themeColors: ['#ABC', '#123456']
      })
    ).toEqual({ mode: 'ai', description: 'editorial system', themeColors: ['#aabbcc', '#123456'] })
  })

  it('rejects an AI selection without a meaningful description or valid colors', () => {
    expect(normalizeAiStyleDescription('   ')).toBe('')
    expect(
      buildSessionStyleSelection({
        mode: 'ai',
        styleId: '',
        description: '   ',
        themeColors: ['invalid']
      })
    ).toBeNull()
  })
})
