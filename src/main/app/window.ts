import { app, BrowserWindow, nativeTheme, screen, shell, webContents, type Size } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log/main.js'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { attachRendererCrashRecovery } from './lifecycle'
import { configureWindowMenu } from './menu'
import { ELECTRON_SMOKE_ENV } from './smoke-monitor'
import {
  isAllowedMainWindowNavigation,
  isAllowedGuestLocalRequest,
  isAllowedMainRendererLocalRequest,
  isAllowedWebViewNavigation,
  isAllowedWebViewSource,
  isFileUrl,
  isHttpUrl,
  isLocalAssetUrl,
  resolveUnboundLocalMainFrameRoot,
  resolveWebViewSourceRoot
} from './web-security'
import {
  DEFAULT_UI_THEME_ID,
  UI_THEME_CHROME,
  normalizeUiThemeId,
  type UiThemeId
} from '@shared/ui-theme'
import { APP_NAME } from '@shared/brand'
import { getLocalAssetCompanionRoots } from '../io/local-asset-roots'

const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 820
const BASE_MIN_WIDTH = 880
const BASE_MIN_HEIGHT = 680
const TITLEBAR_HEIGHT = 48
let activeUiThemeId: UiThemeId = DEFAULT_UI_THEME_ID
const __dirname = dirname(fileURLToPath(import.meta.url))
// electron-vite bundles this module into out/main/index.js. Keep asset paths
// relative to that runtime location rather than this source file's directory.
const mainOutputDir = __dirname
const guestRootsByWebContentsId = new Map<number, { primary: string; companions: string[] }>()
const rendererRootsByWebContentsId = new Map<number, string>()
const sessionsWithFilePolicy = new WeakSet<Electron.Session>()

const installLocalFileRequestPolicy = (
  electronSession: Electron.Session,
  staticGuestRoots: string[]
): void => {
  if (sessionsWithFilePolicy.has(electronSession)) return
  sessionsWithFilePolicy.add(electronSession)
  electronSession.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    (details, callback) => {
      if (!isFileUrl(details.url) && !isLocalAssetUrl(details.url)) {
        callback({ cancel: false })
        return
      }
      const webContentsId = details.webContentsId
      const rendererRoot = webContentsId ? rendererRootsByWebContentsId.get(webContentsId) : undefined
      if (rendererRoot) {
        callback({
          cancel: !isAllowedMainRendererLocalRequest(
            details.url,
            rendererRoot,
            staticGuestRoots
          )
        })
        return
      }

      const guestRoot = webContentsId ? guestRootsByWebContentsId.get(webContentsId) : undefined
      if (guestRoot) {
        callback({
          cancel: !isAllowedGuestLocalRequest(details.url, guestRoot.primary, [
            ...guestRoot.companions,
            ...staticGuestRoots
          ])
        })
        return
      }

      // Hidden render/export windows also use the default session. Bind their explicitly
      // registered project root on the first local main-frame request so fonts, master CSS,
      // and local assets can load without opening access to another project root.
      const provisionalRoot = resolveUnboundLocalMainFrameRoot(
        details.url,
        details.resourceType
      )
      if (webContentsId && provisionalRoot) {
        guestRootsByWebContentsId.set(webContentsId, {
          primary: provisionalRoot,
          companions: getLocalAssetCompanionRoots(provisionalRoot)
        })
        webContents.fromId(webContentsId)?.once('destroyed', () => {
          guestRootsByWebContentsId.delete(webContentsId)
        })
        callback({ cancel: false })
        return
      }

      callback({ cancel: true })
    }
  )
}

const resolveWindowBounds = (): {
  width: number
  height: number
  minWidth: number
  minHeight: number
  workArea: Size
} => {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const maxInitialWidth = Math.max(900, workArea.width - 72)
  const maxInitialHeight = Math.max(620, workArea.height - 88)
  const minWidth = Math.min(BASE_MIN_WIDTH, maxInitialWidth)
  const minHeight = Math.min(BASE_MIN_HEIGHT, maxInitialHeight)
  const width = Math.max(minWidth, Math.min(DEFAULT_WINDOW_WIDTH, maxInitialWidth))
  const height = Math.max(minHeight, Math.min(DEFAULT_WINDOW_HEIGHT, maxInitialHeight))

  return { width, height, minWidth, minHeight, workArea }
}

export type MainWindowOptions = {
  isShuttingDown(): boolean
  isTrayEnabled(): boolean
  onHideToTray(): void
  themeId?: UiThemeId
}

export function applyWindowUiTheme(window: BrowserWindow, value: unknown): UiThemeId {
  const themeId = normalizeUiThemeId(value)
  const chrome = UI_THEME_CHROME[themeId]
  activeUiThemeId = themeId
  nativeTheme.themeSource = chrome.colorScheme
  window.setBackgroundColor(chrome.backgroundColor)
  if (process.platform !== 'darwin') {
    window.setTitleBarOverlay({
      color: chrome.backgroundColor,
      symbolColor: chrome.symbolColor,
      height: TITLEBAR_HEIGHT
    })
  }
  return themeId
}

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const preloadPath = join(mainOutputDir, '../preload/index.cjs')
  const rendererRootPath = join(mainOutputDir, '../renderer')
  const resourcesRootPath = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources')
    : join(process.cwd(), 'resources')
  const windowBounds = resolveWindowBounds()
  const iconPath = join(mainOutputDir, '../../build/icons/512x512.png')
  const themeId = normalizeUiThemeId(options.themeId ?? activeUiThemeId)
  const themeChrome = UI_THEME_CHROME[themeId]

  if (isMac && existsSync(iconPath)) {
    try {
      app.dock?.setIcon(iconPath)
    } catch {
      // Ignore a platform-specific dock icon failure.
    }
  }

  const window = new BrowserWindow({
    title: APP_NAME,
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: windowBounds.minWidth,
    minHeight: windowBounds.minHeight,
    center: true,
    show: false,
    backgroundColor: themeChrome.backgroundColor,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 14, y: Math.round((TITLEBAR_HEIGHT - 14) / 2) }
        }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: themeChrome.backgroundColor,
            symbolColor: themeChrome.symbolColor,
            height: TITLEBAR_HEIGHT
          }
        }),
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: true
    }
  })
  applyWindowUiTheme(window, themeId)
  rendererRootsByWebContentsId.set(window.webContents.id, rendererRootPath)
  installLocalFileRequestPolicy(window.webContents.session, [resourcesRootPath])
  configureWindowMenu(window)

  window.on('close', (event) => {
    if (process.platform === 'win32' && options.isTrayEnabled() && !options.isShuttingDown()) {
      event.preventDefault()
      window.hide()
      options.onHideToTray()
    }
  })

  log.info('[app] creating window', {
    preloadPath,
    contextIsolation: true,
    sandbox: true,
    window: {
      width: windowBounds.width,
      height: windowBounds.height,
      minWidth: windowBounds.minWidth,
      minHeight: windowBounds.minHeight,
      workArea: windowBounds.workArea,
      titlebarHeight: TITLEBAR_HEIGHT,
      titleBarStyle: isMac ? 'hidden' : 'hidden+overlay'
    }
  })

  window.on('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler((details) => {
    if (isHttpUrl(details.url)) void shell.openExternal(details.url).catch(() => undefined)
    return { action: 'deny' }
  })

  const rendererOrigin = (() => {
    if (!is.dev || !process.env['ELECTRON_RENDERER_URL']) return undefined
    try {
      return new URL(process.env['ELECTRON_RENDERER_URL']).origin
    } catch {
      return undefined
    }
  })()
  const handleMainNavigation = (event: Electron.Event, url: string): void => {
    if (
      isAllowedMainWindowNavigation(url, {
        rendererOrigin,
        rendererRootPath
      })
    ) {
      return
    }
    event.preventDefault()
    if (isHttpUrl(url)) void shell.openExternal(url).catch(() => undefined)
  }
  window.webContents.on('will-navigate', handleMainNavigation)
  window.webContents.on('will-redirect', handleMainNavigation)

  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    // Guest pages must never inherit a renderer preload or Node privileges.
    webPreferences.preload = ''
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    webPreferences.allowRunningInsecureContent = false

    const source = typeof params.src === 'string' ? params.src : ''
    if (isAllowedWebViewSource(source)) return

    event.preventDefault()
    if (isHttpUrl(source)) void shell.openExternal(source).catch(() => undefined)
  })

  window.webContents.on('did-attach-webview', (_event, guestWebContents) => {
    const initialSource = guestWebContents.getURL()
    const guestRoot = resolveWebViewSourceRoot(initialSource)
    if (guestRoot) {
      guestRootsByWebContentsId.set(guestWebContents.id, {
        primary: guestRoot,
        companions: getLocalAssetCompanionRoots(guestRoot)
      })
    }
    const handleGuestNavigation = (event: Electron.Event, url: string): void => {
      if (isAllowedWebViewNavigation(url, initialSource)) return
      event.preventDefault()
      if (isHttpUrl(url)) void shell.openExternal(url).catch(() => undefined)
    }

    guestWebContents.on('will-navigate', handleGuestNavigation)
    guestWebContents.on('will-redirect', handleGuestNavigation)
    guestWebContents.on('will-frame-navigate', (details) => {
      if (isAllowedWebViewNavigation(details.url, initialSource)) return
      details.preventDefault()
      if (isHttpUrl(details.url)) void shell.openExternal(details.url).catch(() => undefined)
    })
    guestWebContents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) void shell.openExternal(url).catch(() => undefined)
      return { action: 'deny' }
    })

    const guestWebContentsId = guestWebContents.id
    const cleanup = (): void => {
      guestRootsByWebContentsId.delete(guestWebContentsId)
      if (guestWebContents.isDestroyed()) return
      guestWebContents.removeListener('will-navigate', handleGuestNavigation)
      guestWebContents.removeListener('will-redirect', handleGuestNavigation)
    }
    guestWebContents.once('destroyed', cleanup)
  })

  const mainWebContentsId = window.webContents.id
  window.webContents.once('destroyed', () => {
    // webContents.id is a native getter that throws once destroyed, so the id
    // must be captured while the contents are still alive.
    rendererRootsByWebContentsId.delete(mainWebContentsId)
  })

  const loadHome = (): void => {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const rendererUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
      if (process.env[ELECTRON_SMOKE_ENV] === '1') {
        rendererUrl.searchParams.set('electron-smoke', '1')
      }
      rendererUrl.hash = '/'
      void window.loadURL(rendererUrl.toString())
      return
    }
    void window.loadFile(join(mainOutputDir, '../renderer/index.html'), {
      hash: '/',
      query: process.env[ELECTRON_SMOKE_ENV] === '1' ? { 'electron-smoke': '1' } : undefined
    })
  }
  attachRendererCrashRecovery(window, { isShuttingDown: options.isShuttingDown, loadHome })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (process.env[ELECTRON_SMOKE_ENV] === '1') {
      rendererUrl.searchParams.set('electron-smoke', '1')
    }
    void window.loadURL(rendererUrl.toString())
  } else {
    void window.loadFile(join(mainOutputDir, '../renderer/index.html'), {
      query: process.env[ELECTRON_SMOKE_ENV] === '1' ? { 'electron-smoke': '1' } : undefined
    })
  }
  return window
}

export function showMainWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}
