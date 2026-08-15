import { describe, expect, it } from 'vitest'
import {
  assignTemplateBasePages,
  classifyTemplatePageRole,
  describeTemplatePageRole,
  isValidTemplatePageRole,
  replaceTemplatePageId
} from '../../../src/main/templates/template-page-roles'
import { parseTemplateManifest } from '../../../src/main/templates/template-manifest'

describe('template page role classification', () => {
  it('marks the first page as cover and the last as ending', () => {
    expect(classifyTemplatePageRole({ pageNumber: 1, title: '封面' }, 6)).toBe('cover')
    expect(classifyTemplatePageRole({ pageNumber: 6, title: '谢谢观看' }, 6)).toBe('ending')
  })

  it('detects toc, section and data pages from title and outline keywords', () => {
    expect(
      classifyTemplatePageRole({ pageNumber: 2, title: '目录', contentOutline: '01 概述；02 方案' }, 6)
    ).toBe('toc')
    expect(
      classifyTemplatePageRole({ pageNumber: 3, title: '第二章 方案设计', contentOutline: '' }, 6)
    ).toBe('section')
    expect(
      classifyTemplatePageRole(
        { pageNumber: 4, title: '经营数据', contentOutline: '季度增长 32%；图表' },
        6
      )
    ).toBe('data')
    expect(
      classifyTemplatePageRole(
        { pageNumber: 5, title: '实施路径', contentOutline: '分三个阶段推进，每阶段两页内容' },
        6
      )
    ).toBe('content')
  })

  it('keeps a valid manifest role as-is and ignores invalid values', () => {
    expect(
      classifyTemplatePageRole({ pageNumber: 2, title: 'x', role: 'toc' }, 6)
    ).toBe('toc')
    expect(classifyTemplatePageRole({ pageNumber: 2, title: '目录', role: 'bogus' }, 6)).toBe('toc')
    expect(isValidTemplatePageRole('cover')).toBe(true)
    expect(isValidTemplatePageRole('bogus')).toBe(false)
  })
})

describe('template base page assignment', () => {
  const templatePages = [
    { pageNumber: 1, title: '封面' },
    { pageNumber: 2, title: '目录', contentOutline: '01 概述；02 方案' },
    { pageNumber: 3, title: '背景与现状', contentOutline: '行业背景、竞品与现状分析' },
    { pageNumber: 4, title: '经营数据', contentOutline: '季度增长 32%；图表' },
    { pageNumber: 5, title: '实施路径', contentOutline: '分阶段推进' },
    { pageNumber: 6, title: '谢谢' }
  ]

  it('assigns cover first, toc second, ending last regardless of template order heuristics', () => {
    const assigned = assignTemplateBasePages(templatePages, 6)
    expect(assigned[0]?.role).toBe('cover')
    expect(assigned[1]?.role).toBe('toc')
    expect(assigned[5]?.role).toBe('ending')
    // 中间页来自内容型页面池，不再是封面/结尾
    for (const page of assigned.slice(2, 5)) {
      expect(['content', 'section', 'data', 'toc']).toContain(page.role)
    }
  })

  it('expands a small template to more output pages with variety', () => {
    const assigned = assignTemplateBasePages(templatePages, 12)
    expect(assigned).toHaveLength(12)
    expect(assigned[0]?.role).toBe('cover')
    expect(assigned[11]?.role).toBe('ending')
    const middleSourcePages = new Set(assigned.slice(2, 11).map((page) => page.pageNumber))
    expect(middleSourcePages.size).toBeGreaterThanOrEqual(3)
  })

  it('shrinks output count and never leaves the cover/ending anchors', () => {
    const assigned = assignTemplateBasePages(templatePages, 2)
    expect(assigned.map((page) => page.role)).toEqual(['cover', 'ending'])
    const single = assignTemplateBasePages(templatePages.slice(0, 1), 4)
    expect(single.every((page) => page.pageNumber === 1)).toBe(true)
  })

  it('falls back gracefully when the template has no toc page', () => {
    const assigned = assignTemplateBasePages(
      templatePages.filter((page) => page.title !== '目录'),
      5
    )
    expect(assigned[0]?.role).toBe('cover')
    expect(assigned[4]?.role).toBe('ending')
    expect(assigned[1]?.role).not.toBe('toc')
  })
})

describe('template page identity rewrite', () => {
  it('replaces page ids with word boundaries and leaves substrings intact', () => {
    const html = '<section data-page-id="page-abc" class="x"><a href="#page-abc">page-abcx</a></section>'
    const rewritten = replaceTemplatePageId(html, 'page-abc', 'page-xyz')
    expect(rewritten).toContain('data-page-id="page-xyz"')
    expect(rewritten).toContain('href="#page-xyz"')
    expect(rewritten).toContain('page-abcx')
  })
})

describe('template manifest role persistence', () => {
  it('round-trips optional role and contentOutline fields', () => {
    const manifest = parseTemplateManifest({
      id: 'tpl_test123',
      name: '测试模板',
      slideSizeId: 'standard-4-3',
      slideWidth: 1600,
      slideHeight: 1200,
      pages: [
        { pageNumber: 1, pageId: 'page-1', title: '封面', htmlPath: 'page-1.html', role: 'cover' },
        {
          pageNumber: 2,
          pageId: 'page-2',
          title: '经营数据',
          htmlPath: 'page-2.html',
          contentOutline: '季度增长 32%',
          role: 'data'
        },
        { pageNumber: 3, pageId: 'page-3', title: '尾页', htmlPath: 'page-3.html', role: 'bogus' }
      ]
    })
    expect(manifest.pages[0]?.role).toBe('cover')
    expect(manifest.pages[1]?.contentOutline).toBe('季度增长 32%')
    expect(manifest.pages[1]?.role).toBe('data')
    expect(manifest.pages[2]?.role).toBeUndefined()
  })
})

describe('describeTemplatePageRole', () => {
  it('returns bilingual descriptions for every role', () => {
    for (const role of ['cover', 'toc', 'section', 'content', 'data', 'ending'] as const) {
      const description = describeTemplatePageRole(role)
      expect(description.zh.length).toBeGreaterThan(0)
      expect(description.en.length).toBeGreaterThan(0)
    }
  })
})
