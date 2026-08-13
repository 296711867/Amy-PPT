import { describe, expect, it } from 'vitest'
import {
  diversifyUniversalLayoutSequence,
  formatContentStructureCandidatePrompt,
  formatUniversalLayoutPrompt,
  getUniversalLayoutCandidates,
  getUniversalLayoutImageCount,
  resolveUniversalLayoutId
} from '../../../src/shared/universal-layouts'

describe('universal PPT layouts', () => {
  it('uses deterministic fallbacks for common module counts', () => {
    expect(resolveUniversalLayoutId({ moduleCount: 2, intent: 'concept' })).toBe('two-cards-split')
    expect(resolveUniversalLayoutId({ moduleCount: 2, intent: 'process' })).toBe('two-cards-stair')
    expect(resolveUniversalLayoutId({ moduleCount: 4, intent: 'concept' })).toBe('four-cards-grid')
    expect(resolveUniversalLayoutId({ moduleCount: 5, intent: 'image-focus' })).toBe(
      'five-images-2-3'
    )
  })

  it('covers one to six text modules and the requested image gallery sizes', () => {
    for (let moduleCount = 1; moduleCount <= 6; moduleCount += 1) {
      expect(resolveUniversalLayoutId({ moduleCount, intent: 'concept' })).toBeTruthy()
    }
    expect(getUniversalLayoutImageCount('two-images-caption')).toBe(2)
    expect(getUniversalLayoutImageCount('three-images-feature')).toBe(3)
    expect(getUniversalLayoutImageCount('four-images-grid')).toBe(4)
    expect(getUniversalLayoutImageCount('six-images-feature')).toBe(6)
    expect(getUniversalLayoutImageCount('image-left-two-cards')).toBe(1)
  })

  it('rotates repeated module counts across different silhouettes', () => {
    const result = diversifyUniversalLayoutSequence([
      { layoutId: 'three-cards-row', moduleCount: 3, contentStructure: 'parallel' as const },
      { layoutId: 'three-cards-row', moduleCount: 3, contentStructure: 'parallel' as const },
      { layoutId: 'three-cards-row', moduleCount: 3, contentStructure: 'parallel' as const },
      { layoutId: 'three-cards-row', moduleCount: 3, contentStructure: 'parallel' as const }
    ])
    expect(new Set(result.map((item) => item.layoutId)).size).toBeGreaterThanOrEqual(2)
    expect(result[0].layoutId).not.toBe(result[1].layoutId)
    expect(result[1].layoutId).not.toBe(result[2].layoutId)
  })

  it('builds an explicit candidate pool from content structure before choosing a layout', () => {
    expect(
      getUniversalLayoutCandidates({ moduleCount: 3, contentStructure: 'sequence' }).map(
        (layout) => layout.id
      )[0]
    ).toBe('three-cards-stack')
    expect(
      getUniversalLayoutCandidates({ moduleCount: 2, contentStructure: 'image-support' }).map(
        (layout) => layout.id
      )
    ).toEqual(['image-left-two-cards', 'two-cards-left-image'])
    expect(
      getUniversalLayoutCandidates({ moduleCount: 4, contentStructure: 'gallery' }).every(
        (layout) => layout.family === 'gallery'
      )
    ).toBe(true)
    expect(
      getUniversalLayoutCandidates({ moduleCount: 5, contentStructure: 'gallery' }).map(
        (layout) => layout.id
      )
    ).toEqual([
      'five-images-2-3',
      'five-images-feature',
      'five-images-row-portrait',
      'five-images-2-3-square'
    ])
    expect(
      getUniversalLayoutCandidates({ moduleCount: 2, contentStructure: 'single-focus' })
    ).toEqual([])
  })

  it('rejects an incompatible explicit layout and fills missing layouts from the candidate pool', () => {
    expect(
      resolveUniversalLayoutId({
        value: 'four-cards-grid',
        moduleCount: 3,
        contentStructure: 'sequence'
      })
    ).toBe('three-cards-stack')

    const result = diversifyUniversalLayoutSequence([
      { moduleCount: 2, contentStructure: 'parallel' as const, layoutIntent: 'concept' as const },
      { moduleCount: 2, contentStructure: 'parallel' as const, layoutIntent: 'concept' as const }
    ])
    expect(result.map((item) => item.layoutId)).toEqual([
      'two-cards-split',
      'two-text-asymmetric'
    ])
  })

  it('exposes the content structure candidate map to the planning agent', () => {
    const prompt = formatContentStructureCandidatePrompt()
    expect(prompt).toContain('sequence:')
    expect(prompt).toContain('three-cards-stair')
    expect(prompt).toContain('image-support:')
    expect(prompt).toContain('image-left-two-cards')
  })

  it('selects gallery geometry from image count and visual aspect', () => {
    expect(
      resolveUniversalLayoutId({
        moduleCount: 5,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'portrait',
        contentDensity: 'light'
      })
    ).toBe('five-images-row-portrait')
    expect(
      resolveUniversalLayoutId({
        moduleCount: 6,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'portrait',
        contentDensity: 'light'
      })
    ).toBe('six-images-row-portrait')
    expect(
      resolveUniversalLayoutId({
        moduleCount: 6,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'landscape',
        contentDensity: 'standard'
      })
    ).toBe('six-images-grid')
    expect(
      resolveUniversalLayoutId({
        moduleCount: 5,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'mixed'
      })
    ).toBe('five-images-feature')
    expect(
      resolveUniversalLayoutId({
        moduleCount: 4,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'square'
      })
    ).toBe('four-images-grid-square')
    expect(
      resolveUniversalLayoutId({
        moduleCount: 6,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'square'
      })
    ).toBe('six-images-grid-square')
  })

  it('does not accept a layout whose image geometry conflicts with the plan', () => {
    expect(
      resolveUniversalLayoutId({
        value: 'six-images-grid',
        moduleCount: 6,
        intent: 'image-focus',
        contentStructure: 'gallery',
        visualAspect: 'portrait'
      })
    ).toBe('six-images-row-portrait')
  })

  it('keeps an explicit valid layout and emits a hard geometry contract', () => {
    expect(
      resolveUniversalLayoutId({ value: 'three-cards-stack', moduleCount: 3, intent: 'concept' })
    ).toBe('three-cards-stack')
    expect(formatUniversalLayoutPrompt('three-cards-stack')).toContain('Hard geometry contract')
    expect(formatUniversalLayoutPrompt('three-cards-stack')).toContain('exactly three')
  })
})
