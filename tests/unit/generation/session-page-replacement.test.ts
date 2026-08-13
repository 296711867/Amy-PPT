import { describe, expect, it, vi } from 'vitest'
import { retireActiveSessionPagesForReplacement } from '../../../src/main/generation/session-page-replacement'

describe('retireActiveSessionPagesForReplacement', () => {
  it('soft deletes the previous active page set before a full replacement', async () => {
    const softDeleteSessionPages = vi.fn(async () => undefined)
    const db = {
      listSessionPages: vi.fn(async () => [{ id: 'old-1' }, { id: 'old-2' }]),
      softDeleteSessionPages
    }

    await expect(
      retireActiveSessionPagesForReplacement(db as never, 'session-1')
    ).resolves.toBe(2)
    expect(softDeleteSessionPages).toHaveBeenCalledWith('session-1', ['old-1', 'old-2'])
  })

  it('does not write when the session has no active pages', async () => {
    const softDeleteSessionPages = vi.fn(async () => undefined)
    const db = {
      listSessionPages: vi.fn(async () => []),
      softDeleteSessionPages
    }

    await expect(
      retireActiveSessionPagesForReplacement(db as never, 'session-1')
    ).resolves.toBe(0)
    expect(softDeleteSessionPages).not.toHaveBeenCalled()
  })
})
