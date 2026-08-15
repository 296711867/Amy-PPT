import { describe, expect, it } from 'vitest'
import {
  validateTemplateSkeletonPreserved,
  validateTemplateStructurePreserved
} from '../../../src/main/presentation/templates/template-skeleton-validator'

const buildTemplateHtml = (zoneCount: number, decorCount: number): string => {
  const zones = Array.from(
    { length: zoneCount },
    (_, index) => `<div class="zone-${index}">模块 ${index + 1}</div>`
  ).join('\n')
  const decor = Array.from(
    { length: decorCount },
    (_, index) => `<img class="decor-bg" src="./decor-${index}.png" />`
  ).join('\n')
  return `<html><body><section data-page-scaffold="1">
  <main data-role="content">
    ${zones}
    ${decor}
  </main>
</section></body></html>`
}

describe('template structure fingerprint', () => {
  it('accepts a rewrite that keeps the structural zones and decoration layers', () => {
    const before = buildTemplateHtml(5, 4)
    const after = buildTemplateHtml(4, 3)
    expect(validateTemplateStructurePreserved(before, after)).toEqual([])
  })

  it('rejects a rewrite that collapses structural zones', () => {
    const before = buildTemplateHtml(6, 0)
    const after = buildTemplateHtml(2, 0)
    const violations = validateTemplateStructurePreserved(before, after)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('结构分区')
  })

  it('rejects a rewrite that drops decoration layers', () => {
    const before = buildTemplateHtml(2, 6)
    const after = buildTemplateHtml(2, 1)
    const violations = validateTemplateStructurePreserved(before, after)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('装饰类元素')
  })

  it('stays silent for small page bases to avoid false positives', () => {
    const before = buildTemplateHtml(2, 2)
    const after = buildTemplateHtml(1, 0)
    expect(validateTemplateStructurePreserved(before, after)).toEqual([])
  })

  it('still reports missing skeleton resources independently', () => {
    const before = buildTemplateHtml(4, 4)
    const after = before.replace('./decor-3.png', './other.png')
    expect(validateTemplateSkeletonPreserved(before, after)).toEqual(['decor-3.png'])
    expect(validateTemplateStructurePreserved(before, after)).toEqual([])
  })
})
