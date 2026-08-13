import { describe, expect, it } from 'vitest'
import {
  evaluateDeckNarrative,
  extractNarrativePageSnapshot,
  findNewNarrativeHardViolations,
  type DeckNarrativeReport,
  type NarrativePageSnapshot
} from '../../../src/main/presentation/html/deck-narrative-validator'

const page = (
  pageNumber: number,
  overrides: Partial<NarrativePageSnapshot> = {}
): NarrativePageSnapshot => ({
  pageId: `page-${pageNumber}`,
  pageNumber,
  plannedTitle: `Planned ${pageNumber}`,
  renderedTitle: `A distinct claim for page ${pageNumber}`,
  bodyText: [
    'The opening frames the audience decision and establishes why the topic matters now.',
    'Observed behavior reveals the strongest adoption barrier and the evidence behind it.',
    'The recommendation focuses resources on the intervention with the clearest expected impact.',
    'The conclusion resolves the opening question and names the next action for the audience.'
  ][Math.min(pageNumber - 1, 3)],
  textBlocks: [`Distinct supporting point ${pageNumber}`],
  layoutIntent: pageNumber === 1 ? 'cover' : pageNumber === 4 ? 'summary' : 'concept',
  hasVisualEvidence: true,
  hasQuantitativeEvidence: true,
  ...overrides
})

describe('deck narrative validator', () => {
  it('extracts audience-facing content while excluding runtime and auxiliary text', () => {
    const snapshot = extractNarrativePageSnapshot({
      html: `<!doctype html><html><body><main data-role="content"><h1>增长来自高意向搜索</h1><p>搜索用户转化率达到 28%</p><footer>来源：内部报告</footer><script>thinking...</script><svg></svg></main></body></html>`,
      pageId: 'page-2',
      pageNumber: 2,
      plannedTitle: '搜索表现',
      layoutIntent: 'data-focus'
    })

    expect(snapshot.renderedTitle).toBe('增长来自高意向搜索')
    expect(snapshot.bodyText).toContain('搜索用户转化率达到 28%')
    expect(snapshot.bodyText).not.toContain('来源')
    expect(snapshot.hasVisualEvidence).toBe(true)
    expect(snapshot.hasQuantitativeEvidence).toBe(true)
  })

  it('blocks internal process leakage and duplicate narrative jobs', () => {
    const duplicateBody =
      '同一段核心内容被完整复制到多个页面，这意味着当前页面没有提供新的证据、推论、对比或行动建议，无法推进整套演示的叙事。'
    const violations = evaluateDeckNarrative([
      page(1),
      page(2, {
        renderedTitle: '核心发现',
        bodyText: duplicateBody
      }),
      page(3, {
        renderedTitle: '核心发现',
        bodyText: duplicateBody
      }),
      page(4, {
        renderedTitle: '正在生成页面计划',
        bodyText: '本轮工作记录将继续更新'
      })
    ])
    const codes = violations.map((violation) => violation.code)

    expect(codes).toContain('narrative-internal-process-leak')
    expect(codes).toContain('narrative-duplicate-title')
    expect(codes).toContain('narrative-duplicate-body')
    expect(violations.filter((violation) => violation.severity === 'error').length).toBeGreaterThan(
      0
    )
  })

  it('ignores repeated short labels that are not substantive body copy', () => {
    const violations = evaluateDeckNarrative([
      page(1),
      page(2, { bodyText: '核心结论' }),
      page(3, { bodyText: '核心结论' })
    ])

    expect(violations.map((violation) => violation.code)).not.toContain('narrative-duplicate-body')
  })

  it('keeps topic-only titles, missing evidence, and generic endings advisory', () => {
    const violations = evaluateDeckNarrative([
      page(1),
      page(2, {
        renderedTitle: '分析',
        layoutIntent: 'data-focus',
        hasVisualEvidence: false,
        hasQuantitativeEvidence: false
      }),
      page(3, {
        renderedTitle: '谢谢',
        bodyText: '感谢聆听',
        layoutIntent: 'summary'
      })
    ])
    const codes = violations.map((violation) => violation.code)

    expect(codes).toContain('narrative-topic-only-title')
    expect(codes).toContain('narrative-evidence-missing')
    expect(codes).toContain('narrative-generic-ending')
    expect(violations.every((violation) => violation.severity === 'warn')).toBe(true)
  })

  it('reports only new hard issues introduced by an edit', () => {
    const before: DeckNarrativeReport = {
      pages: [],
      unavailablePages: [],
      violations: [
        {
          code: 'narrative-duplicate-title',
          severity: 'error',
          pageIds: ['page-1'],
          detail: 'existing',
          fix: 'fix'
        }
      ]
    }
    const after: DeckNarrativeReport = {
      pages: [],
      unavailablePages: [],
      violations: [
        {
          code: 'narrative-duplicate-title',
          severity: 'error',
          pageIds: ['page-1', 'page-2'],
          detail: 'duplicate',
          fix: 'fix'
        }
      ]
    }

    expect(findNewNarrativeHardViolations({ before, after, pageIds: ['page-2'] })).toEqual([
      expect.objectContaining({ pageIds: ['page-2'] })
    ])
  })
})
