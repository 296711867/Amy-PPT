import log from 'electron-log/main.js'
import type Dispatcher from 'undici/types/dispatcher'
import { ProxyAgent, Socks5ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

let originalDispatcher: Dispatcher | null = null
let currentProxyDispatcher: Dispatcher | null = null

function isSocksUrl(url: string): boolean {
  return url.startsWith('socks5://') || url.startsWith('socks://')
}

export function applyProxy(proxyUrl: string | undefined): void {
  if (!originalDispatcher) {
    originalDispatcher = getGlobalDispatcher()
  }

  if (!proxyUrl || !proxyUrl.trim()) {
    clearProxy()
    return
  }

  const url = proxyUrl.trim()
  const dispatcher = isSocksUrl(url) ? new Socks5ProxyAgent(url) : new ProxyAgent(url)

  closeCurrentProxy()
  currentProxyDispatcher = dispatcher
  setGlobalDispatcher(dispatcher)
  log.info('[proxy] applied', url)
}

export function clearProxy(): void {
  if (!originalDispatcher) return
  closeCurrentProxy()
  setGlobalDispatcher(originalDispatcher)
  log.info('[proxy] cleared, restored default dispatcher')
}

function closeCurrentProxy(): void {
  if (currentProxyDispatcher && typeof currentProxyDispatcher.close === 'function') {
    void currentProxyDispatcher.close().catch(() => {})
  }
  currentProxyDispatcher = null
}
