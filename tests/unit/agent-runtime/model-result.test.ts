import { describe, expect, it } from 'vitest'
import {
  assertModelText,
  extractJsonBlock,
  extractModelText,
  readModelResponseDiagnostics
} from '../../../src/main/agent-runtime/model/result'

describe('extractModelText', () => {
  it('extracts strings and supported structured message content', () => {
    expect(extractModelText('plain text')).toBe('plain text')
    expect(
      extractModelText({
        content: ['first', { text: 'second' }, { type: 'image_url', image_url: 'ignored' }]
      })
    ).toBe('first\nsecond')
  })

  it('returns an empty string for unsupported model values', () => {
    expect(extractModelText(null)).toBe('')
    expect(extractModelText({ content: [{ text: 123 }] })).toBe('')
  })
})

describe('model response diagnostics', () => {
  it('recognizes an empty response that exhausted its output budget', () => {
    const response = {
      content: '',
      response_metadata: {
        finish_reason: 'length',
        tokenUsage: { completionTokens: 4096 }
      }
    }

    expect(readModelResponseDiagnostics(response)).toEqual({
      finishReason: 'length',
      outputTokens: 4096
    })
    expect(() => assertModelText(response, { maxTokens: 4096, locale: 'zh' })).toThrow(
      '模型已耗尽 4096 个输出 token，但没有返回可见文本'
    )
  })

  it('returns visible text and explains unexplained empty responses', () => {
    expect(assertModelText({ content: '  {"ok":true}  ' })).toBe('{"ok":true}')
    expect(() => assertModelText({ content: '' }, { locale: 'zh' })).toThrow(
      '模型返回了空响应，没有可见文本'
    )
  })
})

describe('extractJsonBlock', () => {
  it('extracts a fenced JSON payload', () => {
    expect(extractJsonBlock('Model response:\n```json\n{\n  "title": "Deck"\n}\n```')).toBe(
      '{\n  "title": "Deck"\n}'
    )
  })

  it('extracts balanced objects without being confused by braces in strings', () => {
    expect(
      extractJsonBlock('Use this result: {"message":"keep {this} literal","items":[1,2]} Thanks.')
    ).toBe('{"message":"keep {this} literal","items":[1,2]}')
  })

  it('extracts a top-level JSON array', () => {
    expect(extractJsonBlock('Result: [{"title":"One"},{"title":"Two"}] done')).toBe(
      '[{"title":"One"},{"title":"Two"}]'
    )
  })

  it('skips prose brackets before a JSON payload', () => {
    expect(extractJsonBlock('Note [draft]: {"title":"Deck"}')).toBe('{"title":"Deck"}')
  })

  it('returns a trimmed fallback when no JSON block is present', () => {
    expect(extractJsonBlock('  model declined to return JSON  ')).toBe('model declined to return JSON')
  })
})
