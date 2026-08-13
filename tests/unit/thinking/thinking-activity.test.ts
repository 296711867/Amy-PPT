import { describe, expect, it } from 'vitest'
import { mergeThinkingActivity, settleThinkingActivities } from '../../../src/shared/thinking-activity'

describe('thinking activity timeline', () => {
  it('updates a running tool call to completed by id', () => {
    const running = mergeThinkingActivity([], {
      id: 'call-1',
      type: 'tool',
      toolName: 'update_thinking_document',
      summary: '正在更新方案',
      status: 'running'
    })
    const completed = mergeThinkingActivity(running, {
      id: 'call-1',
      type: 'tool',
      toolName: 'update_thinking_document',
      summary: 'PPT 方案已更新',
      status: 'completed'
    })

    expect(completed).toHaveLength(1)
    expect(completed[0]).toMatchObject({ status: 'completed', summary: 'PPT 方案已更新' })
  })

  it('marks unfinished activities as failed without changing completed work', () => {
    expect(
      settleThinkingActivities(
        [
          { id: 'a', type: 'phase', summary: '连接完成', status: 'completed' },
          { id: 'b', type: 'phase', summary: '生成大纲', status: 'running' }
        ],
        'failed'
      ).map((activity) => activity.status)
    ).toEqual(['completed', 'failed'])
  })
})
