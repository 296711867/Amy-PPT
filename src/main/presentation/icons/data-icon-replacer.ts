import * as cheerio from 'cheerio'
import { getIconInner, getIconStrokeAttrs, getIconViewBox } from './icon-registry'

/**
 * 把 HTML 里的 `data-icon="id"` 引用替换成真实 lucide SVG inner markup。
 *
 * - 已知 id：保留原 class/style，注入 viewBox + strokeAttrs，塞 inner，移除 data-icon → 完整 svg
 * - 未知 id：保留原样（不替换），收集到 unknownIds（校验由 page-quality-validator 做）
 *
 * 替换器只做转换、不抛错；校验分层在 validator，符合现有 harness 设计。
 */
export function replaceDataIcons(html: string): { html: string; unknownIds: string[] } {
  // 快速跳过：绝大多数页不含图标引用，避免无谓的 cheerio 解析
  if (!html.includes('data-icon')) return { html, unknownIds: [] }

  const $ = cheerio.load(html, { scriptingEnabled: false })
  const unknownIds: string[] = []
  const viewBox = getIconViewBox()
  const strokeAttrs = getIconStrokeAttrs()

  $('[data-icon]').each((_index, el) => {
    const $el = $(el)
    const id = ($el.attr('data-icon') || '').trim()
    if (!id) {
      $el.removeAttr('data-icon')
      return
    }
    const inner = getIconInner(id)
    if (inner === null) {
      // 未知 id：保留原样，交给 validator 报 unknown-icon-id
      if (!unknownIds.includes(id)) unknownIds.push(id)
      return
    }
    // 已知 id：保留原 class/style，构造标准描边 svg
    const cls = $el.attr('class') || ''
    const style = $el.attr('style') || ''
    const classAttr = cls ? ` class="${cls}"` : ''
    const styleAttr = style ? ` style="${style}"` : ''
    $el.replaceWith(
      `<svg${classAttr}${styleAttr} viewBox="${viewBox}" ${strokeAttrs}>${inner}</svg>`
    )
  })

  return { html: $.html(), unknownIds }
}
