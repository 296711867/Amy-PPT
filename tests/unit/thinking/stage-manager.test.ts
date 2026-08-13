import { describe, expect, it } from 'vitest'
import {
  detectStageFallback,
  resolveRequestedStage
} from '../../../src/main/thinking/stage-manager'

const COMPLETE_THINKING_MD = `# Thinking Brief

## Topic
2026 AI模型的进化

## Page 1: 封面
- Role: cover
- Objective: 建立主题

介绍主题和分享背景。

- 主题定位
- 受众价值

## Page 2: 技术演进
- Role: content
- Objective: 说明关键趋势

梳理核心技术变化和工程影响。

- 架构趋势
- 部署趋势
`

describe('thinking stage manager', () => {
  it('treats Chinese detail-improvement requests as draft expansion intent', () => {
    expect(detectStageFallback('完善一下细节吧')).toBe('draft')
    expect(detectStageFallback('再补充一些细节')).toBe('draft')
    expect(detectStageFallback('把内容丰富一下')).toBe('draft')
  })

  it('allows outline to move to draft when a complete page plan exists', () => {
    expect(
      resolveRequestedStage({
        currentStage: 'outline',
        requestedStage: 'draft',
        thinkingMd: COMPLETE_THINKING_MD
      })
    ).toBe('draft')
  })
})
