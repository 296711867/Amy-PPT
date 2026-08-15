/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

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
  return { useT: () => t }
})

const ipcState = vi.hoisted(() => ({
  listFonts: vi.fn(),
  listFontSchemes: vi.fn(),
  loadFontPreviewCss: vi.fn(),
  deleteFontScheme: vi.fn()
}))

const toastState = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))

vi.mock('@renderer/lib/ipc', () => ({
  ipc: {
    listFonts: ipcState.listFonts,
    listFontSchemes: ipcState.listFontSchemes,
    loadFontPreviewCss: ipcState.loadFontPreviewCss,
    deleteFontScheme: ipcState.deleteFontScheme,
    revealFontsFolder: vi.fn(),
    updateFont: vi.fn(),
    uploadFont: vi.fn(),
    chooseFontFiles: vi.fn()
  }
}))

vi.mock('@renderer/store', () => ({
  useToastStore: () => toastState
}))

const customScheme = {
  id: 'scheme-custom',
  name: '我的组合',
  description: '',
  builtIn: false,
  available: true,
  missingFamilies: [],
  title: { source: 'system', family: '微软雅黑' },
  subtitle: { source: 'system', family: '微软雅黑' },
  body: { source: 'system', family: '微软雅黑' }
}

async function renderFontsPage(): Promise<{ container: HTMLDivElement; root: Root }> {
  const { FontsPage } = await import('../../../src/renderer/src/pages/fonts')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(FontsPage))
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

describe('FontsPage scheme management', () => {
  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('surfaces an error toast instead of an unhandled rejection when scheme deletion fails', async () => {
    ipcState.listFonts.mockResolvedValue({ googleFonts: [], userFonts: [], systemFonts: [] })
    ipcState.listFontSchemes.mockResolvedValue({ items: [customScheme] })
    ipcState.loadFontPreviewCss.mockResolvedValue('')
    ipcState.deleteFontScheme.mockRejectedValue(new Error('scheme in use'))

    const { container, root } = await renderFontsPage()
    try {
      const deleteButton = container.querySelector(
        'button[aria-label="删除组合 我的组合"]'
      ) as HTMLButtonElement | null
      expect(deleteButton).toBeTruthy()

      await act(async () => {
        deleteButton?.click()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(ipcState.deleteFontScheme).toHaveBeenCalledWith('scheme-custom')
      expect(toastState.error).toHaveBeenCalledWith(
        '字体组合删除失败',
        expect.objectContaining({ description: 'scheme in use' })
      )
      expect(toastState.success).not.toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('reports a validation error when saving a scheme without required fonts', async () => {
    ipcState.listFonts.mockResolvedValue({ googleFonts: [], userFonts: [], systemFonts: [] })
    ipcState.listFontSchemes.mockResolvedValue({ items: [customScheme] })
    ipcState.loadFontPreviewCss.mockResolvedValue('')

    const { container, root } = await renderFontsPage()
    try {
      const createButton = [...container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('新建组合')
      ) as HTMLButtonElement | undefined
      expect(createButton).toBeTruthy()

      await act(async () => {
        createButton?.click()
        await Promise.resolve()
        await Promise.resolve()
      })

      const saveButton = [...document.body.querySelectorAll('button')].find((button) =>
        button.textContent === '保存组合'
      ) as HTMLButtonElement | undefined
      expect(saveButton).toBeTruthy()

      await act(async () => {
        saveButton?.click()
        await Promise.resolve()
      })

      expect(toastState.error).toHaveBeenCalledWith('请填写组合名称并选择大标题、小标题和正文字体')
    } finally {
      await act(async () => root.unmount())
    }
  })
})
