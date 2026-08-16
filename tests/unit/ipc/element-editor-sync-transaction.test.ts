import fs from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, recordOperationMock, handleMock } = vi.hoisted(() => {
  const registered = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
  const handle = vi.fn((channel: string, callback: (event: unknown, payload: unknown) => Promise<unknown>) => {
    registered.set(channel, callback)
  })
  return {
    handlers: registered,
    recordOperationMock: vi.fn().mockResolvedValue({ id: 'operation-1' }),
    handleMock: handle
  }
})

vi.mock('electron', () => ({ ipcMain: { handle: handleMock } }))
vi.mock('electron-log/main.js', () => ({ default: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('../../../src/main/history/git-history-service', () => ({
  GitHistoryService: class {
    recordOperation = recordOperationMock
  }
}))

import { registerEditorHandlers } from '../../../src/main/element-editor/handlers'

describe('element editor sync transaction', () => {
  const roots: string[] = []
  const sourceFragment =
    '<div data-ppt-sync-element-id="sync-1" data-block-id="source-block">New content</div>'

  beforeEach(() => {
    registerEditorHandlers(createContext(''))
    recordOperationMock.mockReset()
    recordOperationMock.mockResolvedValue({ id: 'operation-1' })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true })
    }
  })

  const createContext = (root: string) => ({
    normalizeSessionId: (value: unknown) => (typeof value === 'string' ? value.trim() : ''),
    assertPathInAllowedRoots: vi.fn(async ({ filePath }: { filePath: string }) => filePath),
    resolveSessionProjectDir: vi.fn(async () => root),
    db: {
      getSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
      listSessionPages: vi.fn().mockResolvedValue([
        { file_slug: 'page-1', html_path: 'page-1.html' },
        { file_slug: 'page-2', html_path: 'page-2.html' },
        { file_slug: 'page-3', html_path: 'page-3.html' }
      ])
    }
  })

  const prepareFiles = async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ohmyppt-sync-transaction-'))
    roots.push(root)
    const original = (page: number) =>
      `<html><body><div data-ppt-sync-element-id="sync-1">Page ${page}</div></body></html>`
    await Promise.all([
      writeFile(path.join(root, 'page-1.html'), original(1), 'utf-8'),
      writeFile(path.join(root, 'page-2.html'), original(2), 'utf-8'),
      writeFile(path.join(root, 'page-3.html'), original(3), 'utf-8')
    ])
    return root
  }

  const invoke = async (root: string) => {
    const callback = handlers.get('element-editor:apply-sync-to-all-pages')
    if (!callback) throw new Error('sync handler was not registered')
    return callback(null, {
      sessionId: 'session-1',
      pageId: 'page-1',
      htmlPath: path.join(root, 'page-1.html'),
      sourceHtmlFragment: sourceFragment,
      syncElementId: 'sync-1',
      sourceBlockId: 'source-block'
    })
  }

  it('preflights all pages, writes them, and records one history operation', async () => {
    const root = await prepareFiles()
    registerEditorHandlers(createContext(root))

    await expect(invoke(root)).resolves.toMatchObject({
      success: true,
      changedCount: 3,
      updatedCount: 3
    })
    expect(recordOperationMock).toHaveBeenCalledTimes(1)
    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toContain('New content')
    await expect(readFile(path.join(root, 'page-2.html'), 'utf-8')).resolves.toContain('New content')
    await expect(readFile(path.join(root, 'page-3.html'), 'utf-8')).resolves.toContain('New content')
  })

  it('restores earlier pages when a later page write fails', async () => {
    const root = await prepareFiles()
    registerEditorHandlers(createContext(root))
    const originalWriteFile = fs.promises.writeFile.bind(fs.promises)
    let writeCount = 0
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(((file: fs.PathLike, data: any, options?: any) => {
      writeCount += 1
      if (writeCount === 2) return Promise.reject(new Error('page-2 write failed'))
      return originalWriteFile(file, data, options)
    }) as typeof fs.promises.writeFile)

    await expect(invoke(root)).rejects.toThrow('page-2 write failed')
    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toContain('Page 1')
    await expect(readFile(path.join(root, 'page-2.html'), 'utf-8')).resolves.toContain('Page 2')
    await expect(readFile(path.join(root, 'page-3.html'), 'utf-8')).resolves.toContain('Page 3')
    expect(recordOperationMock).not.toHaveBeenCalled()
  })

  it('restores all pages when history recording fails', async () => {
    const root = await prepareFiles()
    registerEditorHandlers(createContext(root))
    recordOperationMock.mockRejectedValueOnce(new Error('history write failed'))

    await expect(invoke(root)).rejects.toThrow('history write failed')
    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toContain('Page 1')
    await expect(readFile(path.join(root, 'page-2.html'), 'utf-8')).resolves.toContain('Page 2')
    await expect(readFile(path.join(root, 'page-3.html'), 'utf-8')).resolves.toContain('Page 3')
    expect(recordOperationMock).toHaveBeenCalledTimes(1)
  })

  it('does not write any page when preflight read fails', async () => {
    const root = await prepareFiles()
    registerEditorHandlers(createContext(root))
    const originalReadFile = fs.promises.readFile.bind(fs.promises)
    const readSpy = vi.spyOn(fs.promises, 'readFile').mockImplementation(((file: fs.PathLike, options?: any) => {
      if (path.basename(String(file)) === 'page-2.html') {
        return Promise.reject(new Error('page-2 read failed'))
      }
      return originalReadFile(file, options)
    }) as typeof fs.promises.readFile)
    const writeSpy = vi.spyOn(fs.promises, 'writeFile')

    await expect(invoke(root)).rejects.toThrow('page-2 read failed')
    expect(writeSpy).not.toHaveBeenCalled()
    expect(readSpy).toHaveBeenCalled()
    await expect(readFile(path.join(root, 'page-1.html'), 'utf-8')).resolves.toContain('Page 1')
  })

  it('reports the original error and rollback paths when recovery also fails', async () => {
    const root = await prepareFiles()
    registerEditorHandlers(createContext(root))
    recordOperationMock.mockRejectedValueOnce(new Error('history write failed'))
    const originalWriteFile = fs.promises.writeFile.bind(fs.promises)
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(((file: fs.PathLike, data: any, options?: any) => {
      if (String(data).includes('Page 2')) return Promise.reject(new Error('page-2 restore failed'))
      return originalWriteFile(file, data, options)
    }) as typeof fs.promises.writeFile)

    const error = await invoke(root).catch((value) => value)

    expect(error).toBeInstanceOf(AggregateError)
    expect(error.errors[0]).toMatchObject({ message: 'history write failed' })
    expect(error.errors[1].message).toContain('page-2.html')
  })
})
