import { describe, expect, it } from 'vitest'
import { buildSinglePageGenerationPrompt } from '../../../src/main/agent-runtime/prompt/composers/generation-user'
import { requireSlideSizePreset } from '../../../src/shared/slide-size'

const slideSize = requireSlideSizePreset('wide-16-9')

const baseArgs = {
  topic: '增长策略',
  deckTitle: '增长策略',
  pageId: 'page-1',
  pageNumber: 2,
  pageTitle: '增长飞轮',
  pageOutline: '内容吸引用户；用户产生数据；数据优化产品',
  slideSize
}

describe('planned visual format in the single-page prompt', () => {
  it('routes diagram formats to the diagram skill with type guidance', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      visualFormat: 'diagram-cycle'
    })

    expect(prompt).toContain('Planned visual format: diagram-cycle')
    expect(prompt).toContain('inline SVG cycle diagram')
    expect(prompt).toContain('amy-ppt-diagram')
  })

  it('routes chart pages to the chart skill instead of diagrams', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      visualFormat: 'chart'
    })

    expect(prompt).toContain('Planned visual format: chart')
    expect(prompt).toContain('Build the page around one Chart.js chart')
    expect(prompt).not.toContain('Planned visual format: diagram')
  })

  it('describes non-diagram formats without skill routing', () => {
    const bigNumber = buildSinglePageGenerationPrompt({
      ...baseArgs,
      visualFormat: 'big-number'
    })
    expect(bigNumber).toContain('hero metrics dominate the page')
    expect(bigNumber).not.toContain('Planned visual format: diagram')

    const ending = buildSinglePageGenerationPrompt({
      ...baseArgs,
      visualFormat: 'ending'
    })
    expect(ending).toContain('closing page')
  })

  it('stays silent when no format was planned', () => {
    const prompt = buildSinglePageGenerationPrompt(baseArgs)
    expect(prompt).not.toContain('Planned visual format')
  })

  it('switches image slots to semantic placeholder blocks in placeholder mode', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      imageAssetPaths: [
        './assets/amy-image-placeholder.png',
        './assets/amy-image-placeholder.png'
      ]
    })

    expect(prompt).toContain('placeholder mode (2 planned slot(s)')
    expect(prompt).toContain('data-role="image-placeholder"')
    expect(prompt).toContain('语义描述')
    expect(prompt).toContain('替换图片')
    expect(prompt).not.toContain('Assigned image assets')
    expect(prompt).not.toContain('<img src="./assets/amy-image-placeholder.png">')
  })

  it('keeps real <img> instructions for AI-generated image assets', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      imageAssetPaths: ['./images/page-2-slot-1.png']
    })

    expect(prompt).toContain('Assigned image assets (1 distinct slots)')
    expect(prompt).toContain('<img src="./images/page-2-slot-1.png">')
    expect(prompt).not.toContain('placeholder mode')
  })

  it('treats a single placeholder path the same as a full placeholder set', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      imageAssetPath: './assets/amy-image-placeholder.png'
    })

    expect(prompt).toContain('placeholder mode (1 planned slot(s)')
    expect(prompt).not.toContain('Assigned image asset:')
  })

  it('surfaces the planned audience move as a module-level filter', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      audienceMove: 'thinks growth is random → sees the three levers'
    })

    expect(prompt).toContain('Planned audience move: thinks growth is random → sees the three levers')
    expect(prompt).toContain('must serve this before → after transition')
  })

  it('omits the audience move section when not planned', () => {
    const prompt = buildSinglePageGenerationPrompt(baseArgs)
    expect(prompt).not.toContain('Planned audience move')
  })

  it('injects escalated method-level corrections as proactive guidance', () => {
    const prompt = buildSinglePageGenerationPrompt({
      ...baseArgs,
      methodLevelFixes: [
        'Icons must be referenced as <svg data-icon="id"> (never emoji).'
      ]
    })

    expect(prompt).toContain('Method-level corrections from earlier slides')
    expect(prompt).toContain('apply proactively, do not wait to fail the same way')
    expect(prompt).toContain('never emoji')
  })

  it('omits the method-level section when no signal escalated', () => {
    const prompt = buildSinglePageGenerationPrompt(baseArgs)
    expect(prompt).not.toContain('Method-level corrections')
  })
})
