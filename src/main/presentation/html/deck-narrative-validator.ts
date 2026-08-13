import fs from 'fs'
import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { LayoutIntent } from '@shared/layout-intent'

export type NarrativeSeverity = 'error' | 'warn'

export type NarrativePageSnapshot = {
  pageId: string
  pageNumber: number
  plannedTitle: string
  renderedTitle: string
  bodyText: string
  textBlocks: string[]
  layoutIntent?: LayoutIntent
  hasVisualEvidence: boolean
  hasQuantitativeEvidence: boolean
}

export type DeckNarrativeViolation = {
  code: string
  severity: NarrativeSeverity
  pageIds: string[]
  detail: string
  fix: string
}

export type DeckNarrativeReport = {
  pages: NarrativePageSnapshot[]
  violations: DeckNarrativeViolation[]
  unavailablePages: Array<{ pageId: string; reason: string }>
}

const AUXILIARY_SELECTOR = [
  'footer',
  'small',
  'figcaption',
  '[data-ppt-text-role="auxiliary"]',
  '[data-role="footer"]',
  '[data-role="footnote"]',
  '[data-role="source"]',
  '[data-role="annotation"]',
  '[data-role="page-number"]'
].join(',')

const INTERNAL_PROCESS_PATTERN =
  /思考中|正在(?:生成|更新方案|整理需求|连接模型)|本轮工作记录|已恢复历史上下文|用户意图|确认的决策|最新方向|页面计划|设计契约|布局意图|重试要求|模型回复|工具调用|占位(?:内容|文本)|待补充|稍后替换|lorem ipsum|thinking\.\.\.|user intent|confirmed decisions|latest direction|page plan|design contract|layout intent|retry requirement|tool call|model response|placeholder|deck-level quality review/i

const GENERIC_TITLE_PATTERN =
  /^(?:目录|概述|背景|现状|介绍|产品介绍|功能介绍|分析|总结|结论|核心功能|主要问题|解决方案|未来展望|agenda|overview|background|introduction|analysis|summary|conclusion|key features|challenges|solution|next steps)$/i

const GENERIC_ENDING_PATTERN =
  /^(?:谢谢|感谢聆听|感谢观看|thank you|thanks|q\s*&\s*a|questions?)?[！!。.\s]*$/i

// Chinese paragraphs carry substantially more information per character than English prose.
const MIN_COMPARABLE_BODY_LENGTH = 36

const normalizeComparableText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim()

const ngrams = (value: string, size = 2): Set<string> => {
  const normalized = normalizeComparableText(value)
  const result = new Set<string>()
  for (let index = 0; index <= normalized.length - size; index += 1) {
    result.add(normalized.slice(index, index + size))
  }
  return result
}

const jaccardSimilarity = (left: string, right: string): number => {
  const leftSet = ngrams(left)
  const rightSet = ngrams(right)
  if (leftSet.size === 0 || rightSet.size === 0) return 0
  let intersection = 0
  for (const item of leftSet) if (rightSet.has(item)) intersection += 1
  return intersection / (leftSet.size + rightSet.size - intersection)
}

const textOf = ($element: cheerio.Cheerio<AnyNode>): string =>
  $element.text().replace(/\s+/g, ' ').trim()

export function extractNarrativePageSnapshot(args: {
  html: string
  pageId: string
  pageNumber: number
  plannedTitle: string
  layoutIntent?: LayoutIntent
}): NarrativePageSnapshot {
  const $ = cheerio.load(args.html, { scriptingEnabled: false })
  $('script,style,noscript').remove()
  $(AUXILIARY_SELECTOR).remove()
  const content = $('main[data-role="content"],.ppt-page-content').first()
  const root = content.length > 0 ? content : $('body')
  const titleElement = root
    .find('[data-role="title"],[data-block-id="title"],h1,h2,h3,h4,h5,h6')
    .first()
  const renderedTitle = textOf(titleElement)
  titleElement.remove()
  const textBlocks = root
    .find('p,li,blockquote,td,th,[data-role="takeaway"],[data-role="summary"]')
    .toArray()
    .map((node) => textOf($(node)))
    .filter((text) => text.length > 0)
  const bodyText = textOf(root)
  const visualSelector =
    'img,picture,video,canvas,svg,figure,table,[data-chart],[data-ppt-chart],[data-role="image-placeholder"]'

  return {
    pageId: args.pageId,
    pageNumber: args.pageNumber,
    plannedTitle: args.plannedTitle,
    renderedTitle: renderedTitle || args.plannedTitle,
    bodyText,
    textBlocks,
    layoutIntent: args.layoutIntent,
    hasVisualEvidence: root.find(visualSelector).length > 0,
    hasQuantitativeEvidence:
      /(?:^|\D)\d+(?:\.\d+)?\s*(?:%|％|万|亿|k|m|b|倍|年|月|日)?(?:\D|$)/i.test(bodyText) ||
      root.find('table,[data-chart],[data-ppt-chart],canvas').length > 0
  }
}

export function evaluateDeckNarrative(pages: NarrativePageSnapshot[]): DeckNarrativeViolation[] {
  const ordered = [...pages].sort((left, right) => left.pageNumber - right.pageNumber)
  const violations: DeckNarrativeViolation[] = []
  if (ordered.length === 0) return violations

  const leakedPages = ordered.filter((page) =>
    INTERNAL_PROCESS_PATTERN.test(`${page.renderedTitle}\n${page.bodyText}`)
  )
  if (leakedPages.length > 0) {
    const pageIds = leakedPages.map((page) => page.pageId)
    violations.push({
      code: 'narrative-internal-process-leak',
      severity: 'error',
      pageIds,
      detail: `${pageIds.length} 页向观众暴露了生成过程、内部提示或占位语言：${pageIds.join(', ')}`,
      fix: '删除思考过程、计划、工具、模型、占位和重试说明，改成直接面向观众的标题、事实和结论'
    })
  }

  const titleGroups = new Map<string, NarrativePageSnapshot[]>()
  for (const page of ordered) {
    const key = normalizeComparableText(page.renderedTitle)
    if (!key) continue
    const group = titleGroups.get(key) || []
    group.push(page)
    titleGroups.set(key, group)
  }
  const duplicateTitles = Array.from(titleGroups.values()).filter((group) => group.length > 1)
  for (const group of duplicateTitles) {
    const pageIds = group.map((page) => page.pageId)
    violations.push({
      code: 'narrative-duplicate-title',
      severity: 'error',
      pageIds: pageIds.slice(1),
      detail: `页面 ${pageIds.join(', ')} 使用了相同标题“${group[0].renderedTitle}”，叙事任务无法区分`,
      fix: '保留每页不同的叙事职责，把标题改成该页独有且可口述的结论；不要只换同义词重复主题名'
    })
  }

  const duplicateBodyPageIds = new Set<string>()
  for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
    const left = ordered[leftIndex]
    if (normalizeComparableText(left.bodyText).length < MIN_COMPARABLE_BODY_LENGTH) continue
    for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
      const right = ordered[rightIndex]
      if (normalizeComparableText(right.bodyText).length < MIN_COMPARABLE_BODY_LENGTH) continue
      if (jaccardSimilarity(left.bodyText, right.bodyText) >= 0.82) {
        duplicateBodyPageIds.add(right.pageId)
      }
    }
  }
  if (duplicateBodyPageIds.size > 0) {
    const pageIds = Array.from(duplicateBodyPageIds)
    violations.push({
      code: 'narrative-duplicate-body',
      severity: 'error',
      pageIds,
      detail: `${pageIds.length} 页与前文正文高度重复，未推进叙事：${pageIds.join(', ')}`,
      fix: '删除重复事实和重复结论，让该页回答前一页自然引出的新问题；若没有新增价值，应合并或改变证据角度'
    })
  }

  const genericTitlePages = ordered.filter(
    (page) => page.layoutIntent !== 'cover' && GENERIC_TITLE_PATTERN.test(page.renderedTitle.trim())
  )
  if (genericTitlePages.length > 0) {
    const pageIds = genericTitlePages.map((page) => page.pageId)
    violations.push({
      code: 'narrative-topic-only-title',
      severity: 'warn',
      pageIds,
      detail: `${pageIds.length} 页标题只命名主题，没有传达观点或结论：${pageIds.join(', ')}`,
      fix: '把标题改成演讲者会直接说出口的一句判断，让观众只看标题也能理解该页推进了什么'
    })
  }

  const evidenceMismatchPages = ordered.filter(
    (page) =>
      page.layoutIntent === 'data-focus' && !page.hasQuantitativeEvidence && !page.hasVisualEvidence
  )
  if (evidenceMismatchPages.length > 0) {
    const pageIds = evidenceMismatchPages.map((page) => page.pageId)
    violations.push({
      code: 'narrative-evidence-missing',
      severity: 'warn',
      pageIds,
      detail: `计划为数据证据页，但页面没有可识别的数字、图表或表格：${pageIds.join(', ')}`,
      fix: '加入真实且可追溯的数据证据，并明确说明它为何支持当前结论；没有数据时改用更符合内容的页面职责'
    })
  }

  const lastPage = ordered[ordered.length - 1]
  const lastText = `${lastPage.renderedTitle} ${lastPage.bodyText}`.trim()
  const genericEnding =
    GENERIC_ENDING_PATTERN.test(lastPage.renderedTitle.trim()) ||
    (normalizeComparableText(lastPage.bodyText).length < 20 &&
      /谢谢|感谢|thank|questions?/i.test(lastText))
  if (ordered.length >= 3 && genericEnding) {
    violations.push({
      code: 'narrative-generic-ending',
      severity: 'warn',
      pageIds: [lastPage.pageId],
      detail: `结尾页“${lastPage.renderedTitle}”没有解决开场问题或给出结论、行动与启示`,
      fix: '用明确的最终判断、建议、下一步或可讨论的问题收束全套；致谢可以作为辅助文字，不能成为唯一内容'
    })
  }

  return violations
}

export async function inspectPresentationDeckNarrative(args: {
  pages: Array<{
    pageId: string
    pageNumber: number
    title: string
    htmlPath: string
    layoutIntent?: LayoutIntent
  }>
}): Promise<DeckNarrativeReport> {
  const pages: NarrativePageSnapshot[] = []
  const unavailablePages: Array<{ pageId: string; reason: string }> = []
  for (const page of [...args.pages].sort((left, right) => left.pageNumber - right.pageNumber)) {
    try {
      const html = await fs.promises.readFile(page.htmlPath, 'utf-8')
      pages.push(
        extractNarrativePageSnapshot({
          html,
          pageId: page.pageId,
          pageNumber: page.pageNumber,
          plannedTitle: page.title,
          layoutIntent: page.layoutIntent
        })
      )
    } catch (error) {
      unavailablePages.push({
        pageId: page.pageId,
        reason: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return { pages, violations: evaluateDeckNarrative(pages), unavailablePages }
}

export function findNewNarrativeHardViolations(args: {
  before: DeckNarrativeReport
  after: DeckNarrativeReport
  pageIds?: readonly string[]
}): DeckNarrativeViolation[] {
  const scope = args.pageIds?.length ? new Set(args.pageIds) : null
  const beforeKeys = new Set(
    args.before.violations
      .filter((violation) => violation.severity === 'error')
      .flatMap((violation) => violation.pageIds.map((pageId) => `${violation.code}:${pageId}`))
  )
  return args.after.violations
    .filter((violation) => violation.severity === 'error')
    .map((violation) => ({
      ...violation,
      pageIds: violation.pageIds.filter(
        (pageId) => (!scope || scope.has(pageId)) && !beforeKeys.has(`${violation.code}:${pageId}`)
      )
    }))
    .filter((violation) => violation.pageIds.length > 0)
}

export function formatDeckNarrativeFeedback(
  violations: DeckNarrativeViolation[],
  pageId?: string
): string {
  const scoped = pageId
    ? violations.filter((violation) => violation.pageIds.includes(pageId))
    : violations
  if (scoped.length === 0) return ''
  return [
    pageId ? `Narrative review findings assigned to ${pageId}:` : 'Narrative review findings:',
    ...scoped.map((violation) => `- [${violation.code}] ${violation.detail} -> ${violation.fix}`)
  ].join('\n')
}
