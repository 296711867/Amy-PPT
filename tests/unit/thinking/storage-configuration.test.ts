import { describe, expect, it, vi } from 'vitest'
import { resolveThinkingHistoryStoragePath } from '../../../src/main/ipc/thinking/storage-configuration'

describe('thinking history storage configuration', () => {
  it('treats a missing storage path as an empty history or latest-workspace state', async () => {
    const resolveStoragePath = vi.fn(async () => {
      throw new Error('storage path is required')
    })

    await expect(
      resolveThinkingHistoryStoragePath({
        readStoragePath: vi.fn(async () => ''),
        resolveStoragePath
      })
    ).resolves.toBeNull()
    expect(resolveStoragePath).not.toHaveBeenCalled()
  })

  it('uses the normal validated resolver after storage is configured', async () => {
    const resolveStoragePath = vi.fn(async () => 'D:\\ppt-projects')

    await expect(
      resolveThinkingHistoryStoragePath({
        readStoragePath: vi.fn(async () => '  D:\\ppt-projects  '),
        resolveStoragePath
      })
    ).resolves.toBe('D:\\ppt-projects')
    expect(resolveStoragePath).toHaveBeenCalledOnce()
  })
})
