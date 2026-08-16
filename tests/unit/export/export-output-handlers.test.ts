import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => Promise<unknown>>()
  return {
    handlers,
    dialog: {
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn()
    },
    shell: {
      showItemInFolder: vi.fn(),
      openPath: vi.fn().mockResolvedValue('')
    },
    browserWindow: {
      fromWebContents: vi.fn(() => null),
      getFocusedWindow: vi.fn(() => null)
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
        handlers.set(channel, handler)
      })
    },
    writeHtmlToPptx: vi.fn(),
    exportHtmlPagesToVideo: vi.fn(),
    resolveBundledFfmpegPath: vi.fn(),
    renderPageToPdfBuffer: vi.fn(),
    captureHtmlPageToPptxImageSlide: vi.fn(),
    extractHtmlPageToPptxSlide: vi.fn(),
    assertPptxPagesHaveResolvedIcons: vi.fn(),
    collectEmbeddedFonts: vi.fn(),
    normalizeVideoExportFps: vi.fn((value: unknown) => Number(value) || 24),
    normalizeVideoExportSecondsPerPage: vi.fn((value: unknown) => Number(value) || 1)
  }
})

vi.mock('electron', () => ({
  BrowserWindow: state.browserWindow,
  dialog: state.dialog,
  ipcMain: state.ipcMain,
  shell: state.shell
}))
vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))
vi.mock('@arcsin1/html2pptx/node', () => ({ writeHtmlToPptx: state.writeHtmlToPptx }))
vi.mock('../../../src/main/io/html-pptx/renderer', () => ({
  captureHtmlPageToPptxImageSlide: state.captureHtmlPageToPptxImageSlide,
  extractHtmlPageToPptxSlide: state.extractHtmlPageToPptxSlide
}))
vi.mock('../../../src/main/io/html-pptx/icon-preflight', () => ({
  assertPptxPagesHaveResolvedIcons: state.assertPptxPagesHaveResolvedIcons
}))
vi.mock('../../../src/main/io/html-pptx/font-collect', () => ({
  collectEmbeddedFonts: state.collectEmbeddedFonts
}))
vi.mock('../../../src/main/io/html-video/exporter', () => ({
  exportHtmlPagesToVideo: state.exportHtmlPagesToVideo,
  normalizeVideoExportFps: state.normalizeVideoExportFps,
  normalizeVideoExportSecondsPerPage: state.normalizeVideoExportSecondsPerPage,
  resolveBundledFfmpegPath: state.resolveBundledFfmpegPath
}))

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

const page = {
  id: 'page-1',
  pageNumber: 1,
  pageId: 'page-1',
  title: 'Cover',
  htmlPath: '/session/page-1.html'
}

const createContext = (projectDir: string, renderPageToPdfBuffer = state.renderPageToPdfBuffer) => ({
  mainWindow: {},
  db: {
    getProject: vi.fn().mockResolvedValue({ id: 'project-1' }),
    updateProjectStatus: vi.fn().mockResolvedValue(undefined),
    listSessionPages: vi.fn().mockResolvedValue([
      { id: 'page-1', page_number: 1, title: 'Cover' }
    ])
  },
  ensureSessionAssets: vi.fn().mockResolvedValue(undefined),
  resolveSessionProjectDir: vi.fn().mockResolvedValue(projectDir),
  resolveSessionPageFiles: vi.fn().mockResolvedValue({
    session: {
      id: 'session-1',
      title: 'Demo',
      slideSizeId: 'wide-16-9',
      slideWidth: 1600,
      slideHeight: 900
    },
    pages: [page],
    projectDir
  }),
  renderPageToPdfBuffer,
  waitForPrintReadySignal: vi.fn(),
  EXPORT_PAGE_READY_TIMEOUT_MS: 4000,
  EXPORT_CAPTURE_SETTLE_MS: 120
})

const createEvent = () => ({ sender: { send: vi.fn() } })

let registerExportHandlers: typeof import('../../../src/main/io/export-handlers').registerExportHandlers

const temporaryDirectories: string[] = []

beforeEach(async () => {
  vi.resetModules()
  state.handlers.clear()
  state.ipcMain.handle.mockClear()
  state.dialog.showSaveDialog.mockReset()
  state.dialog.showOpenDialog.mockReset()
  state.shell.showItemInFolder.mockReset()
  state.shell.openPath.mockReset().mockResolvedValue('')
  state.browserWindow.fromWebContents.mockReset().mockReturnValue(null)
  state.browserWindow.getFocusedWindow.mockReset().mockReturnValue(null)
  state.writeHtmlToPptx.mockReset().mockImplementation(async (outputPath: string) => {
    await fs.promises.writeFile(outputPath, 'pptx-output', 'utf-8')
  })
  state.exportHtmlPagesToVideo.mockReset().mockImplementation(async (options: { outputPath: string }) => {
    await fs.promises.writeFile(options.outputPath, 'video-output', 'utf-8')
    return { pageCount: 1, frameCount: 24, durationMs: 1000, warnings: [] }
  })
  state.resolveBundledFfmpegPath.mockReset().mockResolvedValue('/resources/ffmpeg/ffmpeg')
  state.captureHtmlPageToPptxImageSlide.mockReset().mockResolvedValue({
    slide: { texts: [], shapes: [] }
  })
  state.extractHtmlPageToPptxSlide.mockReset().mockResolvedValue({
    slide: { texts: [], shapes: [] }
  })
  state.assertPptxPagesHaveResolvedIcons.mockReset().mockResolvedValue(undefined)
  state.collectEmbeddedFonts.mockReset().mockResolvedValue([])
  state.normalizeVideoExportFps.mockClear()
  state.normalizeVideoExportSecondsPerPage.mockClear()
  state.renderPageToPdfBuffer.mockReset().mockResolvedValue({ pngBuffer: onePixelPng })
  const exportHandlers = await import('../../../src/main/io/export-handlers')
  registerExportHandlers = exportHandlers.registerExportHandlers
})

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  )
})

const createProjectDirectory = async (): Promise<string> => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'amy-ppt-export-handler-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('export output transactions in IPC handlers', () => {
  it('reports bundled ffmpeg availability through the renderer-safe capability handler', async () => {
    const projectDir = await createProjectDirectory()
    registerExportHandlers(createContext(projectDir) as never)

    await expect(state.handlers.get('export:capabilities')?.(createEvent(), undefined)).resolves.toEqual({
      video: { available: true, reason: null }
    })

    state.resolveBundledFfmpegPath.mockResolvedValueOnce(null)
    await expect(state.handlers.get('export:capabilities')?.(createEvent(), undefined)).resolves.toEqual({
      video: { available: false, reason: 'ffmpeg-missing' }
    })
  })

  it('refreshes old runtime assets before resolving pages and commits PDF output', async () => {
    const projectDir = await createProjectDirectory()
    const outputPath = path.join(projectDir, 'demo.pdf')
    await fs.promises.writeFile(outputPath, 'old-pdf', 'utf-8')
    state.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outputPath })
    const context = createContext(projectDir)
    registerExportHandlers(context as never)

    const result = await state.handlers.get('export:pdf')?.(createEvent(), 'session-1')

    expect(result).toMatchObject({ success: true, path: outputPath })
    expect(await fs.promises.readFile(outputPath)).not.toEqual(Buffer.from('old-pdf'))
    expect(context.ensureSessionAssets).toHaveBeenCalledTimes(1)
    expect(context.ensureSessionAssets.mock.invocationCallOrder[0]).toBeLessThan(
      context.resolveSessionPageFiles.mock.invocationCallOrder[0]
    )
  })

  it('commits PPTX output only after the writer succeeds', async () => {
    const projectDir = await createProjectDirectory()
    const outputPath = path.join(projectDir, 'demo.pptx')
    await fs.promises.writeFile(outputPath, 'old-pptx', 'utf-8')
    state.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outputPath })
    registerExportHandlers(createContext(projectDir) as never)

    await expect(state.handlers.get('export:pptx')?.(createEvent(), 'session-1')).resolves.toMatchObject({
      success: true,
      path: outputPath
    })
    expect(await fs.promises.readFile(outputPath, 'utf-8')).toBe('pptx-output')
    expect(state.writeHtmlToPptx).toHaveBeenCalledWith(
      expect.stringContaining(`${path.sep}.demo.pptx.tmp-`),
      expect.anything()
    )
  })

  it('commits a PNG directory as a unit after all pages render', async () => {
    const projectDir = await createProjectDirectory()
    state.dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [projectDir]
    })
    registerExportHandlers(createContext(projectDir) as never)

    const result = (await state.handlers.get('export:png')?.(createEvent(), 'session-1')) as {
      path: string
    }
    expect(await fs.promises.readFile(path.join(result.path, '01-Cover.png'))).toEqual(onePixelPng)
  })

  it('cleans a failed video staging output and preserves the selected target', async () => {
    const projectDir = await createProjectDirectory()
    const outputPath = path.join(projectDir, 'demo.mp4')
    await fs.promises.writeFile(outputPath, 'old-video', 'utf-8')
    state.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outputPath })
    state.exportHtmlPagesToVideo.mockImplementation(async (options: { outputPath: string }) => {
      await fs.promises.writeFile(options.outputPath, 'partial-video', 'utf-8')
      throw new Error('ffmpeg failed')
    })
    registerExportHandlers(createContext(projectDir) as never)

    await expect(state.handlers.get('export:video')?.(createEvent(), 'session-1')).rejects.toThrow(
      'ffmpeg failed'
    )
    expect(await fs.promises.readFile(outputPath, 'utf-8')).toBe('old-video')
    const remainingEntries = await fs.promises.readdir(projectDir)
    expect(remainingEntries.some((entry) => entry.includes('.demo.mp4.tmp-'))).toBe(false)
  })

  it('rejects video export before opening the save dialog when ffmpeg is unavailable', async () => {
    const projectDir = await createProjectDirectory()
    state.resolveBundledFfmpegPath.mockResolvedValue(null)
    registerExportHandlers(createContext(projectDir) as never)

    await expect(state.handlers.get('export:video')?.(createEvent(), 'session-1')).rejects.toThrow(
      '视频编码器缺失'
    )
    expect(state.dialog.showSaveDialog).not.toHaveBeenCalled()
    expect(state.exportHtmlPagesToVideo).not.toHaveBeenCalled()
  })

  it('allows a new session ZIP target outside the project directory', async () => {
    const projectDir = await createProjectDirectory()
    const outputDir = await createProjectDirectory()
    await fs.promises.writeFile(path.join(projectDir, 'index.html'), 'deck', 'utf-8')
    const outputPath = path.join(outputDir, 'session.zip')
    state.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outputPath })
    registerExportHandlers(createContext(projectDir) as never)

    const result = (await state.handlers.get('export:sessionZip')?.(createEvent(), 'session-1')) as {
      success: boolean
      path: string
    }

    expect(result).toMatchObject({ success: true, path: outputPath })
    await expect(fs.promises.lstat(outputPath)).resolves.toBeDefined()
  })

  it('rejects a nonexistent session ZIP target below a project symlink or junction', async ({
    skip
  }) => {
    const projectDir = await createProjectDirectory()
    const aliasRoot = await createProjectDirectory()
    const projectAlias = path.join(aliasRoot, 'project-alias')
    try {
      await fs.promises.symlink(
        projectDir,
        projectAlias,
        process.platform === 'win32' ? 'junction' : 'dir'
      )
    } catch (error) {
      const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
      if (code === 'EPERM' || code === 'EACCES' || code === 'ENOSYS' || code === 'EINVAL') {
        skip(`directory links are unavailable on this platform: ${String(code)}`)
        return
      }
      throw error
    }

    const outputPath = path.join(projectAlias, 'new-session.zip')
    state.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: outputPath })
    registerExportHandlers(createContext(projectDir) as never)

    await expect(
      state.handlers.get('export:sessionZip')?.(createEvent(), 'session-1')
    ).rejects.toThrow('不能导出到当前会话目录')
    await expect(fs.promises.lstat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
