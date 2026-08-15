/**
 * 模板页语义角色：导入时为每个模板页推断布局角色（封面/目录/章节/内容/数据/结尾），
 * 生成会话时按角色而不是纯位置插值分配页面基底，并作为提示词注入 Agent。
 */

export type TemplatePageRole = 'cover' | 'toc' | 'section' | 'content' | 'data' | 'ending'

export const TEMPLATE_PAGE_ROLES: readonly TemplatePageRole[] = [
  'cover',
  'toc',
  'section',
  'content',
  'data',
  'ending'
]

export function isValidTemplatePageRole(value: unknown): value is TemplatePageRole {
  return typeof value === 'string' && (TEMPLATE_PAGE_ROLES as readonly string[]).includes(value)
}

export interface TemplateRolePageInput {
  pageNumber: number
  title: string
  contentOutline?: string | null
  role?: TemplatePageRole | null
}

const TOC_TEXT_RE = /^(目录|目次|议程|大纲|概览|内容提要|contents|agenda|overview)/i

const SECTION_TITLE_RE =
  /^(?:第\s*[0-9〇一二三四五六七八九十百]+\s*(?:章|节|讲|部分|篇)|part\s+\d+|chapter\s+\d+|[0-9]{1,2}\s*[/．.、]\s*\S)/i

const DATA_TEXT_RE = /(图表|表格|数据|指标|占比|增长|趋势|kpi|chart|table|data|metric)/i
const DATA_SYMBOL_RE = /\d+\s*[%％]/

const collectRoleText = (page: TemplateRolePageInput): string =>
  `${page.title || ''}\n${page.contentOutline || ''}`.trim()

/**
 * 依据位置 + 标题/大纲关键词为模板页推断角色。manifest 已带有合法 role 时直接沿用。
 */
export function classifyTemplatePageRole(
  page: TemplateRolePageInput,
  totalPages: number
): TemplatePageRole {
  if (isValidTemplatePageRole(page.role)) return page.role

  const pageNumber = Math.max(1, Math.floor(page.pageNumber) || 1)
  const total = Math.max(pageNumber, Math.floor(totalPages) || pageNumber)
  if (pageNumber === 1) return 'cover'
  if (total >= 3 && pageNumber === total) return 'ending'

  const text = collectRoleText(page)
  if (TOC_TEXT_RE.test(page.title || '') || TOC_TEXT_RE.test(text.slice(0, 40))) return 'toc'

  const outlineLength = (page.contentOutline || '').trim().length
  const titleLength = (page.title || '').trim().length
  const looksLikeSectionTitle = SECTION_TITLE_RE.test(page.title || '')
  if (looksLikeSectionTitle && outlineLength <= 24 && titleLength <= 20) return 'section'

  if (DATA_TEXT_RE.test(text) || DATA_SYMBOL_RE.test(text)) return 'data'

  return 'content'
}

export function classifyTemplatePages<T extends TemplateRolePageInput>(
  pages: T[]
): Array<T & { role: TemplatePageRole }> {
  const totalPages = pages.length
  return pages.map((page) => ({ ...page, role: classifyTemplatePageRole(page, totalPages) }))
}

/**
 * 按角色为输出页分配模板基底：
 * - 第 1 输出页优先用封面页，最后一页优先用结尾页；
 * - 第 2 输出页优先用目录页（若模板有）；
 * - 其余输出页在内容型页面池（content/section/data/toc）内按比例取样，
 *   保证多样性的同时保持与模板顺序的对应感。
 */
export function assignTemplateBasePages<T extends TemplateRolePageInput>(
  pages: T[],
  outputCount: number
): Array<T & { role: TemplatePageRole }> {
  const classified = classifyTemplatePages<T>(pages.slice().sort((a, b) => a.pageNumber - b.pageNumber))
  const count = Math.max(1, Math.floor(outputCount) || 1)
  if (classified.length === 0) throw new Error('模板没有可用页面')
  if (classified.length === 1 || count === 1) {
    return Array.from({ length: count }, () => classified[0])
  }

  const coverPage = classified.find((page) => page.role === 'cover') ?? classified[0]
  const endingPage =
    classified.find((page) => page.role === 'ending') ?? classified[classified.length - 1]
  const tocPage = classified.find((page) => page.role === 'toc')
  const contentPool = classified.filter(
    (page) => page !== coverPage && page !== endingPage && page.role !== 'cover' && page.role !== 'ending'
  )
  const pool = contentPool.length > 0 ? contentPool : classified.slice(1, -1)
  const fallbackPool = pool.length > 0 ? pool : classified

  const assignments: Array<T & { role: TemplatePageRole }> = []
  for (let outputIndex = 0; outputIndex < count; outputIndex += 1) {
    if (outputIndex === 0) {
      assignments.push(coverPage)
      continue
    }
    if (count >= 2 && outputIndex === count - 1) {
      assignments.push(endingPage)
      continue
    }
    if (outputIndex === 1 && tocPage && count >= 3) {
      assignments.push(tocPage)
      continue
    }
    const middleOutputCount = Math.max(1, count - 2 - (tocPage && count >= 3 ? 1 : 0))
    const middleOutputIndex = outputIndex - 1 - (tocPage && count >= 3 ? 1 : 0)
    const poolIndex =
      middleOutputCount === 1
        ? Math.floor((fallbackPool.length - 1) / 2)
        : Math.round((middleOutputIndex * (fallbackPool.length - 1)) / (middleOutputCount - 1))
    assignments.push(
      fallbackPool[Math.max(0, Math.min(fallbackPool.length - 1, poolIndex))]
    )
  }
  return assignments
}

export function describeTemplatePageRole(role: TemplatePageRole): { zh: string; en: string } {
  switch (role) {
    case 'cover':
      return { zh: '封面页基底', en: 'cover-page base' }
    case 'toc':
      return { zh: '目录页基底', en: 'table-of-contents base' }
    case 'section':
      return { zh: '章节隔断页基底', en: 'section-divider base' }
    case 'data':
      return { zh: '数据/图表页基底', en: 'data/chart base' }
    case 'ending':
      return { zh: '结尾页基底', en: 'ending-page base' }
    case 'content':
      return { zh: '内容页基底', en: 'content base' }
  }
}

/**
 * 把模板基底 HTML 中的旧页面 ID（data 属性、锚点、选择器引用）替换为新页面 ID，
 * 使用词边界匹配避免误伤子串。模板会话追加页复用基底时共享此逻辑。
 */
export function replaceTemplatePageId(
  html: string,
  oldPageId: string,
  nextPageId: string
): string {
  const oldId = oldPageId.trim()
  if (!oldId || oldId === nextPageId) return html
  const escapedOldId = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boundaryPattern = new RegExp(`(^|[^A-Za-z0-9_-])${escapedOldId}(?=$|[^A-Za-z0-9_-])`, 'g')
  return html.replace(boundaryPattern, `$1${nextPageId}`)
}
