import * as cheerio from 'cheerio'

const NON_TEMPLATE_SKELETON_RESOURCE_RE =
  /(?:^|\/)(?:(?:tailwindcss\.v3|anime\.v4|ppt-runtime|chart\.v4|katex(?:\.min)?|katex-auto-render\.min)\.(?:js|css)|assets\/fonts\/.+)(?:[?#].*)?$/i
const SKELETON_HINT_RE =
  /\b(?:bg-|background|decor|decoration|texture|mask|overlay|ornament|pattern|backdrop)\b/i

const normalizeTemplateResourceRef = (value: string): string | null => {
  const raw = value.trim().replace(/^['"]|['"]$/g, '').trim()
  if (!raw || raw.startsWith('#')) return null
  const withoutQuery = raw.split('#')[0].split('?')[0].trim()
  if (
    !withoutQuery ||
    /^data:/i.test(withoutQuery) ||
    /^blob:/i.test(withoutQuery) ||
    /^javascript:/i.test(withoutQuery)
  ) {
    return null
  }
  if (NON_TEMPLATE_SKELETON_RESOURCE_RE.test(withoutQuery)) return null
  return withoutQuery.replace(/^\.\//, '')
}

const collectTemplateSkeletonResourceRefs = (html: string): string[] => {
  const refs = new Set<string>()
  const push = (value: string | undefined | null): void => {
    if (!value) return
    const normalized = normalizeTemplateResourceRef(value)
    if (normalized) refs.add(normalized)
  }

  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
  let match: RegExpExecArray | null
  while ((match = urlRe.exec(html)) !== null) {
    push(match[2])
  }

  try {
    const $ = cheerio.load(html, { scriptingEnabled: false })
    $('image').each((_, node) => {
      const el = $(node)
      push(el.attr('href') || el.attr('xlink:href'))
    })
    $('img, video, source').each((_, node) => {
      const el = $(node)
      const identity = [
        el.attr('class') || '',
        el.attr('style') || '',
        el.parent().attr('class') || '',
        el.parent().attr('style') || ''
      ].join(' ')
      if (!SKELETON_HINT_RE.test(identity)) return
      push(el.attr('src') || el.attr('poster'))
    })
  } catch {
    // CSS url(...) extraction above still covers the most important template resources.
  }

  return Array.from(refs).sort()
}

export const validateTemplateSkeletonPreserved = (beforeHtml: string, afterHtml: string): string[] => {
  const beforeRefs = collectTemplateSkeletonResourceRefs(beforeHtml)
  if (beforeRefs.length === 0) return []
  const afterRefs = new Set(collectTemplateSkeletonResourceRefs(afterHtml))
  return beforeRefs.filter((ref) => !afterRefs.has(ref))
}

/**
 * 结构指纹：骨架资源引用之外的软结构校验。统计创意根节点下的直接分区数
 * 与骨架提示元素（背景/装饰类 img、SVG 等）数量；写盘后骤降过半视为
 * 模板结构被破坏。阈值刻意保守（基数 ≥ 3 才启用），避免内容重排误伤。
 */
const countStructuralZones = (html: string): number => {
  try {
    const $ = cheerio.load(html, { scriptingEnabled: false })
    const contentRoot = $('main[data-role="content"]').first()
    if (contentRoot.length === 0) return 0
    return contentRoot
      .children()
      .filter((_, node) => {
        const tagName = (node as { tagName?: string }).tagName || ''
        return /^(section|div|article|figure|header|footer|ul|ol|table)$/i.test(tagName)
      }).length
  } catch {
    return 0
  }
}

const countSkeletonHintElements = (html: string): number => {
  try {
    const $ = cheerio.load(html, { scriptingEnabled: false })
    let count = 0
    $('img, video, source, svg').each((_, node) => {
      const el = $(node)
      const identity = [
        el.attr('class') || '',
        el.attr('style') || '',
        el.parent().attr('class') || '',
        el.parent().attr('style') || ''
      ].join(' ')
      if (SKELETON_HINT_RE.test(identity)) count += 1
    })
    return count
  } catch {
    return 0
  }
}

const countFontSizeScale = (html: string): number => {
  const sizes = new Set<string>()
  const sizeRe = /font-size:\s*(\d+(?:\.\d+)?)px/gi
  let match: RegExpExecArray | null
  while ((match = sizeRe.exec(html)) !== null) {
    const size = Math.round(Number(match[1]))
    if (size >= 10) sizes.add(String(size))
  }
  return sizes.size
}

const countDistinctColors = (html: string): number => {
  const colors = new Set<string>()
  const colorRe = /#([0-9a-f]{6})\b/gi
  let match: RegExpExecArray | null
  while ((match = colorRe.exec(html)) !== null) {
    colors.add(match[1].toUpperCase())
  }
  return colors.size
}

export const validateTemplateStructurePreserved = (
  beforeHtml: string,
  afterHtml: string
): string[] => {
  const violations: string[] = []

  const beforeZones = countStructuralZones(beforeHtml)
  const afterZones = countStructuralZones(afterHtml)
  if (beforeZones >= 3 && afterZones < Math.ceil(beforeZones / 2)) {
    violations.push(
      `结构分区从 ${beforeZones} 个骤降到 ${afterZones} 个（模板布局骨架疑似被删除）`
    )
  }

  const beforeHints = countSkeletonHintElements(beforeHtml)
  const afterHints = countSkeletonHintElements(afterHtml)
  if (beforeHints >= 3 && afterHints < Math.ceil(beforeHints / 2)) {
    violations.push(
      `背景/装饰类元素从 ${beforeHints} 个骤降到 ${afterHints} 个（模板装饰层疑似被删除）`
    )
  }

  // 字号阶梯与配色盘：模板的排版尺度与色彩系统被整体抛弃时打回。
  // 基数阈值（≥4 档字号 / ≥5 色）保证内容重排不会误伤。
  const beforeSizes = countFontSizeScale(beforeHtml)
  const afterSizes = countFontSizeScale(afterHtml)
  if (beforeSizes >= 4 && afterSizes < Math.ceil(beforeSizes / 2)) {
    violations.push(
      `字号层级从 ${beforeSizes} 档降到 ${afterSizes} 档（模板排版尺度疑似被重设）`
    )
  }

  const beforeColors = countDistinctColors(beforeHtml)
  const afterColors = countDistinctColors(afterHtml)
  if (beforeColors >= 5 && afterColors < Math.ceil(beforeColors / 2)) {
    violations.push(
      `配色从 ${beforeColors} 种降到 ${afterColors} 种（模板色彩系统疑似被替换）`
    )
  }

  return violations
}
