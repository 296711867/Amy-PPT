import { describe, expect, it } from 'vitest'
import {
  isVisualFormat,
  normalizeVisualFormat,
  resolvePlannedVisualFormat,
  VISUAL_FORMATS
} from '../../../src/shared/generation'

describe('planned visual format', () => {
  it('keeps a closed whitelist of formats', () => {
    expect(VISUAL_FORMATS).toContain('diagram-flow')
    expect(VISUAL_FORMATS).toContain('diagram-quadrant')
    expect(VISUAL_FORMATS).toContain('chart')
    expect(VISUAL_FORMATS).toContain('big-number')
    expect(VISUAL_FORMATS.length).toBe(new Set(VISUAL_FORMATS).size)
  })

  it('normalizes only known values and ignores anything else', () => {
    expect(normalizeVisualFormat('diagram-timeline')).toBe('diagram-timeline')
    expect(normalizeVisualFormat('hologram')).toBeUndefined()
    expect(normalizeVisualFormat(null)).toBeUndefined()
    expect(isVisualFormat('narrative')).toBe(true)
    expect(isVisualFormat('timeline')).toBe(false)
  })

  it('falls back to a sensible format from layoutIntent when the planner omitted it', () => {
    expect(resolvePlannedVisualFormat(undefined, 'timeline')).toBe('diagram-timeline')
    expect(resolvePlannedVisualFormat(undefined, 'process')).toBe('diagram-flow')
    expect(resolvePlannedVisualFormat(undefined, 'comparison')).toBe('diagram-comparison')
    expect(resolvePlannedVisualFormat(undefined, 'quote')).toBe('quote')
    expect(resolvePlannedVisualFormat(undefined, 'cover')).toBe('cover')
    // data-focus/concept/summary 等无明确映射时交给页面 Agent 自行决定
    expect(resolvePlannedVisualFormat(undefined, 'data-focus')).toBeUndefined()
    expect(resolvePlannedVisualFormat(undefined)).toBeUndefined()
  })

  it('prefers the explicit planned format over the intent fallback', () => {
    expect(resolvePlannedVisualFormat('chart', 'timeline')).toBe('chart')
  })
})
