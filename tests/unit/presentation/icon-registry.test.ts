import { describe, expect, it } from 'vitest'
import {
  POPULAR_ICONS,
  getIconCount,
  getIconInner,
  getPopularLabel,
  isKnownIconId,
  loadIconLibrary,
  searchIcons
} from '../../../src/main/presentation/icons/icon-registry'

describe('icon-registry', () => {
  it('loads the full lucide library (1000+ icons)', () => {
    const data = loadIconLibrary()
    expect(data.count).toBeGreaterThan(1000)
    expect(data.viewBox).toBe('0 0 24 24')
    expect(data.strokeAttrs).toContain('stroke="currentColor"')
  })

  it('getIconInner returns markup for known id, null for unknown', () => {
    expect(getIconInner('rocket')).toMatch(/<path/)
    expect(getIconInner('star')).toMatch(/<path/)
    expect(getIconInner('definitely-not-an-icon-id-xyz')).toBeNull()
  })

  it('isKnownIconId distinguishes known vs unknown', () => {
    expect(isKnownIconId('rocket')).toBe(true)
    expect(isKnownIconId('trending-up')).toBe(true)
    expect(isKnownIconId('xyz-not-real-123')).toBe(false)
  })

  it('getIconCount matches library count', () => {
    expect(getIconCount()).toBe(loadIconLibrary().count)
  })

  it('searchIcons matches english id substrings', () => {
    const results = searchIcons('arrow', 10)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.id === 'arrow-right')).toBe(true)
  })

  it('searchIcons matches chinese popular labels (增长 → trending-up)', () => {
    const results = searchIcons('增长', 10)
    expect(results.some((r) => r.id === 'trending-up')).toBe(true)
  })

  it('searchIcons returns popular icons for empty query', () => {
    const results = searchIcons('', 5)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(results.every((r) => Boolean(r.label))).toBe(true)
  })

  it('POPULAR_ICONS is non-empty and each maps to a label', () => {
    expect(POPULAR_ICONS.length).toBeGreaterThan(50)
    expect(getPopularLabel('rocket')).toBeDefined()
    expect(getPopularLabel('xyz-not-real')).toBeUndefined()
  })
})
