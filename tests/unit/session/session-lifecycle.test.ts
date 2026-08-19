import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => Promise<unknown>>()
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
        handlers.set(channel, handler)
      })
    },
    resolveModelConfigForTask: vi.fn(),
    readAppLocale: vi.fn().mockResolvedValue('en'),
    ensureSessionRuntimeCompatible: vi.fn(),
    createSessionMasterIfMissing: vi.fn(),
    getStyleDetail: vi.fn(),
    hasStyleSkill: vi.fn(),
    normalizeSourcePlan: vi.fn(() => undefined),
    revokeLocalAssetRootsUnder: vi.fn()
  }
})

vi.mock('electron', () => ({ ipcMain: state.ipcMain }))
vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('../../../src/main/config/model-config-utils', () => ({
  resolveModelConfigForTask: state.resolveModelConfigForTask
}))
vi.mock('../../../src/main/config/locale-utils', () => ({
  readAppLocale: state.readAppLocale,
  uiText: (_locale: string, zh: string, _en: string) => zh
}))
vi.mock('../../../src/main/session/runtime-assets', () => ({
  ensureSessionRuntimeCompatible: state.ensureSessionRuntimeCompatible
}))
vi.mock('../../../src/main/session/master-service', () => ({
  createSessionMasterIfMissing: state.createSessionMasterIfMissing
}))
vi.mock('../../../src/main/styles/catalog', () => ({
  getStyleDetail: state.getStyleDetail,
  hasStyleSkill: state.hasStyleSkill
}))
vi.mock('../../../src/main/generation/source-plan', () => ({
  normalizeSourcePlan: state.normalizeSourcePlan
}))
vi.mock('../../../src/main/history/git-history-service', () => ({
  GitHistoryService: class {}
}))
vi.mock('../../../src/main/io/local-asset-roots', () => ({
  allowLocalAssetRoot: vi.fn(),
  revokeLocalAssetRootsUnder: state.revokeLocalAssetRootsUnder
}))
vi.mock('../../../src/main/session/page-outline-utils', () => ({
  resolveOutlinesForPages: vi.fn().mockResolvedValue(new Map())
}))
vi.mock('../../../src/main/session/session-thumbnail', () => ({
  warmSessionFirstPageThumbnails: vi.fn().mockResolvedValue(new Map())
}))

const temporaryDirectories: string[] = []

beforeEach(() => {
  vi.resetModules()
  state.handlers.clear()
  state.ipcMain.handle.mockClear()
  state.resolveModelConfigForTask.mockReset().mockResolvedValue({
    provider: 'openai',
    model: 'test-model',
    baseUrl: ''
  })
  state.readAppLocale.mockReset().mockResolvedValue('en')
  state.ensureSessionRuntimeCompatible.mockReset()
  state.createSessionMasterIfMissing.mockReset()
  state.getStyleDetail.mockReset().mockReturnValue({
    styleKey: 'test-style',
    label: 'Test style'
  })
  state.hasStyleSkill.mockReset().mockReturnValue(true)
  state.normalizeSourcePlan.mockReset().mockReturnValue(undefined)
  state.revokeLocalAssetRootsUnder.mockReset()
})

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  )
})

const createStorageDirectory = async (): Promise<string> => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'amy-ppt-session-lifecycle-'))
  temporaryDirectories.push(directory)
  return directory
}

const register = async (
  context: unknown,
  lifecycle: { suspendSessionWork?: (sessionId: string) => Promise<() => void> } = {}
) => {
  const { registerSessionHandlers } = await import('../../../src/main/session/handlers')
  registerSessionHandlers(context as never, lifecycle)
  const create = state.handlers.get('session:create')
  const remove = state.handlers.get('session:delete')
  if (!create || !remove) throw new Error('session lifecycle handlers were not registered')
  return { create, remove }
}

const createContext = (storagePath: string) => {
  const db = {
    createSession: vi.fn().mockResolvedValue('session-created'),
    getSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getProject: vi.fn().mockResolvedValue(null),
    updateSessionMetadata: vi.fn().mockResolvedValue(undefined),
    replaceSourcePageSkeletons: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue(undefined)
  }
  const ensureSessionAssets = vi.fn(async (projectDir: string) => {
    await fs.promises.mkdir(path.join(projectDir, 'assets'), { recursive: true })
    await fs.promises.mkdir(path.join(projectDir, 'docs'), { recursive: true })
  })
  return {
    db,
    agentManager: { ensureSession: vi.fn(), removeSession: vi.fn() },
    modelRuntime: { recorder: null },
    resolveStoragePath: vi.fn().mockResolvedValue(storagePath),
    ensureSessionAssets,
    buildSessionGenerationSnapshot: vi.fn(),
    getPageSourceUrl: vi.fn(),
    resolveSessionProjectDir: vi.fn()
  }
}

describe('session create/delete lifecycle', () => {
  it('creates an AI style snapshot without requiring a catalog style id', async () => {
    const storagePath = await createStorageDirectory()
    const context = createContext(storagePath)
    const { create } = await register(context)

    await expect(
      create(
        {},
        {
          topic: 'AI style deck',
          styleSelection: {
            mode: 'ai',
            description: 'quiet technical editorial',
            themeColors: ['#102030', '#F6F1E8']
          },
          slideSizeId: 'wide-16-9'
        }
      )
    ).resolves.toEqual({ sessionId: expect.any(String) })

    expect(state.hasStyleSkill).not.toHaveBeenCalled()
    expect(context.db.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        styleId: expect.stringMatching(/^ai-/),
        styleSnapshot: expect.objectContaining({
          source: 'custom',
          description: 'quiet technical editorial',
          styleSkill: expect.stringContaining('#102030, #F6F1E8')
        })
      })
    )
    expect(context.db.updateSessionMetadata).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        styleSelection: {
          mode: 'ai',
          description: 'quiet technical editorial',
          themeColors: ['#102030', '#F6F1E8']
        }
      })
    )
  })

  it('rejects an AI selection without a description', async () => {
    const storagePath = await createStorageDirectory()
    const context = createContext(storagePath)
    const { create } = await register(context)

    await expect(
      create(
        {},
        {
          topic: 'Invalid AI style',
          styleSelection: { mode: 'ai', description: '  ', themeColors: ['#102030'] },
          slideSizeId: 'wide-16-9'
        }
      )
    ).rejects.toThrow('AI 自定义风格描述不能为空')
    expect(context.db.createSession).not.toHaveBeenCalled()
  })

  it('cleans the new project directory and session row when create fails after DB insert', async () => {
    const storagePath = await createStorageDirectory()
    const context = createContext(storagePath)
    context.db.createProject.mockRejectedValue(new Error('project insert failed'))
    const { create } = await register(context)
    const createResult = create(
      {},
      { topic: 'Test deck', styleId: 'style-1', slideSizeId: 'wide-16-9' }
    )

    await expect(createResult).rejects.toThrow('project insert failed')
    expect(context.db.deleteSession).toHaveBeenCalledTimes(1)
    expect(context.agentManager.removeSession).toHaveBeenCalledTimes(1)
    expect(state.revokeLocalAssetRootsUnder).toHaveBeenCalledTimes(1)
    expect(await fs.promises.readdir(storagePath)).toEqual([])
  })

  it('preserves the project directory when database compensation fails', async () => {
    const storagePath = await createStorageDirectory()
    const context = createContext(storagePath)
    context.db.createProject.mockRejectedValue(new Error('project insert failed'))
    context.db.deleteSession.mockRejectedValue(new Error('database cleanup failed'))
    const { create } = await register(context)

    await expect(
      create({}, { topic: 'Test deck', styleId: 'style-1', slideSizeId: 'wide-16-9' })
    ).rejects.toThrow('数据库补偿失败')
    expect(await fs.promises.readdir(storagePath)).toHaveLength(1)
    expect(context.agentManager.removeSession).toHaveBeenCalledTimes(1)
  })

  it('cleans a partially scaffolded directory when runtime asset setup fails', async () => {
    const storagePath = await createStorageDirectory()
    const context = createContext(storagePath)
    context.ensureSessionAssets.mockImplementationOnce(async (projectDir: string) => {
      await fs.promises.mkdir(path.join(projectDir, 'assets'), { recursive: true })
      throw new Error('runtime asset copy failed')
    })
    const { create } = await register(context)

    await expect(
      create({}, { topic: 'Test deck', styleId: 'style-1', slideSizeId: 'wide-16-9' })
    ).rejects.toThrow('runtime asset copy failed')
    expect(context.db.deleteSession).not.toHaveBeenCalled()
    expect(await fs.promises.readdir(storagePath)).toEqual([])
  })

  it('stages the project before deleting the DB row and removes both on success', async () => {
    const storagePath = await createStorageDirectory()
    const projectDir = path.join(storagePath, 'session-1')
    await fs.promises.mkdir(projectDir, { recursive: true })
    await fs.promises.writeFile(path.join(projectDir, 'index.html'), 'deck', 'utf-8')
    const context = createContext(storagePath)
    context.db.getProject.mockResolvedValue({ root_path: projectDir })
    const { remove } = await register(context)

    await expect(remove({}, 'session-1')).resolves.toEqual({ success: true })
    expect(context.db.deleteSession).toHaveBeenCalledWith('session-1')
    await expect(fs.promises.lstat(projectDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('drains active work before staging the project and releases the suspension afterward', async () => {
    const storagePath = await createStorageDirectory()
    const projectDir = path.join(storagePath, 'session-1')
    await fs.promises.mkdir(projectDir, { recursive: true })
    const context = createContext(storagePath)
    context.db.getProject.mockResolvedValue({ root_path: projectDir })
    let releaseCalled = false
    const suspendSessionWork = vi.fn(async () => {
      expect(await fs.promises.lstat(projectDir)).toBeDefined()
      expect(context.db.deleteSession).not.toHaveBeenCalled()
      return () => {
        releaseCalled = true
      }
    })
    const { remove } = await register(context, { suspendSessionWork })

    await expect(remove({}, 'session-1')).resolves.toEqual({ success: true })
    expect(suspendSessionWork).toHaveBeenCalledWith('session-1')
    expect(context.agentManager.removeSession).toHaveBeenCalledWith('session-1')
    expect(releaseCalled).toBe(true)
  })

  it('does not touch the project or database when active work cannot be drained', async () => {
    const storagePath = await createStorageDirectory()
    const projectDir = path.join(storagePath, 'session-1')
    await fs.promises.mkdir(projectDir, { recursive: true })
    const context = createContext(storagePath)
    context.db.getProject.mockResolvedValue({ root_path: projectDir })
    const { remove } = await register(context, {
      suspendSessionWork: vi.fn().mockRejectedValue(new Error('drain timeout'))
    })

    await expect(remove({}, 'session-1')).rejects.toThrow('drain timeout')
    expect(context.db.getProject).not.toHaveBeenCalled()
    expect(context.db.deleteSession).not.toHaveBeenCalled()
    expect(await fs.promises.lstat(projectDir)).toBeDefined()
  })

  it('restores the project directory when DB deletion fails', async () => {
    const storagePath = await createStorageDirectory()
    const projectDir = path.join(storagePath, 'session-1')
    await fs.promises.mkdir(projectDir, { recursive: true })
    await fs.promises.writeFile(path.join(projectDir, 'index.html'), 'deck', 'utf-8')
    const context = createContext(storagePath)
    context.db.getProject.mockResolvedValue({ root_path: projectDir })
    context.db.deleteSession.mockRejectedValue(new Error('database delete failed'))
    const { remove } = await register(context)

    await expect(remove({}, 'session-1')).rejects.toThrow('database delete failed')
    expect(await fs.promises.readFile(path.join(projectDir, 'index.html'), 'utf-8')).toBe('deck')
    expect(
      (await fs.promises.readdir(storagePath)).some((entry) => entry.includes('.deleting-'))
    ).toBe(false)
  })

  it('keeps the staged directory pending when cleanup fails after DB deletion', async () => {
    const storagePath = await createStorageDirectory()
    const projectDir = path.join(storagePath, 'session-1')
    await fs.promises.mkdir(projectDir, { recursive: true })
    const originalRm = fs.promises.rm.bind(fs.promises)
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockImplementation((...args) => {
      if (String(args[0]).includes('.session-1.deleting-')) {
        return Promise.reject(new Error('project cleanup failed'))
      }
      return originalRm(...args)
    })
    const context = createContext(storagePath)
    context.db.getProject.mockResolvedValue({ root_path: projectDir })
    const { remove } = await register(context)

    try {
      const result = (await remove({}, 'session-1')) as {
        success: boolean
        cleanupPending?: boolean
      }
      expect(result).toMatchObject({ success: true, cleanupPending: true })
      expect(result).not.toHaveProperty('cleanupPath')
      expect(
        (await fs.promises.readdir(storagePath)).some((entry) => entry.includes('.deleting-'))
      ).toBe(true)
    } finally {
      rmSpy.mockRestore()
    }
    expect(context.db.deleteSession).toHaveBeenCalledWith('session-1')
    await expect(fs.promises.lstat(projectDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses to delete a project outside storage and leaves the DB row intact', async () => {
    const storagePath = await createStorageDirectory()
    const outsideRoot = await createStorageDirectory()
    const projectDir = path.join(outsideRoot, 'session-1')
    await fs.promises.mkdir(projectDir, { recursive: true })
    const context = createContext(storagePath)
    context.db.getProject.mockResolvedValue({ root_path: projectDir })
    const { remove } = await register(context)

    await expect(remove({}, 'session-1')).rejects.toThrow('不在配置存储目录内')
    expect(context.db.deleteSession).not.toHaveBeenCalled()
    expect(await fs.promises.lstat(projectDir)).toBeDefined()
  })

  it('only cleans staged deletion directories that carry a DB-commit marker', async () => {
    const storagePath = await createStorageDirectory()
    const committed = path.join(
      storagePath,
      '.session-1.deleting-11111111-1111-1111-1111-111111111111'
    )
    const uncommitted = path.join(
      storagePath,
      '.session-2.deleting-22222222-2222-2222-2222-222222222222'
    )
    await Promise.all([
      fs.promises.mkdir(committed, { recursive: true }),
      fs.promises.mkdir(uncommitted, { recursive: true })
    ])
    await fs.promises.writeFile(
      path.join(committed, '.amy-ppt-delete-committed'),
      'amy-ppt-session-delete-committed\n',
      'utf-8'
    )
    const { cleanupPendingSessionDeletionDirs } = await import('../../../src/main/session/handlers')

    await expect(cleanupPendingSessionDeletionDirs(storagePath)).resolves.toBe(1)
    await expect(fs.promises.lstat(committed)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.promises.lstat(uncommitted)).resolves.toBeDefined()
  })
})
