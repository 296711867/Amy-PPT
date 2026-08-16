import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
  return {
    handlers,
    allowLocalAssetRoot: vi.fn(),
    allowLocalAssetCompanionRoot: vi.fn(),
    dialog: { showOpenDialog: vi.fn() },
    git: {
      commitHtmlFile: vi.fn(),
      ensureHtmlRepo: vi.fn(),
      getHtmlRepoHead: vi.fn(),
      readHtmlAtCommit: vi.fn(),
      restoreHtmlFileAtCommit: vi.fn(),
      restoreHtmlRepoHead: vi.fn()
    },
    ipcMain: {
      handle: vi.fn(
        (channel: string, handler: (event: unknown, payload: unknown) => Promise<unknown>) => {
          handlers.set(channel, handler)
        }
      )
    },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    normalizeImportedHtml: vi.fn(({ html }: { html: string }) => ({
      html,
      designWidth: 1280,
      title: ''
    }))
  }
})

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: { fromWebContents: vi.fn(), getFocusedWindow: vi.fn() },
  dialog: state.dialog,
  ipcMain: state.ipcMain,
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}))
vi.mock('electron-log/main.js', () => ({ default: state.log }))
vi.mock('../../../src/main/html-editor/html-editor-import', () => ({
  normalizeImportedHtml: state.normalizeImportedHtml
}))
vi.mock('../../../src/main/html-editor/html-editor-git', () => ({
  commitHtmlFile: state.git.commitHtmlFile,
  ensureHtmlRepo: state.git.ensureHtmlRepo,
  getHtmlRepoHead: state.git.getHtmlRepoHead,
  readHtmlAtCommit: state.git.readHtmlAtCommit,
  restoreHtmlFileAtCommit: state.git.restoreHtmlFileAtCommit,
  restoreHtmlRepoHead: state.git.restoreHtmlRepoHead
}))
vi.mock('../../../src/main/html-editor/html-editor-thumbnail', () => ({
  refreshHtmlEditorCoverThumbnail: vi.fn(),
  warmHtmlEditorCoverThumbnails: vi.fn()
}))
vi.mock('../../../src/main/html-editor/html-editor-media', () => ({
  getHtmlEditorMediaExtensions: vi.fn(),
  importHtmlEditorMedia: vi.fn(),
  listHtmlEditorMedia: vi.fn()
}))
vi.mock('../../../src/main/io/local-asset-roots', () => ({
  allowLocalAssetRoot: state.allowLocalAssetRoot,
  allowLocalAssetCompanionRoot: state.allowLocalAssetCompanionRoot,
  revokeLocalAssetRootsUnder: vi.fn()
}))

describe('html-editor:openDocument', () => {
  let storagePath = ''

  beforeEach(async () => {
    vi.resetModules()
    state.handlers.clear()
    state.ipcMain.handle.mockClear()
    state.allowLocalAssetRoot.mockReset()
    state.allowLocalAssetCompanionRoot.mockReset()
    state.dialog.showOpenDialog.mockReset()
    Object.values(state.git).forEach((mock) => mock.mockReset())
    state.normalizeImportedHtml.mockClear()
    state.normalizeImportedHtml.mockImplementation(({ html }: { html: string }) => ({
      html,
      designWidth: 1280,
      title: ''
    }))
    storagePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'html-editor-open-'))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (storagePath) await fs.promises.rm(storagePath, { recursive: true, force: true })
  })

  it('reuses an unchanged disk version and revalidates after the file changes', async () => {
    const docId = 'doc-1'
    const workspaceDir = path.join(storagePath, 'html-editor', docId)
    const htmlPath = path.join(workspaceDir, 'current.html')
    await fs.promises.mkdir(workspaceDir, { recursive: true })
    await fs.promises.writeFile(htmlPath, '<html><body>first</body></html>', 'utf-8')

    const { registerHtmlEditorHandlers } =
      await import('../../../src/main/html-editor/html-editor-handlers')
    registerHtmlEditorHandlers({
      mainWindow: null,
      db: {
        getHtmlEditDocument: vi.fn().mockResolvedValue({
          id: docId,
          title: 'Document',
          sourcePath: null,
          htmlPath,
          designWidth: 1280
        })
      },
      resolveStoragePath: vi.fn().mockResolvedValue(storagePath)
    } as never)

    const handler = state.handlers.get('html-editor:openDocument')
    expect(handler).toBeDefined()
    const readFileSpy = vi.spyOn(fs.promises, 'readFile')

    await handler!({}, { docId })
    await handler!({}, { docId })

    expect(state.normalizeImportedHtml).toHaveBeenCalledTimes(1)
    expect(readFileSpy.mock.calls.filter(([filePath]) => filePath === htmlPath)).toHaveLength(1)

    await fs.promises.writeFile(htmlPath, '<html><body>second version</body></html>', 'utf-8')
    await handler!({}, { docId })

    expect(state.normalizeImportedHtml).toHaveBeenCalledTimes(2)
    expect(readFileSpy.mock.calls.filter(([filePath]) => filePath === htmlPath)).toHaveLength(2)
    expect(state.allowLocalAssetRoot).toHaveBeenCalledTimes(3)
    expect(state.allowLocalAssetRoot).toHaveBeenNthCalledWith(1, workspaceDir)
    expect(state.allowLocalAssetRoot).toHaveBeenNthCalledWith(2, workspaceDir)
    expect(state.allowLocalAssetRoot).toHaveBeenNthCalledWith(3, workspaceDir)
  })

  it('registers only the imported document workspace before returning its htmlPath', async () => {
    const sourcePath = path.join(storagePath, 'source.html')
    await fs.promises.writeFile(sourcePath, '<html><body>imported</body></html>', 'utf-8')
    state.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [sourcePath] })
    state.git.ensureHtmlRepo.mockImplementation(async (workspaceDir: string) => {
      await fs.promises.mkdir(workspaceDir, { recursive: true })
    })
    state.git.commitHtmlFile.mockResolvedValue('commit-1')
    const createDocument = vi.fn().mockResolvedValue(undefined)

    const { registerHtmlEditorHandlers } =
      await import('../../../src/main/html-editor/html-editor-handlers')
    registerHtmlEditorHandlers({
      mainWindow: null,
      db: { createHtmlEditDocumentWithVersion: createDocument },
      resolveStoragePath: vi.fn().mockResolvedValue(storagePath)
    } as never)

    const handler = state.handlers.get('html-editor:import')
    expect(handler).toBeDefined()
    const result = (await handler!({ sender: {} }, {})) as {
      cancelled: boolean
      htmlPath: string
    }
    const documentDir = path.dirname(result.htmlPath)

    expect(result.cancelled).toBe(false)
    expect(state.allowLocalAssetRoot).toHaveBeenCalledWith(documentDir)
    expect(state.allowLocalAssetRoot).not.toHaveBeenCalledWith(storagePath)
    expect(state.allowLocalAssetCompanionRoot).toHaveBeenCalledWith(documentDir, storagePath)
    expect(createDocument).toHaveBeenCalledOnce()
  })
})
