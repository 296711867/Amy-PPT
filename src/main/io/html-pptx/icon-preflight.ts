import fs from 'fs'
import * as cheerio from 'cheerio'
import { isKnownIconId } from '../../presentation/icons/icon-registry'

export interface PptxIconPreflightPage {
  pageId: string
  pageNumber: number
  htmlPath: string
}

interface UnresolvedIconReference {
  id: string
  tagName: string
  reason: 'empty-id' | 'wrong-tag' | 'unknown-id' | 'unexpanded-known-id'
}

const inspectUnresolvedIconReferences = (html: string): UnresolvedIconReference[] => {
  if (!html.includes('data-icon')) return []
  const $ = cheerio.load(html, { scriptingEnabled: false })
  return $('[data-icon]')
    .toArray()
    .map((element) => {
      const $element = $(element)
      const id = ($element.attr('data-icon') || '').trim()
      const tagName = String($element.prop('tagName') || 'unknown').toLowerCase()
      const reason = !id
        ? 'empty-id'
        : tagName !== 'svg'
          ? 'wrong-tag'
          : isKnownIconId(id)
            ? 'unexpanded-known-id'
            : 'unknown-id'
      return { id, tagName, reason }
    })
}

export const assertPptxPagesHaveResolvedIcons = async (
  pages: readonly PptxIconPreflightPage[]
): Promise<void> => {
  const results = await Promise.all(
    pages.map(async (page) => ({
      page,
      issues: inspectUnresolvedIconReferences(await fs.promises.readFile(page.htmlPath, 'utf-8'))
    }))
  )
  const failures = results.filter((result) => result.issues.length > 0)
  if (failures.length === 0) return

  const details = failures.slice(0, 8).map(({ page, issues }) => {
    const references = issues
      .slice(0, 6)
      .map((issue) => {
        const id = issue.id || '(empty)'
        return `<${issue.tagName}> data-icon="${id}" [${issue.reason}]`
      })
      .join(', ')
    return `P${page.pageNumber} (${page.pageId}): ${references}`
  })
  throw new Error(
    [
      'PPTX 导出已停止：页面仍含未展开的 data-icon，继续导出会造成图标缺失。',
      ...details,
      '请重新保存或重新生成这些页面；未知图标请使用 search_icons 查找有效 id。'
    ].join('\n')
  )
}
