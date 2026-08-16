import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { executeEditGenerationMock, settleFailureMock, settleSuccessMock } = vi.hoisted(() => ({
  executeEditGenerationMock: vi.fn(),
  settleFailureMock: vi.fn().mockResolvedValue(undefined),
  settleSuccessMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
vi.mock('electron-log/main.js', () => ({ default: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('../../../src/main/generation/edit-flow', () => ({
  assessPageEdit: vi.fn(),
  executeEditGeneration: executeEditGenerationMock,
  resolveEditContext: vi.fn()
}))
vi.mock('../../../src/main/generation/generation-utils', () => ({
  createEmitAssistantMessage: vi.fn(() => vi.fn()),
  resolvePageHtmlPath: ({ projectDir, fileSlug, candidates }: any) => {
    const candidate = candidates?.find((item: string | undefined) => item)
    return candidate
      ? path.isAbsolute(candidate)
        ? candidate
        : path.join(projectDir, candidate)
      : path.join(projectDir, `${fileSlug}.html`)
  }
}))
vi.mock('../../../src/main/generation/context', () => ({
  createGenerationContext: vi.fn(() => ({})),
  normalizeGeneratePayload: vi.fn()
}))
vi.mock('../../../src/main/edit-jobs/edit-job-finalization', () => ({
  settleEditJobFailure: settleFailureMock,
  settleEditJobSuccess: settleSuccessMock
}))

import { PageEditJobService } from '../../../src/main/edit-jobs/page-edit-job-service'

describe('PageEditJobService file recovery', () => {
  const roots: string[] = []

  afterEach(async () => {
    vi.clearAllMocks()
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true })
    }
  })

  const createJob = (root: string) => ({
    sessionId: 'session-1',
    runId: 'run-1',
    lease: { jobId: 'run-1', signal: new AbortController().signal, release: vi.fn() },
    context: {
      sessionId: 'session-1',
      runId: 'run-1',
      projectDir: root,
      selectedPageId: 'page-1'
    }
  })

  const createContext = (root: string, overrides: Record<string, unknown> = {}) => {
    const baseDb = {
      listSessionPages: vi.fn().mockResolvedValue([
        { id: 'page-1', file_slug: 'page-1', page_number: 1, html_path: 'page-1.html' },
        { id: 'page-2', file_slug: 'page-2', page_number: 2, html_path: 'page-2.html' }
      ]),
      getGenerationRun: vi.fn().mockResolvedValue({
        metadata: JSON.stringify({ jobType: 'page-edit', targetPageId: 'page-1' })
      }),
      updateGenerationRunMetadata: vi.fn().mockResolvedValue(undefined),
      listActiveSessionJobs: vi.fn().mockResolvedValue([]),
      updateSessionJobStatus: vi.fn().mockResolvedValue(undefined),
      updateGenerationRunStatus: vi.fn().mockResolvedValue(undefined),
      updateSessionStatus: vi.fn().mockResolvedValue(undefined)
    }
    const { db: dbOverrides, ...otherOverrides } = overrides as {
      db?: Record<string, unknown>
      [key: string]: unknown
    }
    return {
      db: { ...baseDb, ...dbOverrides },
      resolveSessionProjectDir: vi.fn().mockResolvedValue(root),
      emitGenerateChunk: vi.fn(),
      agentManager: { removeSession: vi.fn() },
      ...otherOverrides
    }
  }

  const prepareFiles = async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ohmyppt-page-edit-job-'))
    roots.push(root)
    await writeFile(path.join(root, 'page-1.html'), 'page-1-original', 'utf-8')
    await writeFile(path.join(root, 'page-2.html'), 'page-2-original', 'utf-8')
    await writeFile(path.join(root, 'index.html'), 'index-original', 'utf-8')
    return root
  }

  it('restores the target page when model execution fails', async () => {
    const root = await prepareFiles()
    executeEditGenerationMock.mockImplementationOnce(async () => {
      await writeFile(path.join(root, 'page-1.html'), 'page-1-changed', 'utf-8')
      throw new Error('model write failed')
    })
    const ctx = createContext(root)
    const service = new PageEditJobService(ctx as never, {} as never)

    await (service as any).run(createJob(root))

    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toBe('page-1-original')
    await expect(readFile(path.join(root, 'page-2.html'), 'utf-8')).resolves.toBe('page-2-original')
    expect(settleFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), cancelled: false })
    )
  })

  it('restores the target page when success finalization fails', async () => {
    const root = await prepareFiles()
    executeEditGenerationMock.mockImplementationOnce(async () => {
      await writeFile(path.join(root, 'page-1.html'), 'page-1-changed', 'utf-8')
    })
    settleSuccessMock.mockRejectedValueOnce(new Error('finalization failed'))
    const ctx = createContext(root)
    const service = new PageEditJobService(ctx as never, {} as never)

    await (service as any).run(createJob(root))

    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toBe('page-1-original')
    await expect(readFile(path.join(root, 'page-2.html'), 'utf-8')).resolves.toBe('page-2-original')
    expect(settleFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), cancelled: false })
    )
  })

  it('restores a persisted interrupted target page without touching neighboring pages', async () => {
    const root = await prepareFiles()
    await writeFile(path.join(root, 'page-1.html'), 'page-1-changed', 'utf-8')
    const ctx = createContext(root, {
      db: {
        getGenerationRun: vi.fn().mockResolvedValue({
          metadata: JSON.stringify({
            pageEditRollback: {
              targetPageId: 'page-1',
              snapshots: [
                { relativePath: 'page-1.html', exists: true, content: 'page-1-original' }
              ]
            }
          })
        }),
        listActiveSessionJobs: vi.fn().mockResolvedValue([
          {
            id: 'run-1',
            session_id: 'session-1',
            target_page_id: 'page-1',
            target_page_number: 1,
            previous_session_status: 'completed',
            status: 'active'
          }
        ])
      }
    })
    const service = new PageEditJobService(ctx as never, {} as never)

    await service.abortInterruptedJobs('应用退出导致页面编辑中断，可重新发起')

    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toBe('page-1-original')
    await expect(readFile(path.join(root, 'page-2.html'), 'utf-8')).resolves.toBe('page-2-original')
    expect(ctx.db.updateSessionJobStatus).toHaveBeenCalledWith('run-1', 'aborted', {
      abortReason: '应用退出导致页面编辑中断，可重新发起'
    })
    expect(ctx.db.updateGenerationRunStatus).toHaveBeenCalledWith(
      'run-1',
      'failed',
      '应用退出导致页面编辑中断，可重新发起'
    )
  })
})
