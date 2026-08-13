import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionDetailRuntimeStore } from '../../../src/renderer/src/store/sessionDetailRuntimeStore'

describe('session detail runtime store', () => {
  beforeEach(() => {
    useSessionDetailRuntimeStore.getState().setAddElementHandler(null)
  })

  it('delegates element insertion to the registered editor handler', async () => {
    const handler = vi.fn().mockResolvedValue(true)
    useSessionDetailRuntimeStore.getState().setAddElementHandler(handler)

    const result = await useSessionDetailRuntimeStore
      .getState()
      .addElement('./images/generated.png', 'generated.png', {
        persistImmediately: true,
        asBackground: true
      })

    expect(result).toBe(true)
    expect(handler).toHaveBeenCalledWith('./images/generated.png', 'generated.png', {
      persistImmediately: true,
      asBackground: true
    })
  })

  it('returns false when the editor is unavailable', async () => {
    await expect(
      useSessionDetailRuntimeStore
        .getState()
        .addElement('./images/generated.png', 'generated.png')
    ).resolves.toBe(false)
  })
})
