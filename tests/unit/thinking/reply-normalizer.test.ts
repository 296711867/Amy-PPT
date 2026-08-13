import { describe, expect, it } from 'vitest'
import {
  normalizeThinkingAssistantReply,
  normalizeThinkingMessages
} from '../../../src/main/thinking/reply-normalizer'

describe('thinking reply normalizer', () => {
  it('keeps ordinary user-facing replies', () => {
    expect(normalizeThinkingAssistantReply(' 我已确认主题，可以继续规划。 ')).toBe(
      '我已确认主题，可以继续规划。'
    )
  })

  it('drops workflow tool return text', () => {
    expect(normalizeThinkingAssistantReply('context.md updated for stage collect.')).toBe('')
    expect(normalizeThinkingAssistantReply('thinking.md updated')).toBe('')
  })

  it('strips streamed tool argument fragments before the visible reply', () => {
    const raw = [
      '"topic": "2026年AI短剧的发展",',
      '  "userIntent": "用户希望创建演示文稿",',
      '  "confirmedDecisions": ["主题确定"],',
      '}',
      '',
      '我已确认您的演示主题为**2026年AI短剧的发展**。'
    ].join('\n')

    expect(normalizeThinkingAssistantReply(raw)).toBe(
      '我已确认您的演示主题为**2026年AI短剧的发展**。'
    )
  })

  it('normalizes persisted message arrays without changing user messages', () => {
    const messages = normalizeThinkingMessages([
      { role: 'user', content: '影视从业者，内部研讨' },
      { role: 'assistant', content: 'context.md updated for stage collect.' },
      {
        role: 'assistant',
        content: '"topic": "AI短剧",\n  "userIntent": "规划演示"\n}\n\n可以开始规划。'
      }
    ])

    expect(messages).toEqual([
      { role: 'user', content: '影视从业者，内部研讨' },
      { role: 'assistant', content: '可以开始规划。' }
    ])
  })
})
