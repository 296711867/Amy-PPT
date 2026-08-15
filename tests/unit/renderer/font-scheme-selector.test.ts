/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import type { FontSelection } from '../../../src/shared/generation'
import type { AvailableFontScheme } from '../../../src/shared/font-schemes'

vi.mock('@renderer/i18n', async () => {
  const { zh } = await import('../../../src/renderer/src/i18n/zh')
  const getByPath = (obj: unknown, path: string): string | undefined => {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
      return undefined
    }, obj)
    return typeof value === 'string' ? value : undefined
  }
  const t = (key: string, params?: Record<string, string | number>): string => {
    const template = getByPath(zh, key) || key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    )
  }
  return { useLang: () => ({ lang: 'zh', t }) }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}))

const ipcState = vi.hoisted(() => ({
  listFonts: vi.fn(),
  listFontSchemes: vi.fn()
}))

vi.mock('@renderer/lib/ipc', () => ({
  ipc: {
    listFonts: ipcState.listFonts,
    listFontSchemes: ipcState.listFontSchemes
  }
}))

const scheme = (overrides: Partial<AvailableFontScheme>): AvailableFontScheme => ({
  id: 'scheme-a',
  name: '品牌发布',
  description: '品牌发布会场景',
  builtIn: true,
  available: true,
  missingFamilies: [],
  title: { source: 'system', family: '庞门正道标题体' },
  subtitle: { source: 'system', family: 'OPPOSans' },
  body: { source: 'system', family: '微软雅黑' },
  ...overrides
})

async function renderSelector(
  value: FontSelection
): Promise<{ container: HTMLDivElement; root: Root }> {
  const { FontSchemeSelector } = await import(
    '../../../src/renderer/src/components/font/FontSchemeSelector'
  )
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      React.createElement(FontSchemeSelector, { value, onChange: vi.fn(), compact: false })
    )
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

describe('FontSchemeSelector', () => {
  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('renders scheme cards through i18n and disables schemes with missing fonts', async () => {
    ipcState.listFonts.mockResolvedValue({ googleFonts: [], userFonts: [], systemFonts: [] })
    ipcState.listFontSchemes.mockResolvedValue({
      items: [
        scheme({}),
        scheme({
          id: 'scheme-b',
          name: '国际科技',
          available: false,
          missingFamilies: ['庞门正道标题体', 'OPPOSans']
        })
      ]
    })

    const { container, root } = await renderSelector({ mode: 'auto' })
    try {
      expect(container.textContent).toContain('自动匹配')
      expect(container.textContent).toContain('品牌发布')
      expect(container.textContent).toContain('国际科技')
      expect(container.textContent).toContain('缺少：庞门正道标题体、OPPOSans')

      const disabledCard = [...container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('国际科技')
      )
      expect(disabledCard?.disabled).toBe(true)
      expect(disabledCard?.getAttribute('title')).toBe('缺少字体：庞门正道标题体、OPPOSans')
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('labels the three custom font roles through i18n', async () => {
    ipcState.listFonts.mockResolvedValue({ googleFonts: [], userFonts: [], systemFonts: [] })
    ipcState.listFontSchemes.mockResolvedValue({ items: [scheme({})] })

    const { container, root } = await renderSelector({
      mode: 'pair',
      title: { source: 'system', family: '微软雅黑' },
      body: { source: 'system', family: '微软雅黑' }
    })
    try {
      const toggle = [...container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('自定义三级字体')
      )
      expect(toggle).toBeTruthy()
      expect(container.textContent).toContain('大标题')
      expect(container.textContent).toContain('小标题')
      expect(container.textContent).toContain('正文')
      expect(container.textContent).toContain('管理字体与组合')
    } finally {
      await act(async () => root.unmount())
    }
  })
})
