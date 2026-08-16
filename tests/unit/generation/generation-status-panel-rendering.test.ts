/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { GenerationStatusPanel } from '../../../src/renderer/src/components/session-generating/GenerationStatusPanel'

vi.mock('@renderer/i18n', () => ({ useT: () => (key: string) => key }))

const createModelAction = () => ({
  modelConfigs: [],
  selectedModelConfigId: '',
  activatingModelConfigId: null,
  hasMultipleModelConfigs: false,
  currentModelConfig: null,
  ensureModelActive: vi.fn(async () => 'model-1')
})

async function renderPanel({
  isCancelling,
  onCancel,
  status = 'running',
  hasGeneratedPages = false,
  onContinueRemaining = vi.fn(),
  onRegenerate = vi.fn()
}: {
  isCancelling: boolean
  onCancel: () => void
  status?: 'running' | 'paused' | 'failed' | 'cancelled'
  hasGeneratedPages?: boolean
  onContinueRemaining?: () => void
  onRegenerate?: () => void
}): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      React.createElement(GenerationStatusPanel, {
        status,
        progress: 24,
        stages: ['preflight', 'planning', 'rendering', 'validation'],
        stageLabels: {
          preflight: 'Preflight',
          planning: 'Planning',
          rendering: 'Rendering',
          validation: 'Validation'
        },
        currentStage: 'rendering',
        completedPageCount: 1,
        totalPages: 3,
        error: null,
        interruptedLabel: 'Interrupted',
        enterEditorLabel: 'Enter editor',
        continueRemainingLabel: 'Continue',
        regenerateLabel: 'Regenerate',
        checkSettingsLabel: 'Check settings',
        pausedLabel: '生成已暂停',
        pausedProgressLabel: '已完成',
        pageUnitLabel: '页',
        errorDetailsLabel: 'Error details',
        reconnectLabel: '重新连接并继续',
        cancelLabel: '取消生成',
        isCancelling,
        hasGeneratedPages,
        canEnterEditor: false,
        showEditorShortcut: false,
        modelAction: createModelAction(),
        onEnterEditor: vi.fn(),
        onContinueRemaining,
        onRegenerate,
        onOpenSettings: vi.fn(),
        onCancel
      })
    )
  })

  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    }
  }
}

describe('GenerationStatusPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('disables the cancel button and shows a spinner while cancellation is pending', async () => {
    const onCancel = vi.fn()
    const { container, unmount } = await renderPanel({ isCancelling: true, onCancel })

    try {
      const cancelButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('取消生成')
      ) as HTMLButtonElement | undefined

      expect(cancelButton).toBeTruthy()
      expect(cancelButton?.disabled).toBe(true)
      expect(cancelButton?.getAttribute('aria-busy')).toBe('true')
      expect(cancelButton?.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')

      cancelButton?.click()

      expect(onCancel).not.toHaveBeenCalled()
    } finally {
      await unmount()
    }
  })

  it('keeps the cancel button clickable before cancellation starts', async () => {
    const onCancel = vi.fn()
    const { container, unmount } = await renderPanel({ isCancelling: false, onCancel })

    try {
      const cancelButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('取消生成')
      ) as HTMLButtonElement | undefined

      expect(cancelButton).toBeTruthy()
      expect(cancelButton?.disabled).toBe(false)
      expect(cancelButton?.hasAttribute('aria-busy')).toBe(false)

      cancelButton?.click()

      expect(onCancel).toHaveBeenCalledTimes(1)
    } finally {
      await unmount()
    }
  })

  it('shows pause details and keeps the continue action available', async () => {
    const { container, unmount } = await renderPanel({
      isCancelling: false,
      onCancel: vi.fn(),
      status: 'paused'
    })

    try {
      expect(container.textContent).toContain('生成已暂停')
      expect(container.textContent).toContain('已完成 1/3 页')
      expect(container.textContent).toContain('重新连接并继续')
      expect(container.textContent).toContain('Check settings')
      expect(container.textContent).not.toContain('取消生成')
    } finally {
      await unmount()
    }
  })

  it('routes a failed generation retry through the partial retry callback', async () => {
    const onContinueRemaining = vi.fn()
    const onRegenerate = vi.fn()
    const { container, unmount } = await renderPanel({
      isCancelling: false,
      onCancel: vi.fn(),
      status: 'failed',
      hasGeneratedPages: false,
      onContinueRemaining,
      onRegenerate
    })

    try {
      const retryButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Regenerate')
      ) as HTMLButtonElement | undefined

      expect(retryButton).toBeTruthy()
      await act(async () => {
        retryButton?.click()
      })

      expect(onContinueRemaining).toHaveBeenCalledWith('model-1')
      expect(onRegenerate).not.toHaveBeenCalled()
    } finally {
      await unmount()
    }
  })
})
