import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => Promise<unknown>>()
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
        handlers.set(channel, handler)
      })
    }
  }
})

vi.mock('electron', () => ({ ipcMain: state.ipcMain }))
vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('../../../src/main/config/locale-utils', () => ({
  readAppLocale: vi.fn().mockResolvedValue('en'),
  uiText: (_locale: string, _zh: string, en: string) => en
}))
vi.mock('../../../src/main/config/model-config-utils', () => ({
  resolveModelConfigForTask: vi.fn()
}))
vi.mock('../../../src/main/session/runtime-assets', () => ({
  ensureSessionRuntimeCompatible: vi.fn()
}))
vi.mock('../../../src/main/session/master-service', () => ({
  createSessionMasterIfMissing: vi.fn()
}))
vi.mock('../../../src/main/styles/catalog', () => ({
  getStyleDetail: vi.fn(),
  hasStyleSkill: vi.fn()
}))
vi.mock('../../../src/main/generation/source-plan', () => ({
  normalizeSourcePlan: vi.fn()
}))
vi.mock('../../../src/main/history/git-history-service', () => ({
  GitHistoryService: class {}
}))
vi.mock('../../../src/main/io/local-asset-roots', () => ({
  allowLocalAssetRoot: vi.fn(),
  revokeLocalAssetRootsUnder: vi.fn()
}))
vi.mock('../../../src/main/session/page-outline-utils', () => ({
  resolveOutlinesForPages: vi.fn().mockResolvedValue(new Map())
}))
vi.mock('../../../src/main/session/session-thumbnail', () => ({
  warmSessionFirstPageThumbnails: vi.fn().mockResolvedValue(new Map())
}))

describe('session:list token usage', () => {
  beforeEach(() => {
    vi.resetModules()
    state.handlers.clear()
    state.ipcMain.handle.mockClear()
  })

  it('keeps null for un-attributed history and zero for attributed usage', async () => {
    const { registerSessionHandlers } = await import('../../../src/main/session/handlers')
    const sessions = [
      { id: 'session-null', title: 'Historical', totalTokens: null },
      { id: 'session-zero', title: 'Zero usage', totalTokens: 0 }
    ]
    const context = {
      db: {
        listSessions: vi.fn().mockResolvedValue(sessions),
        getLatestGenerationRun: vi.fn().mockResolvedValue(null)
      },
      agentManager: {},
      resolveStoragePath: vi.fn().mockResolvedValue(''),
      ensureSessionAssets: vi.fn(),
      buildSessionGenerationSnapshot: vi.fn((session) => ({ session, pages: [] })),
      getPageSourceUrl: vi.fn(),
      resolveSessionProjectDir: vi.fn()
    }
    registerSessionHandlers(context as never)

    const list = state.handlers.get('session:list')
    if (!list) throw new Error('session:list handler was not registered')
    await expect(list()).resolves.toEqual([
      expect.objectContaining({ id: 'session-null', totalTokens: null }),
      expect.objectContaining({ id: 'session-zero', totalTokens: 0 })
    ])
  })
})
