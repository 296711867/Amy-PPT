import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockDispatcher = {
  kind: string
  url: string
  close: ReturnType<typeof vi.fn>
}

const proxyTestState = vi.hoisted(() => {
  const createDispatcher = (kind: string, url = ''): MockDispatcher => ({
    kind,
    url,
    close: vi.fn().mockResolvedValue(undefined)
  })

  const originalDispatcher = createDispatcher('original')
  const createdDispatchers: MockDispatcher[] = []
  const logMock = {
    info: vi.fn()
  }
  const getGlobalDispatcherMock = vi.fn(() => originalDispatcher)
  const setGlobalDispatcherMock = vi.fn()
  const ProxyAgentMock = vi.fn(function (url: string) {
    const dispatcher = createDispatcher('proxy', url)
    createdDispatchers.push(dispatcher)
    return dispatcher
  })
  const Socks5ProxyAgentMock = vi.fn(function (url: string) {
    const dispatcher = createDispatcher('socks', url)
    createdDispatchers.push(dispatcher)
    return dispatcher
  })

  return {
    createdDispatchers,
    getGlobalDispatcherMock,
    logMock,
    originalDispatcher,
    ProxyAgentMock,
    setGlobalDispatcherMock,
    Socks5ProxyAgentMock
  }
})

vi.mock('electron-log/main.js', () => ({
  default: proxyTestState.logMock
}))

vi.mock('undici', () => ({
  ProxyAgent: proxyTestState.ProxyAgentMock,
  Socks5ProxyAgent: proxyTestState.Socks5ProxyAgentMock,
  getGlobalDispatcher: proxyTestState.getGlobalDispatcherMock,
  setGlobalDispatcher: proxyTestState.setGlobalDispatcherMock
}))

async function loadProxyModule() {
  vi.resetModules()
  return import('../../../src/main/utils/proxy')
}

describe('proxy dispatcher management', () => {
  beforeEach(() => {
    proxyTestState.createdDispatchers.length = 0
    proxyTestState.getGlobalDispatcherMock.mockClear()
    proxyTestState.getGlobalDispatcherMock.mockReturnValue(proxyTestState.originalDispatcher)
    proxyTestState.logMock.info.mockClear()
    proxyTestState.originalDispatcher.close.mockClear()
    proxyTestState.ProxyAgentMock.mockClear()
    proxyTestState.setGlobalDispatcherMock.mockClear()
    proxyTestState.Socks5ProxyAgentMock.mockClear()
  })

  it('applies HTTP proxy via ProxyAgent and trims the URL', async () => {
    const { applyProxy } = await loadProxyModule()

    applyProxy('  http://127.0.0.1:7890  ')

    expect(proxyTestState.ProxyAgentMock).toHaveBeenCalledWith('http://127.0.0.1:7890')
    expect(proxyTestState.Socks5ProxyAgentMock).not.toHaveBeenCalled()
    expect(proxyTestState.setGlobalDispatcherMock).toHaveBeenCalledWith(
      proxyTestState.createdDispatchers[0]
    )
    expect(proxyTestState.logMock.info).toHaveBeenCalledWith(
      '[proxy] applied',
      'http://127.0.0.1:7890'
    )
  })

  it('applies SOCKS proxy via Socks5ProxyAgent', async () => {
    const { applyProxy } = await loadProxyModule()

    applyProxy('socks5://127.0.0.1:1080')

    expect(proxyTestState.Socks5ProxyAgentMock).toHaveBeenCalledWith('socks5://127.0.0.1:1080')
    expect(proxyTestState.ProxyAgentMock).not.toHaveBeenCalled()
    expect(proxyTestState.createdDispatchers[0]?.kind).toBe('socks')
  })

  it('closes the previous proxy dispatcher before switching to a new one', async () => {
    const { applyProxy } = await loadProxyModule()

    applyProxy('http://127.0.0.1:7890')
    const firstDispatcher = proxyTestState.createdDispatchers[0]

    applyProxy('http://127.0.0.1:7891')

    expect(firstDispatcher.close).toHaveBeenCalledTimes(1)
    expect(proxyTestState.setGlobalDispatcherMock).toHaveBeenNthCalledWith(
      2,
      proxyTestState.createdDispatchers[1]
    )
  })

  it('restores the original dispatcher when the proxy URL is empty', async () => {
    const { applyProxy } = await loadProxyModule()

    applyProxy('http://127.0.0.1:7890')
    const activeProxyDispatcher = proxyTestState.createdDispatchers[0]

    applyProxy('   ')

    expect(activeProxyDispatcher.close).toHaveBeenCalledTimes(1)
    expect(proxyTestState.setGlobalDispatcherMock).toHaveBeenLastCalledWith(
      proxyTestState.originalDispatcher
    )
    expect(proxyTestState.logMock.info).toHaveBeenCalledWith(
      '[proxy] cleared, restored default dispatcher'
    )
  })

  it('ignores async close rejections from the previous proxy dispatcher', async () => {
    const { applyProxy, clearProxy } = await loadProxyModule()

    applyProxy('http://127.0.0.1:7890')
    const activeProxyDispatcher = proxyTestState.createdDispatchers[0]
    activeProxyDispatcher.close.mockRejectedValueOnce(new Error('close failed'))

    expect(() => clearProxy()).not.toThrow()
    await Promise.resolve()

    expect(activeProxyDispatcher.close).toHaveBeenCalledTimes(1)
    expect(proxyTestState.setGlobalDispatcherMock).toHaveBeenLastCalledWith(
      proxyTestState.originalDispatcher
    )
  })
})
