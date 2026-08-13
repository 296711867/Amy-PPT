import { describe, expect, it } from 'vitest'
import { findUnsupportedPrecisionClaims } from '../../../src/main/thinking/content-credibility'

describe('thinking content credibility', () => {
  it('flags unsupported exact metrics when no sources exist', () => {
    const issues = findUnsupportedPrecisionClaims({
      hasSources: false,
      markdown: [
        '# Thinking Brief',
        '',
        '## Page 1: 性能跃迁',
        '- Role: data',
        '- Objective: 说明性能变化',
        '',
        '- 单token推理成本下降70%',
        '- HumanEval基准从67%提升至89%',
        '- 工程侧应关注推理效率和部署复杂度'
      ].join('\n')
    })

    expect(issues).toHaveLength(2)
    expect(issues.map((issue) => issue.text)).toEqual([
      '- 单token推理成本下降70%',
      '- HumanEval基准从67%提升至89%'
    ])
  })

  it('allows structural numbers and sourced exact metrics', () => {
    expect(
      findUnsupportedPrecisionClaims({
        hasSources: false,
        markdown: [
          '# Thinking Brief',
          '',
          '## Topic',
          '2026 AI模型的进化',
          '',
          '## Setting',
          '技术分享会，时长约10分钟',
          '',
          '## Page Count',
          '9'
        ].join('\n')
      })
    ).toHaveLength(0)

    expect(
      findUnsupportedPrecisionClaims({
        hasSources: true,
        markdown: '- 单token推理成本下降70%'
      })
    ).toHaveLength(0)
  })
})
