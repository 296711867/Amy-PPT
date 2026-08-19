import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { describe, expect, it } from 'vitest'
import { localAssetUrl } from '../../../src/shared/local-asset'
import {
  allowLocalAssetRoot,
  isPathAllowedByDynamicRoot,
  normalizeExistingPath
} from '../../../src/main/io/local-asset-roots'
import {
  isAllowedMainWindowNavigation,
  isAllowedGuestLocalRequest,
  isAllowedMainRendererLocalRequest,
  isAllowedWebViewNavigation,
  isAllowedWebViewSource,
  isFileUrl,
  isHttpUrl,
  isLocalAssetUrl,
  resolveUnboundLocalMainFrameRoot
} from '../../../src/main/app/web-security'

describe('Electron navigation security policy', () => {
  it('recognizes only http and https as external browser URLs', () => {
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('https://example.com/path')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isHttpUrl('file:///tmp/page.html')).toBe(false)
  })

  it('keeps local session files and local-asset URLs in WebViews', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-'))
    const pagePath = path.join(projectDir, 'page-1.html')
    const nextPagePath = path.join(projectDir, 'page-2.html')
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-outside-'))
    const outsidePath = path.join(outsideDir, 'page.html')
    fs.writeFileSync(pagePath, '<!doctype html>')
    fs.writeFileSync(nextPagePath, '<!doctype html>')
    fs.writeFileSync(outsidePath, '<!doctype html>')
    allowLocalAssetRoot(projectDir)
    const initialSource = pathToFileURL(pagePath).toString()
    const localAssetSource = localAssetUrl(pagePath)
    const localAssetNextPage = localAssetUrl(nextPagePath)

    expect(isFileUrl(initialSource)).toBe(true)
    expect(isLocalAssetUrl(localAssetSource)).toBe(true)
    expect(isAllowedWebViewSource(initialSource)).toBe(true)
    expect(
      isAllowedWebViewSource(pathToFileURL(path.join(projectDir, 'missing.html')).toString())
    ).toBe(true)
    expect(isAllowedWebViewSource(pathToFileURL(outsidePath).toString())).toBe(false)
    expect(isAllowedWebViewSource(localAssetSource)).toBe(true)
    expect(isAllowedWebViewSource('https://example.com')).toBe(false)
    expect(isAllowedWebViewSource('javascript:alert(1)')).toBe(false)
    expect(isAllowedWebViewNavigation(pathToFileURL(nextPagePath).toString(), initialSource)).toBe(true)
    expect(isAllowedWebViewNavigation(pathToFileURL(outsidePath).toString(), initialSource)).toBe(
      false
    )
    expect(isAllowedWebViewNavigation(localAssetNextPage, initialSource)).toBe(true)
    expect(isAllowedWebViewNavigation('https://example.com', initialSource)).toBe(false)
    expect(isAllowedGuestLocalRequest(pathToFileURL(nextPagePath).toString(), projectDir)).toBe(true)
    expect(isAllowedGuestLocalRequest(pathToFileURL(outsidePath).toString(), projectDir)).toBe(false)
    expect(isAllowedGuestLocalRequest(localAssetNextPage, projectDir)).toBe(true)
    expect(
      isAllowedMainRendererLocalRequest(localAssetNextPage, path.join(process.cwd(), 'renderer'))
    ).toBe(true)
  })

  it('does not let a guest use another registered project root', () => {
    const firstRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-first-'))
    const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-second-'))
    const firstPage = path.join(firstRoot, 'page.html')
    const secondAsset = path.join(secondRoot, 'secret.png')
    fs.writeFileSync(firstPage, '<!doctype html>')
    fs.writeFileSync(secondAsset, 'secret')
    allowLocalAssetRoot(firstRoot)
    allowLocalAssetRoot(secondRoot)

    expect(isAllowedWebViewSource(localAssetUrl(firstPage))).toBe(true)
    expect(isAllowedGuestLocalRequest(localAssetUrl(secondAsset), firstRoot)).toBe(false)
    expect(
      isAllowedMainRendererLocalRequest(
        localAssetUrl(secondAsset),
        path.join(process.cwd(), 'renderer')
      )
    ).toBe(true)
    expect(
      isAllowedWebViewNavigation(localAssetUrl(secondAsset), localAssetUrl(firstPage))
    ).toBe(false)
  })

  it('binds only an allowed unbound local main frame to its registered project root', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-hidden-render-'))
    const pagePath = path.join(projectDir, 'page.html')
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-hidden-outside-'))
    const outsidePath = path.join(outsideDir, 'page.html')
    fs.writeFileSync(pagePath, '<!doctype html>')
    fs.writeFileSync(outsidePath, '<!doctype html>')
    allowLocalAssetRoot(projectDir)

    expect(
      resolveUnboundLocalMainFrameRoot(pathToFileURL(pagePath).toString(), 'mainFrame')
    ).toBe(normalizeExistingPath(projectDir))
    expect(
      resolveUnboundLocalMainFrameRoot(pathToFileURL(pagePath).toString(), 'stylesheet')
    ).toBeNull()
    expect(
      resolveUnboundLocalMainFrameRoot(pathToFileURL(outsidePath).toString(), 'mainFrame')
    ).toBeNull()
  })

  it('resolves dynamic roots through symlinks and keeps missing paths scoped', () => {
    const allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-root-'))
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-target-'))
    const outsideFile = path.join(outsideRoot, 'outside.html')
    fs.writeFileSync(outsideFile, '<!doctype html>')
    const linkPath = path.join(allowedRoot, 'linked')
    try {
      fs.symlinkSync(outsideRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      return
    }

    allowLocalAssetRoot(allowedRoot)
    expect(isPathAllowedByDynamicRoot(path.join(linkPath, 'future.html'))).toBe(false)
    expect(isPathAllowedByDynamicRoot(outsideFile)).toBe(false)
    expect(isAllowedWebViewSource(pathToFileURL(path.join(linkPath, 'future.html')).toString())).toBe(
      false
    )
  })

  it('uses platform path semantics for registered dynamic roots', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-my-ppt-security-case-'))
    allowLocalAssetRoot(root)
    const caseVariantRoot = process.platform === 'win32' ? root.toUpperCase() : root
    expect(isPathAllowedByDynamicRoot(path.join(caseVariantRoot, 'missing.html'))).toBe(true)
    expect(isPathAllowedByDynamicRoot(`${root}-sibling/missing.html`)).toBe(false)
  })

  it('keeps the primary renderer sandboxed with isolated Node-disabled preferences', () => {
    const source = fs.readFileSync('src/main/app/window.ts', 'utf8')
    expect(source).toContain('sandbox: true')
    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
  })

  it('binds hidden render windows to their registered project root before loading assets', () => {
    const source = fs.readFileSync('src/main/app/window.ts', 'utf8')
    expect(source).toContain('resolveUnboundLocalMainFrameRoot(')
    expect(source).toContain('guestRootsByWebContentsId.set(webContentsId')
    expect(source).toContain('getLocalAssetCompanionRoots(provisionalRoot)')
    expect(source).toContain('callback({ cancel: true })')
  })

  it('allows only the renderer origin or packaged renderer files in the main window', () => {
    const rendererRootPath = path.join(process.cwd(), 'renderer')
    const rendererFile = pathToFileURL(path.join(rendererRootPath, 'index.html')).toString()
    const outsideFile = pathToFileURL(path.join(process.cwd(), 'outside.html')).toString()
    const options = { rendererOrigin: 'http://localhost:5173', rendererRootPath }

    expect(isAllowedMainWindowNavigation('http://localhost:5173/session/1', options)).toBe(true)
    expect(isAllowedMainWindowNavigation('https://localhost:5173/session/1', options)).toBe(false)
    expect(isAllowedMainWindowNavigation(rendererFile, options)).toBe(true)
    expect(isAllowedMainWindowNavigation(outsideFile, options)).toBe(false)
    expect(isAllowedMainWindowNavigation('javascript:alert(1)', options)).toBe(false)
  })

  it('uses a CommonJS preload with the sandboxed main renderer', () => {
    const windowSource = fs.readFileSync('src/main/app/window.ts', 'utf-8')
    const viteSource = fs.readFileSync('electron.vite.config.ts', 'utf-8')

    expect(windowSource).toContain("../preload/index.cjs")
    expect(windowSource).toContain('sandbox: true')
    expect(viteSource).toContain("format: 'cjs'")
    expect(viteSource).toContain("entryFileNames: '[name].cjs'")
  })
})
