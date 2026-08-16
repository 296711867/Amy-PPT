/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { useWebviewLoadError } from '../../../src/renderer/src/hooks/useWebviewLoadError'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

type Listener = (event: Event) => void

function createWebviewMock() {
  const listeners = new Map<string, Listener>()
  return {
    listeners,
    webview: {
      addEventListener: vi.fn((type: string, listener: Listener) => {
        listeners.set(type, listener)
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type)
      }),
      reload: vi.fn()
    } as unknown as Electron.WebviewTag
  }
}

function Probe({ webview, source }: { webview: Electron.WebviewTag; source: string }): React.JSX.Element {
  const { error, retry } = useWebviewLoadError(webview, source)
  return React.createElement(
    'div',
    null,
    React.createElement('output', { 'data-error': true }, error || ''),
    React.createElement('button', { onClick: retry }, 'retry')
  )
}

describe('useWebviewLoadError', () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    container?.remove()
    container = null
  })

  it('reports main-frame failures and ignores aborted or subframe failures', async () => {
    const mock = createWebviewMock()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(React.createElement(Probe, { webview: mock.webview, source: 'a' })))

    await act(async () => {
      mock.listeners.get('did-fail-load')?.({
        errorCode: -105,
        errorDescription: 'Network unavailable',
        isMainFrame: false
      } as unknown as Event)
      mock.listeners.get('did-fail-load')?.({
        errorCode: -3,
        errorDescription: 'Aborted',
        isMainFrame: true
      } as unknown as Event)
    })
    expect(container.querySelector('output')?.textContent).toBe('')

    await act(async () => {
      mock.listeners.get('did-fail-load')?.({
        errorCode: -105,
        errorDescription: 'Network unavailable',
        isMainFrame: true
      } as unknown as Event)
    })
    expect(container.querySelector('output')?.textContent).toBe('Network unavailable')
  })

  it('clears on ready, source changes, and retry while reloading the webview', async () => {
    const mock = createWebviewMock()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(React.createElement(Probe, { webview: mock.webview, source: 'a' })))
    await act(async () => {
      mock.listeners.get('did-fail-load')?.({
        errorCode: -105,
        errorDescription: 'Load failed',
        isMainFrame: true
      } as unknown as Event)
    })
    expect(container.querySelector('output')?.textContent).toBe('Load failed')

    await act(async () => {
      mock.listeners.get('dom-ready')?.(new Event('dom-ready'))
    })
    expect(container.querySelector('output')?.textContent).toBe('')

    await act(async () => {
      mock.listeners.get('did-fail-load')?.({
        errorCode: -105,
        errorDescription: 'Load failed again',
        isMainFrame: true
      } as unknown as Event)
    })
    await act(async () => root?.render(React.createElement(Probe, { webview: mock.webview, source: 'b' })))
    expect(container.querySelector('output')?.textContent).toBe('')

    await act(async () => {
      mock.listeners.get('did-fail-load')?.({
        errorCode: -105,
        errorDescription: 'Retry failed',
        isMainFrame: true
      } as unknown as Event)
      container?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mock.webview.reload).toHaveBeenCalledTimes(1)
    expect(container.querySelector('output')?.textContent).toBe('')
  })
})
