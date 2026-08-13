import { describe, expect, it } from 'vitest'
import { replaceDataIcons } from '../../../src/main/presentation/icons/data-icon-replacer'

describe('replaceDataIcons', () => {
  it('replaces a known icon id with inline lucide svg, preserving class', () => {
    const html = '<div><svg data-icon="rocket" class="w-12 h-12 text-blue-500"></svg></div>'
    const { html: out, unknownIds } = replaceDataIcons(html)
    expect(unknownIds).toEqual([])
    // 替换后含真实 path
    expect(out).toMatch(/<path[^>]*d="/)
    // 保留原 class
    expect(out).toContain('w-12 h-12 text-blue-500')
    // 注入 viewBox 和描边属性
    expect(out).toContain('viewBox="0 0 24 24"')
    expect(out).toContain('stroke="currentColor"')
    // 移除 data-icon
    expect(out).not.toContain('data-icon')
  })

  it('preserves inline style alongside class', () => {
    const html = '<svg data-icon="star" class="w-10 h-10" style="color:red"></svg>'
    const { html: out } = replaceDataIcons(html)
    expect(out).toContain('style="color:red"')
    expect(out).toContain('w-10 h-10')
    expect(out).toMatch(/<path/)
  })

  it('leaves unknown icon ids untouched and reports them', () => {
    const html = '<svg data-icon="totally-fake-icon-xyz" class="w-8 h-8"></svg>'
    const { html: out, unknownIds } = replaceDataIcons(html)
    expect(unknownIds).toEqual(['totally-fake-icon-xyz'])
    // 原样保留（未替换）
    expect(out).toContain('data-icon="totally-fake-icon-xyz"')
    expect(out).not.toMatch(/<path/)
  })

  it('handles a mix of known and unknown icons', () => {
    const html =
      '<div><svg data-icon="rocket" class="w-12 h-12"></svg><svg data-icon="fake-xyz"></svg></div>'
    const { html: out, unknownIds } = replaceDataIcons(html)
    expect(unknownIds).toEqual(['fake-xyz'])
    // rocket 已替换
    expect(out).toMatch(/<path/)
    // fake 保留
    expect(out).toContain('data-icon="fake-xyz"')
  })

  it('returns html unchanged when no data-icon present (fast path)', () => {
    const html = '<div><p>no icons here</p><svg><circle cx="12" cy="12" r="10"/></svg></div>'
    const { html: out, unknownIds } = replaceDataIcons(html)
    expect(out).toBe(html)
    expect(unknownIds).toEqual([])
  })

  it('works on a full persisted-style document with section/main', () => {
    const html =
      '<div class="ppt-page-root"><section data-page-scaffold="1"><main data-role="content">' +
      '<div class="px-24"><svg data-icon="check" class="w-6 h-6 text-green-600"></svg></div>' +
      '</main></section></div>'
    const { html: out, unknownIds } = replaceDataIcons(html)
    expect(unknownIds).toEqual([])
    expect(out).toMatch(/<path/)
    expect(out).toContain('text-green-600')
    expect(out).toContain('px-24')
    expect(out).not.toContain('data-icon')
  })
})
