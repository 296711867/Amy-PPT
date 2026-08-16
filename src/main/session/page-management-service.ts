import type { IpcContext } from '../ipc/context'
import log from 'electron-log/main.js'
import * as fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'
import { customAlphabet, nanoid } from 'nanoid'
import { buildProjectIndexHtml } from './template-builder'
import { ensureSessionRuntimeCompatible } from './runtime-assets'
import { carryIndexTransitionConfig } from './index-transition'
import { validatePersistedPageHtml } from '../presentation/html/html-utils'
import {
  buildBlankPageHtmlFromSource,
  buildDuplicatePageHtmlFromSource
} from './page-html-builders'
import { setMasterPageNumber } from '../presentation/html/master-link'
import type { SessionPageStatus } from '../db/schema'
import { resolveOutlinesForPages } from './page-outline-utils'
import { requireSessionSlideSize } from '@shared/slide-size'

const pageSlugId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)

const resolvePageHtmlPath = (
  projectDir: string,
  fileSlug: string,
  candidatePath?: string | null
): string => {
  const projectRoot = path.resolve(projectDir)
  const fallbackPath = path.resolve(projectRoot, `${fileSlug}.html`)
  const rawCandidate = typeof candidatePath === 'string' ? candidatePath.trim() : ''
  if (!rawCandidate) return fallbackPath
  const resolvedCandidate = path.isAbsolute(rawCandidate)
    ? path.resolve(rawCandidate)
    : path.resolve(projectRoot, rawCandidate)
  const relative = path.relative(projectRoot, resolvedCandidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return fallbackPath
  return fs.existsSync(resolvedCandidate) ? resolvedCandidate : fallbackPath
}

type ManagedPageHtmlUpdate = {
  path: string
  source: string
  updated: string
}

type ManagedPagePersistenceInput = {
  id: string
  sessionId: string
  legacyPageId?: string | null
  fileSlug: string
  pageNumber: number
  title: string
  htmlPath: string
  status?: SessionPageStatus
  error?: string | null
}

type ManagedFileSnapshot = {
  path: string
  existed: boolean
  content?: Buffer
}

const isPathInside = (candidatePath: string, rootPath: string): boolean => {
  const relative = path.relative(rootPath, candidatePath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const assertManagedFilePath = async (projectDir: string, filePath: string): Promise<string> => {
  const projectRoot = await fs.promises.realpath(projectDir).catch(() => path.resolve(projectDir))
  const absolutePath = path.resolve(filePath)
  const realPath = await fs.promises.realpath(absolutePath).catch(() => absolutePath)
  if (!isPathInside(realPath, projectRoot)) {
    throw new Error(`页面文件路径不在会话目录内：${filePath}`)
  }
  return absolutePath
}

const captureManagedFileSnapshot = async (filePath: string): Promise<ManagedFileSnapshot> => {
  try {
    const stat = await fs.promises.lstat(filePath)
    if (!stat.isFile() && !stat.isSymbolicLink()) {
      throw new Error(`页面路径不是文件：${filePath}`)
    }
    return {
      path: filePath,
      existed: true,
      content: await fs.promises.readFile(filePath)
    }
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'ENOENT') {
      return { path: filePath, existed: false }
    }
    throw error
  }
}

const restoreManagedFileSnapshot = async (snapshot: ManagedFileSnapshot): Promise<void> => {
  await fs.promises.rm(snapshot.path, { recursive: true, force: true })
  if (!snapshot.existed) return
  await fs.promises.mkdir(path.dirname(snapshot.path), { recursive: true })
  await fs.promises.writeFile(snapshot.path, snapshot.content || Buffer.alloc(0))
}

const restoreManagedFileSnapshots = async (snapshots: ManagedFileSnapshot[]): Promise<void> => {
  const results = await Promise.allSettled(
    snapshots.map((snapshot) => restoreManagedFileSnapshot(snapshot))
  )
  const errors = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return []
    const reason = result.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    log.warn('[session:page-management] managed file restore failed', {
      path: snapshots[index].path,
      error: message
    })
    return [new Error(`文件恢复失败：${snapshots[index].path}：${message}`)]
  })
  if (errors.length > 0) {
    throw new AggregateError(errors, '页面文件恢复失败')
  }
}

const flattenAggregateErrors = (error: unknown): unknown[] => {
  if (error instanceof AggregateError) {
    return Array.from(error.errors).flatMap((item) => flattenAggregateErrors(item))
  }
  return [error]
}

const writeNewManagedPageFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
  } catch (error) {
    await fs.promises.rm(filePath, { force: true }).catch(() => undefined)
    throw error
  }
}

const toSessionPageInput = (
  sessionId: string,
  page: {
    id: string
    file_slug: string
    legacy_page_id?: string | null
    page_number: number
    title: string
    html_path?: string | null
    status?: SessionPageStatus
    error?: string | null
  }
) => ({
  id: page.id,
  sessionId,
  legacyPageId: page.legacy_page_id || null,
  fileSlug: page.file_slug,
  pageNumber: page.page_number,
  title: page.title,
  htmlPath: page.html_path || `${page.file_slug}.html`,
  status: page.status || 'pending',
  error: page.error || null
})

export interface ManagedPage {
  id: string
  pageNumber: number
  pageId: string
  legacyPageId?: string
  title: string
  contentOutline?: string | null
  htmlPath: string
  html?: string
  status?: SessionPageStatus
  error?: string | null
}

export async function loadEditableSessionPages(
  ctx: IpcContext,
  sessionId: string
): Promise<{
  session: Record<string, unknown>
  projectDir: string
  indexPath: string
  deckTitle: string
  pages: ManagedPage[]
}> {
  const session = await ctx.db.getSession(sessionId)
  if (!session) throw new Error('Session not found')

  const projectDir = await ctx.resolveSessionProjectDir(sessionId)
  const indexPath = path.join(projectDir, 'index.html')
  const deckTitle = (session as unknown as { title?: string }).title || 'Untitled'

  const sessionPages = await ctx.db.listSessionPages(sessionId)
  const outlineBySessionPageId = await resolveOutlinesForPages(ctx.db, sessionId, sessionPages)
  const pages: ManagedPage[] = sessionPages.map((sp) => ({
    id: sp.id,
    pageNumber: sp.page_number,
    pageId: sp.file_slug,
    legacyPageId: sp.legacy_page_id || undefined,
    title: sp.title,
    contentOutline: outlineBySessionPageId.get(sp.id) || null,
    htmlPath: resolvePageHtmlPath(projectDir, sp.file_slug, sp.html_path),
    status: sp.status,
    error: sp.error
  }))

  return { session: session as unknown as Record<string, unknown>, projectDir, indexPath, deckTitle, pages }
}

export async function persistManagedPages(
  ctx: IpcContext,
  args: {
    sessionId: string
    projectDir: string
    indexPath: string
    deckTitle: string
    pages: ManagedPage[]
    operation: 'reorder' | 'delete' | 'addPage' | 'rename'
    deletedPageIds?: string[]
    htmlUpdates?: ManagedPageHtmlUpdate[]
    newPages?: ManagedPagePersistenceInput[]
    pageUpdates?: ManagedPagePersistenceInput[]
    prompt: string
  }
): Promise<ManagedPage[]> {
  const { db } = ctx
  // Refresh assets only when runtime marker is missing/mismatched (mainly old sessions).
  await ensureSessionRuntimeCompatible(ctx, args.projectDir)
  // Keep caller order (drag result / filtered order), only rewrite contiguous page numbers.
  const renumbered = args.pages.map((p, i) => ({ ...p, pageNumber: i + 1 }))
  const currentSession = await db.getSession(args.sessionId)
  if (!currentSession) throw new Error('Session not found')

  const originalSessionPages =
    typeof db.listSessionPages === 'function'
      ? await db.listSessionPages(args.sessionId)
      : renumbered.map((page) => ({
          id: page.id,
          file_slug: page.pageId,
          legacy_page_id: page.legacyPageId || null,
          page_number: page.pageNumber,
          title: page.title,
          html_path: page.htmlPath,
          status: page.status || 'pending',
          error: page.error || null
        }))
  const originalPageIds = new Set(originalSessionPages.map((page) => page.id))
  const newPageIds = renumbered
    .filter((page) => !originalPageIds.has(page.id))
    .map((page) => page.id)
  const explicitHtmlUpdates = new Map((args.htmlUpdates || []).map((update) => [update.path, update]))
  const pageUpdates = await Promise.all(
    renumbered.map(async (page) => {
      const safePath = await assertManagedFilePath(args.projectDir, page.htmlPath)
      const explicitUpdate = explicitHtmlUpdates.get(safePath)
      const currentSource = await fs.promises.readFile(safePath, 'utf-8')
      if (explicitUpdate && currentSource !== explicitUpdate.source) {
        throw new Error(`页面文件在编辑期间发生变化：${safePath}`)
      }
      const source = explicitUpdate?.source || currentSource
      const baseUpdated = explicitUpdate?.updated || source
      return {
        path: safePath,
        source,
        updated: setMasterPageNumber(baseUpdated, page.pageNumber)
      }
    })
  )
  const changedPageUpdates = pageUpdates.filter((page) => page.updated !== page.source)

  const pagePaths = new Set<string>()
  for (const page of originalSessionPages) {
    pagePaths.add(
      await assertManagedFilePath(
        args.projectDir,
        resolvePageHtmlPath(args.projectDir, page.file_slug, page.html_path)
      )
    )
  }
  for (const page of renumbered) {
    pagePaths.add(await assertManagedFilePath(args.projectDir, page.htmlPath))
  }
  const newPagePaths = new Set(
    await Promise.all(
      (args.newPages || []).map((page) => assertManagedFilePath(args.projectDir, page.htmlPath))
    )
  )
  const pageSnapshots = await Promise.all(
    [...pagePaths].map((filePath) =>
      newPagePaths.has(filePath)
        ? Promise.resolve({ path: filePath, existed: false })
        : captureManagedFileSnapshot(filePath)
    )
  )
  const safeIndexPath = await assertManagedFilePath(args.projectDir, args.indexPath)
  const indexSnapshot = await captureManagedFileSnapshot(safeIndexPath)
  const tempIndexPath = `${safeIndexPath}.tmp-${nanoid(8)}`
  const backupIndexPath = `${safeIndexPath}.bak-${nanoid(8)}`
  const originalMetadata =
    typeof currentSession.metadata === 'string' ? currentSession.metadata : null

  const deckPages = renumbered.map((p) => ({
    id: p.id,
    pageNumber: p.pageNumber,
    pageId: p.pageId,
    title: p.title,
    htmlPath: path.basename(p.htmlPath)
  }))
  const rebuiltIndexHtml = buildProjectIndexHtml(
    args.deckTitle,
    deckPages,
    requireSessionSlideSize(currentSession)
  )
  const indexHtml = indexSnapshot.existed
    ? carryIndexTransitionConfig(
        await fs.promises.readFile(safeIndexPath, 'utf-8'),
        rebuiltIndexHtml
      )
    : rebuiltIndexHtml
  let currentMetadata: Record<string, unknown> = {}
  try {
    currentMetadata = JSON.parse((currentSession?.metadata as string | null) || '{}')
  } catch {
    currentMetadata = {}
  }
  const {
    generatedPages: _generatedPages,
    failedPages: _failedPages,
    ...safeMetadata
  } = currentMetadata as Record<string, unknown> & {
    generatedPages?: unknown
    failedPages?: unknown
  }

  const originalPagesForRestore = originalSessionPages.map((page) =>
    toSessionPageInput(args.sessionId, page)
  )
  const restoreDatabase = async (): Promise<void> => {
    const restoreErrors: unknown[] = []
    try {
      if (newPageIds.length > 0 && typeof db.hardDeleteSessionPages === 'function') {
        await db.hardDeleteSessionPages(args.sessionId, newPageIds)
      }
    } catch (error) {
      restoreErrors.push(error)
    }
    if (typeof db.upsertSessionPage === 'function') {
      const pageRestoreResults = await Promise.allSettled(
        originalPagesForRestore.map((page) =>
          Promise.resolve().then(() => db.upsertSessionPage(page))
        )
      )
      pageRestoreResults.forEach((result) => {
        if (result.status === 'rejected') restoreErrors.push(result.reason)
      })
    }
    try {
      if (typeof db.restoreSessionMetadata === 'function') {
        await db.restoreSessionMetadata(args.sessionId, originalMetadata)
      } else if (typeof db.updateSessionMetadata === 'function') {
        let metadataObject: Record<string, unknown> = {}
        if (originalMetadata) {
          try {
            const parsed = JSON.parse(originalMetadata)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              metadataObject = parsed as Record<string, unknown>
            }
          } catch {
            metadataObject = {}
          }
        }
        await db.updateSessionMetadata(args.sessionId, metadataObject)
      }
    } catch (error) {
      restoreErrors.push(error)
    }
    if (restoreErrors.length > 0) {
      throw new AggregateError(restoreErrors, '页面持久化失败，且数据库状态恢复失败')
    }
  }

  let indexSnapshotRestored = false
  const restoreFiles = async (): Promise<{ errors: unknown[]; indexRestored: boolean }> => {
    const restoreErrors: unknown[] = []
    try {
      await restoreManagedFileSnapshots(pageSnapshots)
    } catch (error) {
      restoreErrors.push(...flattenAggregateErrors(error))
    }
    try {
      await restoreManagedFileSnapshot(indexSnapshot)
      indexSnapshotRestored = true
    } catch (error) {
      restoreErrors.push(error)
      log.warn('[session:page-management] index snapshot restore failed', {
        path: indexSnapshot.path,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    return { errors: restoreErrors, indexRestored: indexSnapshotRestored }
  }

  const deletedPagePaths = (args.deletedPageIds || [])
    .map((pageId) => originalSessionPages.find((page) => page.id === pageId))
    .filter((page): page is (typeof originalSessionPages)[number] => Boolean(page))
    .map((page) =>
      resolvePageHtmlPath(args.projectDir, page.file_slug, page.html_path)
    )

  let backupIndexCreated = false
  const replaceIndexFile = async (): Promise<void> => {
    let backupCreated = false
    try {
      if (indexSnapshot.existed) {
        await fs.promises.rename(safeIndexPath, backupIndexPath)
        backupCreated = true
        backupIndexCreated = true
      }
      await fs.promises.rename(tempIndexPath, safeIndexPath)
    } catch (error) {
      if (backupCreated) {
        const restoreErrors: unknown[] = [error]
        try {
          await fs.promises.rm(safeIndexPath, { force: true })
        } catch (cleanupError) {
          restoreErrors.push(cleanupError)
        }
        try {
          await fs.promises.rename(backupIndexPath, safeIndexPath)
          backupIndexCreated = false
          indexSnapshotRestored = true
        } catch (restoreError) {
          restoreErrors.push(restoreError)
          log.warn('[session:page-management] index backup retained after replacement failure', {
            backupIndexPath,
            error: restoreError instanceof Error ? restoreError.message : String(restoreError)
          })
        }
        if (restoreErrors.length > 1) {
          throw new AggregateError(
            restoreErrors,
            `index 替换失败，且原 index 恢复失败；backup 保留：${backupIndexPath}`
          )
        }
      }
      throw error
    }
  }

  let committed = false
  try {
    await Promise.all(
      changedPageUpdates.map((page) => fs.promises.writeFile(page.path, page.updated, 'utf-8'))
    )
    await fs.promises.writeFile(tempIndexPath, indexHtml, 'utf-8')
    for (const page of args.newPages || []) {
      await db.upsertSessionPage(page)
    }
    for (const page of args.pageUpdates || []) {
      await db.upsertSessionPage(page)
    }
    await db.persistSessionPageState({
      sessionId: args.sessionId,
      pages: renumbered.map((page) => ({ id: page.id, pageNumber: page.pageNumber })),
      deletedPageIds: args.deletedPageIds,
      metadata: {
      ...safeMetadata,
      entryMode: 'multi_page',
        indexPath: args.indexPath
      }
    })
    await replaceIndexFile()
    await Promise.all(
      deletedPagePaths.map(async (filePath) => {
        const safePath = await assertManagedFilePath(args.projectDir, filePath)
        await fs.promises.rm(safePath, { force: true })
      })
    )
    committed = true
    return renumbered
  } catch (error) {
    const restoreErrors: unknown[] = []
    const fileRestoreResult = await restoreFiles()
    restoreErrors.push(...fileRestoreResult.errors)
    if (backupIndexCreated && !fileRestoreResult.indexRestored) {
      const backupDiagnostic = new Error(`index backup 保留待恢复：${backupIndexPath}`)
      restoreErrors.push(backupDiagnostic)
      log.warn('[session:page-management] index backup retained for recovery', {
        backupIndexPath,
        sessionId: args.sessionId
      })
    }
    try {
      await restoreDatabase()
    } catch (restoreError) {
      restoreErrors.push(restoreError)
    }
    if (restoreErrors.length > 0) {
      throw new AggregateError([error, ...restoreErrors], '页面操作失败，且无法完整恢复原状态')
    }
    throw error
  } finally {
    if (!committed) {
      await fs.promises.rm(tempIndexPath, { force: true }).catch((cleanupError) => {
        log.warn('[session:page-management] temporary index cleanup failed', {
          path: tempIndexPath,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        })
      })
    }
    if (committed || indexSnapshotRestored) {
      await fs.promises.rm(backupIndexPath, { force: true }).catch((cleanupError) => {
        log.warn('[session:page-management] index backup cleanup pending', {
          path: backupIndexPath,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        })
      })
    } else if (backupIndexCreated) {
      log.warn('[session:page-management] index backup kept after failed restore', {
        path: backupIndexPath,
        sessionId: args.sessionId
      })
    }
  }
}

const updatePostCommitStatuses = async (
  ctx: IpcContext,
  sessionId: string,
  updateSessionStatus: boolean
): Promise<void> => {
  try {
    const project = await ctx.db.getProject(sessionId)
    if (project?.id) await ctx.db.updateProjectStatus(project.id, 'draft')
  } catch (error) {
    log.warn('[session:page-management] project status update failed after commit', {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    })
  }

  if (!updateSessionStatus) return
  try {
    await ctx.db.updateSessionStatus(sessionId, 'completed')
  } catch (error) {
    log.warn('[session:page-management] session status update failed after commit', {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export async function createBlankSessionPage(
  ctx: IpcContext,
  args: {
    sessionId: string
    sourcePageId: string
  }
): Promise<{ pages: ManagedPage[]; selectedPageId: string }> {
  const { sessionId, sourcePageId } = args
  const { projectDir, indexPath, deckTitle, pages } = await loadEditableSessionPages(ctx, sessionId)
  if (pages.length === 0) throw new Error('当前会话没有可复制的页面')
  const sourceIndex = pages.findIndex(
    (page) => page.id === sourcePageId || page.pageId === sourcePageId
  )
  if (sourceIndex < 0) throw new Error('未找到要复制的页面')
  const sourcePage = pages[sourceIndex]
  if (!fs.existsSync(sourcePage.htmlPath)) throw new Error('源页面文件不存在')

  await ensureSessionRuntimeCompatible(ctx, projectDir)
  const insertAfterPageNumber = sourcePage.pageNumber
  const nextPageEntityId = nanoid()
  const nextPageId = `page-${pageSlugId()}`
  const nextHtmlPath = path.join(projectDir, `${nextPageId}.html`)
  const nextTitle = '新增空白页'
  const sourceHtml = await fs.promises.readFile(sourcePage.htmlPath, 'utf-8')
  const nextHtml = buildBlankPageHtmlFromSource({
    html: sourceHtml,
    oldPageId: sourcePage.pageId,
    nextPageId,
    pageNumber: insertAfterPageNumber + 1,
    title: nextTitle
  })
  const validation = validatePersistedPageHtml(nextHtml, nextPageId)
  if (!validation.valid) {
    throw new Error(`空白页创建失败: ${validation.errors.join('; ')}`)
  }
  await writeNewManagedPageFile(nextHtmlPath, nextHtml)

  const newPage: ManagedPage = {
    id: nextPageEntityId,
    pageNumber: insertAfterPageNumber + 1,
    pageId: nextPageId,
    title: nextTitle,
    contentOutline: null,
    htmlPath: nextHtmlPath,
    html: nextHtml,
    status: 'completed',
    error: null
  }
  const mergedPages = [
    ...pages.slice(0, sourceIndex + 1),
    newPage,
    ...pages.slice(sourceIndex + 1)
  ]

  let result: ManagedPage[]
  try {
    result = await persistManagedPages(ctx, {
      sessionId,
      projectDir,
      indexPath,
      deckTitle,
      pages: mergedPages,
      operation: 'addPage',
      newPages: [
        {
          id: newPage.id,
          sessionId,
          legacyPageId: null,
          fileSlug: newPage.pageId,
          pageNumber: newPage.pageNumber,
          title: newPage.title,
          htmlPath: newPage.htmlPath,
          status: 'completed',
          error: null
        }
      ],
      prompt: `新增空白页：复制 P${sourcePage.pageNumber}`
    })
  } catch (error) {
    await fs.promises.rm(nextHtmlPath, { force: true }).catch(() => undefined)
    await ctx.db.hardDeleteSessionPages(sessionId, [newPage.id]).catch(() => undefined)
    throw error
  }
  await updatePostCommitStatuses(ctx, sessionId, true)
  return { pages: result, selectedPageId: nextPageEntityId }
}

export async function duplicateSessionPage(
  ctx: IpcContext,
  args: {
    sessionId: string
    sourcePageId: string
  }
): Promise<{ pages: ManagedPage[]; selectedPageId: string }> {
  const { sessionId, sourcePageId } = args
  const { projectDir, indexPath, deckTitle, pages } = await loadEditableSessionPages(ctx, sessionId)
  if (pages.length === 0) throw new Error('当前会话没有可复制的页面')
  const sourceIndex = pages.findIndex(
    (page) => page.id === sourcePageId || page.pageId === sourcePageId
  )
  if (sourceIndex < 0) throw new Error('未找到要复制的页面')
  const sourcePage = pages[sourceIndex]
  if (!fs.existsSync(sourcePage.htmlPath)) throw new Error('源页面文件不存在')

  await ensureSessionRuntimeCompatible(ctx, projectDir)
  const nextPageEntityId = nanoid()
  const nextPageId = `page-${pageSlugId()}`
  const nextHtmlPath = path.join(projectDir, `${nextPageId}.html`)
  const nextTitle = `[副本]${sourcePage.title ?? ''}`
  const sourceHtml = await fs.promises.readFile(sourcePage.htmlPath, 'utf-8')
  const nextHtml = buildDuplicatePageHtmlFromSource({
    html: sourceHtml,
    oldPageId: sourcePage.pageId,
    nextPageId,
    pageNumber: sourcePage.pageNumber + 1,
    title: nextTitle
  })
  const validation = validatePersistedPageHtml(nextHtml, nextPageId)
  if (!validation.valid) {
    throw new Error(`复制页面失败: ${validation.errors.join('; ')}`)
  }
  await writeNewManagedPageFile(nextHtmlPath, nextHtml)

  const newPage: ManagedPage = {
    id: nextPageEntityId,
    // 占位页码，persistManagedPages 会按位置连续重排。
    pageNumber: sourcePage.pageNumber + 1,
    pageId: nextPageId,
    title: nextTitle,
    contentOutline: sourcePage.contentOutline || null,
    htmlPath: nextHtmlPath,
    html: nextHtml,
    status: sourcePage.status || 'completed',
    error: null
  }
  // 插到源页紧后方（区别于空白页追加到末尾）。
  const mergedPages = [...pages.slice(0, sourceIndex + 1), newPage, ...pages.slice(sourceIndex + 1)]

  let result: ManagedPage[]
  try {
    result = await persistManagedPages(ctx, {
      sessionId,
      projectDir,
      indexPath,
      deckTitle,
      pages: mergedPages,
      operation: 'addPage',
      newPages: [
        {
          id: newPage.id,
          sessionId,
          legacyPageId: null,
          fileSlug: newPage.pageId,
          pageNumber: newPage.pageNumber,
          title: newPage.title,
          htmlPath: newPage.htmlPath,
          status: newPage.status || 'completed',
          error: null
        }
      ],
      prompt: `复制页面：P${sourcePage.pageNumber}《${sourcePage.title}》`
    })
  } catch (error) {
    await fs.promises.rm(nextHtmlPath, { force: true }).catch(() => undefined)
    await ctx.db.hardDeleteSessionPages(sessionId, [newPage.id]).catch(() => undefined)
    throw error
  }
  await updatePostCommitStatuses(ctx, sessionId, true)
  return { pages: result, selectedPageId: nextPageEntityId }
}

export async function renameSessionPageTitle(
  ctx: IpcContext,
  args: {
    sessionId: string
    pageId: string
    title: string
  }
): Promise<{ pages: ManagedPage[]; selectedPageId: string }> {
  const title = args.title.replace(/\s+/g, ' ').trim()
  if (!title) throw new Error('页面标题不能为空')
  const { projectDir, indexPath, deckTitle, pages } = await loadEditableSessionPages(ctx, args.sessionId)
  const page = pages.find((item) => item.id === args.pageId || item.pageId === args.pageId)
  if (!page) throw new Error('未找到要修改标题的页面')

  const nextPages = pages.map((item) =>
    item.id === page.id
      ? {
          ...item,
          title
        }
      : item
  )

  const htmlUpdates: ManagedPageHtmlUpdate[] = []
  if (fs.existsSync(page.htmlPath)) {
    const html = await fs.promises.readFile(page.htmlPath, 'utf-8')
    const $ = cheerio.load(html, { scriptingEnabled: false })
    $('title').text(title)
    htmlUpdates.push({ path: page.htmlPath, source: html, updated: $.html() })
  }

  const result = await persistManagedPages(ctx, {
    sessionId: args.sessionId,
    projectDir,
    indexPath,
    deckTitle,
    pages: nextPages,
    operation: 'rename',
    htmlUpdates,
    pageUpdates: [
      {
        id: page.id,
        sessionId: args.sessionId,
        legacyPageId: page.legacyPageId || null,
        fileSlug: page.pageId,
        pageNumber: page.pageNumber,
        title,
        htmlPath: page.htmlPath,
        status: page.status || 'completed',
        error: page.error || null
      }
    ],
    prompt: `修改页面标题：P${page.pageNumber}《${page.title}》->《${title}》`
  })
  await updatePostCommitStatuses(ctx, args.sessionId, false)
  return { pages: result, selectedPageId: page.id }
}
