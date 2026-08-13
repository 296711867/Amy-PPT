import type { ThinkingStage } from '@shared/thinking'
import { COLLECT_STAGE_PROMPT } from './collect'
import { OUTLINE_STAGE_PROMPT } from './outline'
import { DRAFT_STAGE_PROMPT } from './draft'
import { REFINE_STAGE_PROMPT } from './refine'
import { READY_STAGE_PROMPT } from './ready'

const STAGE_PROMPTS: Record<ThinkingStage, string> = {
  collect: COLLECT_STAGE_PROMPT,
  outline: OUTLINE_STAGE_PROMPT,
  draft: DRAFT_STAGE_PROMPT,
  refine: REFINE_STAGE_PROMPT,
  ready: READY_STAGE_PROMPT
}

export function getStagePrompt(stage: ThinkingStage): string {
  return STAGE_PROMPTS[stage] || COLLECT_STAGE_PROMPT
}
