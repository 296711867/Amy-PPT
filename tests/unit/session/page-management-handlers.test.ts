import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobCoordinator } from '../../../src/main/agent-runtime/job/coordinator'
import { sessionLockKey } from '../../../src/main/agent-runtime/lock/keys'

const state = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => Promise<unknown>>(),
  loadEditableSessionPages: vi.fn(),
  persistManagedPages: vi.fn(),
  createBlankSessionPage: vi.fn(),
  duplicateSessionPage: vi.fn(),
  renameSessionPageTitle: vi.fn(),
  migrateLegacyPageOutlinesToSourceSkeletons: vi.fn(),
  ensureHistoryBaselineSafe: vi.fn(),
  recordHistoryOperationStrict: vi.fn(),
  logWarn: vi.fn(),
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
      state.handlers.set(channel, handler)
    })
  }
}))

vi.mock('electron', () => ({ ipcMain: state.ipcMain }))
vi.mock('electron-log/main.js', () => ({ default: { warn: state.logWarn } }))
vi.mock('../../../src/main/session/page-management-service', () => ({
  loadEditableSessionPages: state.loadEditableSessionPages,
  persistManagedPages: state.persistManagedPages,
  createBlankSessionPage: state.createBlankSessionPage,
  duplicateSessionPage: state.duplicateSessionPage,
  renameSessionPageTitle: state.renameSessionPageTitle
}))
vi.mock('../../../src/main/session/page-outline-utils', () => ({
  migrateLegacyPageOutlinesToSourceSkeletons: state.migrateLegacyPageOutlinesToSourceSkeletons
}))
vi.mock('../../../src/main/history/git-history-service', () => ({
  ensureHistoryBaselineSafe: state.ensureHistoryBaselineSafe,
  recordHistoryOperationStrict: state.recordHistoryOperationStrict
}))

const pages = [
  {
    id: 'first',
    pageNumber: 1,
    pageId: 'page-first',
    title: 'First',
    contentOutline: null,
    htmlPath: 'page-first.html',
    status: 'completed',
    error: null
  },
  {
    id: 'second',
    pageNumber: 2,
    pageId: 'page-second',
    title: 'Second',
    contentOutline: null,
    htmlPath: 'page-second.html',
    status: 'completed',
    error: null
  }
]

const createContext = () => ({
  db: {
    getSession: vi.fn().mockResolvedValue({ title: 'Deck' }),
    getProject: vi.fn().mockResolvedValue(null),
    listSourcePageSkeletons: vi.fn().mockResolvedValue([]),
    upsertSourcePageSkeleton: vi.fn().mockResolvedValue(undefined),
    deleteSourcePageSkeleton: vi.fn().mockResolvedValue(undefined)
  }
})

const register = async (coordinator = new JobCoordinator()) => {
  const { registerPageManagementHandlers } =
    await import('../../../src/main/session/page-management-handlers')
  registerPageManagementHandlers(createContext() as never, coordinator)
  return coordinator
}

beforeEach(() => {
  vi.resetModules()
  state.handlers.clear()
  state.ipcMain.handle.mockClear()
  state.loadEditableSessionPages.mockReset().mockResolvedValue({
    session: { title: 'Deck' },
    projectDir: 'C:/sessions/session-1',
    indexPath: 'C:/sessions/session-1/index.html',
    deckTitle: 'Deck',
    pages
  })
  state.persistManagedPages.mockReset().mockImplementation(async (_ctx, args) => args.pages)
  state.createBlankSessionPage.mockReset().mockResolvedValue({ pages, selectedPageId: 'second' })
  state.duplicateSessionPage.mockReset().mockResolvedValue({ pages, selectedPageId: 'second' })
  state.renameSessionPageTitle.mockReset().mockResolvedValue({ pages, selectedPageId: 'first' })
  state.migrateLegacyPageOutlinesToSourceSkeletons.mockReset()
  state.ensureHistoryBaselineSafe.mockReset().mockResolvedValue(undefined)
  state.recordHistoryOperationStrict.mockReset().mockRejectedValue(new Error('history unavailable'))
  state.logWarn.mockReset()
})

describe('page management post-commit IPC handling', () => {
  it('keeps reorder successful when history recording fails after commit', async () => {
    await register()
    const handler = state.handlers.get('session:reorderPages')
    const result = await handler?.(
      {},
      {
        sessionId: 'session-1',
        orderedPageIds: ['second', 'first'],
        selectedPageId: 'second'
      }
    )

    expect(result).toMatchObject({ ok: true, selectedPageId: 'second' })
    expect(state.persistManagedPages).toHaveBeenCalledTimes(1)
    expect(state.logWarn).toHaveBeenCalledWith(
      '[session:page-management] history record failed after commit',
      expect.objectContaining({ sessionId: 'session-1', type: 'reorder' })
    )
  })

  it('keeps add-page operations successful when history recording fails after commit', async () => {
    await register()
    const handler = state.handlers.get('session:createBlankPage')
    const result = await handler?.({}, { sessionId: 'session-1', sourcePageId: 'first' })

    expect(result).toMatchObject({ ok: true, selectedPageId: 'second' })
    expect(state.createBlankSessionPage).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 'session-1',
      sourcePageId: 'first'
    })
    expect(state.logWarn).toHaveBeenCalledWith(
      '[session:page-management] history record failed after commit',
      expect.objectContaining({ sessionId: 'session-1', type: 'addPage' })
    )
  })

  it('keeps title edits successful when history recording fails after commit', async () => {
    await register()
    const handler = state.handlers.get('session:updatePageTitle')
    const result = await handler?.(
      {},
      {
        sessionId: 'session-1',
        pageId: 'first',
        title: 'Renamed'
      }
    )

    expect(result).toMatchObject({ ok: true, selectedPageId: 'first' })
    expect(state.renameSessionPageTitle).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 'session-1',
      pageId: 'first',
      title: 'Renamed'
    })
    expect(state.logWarn).toHaveBeenCalledWith(
      '[session:page-management] history record failed after commit',
      expect.objectContaining({ sessionId: 'session-1', type: 'edit' })
    )
  })

  it('keeps outline edits successful when the post-commit refresh fails', async () => {
    await register()
    state.loadEditableSessionPages
      .mockResolvedValueOnce({
        session: { title: 'Deck' },
        projectDir: 'C:/sessions/session-1',
        indexPath: 'C:/sessions/session-1/index.html',
        deckTitle: 'Deck',
        pages
      })
      .mockRejectedValueOnce(new Error('refresh unavailable'))
    const handler = state.handlers.get('session:updatePageOutline')
    const result = await handler?.(
      {},
      {
        sessionId: 'session-1',
        pageId: 'first',
        contentOutline: 'Updated outline'
      }
    )

    expect(result).toMatchObject({ ok: true, selectedPageId: 'first' })
    expect(
      (result as { generatedPages: Array<{ contentOutline: string }> }).generatedPages[0]
    ).toMatchObject({ contentOutline: 'Updated outline' })
    expect(state.logWarn).toHaveBeenCalledWith(
      '[session:page-management] outline refresh failed after commit',
      expect.objectContaining({ sessionId: 'session-1', pageId: 'first' })
    )
  })

  it('holds delete suspension while a page mutation lease is active', async () => {
    const coordinator = await register()
    let operationStarted!: () => void
    let releasePersistence!: () => void
    const operationStartedPromise = new Promise<void>((resolve) => {
      operationStarted = resolve
    })
    state.persistManagedPages.mockImplementation(async (_ctx, args) => {
      operationStarted()
      await new Promise<void>((resolve) => {
        releasePersistence = resolve
      })
      return args.pages
    })

    const reorder = state.handlers.get('session:reorderPages')
    if (!reorder) throw new Error('reorder handler was not registered')
    const pageMutation = reorder(
      {},
      {
        sessionId: 'session-1',
        orderedPageIds: ['second', 'first'],
        selectedPageId: 'second'
      }
    )
    await operationStartedPromise

    let deleteMutationStarted = false
    const deleteAttempt = async () => {
      const release = await coordinator.suspendOwners([{ kind: 'session', id: 'session-1' }], 10)
      try {
        deleteMutationStarted = true
      } finally {
        release()
      }
    }

    await expect(deleteAttempt()).rejects.toThrow('Timed out')
    expect(deleteMutationStarted).toBe(false)
    expect(coordinator.getByOwner({ kind: 'session', id: 'session-1' })).not.toBeNull()

    releasePersistence()
    await expect(pageMutation).resolves.toMatchObject({ ok: true })
    const nextReservation = await coordinator.reserve({
      jobId: 'page-management-after-delete-drain',
      domain: 'edit',
      owner: { kind: 'session', id: 'session-1' },
      claims: { write: [sessionLockKey('session-1')] },
      wait: 'fail'
    })
    expect(nextReservation.status).toBe('acquired')
    if (nextReservation.status === 'acquired') nextReservation.lease.release()
  })
})
