import { describe, expect, it, vi } from 'vitest'
import { finalizeGenerationFailure } from '../../../src/main/generation/finalization'

describe('finalizeGenerationFailure system pause', () => {
  it('publishes run_paused for a model quota failure before page generation starts', async () => {
    const emitGenerateChunk = vi.fn()
    const db = {
      getGenerationRun: vi.fn(async () => ({ status: 'running' })),
      listSessionPages: vi.fn(async () => [
        { file_slug: 'page-1', status: 'pending' },
        { file_slug: 'page-2', status: 'pending' }
      ]),
      updateGenerationRunStatus: vi.fn(async () => undefined),
      updateSessionStatus: vi.fn(async () => undefined),
      addMessage: vi.fn(async () => 'message-1')
    }
    const ctx = {
      db,
      runtimeEmitters: { emitGenerateChunk }
    }
    const context = {
      sessionId: 'session-1',
      runId: 'run-1',
      styleId: 'style-1',
      previousSessionStatus: 'active',
      effectiveMode: 'generate',
      messageScope: 'main',
      projectId: 'project-1',
      provider: 'openai-responses',
      model: 'gpt-5.6-sol'
    }

    await finalizeGenerationFailure(
      ctx as never,
      context as never,
      new Error('429 Daily usage quota exhausted for this platform')
    )

    expect(db.updateGenerationRunStatus).toHaveBeenCalledWith(
      'run-1',
      'failed',
      '429 Daily usage quota exhausted for this platform'
    )
    expect(emitGenerateChunk).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        type: 'run_paused',
        payload: expect.objectContaining({
          pendingPageCount: 2,
          provider: 'openai-responses',
          model: 'gpt-5.6-sol',
          failure: expect.objectContaining({ code: 'MODEL_RATE_LIMIT' })
        })
      })
    )
  })
})
