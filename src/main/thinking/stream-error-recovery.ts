import { isOpenAIResponsesFormatError } from '../agent-runtime/model/responses-compat'
import type { ThinkingWorkflowState } from './thinking-tools'

export function canRecoverThinkingStreamError(
  error: unknown,
  workflowState: Pick<ThinkingWorkflowState, 'contextUpdated' | 'thinkingUpdated' | 'thinkingStaged'>
): boolean {
  const hasPersistedWork =
    workflowState.contextUpdated || workflowState.thinkingUpdated || workflowState.thinkingStaged
  return hasPersistedWork && isOpenAIResponsesFormatError(error)
}
