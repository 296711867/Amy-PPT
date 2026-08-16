/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { useWebviewLoadError } from '../../../src/renderer/src/hooks/useWebviewLoadError'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

function createWebviewMock() {
  const listeners = new Map<string, (event: Event) => void>()
  return {
    listeners,
    webview: {
      addEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
        listeners.set(type, listener)
      }),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
      reload: vi.fn()
    } as unknown as Electron.WebviewTag
  }
}

function Probe({ webview }: { webview: Electron.WebviewTag }): React.JSX.Element {
  const { error, retry } = useWebviewLoadError(webview, 'editor.html')
  return React.createElement(
    'div',
    null,
    React.createElement('output', null, error || ''),
    React.createElement('button', { onClick: retry }, 'retry')
  )
}

describe('HtmlEditorCanvas webview load recovery', () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    container?.remove()
    container = null
  })

  it('shows a main-frame failure and reloads after retry', async () => {
    const mock = createWebviewMock()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(React.createElement(Probe, { webview: mock.webview })))
    await act(async () => {
      mock.listeners.get('did-fail-load')?.({
        errorCode: -105,
        errorDescription: 'Editor document unavailable',
        isMainFrame: true
      } as unknown as Event)
    })

    expect(container.querySelector('output')?.textContent).toBe('Editor document unavailable')

    await act(async () => {
      container?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mock.webview.reload).toHaveBeenCalledTimes(1)
    expect(container.querySelector('output')?.textContent).toBe('')
  })
})
