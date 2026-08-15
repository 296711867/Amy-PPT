/**
 * 模板链路共享的提示词补充：模板整册生成（template-deck-flow）与模板会话
 * 追加新页（add-page-flow）使用同一套"模板设计系统"约束，保证追加页不脱模。
 */

export const TEMPLATE_SYSTEM_PROMPT_ADDENDUM = [
  '## 模板设计系统模式',
  '- 当前页面文件来自用户模板复制并清洗后的页面基底；它定义本会话的当前设计系统。',
  '- 以模板页面和 styleId 共同作为设计依据，优先保持视觉连续性。',
  '- 本链路不抽象、不重算 designContract；直接从页面基底继承背景、配色、字体尺度、组件语言、留白节奏和首尾页角色。',
  '- 如果上下文里存在 designContract，它只代表模板继承的字体与历史元数据；页面基底才是视觉事实来源。',
  '- 不要无故换成一套全新的风格、背景、配色、字体尺度、组件语言或首尾页角色。',
  '- 背景图、纹理图、装饰图片、蒙版、叠加层、CSS background-image/url(...)、SVG image href 属于模板骨架，不属于旧业务内容；生成时必须保留或等价复现。',
  '- 写回页面时要使用模板里读到的本地资源路径，不要因为替换文字/数据而删除背景层、装饰层或承载它们的结构容器。',
  '- 可以为了适配新内容做必要的局部调整：信息密度、模块数量、图表类型、局部排列、文字层级和避免遮挡的尺寸变化。',
  '- 旧模板里的业务文字、数字、公司名、日期和结论不是事实来源，必须用用户 brief/source document 替换。',
  '- 新增/复用的中间页应沿着模板设计系统延展，而不是机械复制旧内容。'
].join('\n')

export const TEMPLATE_SINGLE_PAGE_PROMPT_ADDENDUM = [
  'Template design system for this slide:',
  '- The existing target page file is a copied template page base. Preserve its visual system and layout language.',
  '- Replace old text/data/media meaning with the new slide content, but do not redesign the whole page.',
  '- Treat background images, texture images, decorative images, masks, overlay layers, CSS background-image/url(...) references, and SVG image hrefs as template structure, not old business content.',
  '- Keep those template assets and their local paths in the written page unless the user explicitly asks to remove them; text/data changes must not strip the visual shell.',
  '- Keep color language, typography scale, spacing rhythm, component shapes, and chart/table styling unless a local adjustment is needed to avoid overlap.',
  '- Do not infer or invent a separate deck-wide design contract for this template run.',
  '- If a design contract is present, treat it as inherited font/runtime metadata only; the page base remains the visual source of truth.',
  '- Do not treat old template business text, numbers, company names, dates, or conclusions as facts.'
].join('\n')
