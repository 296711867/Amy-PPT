import fs from 'fs'
import type { PPTDatabase, SessionPageRecord } from '../db/database'
import { validatePersistedPageHtml } from '../presentation/html/html-utils'

const RECOVERABLE_FAILURE_RE =
  /ERR_BLOCKED_BY_CLIENT|浏览器渲染验收不可用|Browser render validation was unavailable|^(?:生成已取消|Generation cancell?ed)$/i

export const isRecoverableSessionPageStatus = (page: SessionPageRecord): boolean => {
  if (page.status === 'completed') return false
  if (page.status === 'pending' && !String(page.error || '').trim()) return true
  return RECOVERABLE_FAILURE_RE.test(String(page.error || '').trim())
}

export const hasCompleteSessionPageCoverage = (
  pages: SessionPageRecord[],
  expectedPageCount: number
): boolean => {
  const expected = Math.max(0, Math.floor(expectedPageCount || 0))
  if (expected === 0 || pages.length !== expected) return false
  if (pages.some((page) => page.status !== 'completed')) return false
  const pageNumbers = new Set(pages.map((page) => page.page_number))
  if (pageNumbers.size !== expected) return false
  return Array.from({ length: expected }, (_, index) => index + 1).every((pageNumber) =>
    pageNumbers.has(pageNumber)
  )
}

export async function recoverUsableSessionPages(args: {
  db: Pick<PPTDatabase, 'upsertSessionPage'>
  sessionId: string
  pages: SessionPageRecord[]
  resolveHtmlPath(page: SessionPageRecord): string
}): Promise<{ pages: SessionPageRecord[]; recoveredPageIds: string[] }> {
  const recoveredPageIds: string[] = []
  const pages: SessionPageRecord[] = []

  for (const page of args.pages) {
    if (!isRecoverableSessionPageStatus(page)) {
      pages.push(page)
      continue
    }

    const htmlPath = args.resolveHtmlPath(page)
    let html = ''
    try {
      html = await fs.promises.readFile(htmlPath, 'utf-8')
    } catch {
      pages.push(page)
      continue
    }

    if (!validatePersistedPageHtml(html, page.file_slug).valid) {
      pages.push(page)
      continue
    }

    await args.db.upsertSessionPage({
      id: page.id,
      sessionId: args.sessionId,
      legacyPageId: page.legacy_page_id,
      fileSlug: page.file_slug,
      pageNumber: page.page_number,
      title: page.title,
      htmlPath,
      status: 'completed',
      error: null
    })
    recoveredPageIds.push(page.file_slug)
    pages.push({
      ...page,
      html_path: htmlPath,
      status: 'completed',
      error: null
    })
  }

  return { pages, recoveredPageIds }
}
