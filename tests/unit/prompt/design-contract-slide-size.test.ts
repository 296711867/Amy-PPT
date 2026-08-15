import { describe, expect, it } from 'vitest'
import { buildDesignContractSystemPrompt } from '../../../src/main/agent-runtime/prompt'
import { resolveSlideSize } from '../../../src/shared/slide-size'

describe('size-aware design contract prompt', () => {
  it('uses the exact target size to adapt layoutMotif without injecting layout skills', () => {
    const prompt = buildDesignContractSystemPrompt({
      styleSkill: 'A blue editorial style originally observed on a 16:9 canvas.',
      slideSize: resolveSlideSize({
        id: 'vertical-9-16',
        width: 1080,
        height: 1920
      })
    })

    expect(prompt).toContain('Slide size id: vertical-9-16')
    expect(prompt).toContain('Exact dimensions: 1080x1920')
    expect(prompt).toContain('Generate layoutMotif for this exact canvas')
    expect(prompt).toContain(
      'layoutMotif must combine the style specification with the exact target canvas above'
    )
    expect(prompt).not.toMatch(/\{\{[^}]+\}\}/)
    expect(prompt).not.toContain('layout-skill')
    expect(prompt).not.toContain('catalog')
    expect(prompt).not.toContain('checklist')
  })

  it('keeps square dimensions explicit for a square design contract', () => {
    const prompt = buildDesignContractSystemPrompt({
      styleSkill: 'Use restrained monochrome geometry.',
      slideSize: resolveSlideSize({ id: 'square-1-1' })
    })

    expect(prompt).toContain('Slide size id: square-1-1')
    expect(prompt).toContain('Exact dimensions: 1200x1200')
  })

  it('keeps conditional font guidance and serialized font inventory in the composer', () => {
    const prompt = buildDesignContractSystemPrompt({
      styleSkill: 'Use clear editorial hierarchy.',
      availableFonts: [
        { family: 'Noto Sans SC', roles: ['title', 'body'] },
        { family: 'Inter', roles: ['body'] }
      ],
      requestedFontPair: {
        titleFont: 'Noto Sans SC',
        subtitleFont: 'Inter',
        bodyFont: 'Inter'
      },
      languageHint: 'zh-CN',
      slideSize: resolveSlideSize({ id: 'wide-16-9' })
    })

    expect(prompt).toContain(
      'titleFont, subtitleFont, and bodyFont are fixed by the user selection'
    )
    expect(prompt).toContain('titleFont: Noto Sans SC')
    expect(prompt).toContain('subtitleFont: Inter')
    expect(prompt).toContain('bodyFont: Inter')
    expect(prompt).toContain('languageHint: zh-CN')
    expect(prompt).toContain('"family":"Noto Sans SC"')
    expect(prompt).not.toMatch(/\{\{[^}]+\}\}/)
  })

  it('asks the model to fold card/module embellishment vocabulary into shapeLanguage', () => {
    const prompt = buildDesignContractSystemPrompt({
      styleSkill: 'A minimal corporate style with restrained decoration.',
      slideSize: resolveSlideSize({ id: 'wide-16-9' })
    })

    // 新增装饰语汇段
    expect(prompt).toContain('## Card & module embellishment')
    expect(prompt).toContain('fold into shapeLanguage')
    expect(prompt).toContain('must go beyond corners/borders/shadows')
    // 装饰维度清单
    expect(prompt).toContain('Icons & backings')
    expect(prompt).toContain('Visual anchors')
    expect(prompt).toContain('Restraint must match the style')
    expect(prompt).toContain('Peer consistency')
    // Format example 的 shapeLanguage 展示了装饰语汇写法（克制示例）
    expect(prompt).toContain('clean restraint — no icon backings')
  })
})
