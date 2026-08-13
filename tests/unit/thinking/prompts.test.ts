import { describe, expect, it } from 'vitest'
import { BASE_THINKING_PROMPT } from '../../../src/main/thinking/prompts/base'
import { DRAFT_STAGE_PROMPT } from '../../../src/main/thinking/prompts/draft'
import { OUTLINE_STAGE_PROMPT } from '../../../src/main/thinking/prompts/outline'
import { READY_STAGE_PROMPT } from '../../../src/main/thinking/prompts/ready'
import { REFINE_STAGE_PROMPT } from '../../../src/main/thinking/prompts/refine'

describe('thinking prompts', () => {
  it('does not hard-code English confirm-and-generate replies', () => {
    const prompts = [
      OUTLINE_STAGE_PROMPT,
      DRAFT_STAGE_PROMPT,
      REFINE_STAGE_PROMPT,
      READY_STAGE_PROMPT
    ]

    for (const prompt of prompts) {
      expect(prompt).not.toContain('You can click **Confirm & Generate**')
      expect(prompt).not.toContain('Looks good! Click **Confirm & Generate**')
      expect(prompt).not.toContain('User will click "Confirm & Generate"')
    }
  })

  it('requires an internal ReAct loop without leaking reasoning', () => {
    expect(BASE_THINKING_PROMPT).toContain('Use an internal ReAct loop every turn')
    expect(BASE_THINKING_PROMPT).toContain('Do not reveal hidden reasoning or tool chatter')
  })

  it('blocks unsupported exact metrics for source-less thinking', () => {
    expect(BASE_THINKING_PROMPT).toContain('Do not write exact metrics')
    expect(DRAFT_STAGE_PROMPT).toContain('If no sources support exact metrics')
    expect(OUTLINE_STAGE_PROMPT).toContain('For source-less topics')
  })
})
