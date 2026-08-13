import { describe, expect, it } from 'vitest'
import { SLIDE_SIZE_PRESETS } from '@shared/slide-size'
import { validatePageQuality } from '../../../src/main/presentation/html/page-quality-validator'

const wide = SLIDE_SIZE_PRESETS.find((p) => p.id === 'wide-16-9')! // 1600×900 → floor 96px = px-24

/** 包成落盘后的外壳结构：.ppt-page-root > section[data-page-scaffold] > main[data-role=content] > 用户根容器 */
function wrap(inner: string): string {
  return `<div class="ppt-page-root"><section data-page-scaffold="page-1"><main data-role="content">${inner}</main></section></div>`
}

const codes = (v: ReturnType<typeof validatePageQuality>) => v.map((x) => x.code)

describe('validatePageQuality', () => {
  describe('emoji-as-icon', () => {
    it('flags emoji inside a rounded-full icon backing', () => {
      const html = wrap(
        '<div class="flex gap-4"><div class="w-12 h-12 rounded-full bg-pink-200 flex items-center justify-center"><span class="text-2xl">👂</span></div><div>内容</div></div>'
      )
      expect(codes(validatePageQuality(html, wide))).toContain('emoji-as-icon')
    })

    it('flags emoji inside a large-text icon span (text-3xl)', () => {
      const html = wrap('<span class="text-3xl">🐰 小兔子</span>')
      expect(codes(validatePageQuality(html, wide))).toContain('emoji-as-icon')
    })

    it('does NOT flag emoji inside neutral body paragraph text', () => {
      const html = wrap('<p class="text-base">喜欢 🥕 胡萝卜是小兔子的天性</p>')
      expect(codes(validatePageQuality(html, wide))).not.toContain('emoji-as-icon')
    })

    it('does NOT flag an inline SVG inside an icon backing', () => {
      const html = wrap(
        '<div class="w-12 h-12 rounded-full bg-pink-200 flex items-center justify-center"><svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('emoji-as-icon')
    })

    it('flags emoji inside a rounded-2xl icon backing (square backing)', () => {
      const html = wrap(
        '<div class="flex gap-4"><div class="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center"><span class="text-2xl">🚀</span></div><div>内容</div></div>'
      )
      expect(codes(validatePageQuality(html, wide))).toContain('emoji-as-icon')
    })

    it('does NOT flag a large rounded card (not an icon backing)', () => {
      // 大卡片 w-40 h-40 rounded-2xl 不算图标底托（尺寸超 96px）
      const html = wrap(
        '<div class="w-40 h-40 rounded-2xl bg-pink-100 p-6"><p class="text-lg">这是一个大卡片内容块，里面有足够文字不会被误判。</p></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('emoji-as-icon')
    })
  })

  describe('padding-below-floor', () => {
    it('flags content root px-10 (40px < 96px floor on 1600w)', () => {
      const html = wrap('<div class="w-full h-full flex flex-col px-10"><h1>标题</h1></div>')
      const v = validatePageQuality(html, wide)
      const pad = v.find((x) => x.code === 'padding-below-floor')
      expect(pad).toBeDefined()
      expect(pad!.detail).toContain('40px')
      expect(pad!.detail).toContain('96px')
      expect(pad!.fix).toContain('px-24')
    })

    it('does NOT flag content root px-24 (96px = floor)', () => {
      const html = wrap('<div class="w-full h-full flex flex-col px-24"><h1>标题</h1></div>')
      expect(codes(validatePageQuality(html, wide))).not.toContain('padding-below-floor')
    })

    it('does NOT flag arbitrary px-[120px] above floor', () => {
      const html = wrap('<div class="px-[120px]"><h1>标题</h1></div>')
      expect(codes(validatePageQuality(html, wide))).not.toContain('padding-below-floor')
    })

    it('does NOT flag a container that declares no horizontal padding', () => {
      const html = wrap('<div class="w-full h-full flex flex-col"><h1>标题</h1></div>')
      expect(codes(validatePageQuality(html, wide))).not.toContain('padding-below-floor')
      expect(codes(validatePageQuality(html, wide))).toContain('safe-area-implicit')
    })

    it('catches inline-style padding bypass (style="padding: 10px 30px")', () => {
      // LLM 试图用内联 style 绕过 class px-N 检测 → 仍应命中
      const html = wrap('<div style="padding: 10px 30px"><h1>标题</h1></div>')
      const v = validatePageQuality(html, wide)
      const pad = v.find((x) => x.code === 'padding-below-floor')
      expect(pad).toBeDefined()
      expect(pad!.detail).toContain('内联 style')
      expect(pad!.detail).toContain('30px')
    })

    it('does NOT flag inline-style padding above floor', () => {
      const html = wrap('<div style="padding: 20px 120px"><h1>标题</h1></div>')
      expect(codes(validatePageQuality(html, wide))).not.toContain('padding-below-floor')
    })

    it('scales the floor with canvas width (vertical-9-16 900w → floor 54px)', () => {
      const vertical = SLIDE_SIZE_PRESETS.find((p) => p.id === 'vertical-9-16')!
      // px-12 = 48px < 54px → 命中
      const html = wrap('<div class="px-12"><h1>标题</h1></div>')
      expect(codes(validatePageQuality(html, vertical))).toContain('padding-below-floor')
    })
  })

  describe('font-below-floor', () => {
    it('flags explicitly undersized body and heading text', () => {
      const html = wrap(
        '<div class="px-24"><h2 class="text-xl">结论标题</h2><p class="text-sm">这是一段投影时无法阅读的正文。</p><svg viewBox="0 0 10 10"></svg></div>'
      )
      const violations = validatePageQuality(html, wide).filter(
        (item) => item.code === 'font-below-floor'
      )
      expect(violations).toHaveLength(2)
      expect(violations.map((item) => item.detail).join(' ')).toContain('标题下限 24px')
      expect(violations.map((item) => item.detail).join(' ')).toContain('正文下限 18px')
    })

    it('allows auxiliary text below the body floor', () => {
      const html = wrap(
        '<div class="px-24"><h2 class="text-4xl">主要结论</h2><p class="text-lg">正文保持清晰可读。</p><footer class="text-xs">来源：示例数据</footer><svg viewBox="0 0 10 10"></svg></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('font-below-floor')
    })

    it('scales explicit font floors for a tall canvas', () => {
      const vertical = SLIDE_SIZE_PRESETS.find((p) => p.id === 'vertical-9-16')!
      const html = wrap(
        '<div class="px-16"><h2 class="text-[40px]">竖版标题</h2><p class="text-2xl">24px 正文对竖版画布过小。</p><svg viewBox="0 0 10 10"></svg></div>'
      )
      expect(codes(validatePageQuality(html, vertical))).toContain('font-below-floor')
    })
  })

  describe('web UI advisories', () => {
    it('warns rather than errors for interactive controls and a card wall', () => {
      const cards = Array.from(
        { length: 6 },
        (_, index) =>
          `<article class="card rounded-2xl border shadow-sm"><h3 class="text-2xl">模块 ${index + 1}</h3><p class="text-lg">并列内容</p></article>`
      ).join('')
      const html = wrap(
        `<div class="px-24"><nav><span class="text-lg">导航</span></nav><div>${cards}</div></div>`
      )
      const violations = validatePageQuality(html, wide)
      expect(violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'interactive-ui-controls', severity: 'warn' }),
          expect.objectContaining({ code: 'card-wall-density', severity: 'warn' })
        ])
      )
    })
  })

  describe('combined', () => {
    it('returns empty for a clean compliant page', () => {
      const html = wrap(
        '<div class="w-full h-full flex flex-col px-24"><h1>标题</h1><div class="w-12 h-12 rounded-full"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div></div>'
      )
      expect(validatePageQuality(html, wide)).toEqual([])
    })

    it('reports emoji-as-icon and padding-below-floor together', () => {
      const filler =
        '在产品评测场景中，用户反馈集中在三个核心维度：界面交互的流畅度，包括页面加载速度与手势响应；推荐算法的精准性，涉及兴趣匹配与内容多样性；社区氛围的健康度，涵盖评论质量与互动友善度，我们把这些整理成可量化的指标体系。'
      const html = wrap(
        `<div class="px-10"><p class="text-lg">${filler}</p><div class="w-10 h-10 rounded-full"><span class="text-2xl">⭐</span></div></div>`
      )
      expect(codes(validatePageQuality(html, wide)).sort()).toEqual([
        'emoji-as-icon',
        'padding-below-floor'
      ])
    })
  })

  describe('under-fill-orphan (conservative bottom-line)', () => {
    it('flags an orphan page: very little text, no large text, no visual subject', () => {
      const html = wrap(
        '<div class="px-24"><h2 class="text-2xl">概述</h2><p class="text-lg">这是介绍。</p></div>'
      )
      expect(codes(validatePageQuality(html, wide))).toContain('under-fill-orphan')
    })

    it('does NOT flag a section divider with a large title (exempt)', () => {
      const html = wrap(
        '<div class="px-24 h-full flex items-center justify-center"><h1 class="text-7xl">第二部分</h1></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('under-fill-orphan')
    })

    it('does NOT flag a quote page with a large lead (exempt)', () => {
      const html = wrap(
        '<div class="px-24"><blockquote class="text-5xl">少即是多。</blockquote></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('under-fill-orphan')
    })

    it('does NOT flag a page with an SVG visual subject (exempt)', () => {
      const html = wrap(
        '<div class="px-24"><svg viewBox="0 0 100 100" class="w-full h-[400px]"><circle cx="50" cy="50" r="40"/></svg></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('under-fill-orphan')
    })

    it('does NOT flag a page with a chart marker (exempt)', () => {
      const html = wrap(
        '<div class="px-24"><div class="h-[360px]" data-chart="bar"><!-- PPT.createChart --></div></div>'
      )
      expect(codes(validatePageQuality(html, wide))).not.toContain('under-fill-orphan')
    })

    it('does NOT flag a content-rich page with enough text (exempt)', () => {
      const longText =
        '本页面展示本季度核心运营指标的完整分析，涵盖日活跃用户、平均使用时长、内容产出量与互动率四项关键数据，并附有环比与同比变化趋势，文字量充足，足以证明这是一个内容充实的数据分析页，不应被孤页兜底规则误判打回。'
      const html = wrap(`<div class="px-24"><h2 class="text-2xl">标题</h2><p class="text-lg">${longText}</p></div>`)
      expect(codes(validatePageQuality(html, wide))).not.toContain('under-fill-orphan')
    })
  })
})
