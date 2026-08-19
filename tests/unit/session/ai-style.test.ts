import { describe, expect, it } from 'vitest'
import {
  buildAiSessionStyleSnapshot,
  buildAiStylePrompt,
  normalizeAiStyleSelection
} from '../../../src/main/session/ai-style'

describe('AI session style selection', () => {
  it('normalizes the user direction and color anchors', () => {
    expect(
      normalizeAiStyleSelection({
        mode: 'ai',
        description: '  cinematic editorial with precise technical diagrams  ',
        themeColors: ['#102030', '#F6F1E8', '#102030']
      })
    ).toEqual({
      mode: 'ai',
      description: 'cinematic editorial with precise technical diagrams',
      themeColors: ['#102030', '#F6F1E8']
    })
  })

  it('rejects AI mode without a meaningful direction', () => {
    expect(normalizeAiStyleSelection({ mode: 'ai', description: '  ' })).toBeNull()
    expect(normalizeAiStyleSelection({ mode: 'preset', description: 'editorial' })).toBeNull()
  })

  it('builds a session-only style prompt from direction, colors, topic, and source outline', () => {
    const selection = normalizeAiStyleSelection({
      mode: 'ai',
      description: 'calm industrial editorial',
      themeColors: ['#0B132B', '#5BC0BE']
    })
    if (!selection) throw new Error('Expected normalized AI selection')

    const prompt = buildAiStylePrompt({
      selection,
      topic: 'Servo motor market strategy',
      sourcePlan: {
        pageSkeleton: [{ title: 'Market context', role: 'content', reason: 'sets the baseline' }]
      },
      referenceDocumentPath: '/docs/reference.md'
    })
    expect(prompt).toContain('calm industrial editorial')
    expect(prompt).toContain('#0B132B, #5BC0BE')
    expect(prompt).toContain('Servo motor market strategy')
    expect(prompt).toContain('Market context')
    expect(prompt).toContain('typography')
    expect(prompt).toContain('shape language')
    expect(prompt).toContain('image subject')
    expect(prompt).toContain('reference/template')

    const snapshot = buildAiSessionStyleSnapshot({
      sessionId: 'session-12345678',
      selection,
      topic: 'Servo motor market strategy'
    })
    expect(snapshot).toMatchObject({
      styleId: 'ai-session-12345678',
      styleKey: 'ai-generated-session1',
      source: 'custom',
      styleNameZh: 'AI 自定义风格'
    })
    expect(snapshot.styleSkill).toContain('Do not mention or select a built-in style by name.')
  })
})
