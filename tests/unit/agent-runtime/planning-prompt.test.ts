import { describe, expect, it } from 'vitest'
import { buildPlanningSystemPrompt } from '../../../src/main/agent-runtime/prompt'

describe('planning prompt composer', () => {
  it('renders the static planning instructions from the Markdown template', () => {
    const prompt = buildPlanningSystemPrompt(7)

    expect(prompt).toContain('Return exactly 7 slide plans. The JSON array length must equal 7.')
    expect(prompt).toContain('Never return fewer or more than 7 items.')
    expect(prompt).toContain('if the material does not naturally fill 7 slides')
    expect(prompt).toContain('## Content language')
    expect(prompt).toContain(
      'title, keyPoints, layoutIntent, visualFormat, contentStructure, moduleCount, visualAspect, contentDensity, and layoutId'
    )
    expect(prompt).toContain(
      'content structure -> module/image geometry -> candidate pool -> rotated final layout'
    )
    expect(prompt).toContain('sequence:')
    expect(prompt).toContain('six-images-row-portrait')
    expect(prompt).toContain('five-cards-2-3-image')
    expect(prompt).not.toMatch(/\{\{[^}]+\}\}/)
  })

  it('requires a planned visual format per slide with diagram/chart routing rules', () => {
    const prompt = buildPlanningSystemPrompt(7)

    expect(prompt).toContain('## Visual format planning')
    expect(prompt).toContain('visualFormat is required on every item')
    expect(prompt).toContain('diagram-flow')
    expect(prompt).toContain('diagram-timeline')
    expect(prompt).toContain('diagram-quadrant')
    expect(prompt).toContain('diagram-cycle')
    expect(prompt).toContain('never plan a chart page for qualitative steps')
    expect(prompt).toContain('never plan a diagram page for pure metric trends')
    expect(prompt).toContain('over-diagrammed')
    expect(prompt).toContain('"visualFormat":"diagram-cycle"')
  })
})
