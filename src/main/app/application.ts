import { app, BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import log from 'electron-log/main.js'
import { AgentManager } from '../agent-runtime/agent'
import { PPTDatabase } from '../db/database'
import { configureHtmlThumbnailService } from '../io/thumbnails/html-thumbnail-service'
import { registerLocalAssetProtocol, setupIPC } from '../ipc'
import {
  initializeSkills,
  resolveBuiltinSkillsSourcePath,
  resolveInstalledSkillsPath,
  setSkillsRuntime
} from '../product-skills'
import {
  initializeStyles,
  resolveBundledStylesSourcePath,
  resolveInstalledStylesPath,
  setStylesRuntime,
  warmStyleThumbnails
} from '../styles'
import { backfillUserStylePackagesFromDatabase, setStyleDb } from '../styles/catalog'
import { applyProxy } from '../utils/proxy'
import { configureLogging, scheduleUpdateNotification } from './lifecycle'
import { createTray, destroyTray, showTrayHideBalloon } from './tray'
import { createMainWindow, showMainWindow } from './window'
import { normalizeUiThemeId, type UiThemeId } from '@shared/ui-theme'
import { APP_ID } from '@shared/brand'
import { resolveBrandDatabasePath } from './database-path'

/** Owns the main-process composition state; `index.ts` only wires Electron lifecycle events. */
export class MainApplication {
  private mainWindow: BrowserWindow | null = null
  private db: PPTDatabase | null = null
  private agentManager: AgentManager | null = null
  private isShuttingDown = false
  private isTrayEnabled = false
  private initialThemeId: UiThemeId | undefined

  focusMainWindow(): void {
    log.info('[app] second instance requested; focusing existing window')
    showMainWindow(this.mainWindow)
  }

  async start(): Promise<void> {
    configureLogging()
    electronApp.setAppUserModelId(APP_ID)

    const database = resolveBrandDatabasePath({
      isDev: is.dev,
      cwd: process.cwd(),
      userDataPath: app.getPath('userData')
    })
    this.db = new PPTDatabase(database.path)
    await this.db.init()
    configureHtmlThumbnailService(this.db)
    await this.db.failInterruptedThumbnailTasks()
    setStyleDb(this.db)
    log.info('[app] database initialized', {
      env: is.dev ? 'dev' : 'prod',
      dbPath: database.path,
      migratedFrom: database.migratedFrom || null
    })
    const savedSettings: Record<string, unknown> = await this.db.getAllSettings().catch(() => ({}))
    this.initialThemeId = normalizeUiThemeId(savedSettings.theme)

    const installedStylesPath = resolveInstalledStylesPath()
    const stylesReadyPromise = initializeStyles({
      bundledSourcePath: resolveBundledStylesSourcePath(),
      installedRootPath: installedStylesPath,
      logger: log
    })
      .then(async (result) => {
        await this.db?.syncInstalledStylesToDatabase(installedStylesPath)
        const userPackageBackfill = await backfillUserStylePackagesFromDatabase(installedStylesPath)
        const backfill = await this.db?.backfillSessionStyleSnapshots()
        log.info('[styles] initialized', {
          installedStylesPath,
          bundledCount: result.bundledCount,
          copiedCount: result.copiedCount,
          failedCount: result.failedCount,
          userPackageBackfill,
          snapshotBackfill: backfill
        })
        return result
      })
      .catch((error) => {
        log.warn('[styles] initialize failed', {
          message: error instanceof Error ? error.message : String(error)
        })
        throw error
      })
    setStylesRuntime({ installedStylesPath, ready: stylesReadyPromise })
    await stylesReadyPromise

    const installedSkillsPath = resolveInstalledSkillsPath()
    const skillsReadyPromise = initializeSkills({
      builtinSourcePath: resolveBuiltinSkillsSourcePath(),
      installedRootPath: installedSkillsPath,
      logger: log
    })
      .then((result) => {
        log.info('[skills] initialized', {
          installedSkillsPath,
          builtinCount: result.builtinCount,
          copiedCount: result.copiedCount,
          skippedCount: result.skippedCount,
          failedCount: result.failedCount
        })
        return result
      })
      .catch((error) => {
        log.warn('[skills] initialize failed', {
          message: error instanceof Error ? error.message : String(error)
        })
        return null
      })
    setSkillsRuntime({ installedSkillsPath, ready: skillsReadyPromise })

    this.agentManager = new AgentManager()
    const window = this.createWindow()
    window.webContents.on('did-finish-load', () => {
      void stylesReadyPromise
        .then(() => this.db?.listStyleRows() || [])
        .then((styles) => warmStyleThumbnails(installedStylesPath, styles))
        .catch((error) => {
          log.warn('[styles] thumbnail warmup failed', {
            message: error instanceof Error ? error.message : String(error)
          })
        })
    })

    if (process.platform === 'win32') {
      this.isTrayEnabled = createTray(window)
    }

    registerLocalAssetProtocol()
    setupIPC(window, this.db, this.agentManager)
    scheduleUpdateNotification(window)

    try {
      if (typeof savedSettings.proxy_url === 'string' && savedSettings.proxy_url.trim()) {
        applyProxy(savedSettings.proxy_url.trim())
      }
    } catch (proxyError) {
      log.warn('[app] failed to apply saved proxy', {
        message: proxyError instanceof Error ? proxyError.message : String(proxyError)
      })
    }

    app.on('browser-window-created', (_, createdWindow) => {
      optimizer.watchWindowShortcuts(createdWindow)
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow()
    })
  }

  handleWindowAllClosed(): void {
    if (process.platform === 'darwin') return
    if (!this.isTrayEnabled) app.quit()
  }

  handleBeforeQuit(): void {
    if (this.isShuttingDown) return
    this.isShuttingDown = true
    destroyTray()
    if (this.db) {
      void this.db.close().catch((error) => {
        log.warn('[app] failed to close database on before-quit', {
          message: error instanceof Error ? error.message : String(error)
        })
      })
    }
  }

  private createWindow(): BrowserWindow {
    const themeId = this.initialThemeId
    this.initialThemeId = undefined
    const window = createMainWindow({
      isShuttingDown: () => this.isShuttingDown,
      isTrayEnabled: () => this.isTrayEnabled,
      onHideToTray: showTrayHideBalloon,
      themeId
    })
    this.mainWindow = window
    return window
  }
}
