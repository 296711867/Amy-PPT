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

const buildTypographyHtml = (sizes: number[], colors: string[]): string => {
  const blocks = sizes
    .map(
      (size, index) =>
        `<div style="font-size:${size}px;color:${colors[index % colors.length] || '#000000'}">文本 ${index}</div>`
    )
    .join('\n')
  return `<html><body><section data-page-scaffold="1"><main data-role="content">${blocks}</main></section></body></html>`
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

  it('rejects a rewrite that collapses the typography scale', () => {
    const before = buildTypographyHtml([48, 36, 24, 20, 16, 14], ['#1a2b3c'])
    const after = buildTypographyHtml([18, 16, 18, 16, 18, 16], ['#1a2b3c'])
    const violations = validateTemplateStructurePreserved(before, after)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('字号层级')
  })

  it('rejects a rewrite that swaps the color palette', () => {
    const before = buildTypographyHtml(
      [48, 36, 24, 20, 16, 14],
      ['#1a2b3c', '#c0504d', '#4f81bd', '#9bbb59', '#8064a2']
    )
    const after = buildTypographyHtml(
      [48, 36, 24, 20, 16, 14],
      ['#111111', '#222222', '#111111', '#222222', '#111111']
    )
    const violations = validateTemplateStructurePreserved(before, after)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('配色')
  })

  it('keeps quiet when the typography or palette base is small', () => {
    const before = buildTypographyHtml([48, 24], ['#1a2b3c', '#c0504d'])
    const after = buildTypographyHtml([18], ['#111111'])
    expect(validateTemplateStructurePreserved(before, after)).toEqual([])
  })
})
