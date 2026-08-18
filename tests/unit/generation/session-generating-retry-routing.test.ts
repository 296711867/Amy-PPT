/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getSession: vi.fn(),
  getGenerateState: vi.fn(),
  statusPanelProps: null as Record<string, unknown> | null,
  location: { key: 'test-location', state: null },
  params: { id: 'session-1' },
  translate: (key: string) => key,
  ensureModelActive: vi.fn(async () => 'model-1')
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params
}))

vi.mock('@renderer/lib/ipc', () => ({
  ipc: {
    getSession: mocks.getSession,
    getGenerateState: mocks.getGenerateState,
    onGenerateChunk: vi.fn(() => vi.fn())
  }
}))

vi.mock('../../../src/renderer/src/i18n', () => ({
  useLang: () => ({
    lang: 'zh',
    t: mocks.translate
  })
}))

vi.mock('../../../src/renderer/src/hooks/useModelAction', () => ({
  useModelAction: () => ({
    modelConfigs: [],
    selectedModelConfigId: 'model-1',
    activatingModelConfigId: null,
    hasMultipleModelConfigs: false,
    currentModelConfig: null,
    ensureModelActive: mocks.ensureModelActive
  })
}))

vi.mock('../../../src/renderer/src/components/brand/AmyLogoMotion', () => ({
  AmyLogoMotion: () => React.createElement('div')
}))

vi.mock('../../../src/renderer/src/components/session-generating', () => ({
  GenerationPreviewGrid: () => React.createElement('div'),
  GenerationSidebar: () => React.createElement('div'),
  GenerationStatusPanel: (props: Record<string, unknown>) => {
    mocks.statusPanelProps = props
    return React.createElement('div', { 'data-testid': 'generation-status' })
  }
}))

import { SessionGeneratingPage } from '../../../src/renderer/src/pages/session-generating'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function renderPage(): Promise<() => Promise<void>> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(SessionGeneratingPage))
    await Promise.resolve()
    await Promise.resolve()
  })

  return async () => {
    await act(async () => root.unmount())
    container.remove()
  }
}

describe('SessionGeneratingPage retry routing', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.getSession.mockReset()
    mocks.getGenerateState.mockReset()
    mocks.statusPanelProps = null
    mocks.getGenerateState.mockResolvedValue({
      status: 'failed',
      hasActiveRun: false,
      error: 'initial generation failed',
      events: []
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('uses full regeneration after a model switch when session_pages is empty', async () => {
    mocks.getSession.mockResolvedValue({
      session: {
        status: 'failed',
        title: 'PPT: High-performance servo motor project pitch',
        page_count: 0,
        generated_count: 0,
        failed_count: 0
      },
      messages: [],
      generatedPages: []
    })

    const unmount = await renderPage()
    try {
      expect(mocks.statusPanelProps?.hasRetryablePages).toBe(false)

      act(() => {
        const onRegenerate = mocks.statusPanelProps?.onRegenerate as (
          modelConfigId: string
        ) => void
        onRegenerate('model-2')
      })

      expect(mocks.navigate).toHaveBeenCalledWith('/sessions/session-1/generating', {
        replace: true,
        state: expect.objectContaining({
          modelConfigId: 'model-2',
          retry: false
        })
      })
    } finally {
      await unmount()
    }
  })

  it('keeps partial retry when persisted session pages exist', async () => {
    mocks.getSession.mockResolvedValue({
      session: {
        status: 'failed',
        title: 'Existing partial deck',
        page_count: 1,
        generated_count: 0,
        failed_count: 1
      },
      messages: [],
      generatedPages: [
        {
          id: 'session-page-1',
          pageNumber: 1,
          title: 'Market analysis',
          html: '',
          pageId: 'page-1',
          status: 'failed'
        }
      ]
    })

    const unmount = await renderPage()
    try {
      expect(mocks.statusPanelProps?.hasRetryablePages).toBe(true)

      act(() => {
        const onContinueRemaining = mocks.statusPanelProps?.onContinueRemaining as (
          modelConfigId: string
        ) => void
        onContinueRemaining('model-2')
      })

      expect(mocks.navigate).toHaveBeenCalledWith('/sessions/session-1/generating', {
        replace: true,
        state: expect.objectContaining({
          modelConfigId: 'model-2',
          retry: true
        })
      })
    } finally {
      await unmount()
    }
  })

  it('enters the editor when recovered pages are complete despite a stale failed run', async () => {
    mocks.getSession.mockResolvedValue({
      session: {
        status: 'completed',
        title: 'Recovered deck',
        page_count: 2,
        generated_count: 2,
        failed_count: 0
      },
      messages: [],
      generatedPages: [
        {
          id: 'session-page-1',
          pageNumber: 1,
          title: 'Cover',
          html: '<html></html>',
          pageId: 'page-1',
          status: 'completed'
        },
        {
          id: 'session-page-2',
          pageNumber: 2,
          title: 'Market',
          html: '<html></html>',
          pageId: 'page-2',
          status: 'completed'
        }
      ]
    })

    const unmount = await renderPage()
    try {
      expect(mocks.navigate).toHaveBeenCalledWith('/sessions/session-1', { replace: true })
    } finally {
      await unmount()
    }
  })
})
