import { describe, expect, it } from 'vitest'
import { appendThinkingUserMessage } from '../../../src/shared/thinking-request'
import type { ThinkingChatMessage } from '../../../src/shared/thinking'

describe('thinking request replay', () => {
  const messages: ThinkingChatMessage[] = [
    { role: 'user', content: '制作一个产品评价 PPT 大纲', timestamp: 1 }
  ]

  it('appends the user message for a new request', () => {
    const next = appendThinkingUserMessage(messages, { content: '补充竞品分析' }, true, 2)

    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ role: 'user', content: '补充竞品分析', timestamp: 2 })
  })

  it('does not append the user message when replaying a failed request', () => {
    const next = appendThinkingUserMessage(messages, { content: '制作一个产品评价 PPT 大纲' }, false)

    expect(next).toBe(messages)
    expect(next).toHaveLength(1)
  })
})
