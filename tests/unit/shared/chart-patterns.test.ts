import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  CHART_PATTERNS,
  formatChartPatternCatalogPrompt,
  formatChartPatternDetail,
  recallChartPatterns
} from '../../../src/shared/chart-patterns'

describe('chart pattern catalog', () => {
  it('keeps unique ids with complete metadata', () => {
    const ids = CHART_PATTERNS.map((pattern) => pattern.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(17)
    for (const pattern of CHART_PATTERNS) {
      expect(pattern.tags.length).toBeGreaterThanOrEqual(4)
      expect(pattern.whenToUse.length).toBeGreaterThan(4)
      expect(pattern.whenNotToUse.length).toBeGreaterThan(4)
      expect(pattern.configHint.length).toBeGreaterThan(10)
      expect(['bar', 'line', 'doughnut', 'pie', 'scatter', 'bubble', 'radar']).toContain(
        pattern.chartType.split('+')[0]?.trim() || pattern.chartType
      )
    }
  })

  it('recalls the right pattern from English and Chinese content descriptions', () => {
    expect(recallChartPatterns('time series')[0]?.pattern.id).toBe('line-trend')
    expect(recallChartPatterns('conversion funnel')[0]?.pattern.id).toBe('funnel-stages')
    expect(recallChartPatterns('漏斗')[0]?.pattern.id).toBe('funnel-stages')
    expect(recallChartPatterns('目标 vs 实际')[0]?.pattern.id).toBe('bullet-target')
    expect(recallChartPatterns('market share')[0]?.pattern.id).toBe('donut-share')
    const composition = recallChartPatterns('占比构成').map((match) => match.pattern.id)
    expect(composition).toContain('stacked-bar-composition')
  })

  it('returns ranked matches, respects limits, and stays silent without a match', () => {
    const matches = recallChartPatterns('对比多个分类', 2)
    expect(matches.length).toBeLessThanOrEqual(2)
    expect(matches[0] ? matches[0].score >= matches[matches.length - 1].score : true).toBe(true)
    expect(recallChartPatterns('')).toEqual([])
    expect(recallChartPatterns('zzzqqq')).toEqual([])
  })

  it('formats a compact catalog and per-pattern details', () => {
    const catalog = formatChartPatternCatalogPrompt()
    for (const pattern of CHART_PATTERNS) {
      expect(catalog).toContain(pattern.id)
    }
    const detail = formatChartPatternDetail(CHART_PATTERNS[0])
    expect(detail).toContain('Use when:')
    expect(detail).toContain('Avoid when:')
    expect(detail).toContain('Config:')
  })
})

describe('chart pattern assets stay in sync', () => {
  const skillPath = path.join(
    process.cwd(),
    'resources/skills/amy-ppt-chart/SKILL.md'
  )

  it('the chart skill lists every pattern and the recall tool', () => {
    const skill = readFileSync(skillPath, 'utf8')
    for (const pattern of CHART_PATTERNS) {
      expect(skill, `missing pattern ${pattern.id}`).toContain(pattern.id)
    }
    expect(skill).toContain('search_chart_patterns')
  })

  it('the recall tool is registered for both single-page and deck agents', () => {
    const toolsSource = readFileSync(
      path.join(process.cwd(), 'src/main/agent-runtime/tools/deck-tools.ts'),
      'utf8'
    )
    expect(toolsSource).toContain("name: 'search_chart_patterns'")
    expect(toolsSource).toContain('searchChartPatternsTool')
  })
})
