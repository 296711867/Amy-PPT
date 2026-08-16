import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { IpcContext } from '../../../src/main/ipc/context'
import {
  persistManagedPages,
  renameSessionPageTitle,
  type ManagedPage
} from '../../../src/main/session/page-management-service'

const mocks = vi.hoisted(() => ({
  ensureSessionRuntimeCompatible: vi.fn(),
  buildProjectIndexHtml: vi.fn(() => '<html><body>new index</body></html>'),
  carryIndexTransitionConfig: vi.fn((_previous: string, next: string) => next),
  logWarn: vi.fn()
}))

vi.mock('electron-log/main.js', () => ({
  default: { warn: mocks.logWarn }
}))

vi.mock('../../../src/main/session/runtime-assets', () => ({
  ensureSessionRuntimeCompatible: mocks.ensureSessionRuntimeCompatible
}))

vi.mock('../../../src/main/session/template-builder', () => ({
  buildProjectIndexHtml: mocks.buildProjectIndexHtml
}))

vi.mock('../../../src/main/session/index-transition', () => ({
  carryIndexTransitionConfig: mocks.carryIndexTransitionConfig
}))

vi.mock('../../../src/main/session/page-outline-utils', () => ({
  resolveOutlinesForPages: vi.fn().mockResolvedValue(new Map())
}))

const createdDirectories: string[] = []

const createProjectDirectory = async (): Promise<string> => {
  const projectDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ohmyppt-page-management-'))
  createdDirectories.push(projectDir)
  return projectDir
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true })))
  vi.clearAllMocks()
})

describe('persistManagedPages', () => {
  it('restores page HTML when page-order persistence fails', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const secondPath = path.join(projectDir, 'page-second.html')
    const firstHtml = '<html><head></head><body><main class="ppt-page-root" data-ppt-guard-root="1"></main></body></html>'
    const secondHtml = '<html><head></head><body><main class="ppt-page-root" data-ppt-guard-root="1"></main></body></html>'
    await Promise.all([
      fs.promises.writeFile(firstPath, firstHtml, 'utf-8'),
      fs.promises.writeFile(secondPath, secondHtml, 'utf-8')
    ])
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        persistSessionPageState: vi.fn().mockRejectedValue(new Error('database unavailable'))
      }
    } as unknown as IpcContext
    const pages: ManagedPage[] = [
      { id: 'second', pageId: 'page-second', pageNumber: 2, title: 'Second', htmlPath: secondPath },
      { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath }
    ]

    await expect(
      persistManagedPages(context, {
        sessionId: 'session-1',
        projectDir,
        indexPath: path.join(projectDir, 'index.html'),
        deckTitle: 'Deck',
        pages,
        operation: 'reorder',
        prompt: 'reorder'
      })
    ).rejects.toThrow('database unavailable')

    await expect(fs.promises.readFile(firstPath, 'utf-8')).resolves.toBe(firstHtml)
    await expect(fs.promises.readFile(secondPath, 'utf-8')).resolves.toBe(secondHtml)
    await expect(fs.promises.access(path.join(projectDir, 'index.html.tmp'))).rejects.toThrow()
  })

  it('restores DB, HTML, and index when the final index rename fails', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const secondPath = path.join(projectDir, 'page-second.html')
    const indexPath = path.join(projectDir, 'index.html')
    const firstHtml = '<html><body><main data-page-number="1"></main></body></html>'
    const secondHtml = '<html><body><main data-page-number="2"></main></body></html>'
    const indexHtml = '<html><body>before</body></html>'
    await Promise.all([
      fs.promises.writeFile(firstPath, firstHtml, 'utf-8'),
      fs.promises.writeFile(secondPath, secondHtml, 'utf-8'),
      fs.promises.writeFile(indexPath, indexHtml, 'utf-8')
    ])
    const renameError = new Error('final index rename failed')
    const originalRename = fs.promises.rename.bind(fs.promises)
    let finalRenameFailed = false
    const renameSpy = vi.spyOn(fs.promises, 'rename').mockImplementation((...args) => {
      if (String(args[1]) === indexPath && !finalRenameFailed) {
        finalRenameFailed = true
        return Promise.reject(renameError)
      }
      return originalRename(...args)
    })
    const originalPages = [
      {
        id: 'first',
        file_slug: 'page-first',
        legacy_page_id: null,
        page_number: 1,
        title: 'First',
        html_path: 'page-first.html',
        status: 'completed' as const,
        error: null
      },
      {
        id: 'second',
        file_slug: 'page-second',
        legacy_page_id: null,
        page_number: 2,
        title: 'Second',
        html_path: 'page-second.html',
        status: 'completed' as const,
        error: null
      }
    ]
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{"before":true}'
        }),
        listSessionPages: vi.fn().mockResolvedValue(originalPages),
        persistSessionPageState: vi.fn().mockResolvedValue(undefined),
        upsertSessionPage: vi.fn().mockResolvedValue(undefined),
        hardDeleteSessionPages: vi.fn().mockResolvedValue(undefined),
        restoreSessionMetadata: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as IpcContext
    const pages: ManagedPage[] = [
      { id: 'second', pageId: 'page-second', pageNumber: 2, title: 'Second', htmlPath: secondPath },
      { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath }
    ]

    try {
      await expect(
        persistManagedPages(context, {
          sessionId: 'session-1',
          projectDir,
          indexPath,
          deckTitle: 'Deck',
          pages,
          operation: 'reorder',
          prompt: 'reorder'
        })
      ).rejects.toThrow('final index rename failed')
    } finally {
      renameSpy.mockRestore()
    }

    await expect(fs.promises.readFile(firstPath, 'utf-8')).resolves.toBe(firstHtml)
    await expect(fs.promises.readFile(secondPath, 'utf-8')).resolves.toBe(secondHtml)
    await expect(fs.promises.readFile(indexPath, 'utf-8')).resolves.toBe(indexHtml)
    expect(context.db.restoreSessionMetadata).toHaveBeenCalledWith('session-1', '{"before":true}')
    expect((await fs.promises.readdir(projectDir)).some((entry) => entry.includes('.tmp-'))).toBe(
      false
    )
  })

  it('removes deleted page files only after the DB and index commit', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const deletedPath = path.join(projectDir, 'page-deleted.html')
    const indexPath = path.join(projectDir, 'index.html')
    await Promise.all([
      fs.promises.writeFile(firstPath, '<html><body>first</body></html>', 'utf-8'),
      fs.promises.writeFile(deletedPath, '<html><body>deleted</body></html>', 'utf-8'),
      fs.promises.writeFile(indexPath, '<html><body>before</body></html>', 'utf-8')
    ])
    const originalPages = [
      {
        id: 'first',
        file_slug: 'page-first',
        legacy_page_id: null,
        page_number: 1,
        title: 'First',
        html_path: 'page-first.html',
        status: 'completed' as const,
        error: null
      },
      {
        id: 'deleted',
        file_slug: 'page-deleted',
        legacy_page_id: null,
        page_number: 2,
        title: 'Deleted',
        html_path: 'page-deleted.html',
        status: 'completed' as const,
        error: null
      }
    ]
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue(originalPages),
        persistSessionPageState: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as IpcContext

    await persistManagedPages(context, {
      sessionId: 'session-1',
      projectDir,
      indexPath,
      deckTitle: 'Deck',
      pages: [
        { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath }
      ],
      operation: 'delete',
      deletedPageIds: ['deleted'],
      prompt: 'delete'
    })

    await expect(fs.promises.access(deletedPath)).rejects.toThrow()
    expect(context.db.persistSessionPageState).toHaveBeenCalledWith(
      expect.objectContaining({ deletedPageIds: ['deleted'] })
    )
  })

  it('restores deleted files and DB state when page removal fails', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const deletedPath = path.join(projectDir, 'page-deleted.html')
    const indexPath = path.join(projectDir, 'index.html')
    const deletedHtml = '<html><body>deleted</body></html>'
    const indexHtml = '<html><body>before</body></html>'
    await Promise.all([
      fs.promises.writeFile(firstPath, '<html><body>first</body></html>', 'utf-8'),
      fs.promises.writeFile(deletedPath, deletedHtml, 'utf-8'),
      fs.promises.writeFile(indexPath, indexHtml, 'utf-8')
    ])
    const originalRm = fs.promises.rm.bind(fs.promises)
    let removalFailed = false
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockImplementation((...args) => {
      if (String(args[0]) === deletedPath && !removalFailed) {
        removalFailed = true
        return Promise.reject(new Error('page remove failed'))
      }
      return originalRm(...args)
    })
    const originalPages = [
      {
        id: 'first',
        file_slug: 'page-first',
        legacy_page_id: null,
        page_number: 1,
        title: 'First',
        html_path: 'page-first.html',
        status: 'completed' as const,
        error: null
      },
      {
        id: 'deleted',
        file_slug: 'page-deleted',
        legacy_page_id: null,
        page_number: 2,
        title: 'Deleted',
        html_path: 'page-deleted.html',
        status: 'completed' as const,
        error: null
      }
    ]
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{"before":true}'
        }),
        listSessionPages: vi.fn().mockResolvedValue(originalPages),
        persistSessionPageState: vi.fn().mockResolvedValue(undefined),
        upsertSessionPage: vi.fn().mockResolvedValue(undefined),
        restoreSessionMetadata: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as IpcContext

    try {
      await expect(
        persistManagedPages(context, {
          sessionId: 'session-1',
          projectDir,
          indexPath,
          deckTitle: 'Deck',
          pages: [
            { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath }
          ],
          operation: 'delete',
          deletedPageIds: ['deleted'],
          prompt: 'delete'
        })
      ).rejects.toThrow('page remove failed')
    } finally {
      rmSpy.mockRestore()
    }

    await expect(fs.promises.readFile(deletedPath, 'utf-8')).resolves.toBe(deletedHtml)
    await expect(fs.promises.readFile(indexPath, 'utf-8')).resolves.toBe(indexHtml)
    expect(context.db.restoreSessionMetadata).toHaveBeenCalledWith('session-1', '{"before":true}')
  })

  it('removes a newly added page file and DB row when persistence fails', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const newPath = path.join(projectDir, 'page-new.html')
    const indexPath = path.join(projectDir, 'index.html')
    await Promise.all([
      fs.promises.writeFile(firstPath, '<html><body>first</body></html>', 'utf-8'),
      fs.promises.writeFile(newPath, '<html><body>new</body></html>', 'utf-8'),
      fs.promises.writeFile(indexPath, '<html><body>before</body></html>', 'utf-8')
    ])
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue([
          {
            id: 'first',
            file_slug: 'page-first',
            legacy_page_id: null,
            page_number: 1,
            title: 'First',
            html_path: 'page-first.html',
            status: 'completed',
            error: null
          }
        ]),
        upsertSessionPage: vi.fn().mockResolvedValue(undefined),
        persistSessionPageState: vi.fn().mockRejectedValue(new Error('database unavailable')),
        hardDeleteSessionPages: vi.fn().mockResolvedValue(undefined),
        restoreSessionMetadata: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as IpcContext

    await expect(
      persistManagedPages(context, {
        sessionId: 'session-1',
        projectDir,
        indexPath,
        deckTitle: 'Deck',
        pages: [
          { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath },
          { id: 'new', pageId: 'page-new', pageNumber: 2, title: 'New', htmlPath: newPath }
        ],
        operation: 'addPage',
        newPages: [
          {
            id: 'new',
            sessionId: 'session-1',
            fileSlug: 'page-new',
            pageNumber: 2,
            title: 'New',
            htmlPath: newPath,
            status: 'completed',
            error: null
          }
        ],
        prompt: 'add'
      })
    ).rejects.toThrow('database unavailable')

    await expect(fs.promises.access(newPath)).rejects.toThrow()
    expect(context.db.hardDeleteSessionPages).toHaveBeenCalledWith('session-1', ['new'])
  })

  it('restores page files when writing the temporary index fails', async () => {
    const projectDir = await createProjectDirectory()
    const pagePath = path.join(projectDir, 'page-first.html')
    const indexPath = path.join(projectDir, 'index.html')
    const pageHtml = '<html><body>first</body></html>'
    await Promise.all([
      fs.promises.writeFile(pagePath, pageHtml, 'utf-8'),
      fs.promises.writeFile(indexPath, '<html><body>before</body></html>', 'utf-8')
    ])
    const originalWriteFile = fs.promises.writeFile.bind(fs.promises)
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation((...args) => {
      if (String(args[0]).includes('.tmp-')) {
        return Promise.reject(new Error('temporary index write failed'))
      }
      return originalWriteFile(...args)
    })
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue([
          {
            id: 'first',
            file_slug: 'page-first',
            legacy_page_id: null,
            page_number: 1,
            title: 'First',
            html_path: 'page-first.html',
            status: 'completed',
            error: null
          }
        ]),
        persistSessionPageState: vi.fn(),
        restoreSessionMetadata: vi.fn()
      }
    } as unknown as IpcContext

    try {
      await expect(
        persistManagedPages(context, {
          sessionId: 'session-1',
          projectDir,
          indexPath,
          deckTitle: 'Deck',
          pages: [
            { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: pagePath }
          ],
          operation: 'reorder',
          prompt: 'reorder'
        })
      ).rejects.toThrow('temporary index write failed')
    } finally {
      writeSpy.mockRestore()
    }

    await expect(fs.promises.readFile(pagePath, 'utf-8')).resolves.toBe(pageHtml)
    expect(context.db.persistSessionPageState).not.toHaveBeenCalled()
  })

  it('restores the original page title when rename persistence fails', async () => {
    const projectDir = await createProjectDirectory()
    const pagePath = path.join(projectDir, 'page-first.html')
    const indexPath = path.join(projectDir, 'index.html')
    const pageHtml =
      '<html><head><title>Original title</title></head><body><main data-page-number="1"></main></body></html>'
    const indexHtml = '<html><body>before</body></html>'
    await Promise.all([
      fs.promises.writeFile(pagePath, pageHtml, 'utf-8'),
      fs.promises.writeFile(indexPath, indexHtml, 'utf-8')
    ])
    const originalPage = {
      id: 'first',
      file_slug: 'page-first',
      legacy_page_id: null,
      page_number: 1,
      title: 'Original title',
      html_path: 'page-first.html',
      status: 'completed' as const,
      error: null
    }
    const upsertSessionPage = vi.fn().mockResolvedValue(undefined)
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          title: 'Deck',
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue([originalPage]),
        upsertSessionPage,
        persistSessionPageState: vi.fn().mockRejectedValue(new Error('database unavailable')),
        restoreSessionMetadata: vi.fn().mockResolvedValue(undefined),
        getProject: vi.fn().mockResolvedValue(null)
      },
      resolveSessionProjectDir: vi.fn().mockResolvedValue(projectDir)
    } as unknown as IpcContext

    await expect(
      renameSessionPageTitle(context, {
        sessionId: 'session-1',
        pageId: 'first',
        title: 'Renamed title'
      })
    ).rejects.toThrow('database unavailable')

    await expect(fs.promises.readFile(pagePath, 'utf-8')).resolves.toBe(pageHtml)
    await expect(fs.promises.readFile(indexPath, 'utf-8')).resolves.toBe(indexHtml)
    expect(upsertSessionPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: 'Renamed title' })
    )
    expect(upsertSessionPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'Original title' })
    )
  })

  it('continues restoring remaining files and the index when one page restore fails', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const secondPath = path.join(projectDir, 'page-second.html')
    const indexPath = path.join(projectDir, 'index.html')
    const firstHtml =
      '<html><body><main class="ppt-page-root" data-ppt-guard-root="1">first</main></body></html>'
    const secondHtml =
      '<html><body><main class="ppt-page-root" data-ppt-guard-root="1">second</main></body></html>'
    const indexHtml = '<html><body>before</body></html>'
    await Promise.all([
      fs.promises.writeFile(firstPath, firstHtml, 'utf-8'),
      fs.promises.writeFile(secondPath, secondHtml, 'utf-8'),
      fs.promises.writeFile(indexPath, indexHtml, 'utf-8')
    ])
    const originalPages = [
      {
        id: 'first',
        file_slug: 'page-first',
        legacy_page_id: null,
        page_number: 1,
        title: 'First',
        html_path: 'page-first.html',
        status: 'completed' as const,
        error: null
      },
      {
        id: 'second',
        file_slug: 'page-second',
        legacy_page_id: null,
        page_number: 2,
        title: 'Second',
        html_path: 'page-second.html',
        status: 'completed' as const,
        error: null
      }
    ]
    const originalWriteFile = fs.promises.writeFile.bind(fs.promises)
    let firstRestoreFailed = false
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation((...args) => {
      if (
        String(args[0]) === firstPath &&
        Buffer.isBuffer(args[1]) &&
        args[1].toString() === firstHtml &&
        !firstRestoreFailed
      ) {
        firstRestoreFailed = true
        return Promise.reject(new Error('first page restore failed'))
      }
      return originalWriteFile(...args)
    })
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue(originalPages),
        persistSessionPageState: vi.fn().mockRejectedValue(new Error('database unavailable')),
        restoreSessionMetadata: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as IpcContext

    try {
      await expect(
        persistManagedPages(context, {
          sessionId: 'session-1',
          projectDir,
          indexPath,
          deckTitle: 'Deck',
          pages: [
            { id: 'second', pageId: 'page-second', pageNumber: 2, title: 'Second', htmlPath: secondPath },
            { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath }
          ],
          operation: 'reorder',
          prompt: 'reorder'
        })
      ).rejects.toThrow('页面操作失败')
    } finally {
      writeSpy.mockRestore()
    }

    expect(firstRestoreFailed).toBe(true)
    await expect(fs.promises.readFile(secondPath, 'utf-8')).resolves.toBe(secondHtml)
    await expect(fs.promises.readFile(indexPath, 'utf-8')).resolves.toBe(indexHtml)
    expect(mocks.logWarn).toHaveBeenCalledWith(
      '[session:page-management] managed file restore failed',
      expect.objectContaining({ path: firstPath })
    )
  })

  it('keeps the index backup when index snapshot recovery also fails', async () => {
    const projectDir = await createProjectDirectory()
    const firstPath = path.join(projectDir, 'page-first.html')
    const deletedPath = path.join(projectDir, 'page-deleted.html')
    const indexPath = path.join(projectDir, 'index.html')
    const indexHtml = '<html><body>before</body></html>'
    await Promise.all([
      fs.promises.writeFile(
        firstPath,
        '<html><body><main class="ppt-page-root" data-ppt-guard-root="1">first</main></body></html>',
        'utf-8'
      ),
      fs.promises.writeFile(deletedPath, '<html><body>deleted</body></html>', 'utf-8'),
      fs.promises.writeFile(indexPath, indexHtml, 'utf-8')
    ])
    let deletionFailed = false
    const originalRm = fs.promises.rm.bind(fs.promises)
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockImplementation((...args) => {
      if (String(args[0]) === deletedPath && !deletionFailed) {
        deletionFailed = true
        return Promise.reject(new Error('page remove failed'))
      }
      return originalRm(...args)
    })
    let indexRestoreFailed = false
    const originalWriteFile = fs.promises.writeFile.bind(fs.promises)
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation((...args) => {
      if (
        String(args[0]) === indexPath &&
        Buffer.isBuffer(args[1]) &&
        args[1].toString() === indexHtml &&
        !indexRestoreFailed
      ) {
        indexRestoreFailed = true
        return Promise.reject(new Error('index snapshot restore failed'))
      }
      return originalWriteFile(...args)
    })
    const originalPages = [
      {
        id: 'first',
        file_slug: 'page-first',
        legacy_page_id: null,
        page_number: 1,
        title: 'First',
        html_path: 'page-first.html',
        status: 'completed' as const,
        error: null
      },
      {
        id: 'deleted',
        file_slug: 'page-deleted',
        legacy_page_id: null,
        page_number: 2,
        title: 'Deleted',
        html_path: 'page-deleted.html',
        status: 'completed' as const,
        error: null
      }
    ]
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue(originalPages),
        persistSessionPageState: vi.fn().mockResolvedValue(undefined),
        restoreSessionMetadata: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as IpcContext

    let caught: unknown
    try {
      await persistManagedPages(context, {
        sessionId: 'session-1',
        projectDir,
        indexPath,
        deckTitle: 'Deck',
        pages: [
          { id: 'first', pageId: 'page-first', pageNumber: 1, title: 'First', htmlPath: firstPath }
        ],
        operation: 'delete',
        deletedPageIds: ['deleted'],
        prompt: 'delete'
      })
    } catch (error) {
      caught = error
    } finally {
      rmSpy.mockRestore()
      writeSpy.mockRestore()
    }

    expect(caught).toBeInstanceOf(AggregateError)
    expect(deletionFailed).toBe(true)
    expect(indexRestoreFailed).toBe(true)
    const backupName = (await fs.promises.readdir(projectDir)).find((entry) =>
      entry.startsWith('index.html.bak-')
    )
    expect(backupName).toBeTruthy()
    await expect(fs.promises.readFile(path.join(projectDir, backupName!), 'utf-8')).resolves.toBe(
      indexHtml
    )
    const errors = caught instanceof AggregateError ? caught.errors : []
    expect(errors.some((error) => String(error).includes('index.html.bak-'))).toBe(true)
  })

  it('returns the committed page result when post-commit status updates fail', async () => {
    const projectDir = await createProjectDirectory()
    const pagePath = path.join(projectDir, 'page-first.html')
    const indexPath = path.join(projectDir, 'index.html')
    await Promise.all([
      fs.promises.writeFile(
        pagePath,
        '<html><head><title>Original</title></head><body><main class="ppt-page-root" data-ppt-guard-root="1"></main></body></html>',
        'utf-8'
      ),
      fs.promises.writeFile(indexPath, '<html><body>before</body></html>', 'utf-8')
    ])
    const context = {
      db: {
        getSession: vi.fn().mockResolvedValue({
          title: 'Deck',
          slideSizeId: 'wide-16-9',
          slideWidth: 1600,
          slideHeight: 900,
          metadata: '{}'
        }),
        listSessionPages: vi.fn().mockResolvedValue([
          {
            id: 'first',
            file_slug: 'page-first',
            legacy_page_id: null,
            page_number: 1,
            title: 'Original',
            html_path: 'page-first.html',
            status: 'completed',
            error: null
          }
        ]),
        upsertSessionPage: vi.fn().mockResolvedValue(undefined),
        persistSessionPageState: vi.fn().mockResolvedValue(undefined),
        getProject: vi.fn().mockResolvedValue({ id: 'project-1' }),
        updateProjectStatus: vi.fn().mockRejectedValue(new Error('project status unavailable')),
        updateSessionStatus: vi.fn().mockRejectedValue(new Error('session status unavailable'))
      },
      resolveSessionProjectDir: vi.fn().mockResolvedValue(projectDir)
    } as unknown as IpcContext

    const result = await renameSessionPageTitle(context, {
      sessionId: 'session-1',
      pageId: 'first',
      title: 'Renamed'
    })

    expect(result.selectedPageId).toBe('first')
    expect(result.pages[0].title).toBe('Renamed')
    expect(context.db.updateProjectStatus).toHaveBeenCalledWith('project-1', 'draft')
    expect(context.db.updateSessionStatus).not.toHaveBeenCalled()
    expect(mocks.logWarn).toHaveBeenCalledWith(
      '[session:page-management] project status update failed after commit',
      expect.objectContaining({ sessionId: 'session-1' })
    )
  })
})
