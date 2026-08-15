import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'
import { localAssetUrl } from '@shared/local-asset'
import {
  AVAILABLE_GOOGLE_FONTS,
  getAvailableSystemFonts,
  assertFontFamilyNameAvailableForUpload,
  cssEscapeString,
  getBundledFontsRoot,
  getUserFontFilesRoot,
  getUserFontsRoot,
  readUserFontRegistry,
  normalizeFontFileFormat,
  writeUserFontRegistry,
  type FontRole,
  type FontScript,
  type FontRegistryEntry
} from './font-registry'
import { deleteFontScheme, listFontSchemes, saveFontScheme } from './font-scheme-store'

const MAX_FONT_FILE_SIZE_BYTES = 20 * 1024 * 1024
const SUPPORTED_FONT_EXTENSIONS = new Set(['.woff2', '.ttf', '.otf'])

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const sanitizeFileName = (value: string): string => {
  const base = path.basename(value).trim() || 'font.woff2'
  const extension = path.extname(base).toLowerCase()
  const stem = path.basename(base, extension).replace(/[^\p{L}\p{N}_.-]+/gu, '-').replace(/-+/g, '-')
  return `${stem || 'font'}${extension}`
}

const normalizeRoles = (value: unknown): FontRole[] => {
  const items = Array.isArray(value) ? value : []
  const roles = items.filter(
    (item): item is FontRole => item === 'title' || item === 'subtitle' || item === 'body'
  )
  return roles.length > 0 ? Array.from(new Set(roles)) : ['title', 'subtitle', 'body']
}

const normalizeScripts = (value: unknown): FontScript[] => {
  const items = Array.isArray(value) ? value : []
  const scripts = items.filter((item): item is FontScript => item === 'latin' || item === 'cjk')
  return Array.from(new Set(scripts))
}

const sha256File = async (filePath: string): Promise<string> => {
  const hash = crypto.createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return hash.digest('hex')
}

const parseUploadPayload = (payload: unknown): {
  family: string
  category: string
  role: FontRole[]
  scripts: FontScript[]
  files: Array<{ path: string; weight: number; style: 'normal' | 'italic' }>
} => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const family = String(record.family || '').replace(/\s+/g, ' ').trim()
  if (!family) throw new Error('字体族名称不能为空')
  const files = Array.isArray(record.files) ? record.files : []
  const parsedFiles = files
    .map((item): { path: string; weight: number; style: 'normal' | 'italic' } | null => {
      const fileRecord = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const filePath = typeof fileRecord.path === 'string' ? fileRecord.path.trim() : ''
      if (!filePath) return null
      const weight = Number(fileRecord.weight)
      return {
        path: filePath,
        weight: Number.isFinite(weight) ? Math.max(1, Math.floor(weight)) : 400,
        style: fileRecord.style === 'italic' ? 'italic' : 'normal'
      }
    })
    .filter((item): item is { path: string; weight: number; style: 'normal' | 'italic' } =>
      Boolean(item)
    )
  if (parsedFiles.length === 0) throw new Error('请至少选择一个字体文件')
  const scripts = normalizeScripts(record.scripts)
  if (scripts.length === 0) throw new Error('请选择适用文字')
  return {
    family,
    category: String(record.category || 'brand').trim() || 'brand',
    role: normalizeRoles(record.role),
    scripts,
    files: parsedFiles
  }
}

export function registerFontHandlers(): void {
  ipcMain.handle('fonts:list', async () => {
    const registry = await readUserFontRegistry()
    return {
      googleFonts: Object.values(AVAILABLE_GOOGLE_FONTS).map((font) => ({
        id: font.id,
        family: font.family,
        source: 'google',
        category: font.category,
        role: font.role,
        scripts: font.scripts
      })),
      systemFonts: getAvailableSystemFonts().map((font) => ({
        id: font.id,
        family: font.family,
        source: 'system',
        category: font.category,
        role: font.role,
        scripts: font.scripts
      })),
      userFonts: registry.fonts
    }
  })

  ipcMain.handle('fonts:upload', async (_event, payload: unknown) => {
    const parsed = parseUploadPayload(payload)
    await assertFontFamilyNameAvailableForUpload(parsed.family)
    const registry = await readUserFontRegistry()
    const fontId = `font_${nanoid(10)}`
    const targetDir = path.join(getUserFontFilesRoot(), fontId)
    await fs.promises.mkdir(targetDir, { recursive: true })

    const copiedFiles: FontRegistryEntry['files'] = []
    for (const file of parsed.files) {
      const sourcePath = path.resolve(file.path)
      const stat = await fs.promises.stat(sourcePath)
      if (!stat.isFile()) throw new Error(`不是有效字体文件：${path.basename(sourcePath)}`)
      if (stat.size > MAX_FONT_FILE_SIZE_BYTES) {
        throw new Error(`字体文件过大：${path.basename(sourcePath)}，单文件上限 20MB`)
      }
      const ext = path.extname(sourcePath).toLowerCase()
      if (!SUPPORTED_FONT_EXTENSIONS.has(ext)) {
        if (ext === '.ttc') {
          throw new Error('暂不支持直接上传 TTC 字体集合；可使用已安装的系统字体，或拆分为 TTF/OTF 后上传')
        }
        throw new Error(`暂不支持的字体格式：${ext || 'unknown'}，支持 .woff2、.ttf、.otf`)
      }
      const safeName = sanitizeFileName(sourcePath)
      const targetPath = path.join(targetDir, safeName)
      await fs.promises.copyFile(sourcePath, targetPath)
      copiedFiles.push({
        file: safeName,
        weight: file.weight,
        style: file.style,
        format: normalizeFontFileFormat(undefined, safeName),
        size: stat.size,
        sha256: await sha256File(targetPath)
      })
    }

    const now = nowSeconds()
    const font: FontRegistryEntry = {
      id: fontId,
      family: parsed.family,
      source: 'uploaded',
      category: parsed.category,
      role: parsed.role,
      scripts: parsed.scripts,
      createdAt: now,
      updatedAt: now,
      files: copiedFiles
    }
    registry.fonts.push(font)
    await writeUserFontRegistry(registry)
    return { success: true, font }
  })

  ipcMain.handle('fonts:update', async (_event, payload: unknown) => {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const fontId = typeof record.id === 'string' ? record.id.trim() : ''
    if (!fontId) throw new Error('fontId 不能为空')
    const registry = await readUserFontRegistry()
    const index = registry.fonts.findIndex((font) => font.id === fontId)
    if (index < 0) throw new Error('字体不存在')
    const current = registry.fonts[index]
    const family =
      typeof record.family === 'string' && record.family.trim()
        ? record.family.replace(/\s+/g, ' ').trim()
        : current.family
    await assertFontFamilyNameAvailableForUpload(family, fontId)
    const updated: FontRegistryEntry = {
      ...current,
      family,
      category:
        typeof record.category === 'string' && record.category.trim()
          ? record.category.trim()
          : current.category,
      role: record.role === undefined ? current.role : normalizeRoles(record.role),
      scripts: record.scripts === undefined ? current.scripts : normalizeScripts(record.scripts),
      updatedAt: nowSeconds()
    }
    registry.fonts[index] = updated
    await writeUserFontRegistry(registry)
    return { success: true, font: updated }
  })

  ipcMain.handle('fonts:delete', async (_event, fontId: unknown) => {
    const id = typeof fontId === 'string' ? fontId.trim() : ''
    if (!id) throw new Error('fontId 不能为空')
    const registry = await readUserFontRegistry()
    const nextFonts = registry.fonts.filter((font) => font.id !== id)
    if (nextFonts.length === registry.fonts.length) throw new Error('字体不存在')
    await writeUserFontRegistry({ version: 1, fonts: nextFonts })
    await fs.promises.rm(path.join(getUserFontFilesRoot(), id), { recursive: true, force: true })
    return { success: true }
  })

  ipcMain.handle('fonts:revealFolder', async () => {
    const dir = getUserFontsRoot()
    await fs.promises.mkdir(dir, { recursive: true })
    await shell.openPath(dir)
    return { success: true }
  })

  ipcMain.handle('fonts:chooseFiles', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择字体文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Fonts', extensions: ['woff2', 'ttf', 'otf'] }]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return { canceled: result.canceled, filePaths: result.filePaths }
  })

  ipcMain.handle('fonts:previewCss', async () => {
    const cssBlocks: string[] = []
    const dirName = (family: string) => family.replace(/ /g, '_')

    // Google fonts: read faces.css, rewrite url("./...") to local-asset://
    const bundledRoot = getBundledFontsRoot()
    for (const font of Object.values(AVAILABLE_GOOGLE_FONTS)) {
      const facesCssPath = path.join(bundledRoot, dirName(font.family), 'faces.css')
      try {
        const raw = await fs.promises.readFile(facesCssPath, 'utf-8')
        const fontDir = path.join(bundledRoot, dirName(font.family))
        // Rewrite url("./xxx.woff2") to a local-asset URL.
        const rewritten = raw.replace(
          /url\(\s*"\.\/([^"]+)"\s*\)/g,
          (_, fileName) => `url("${localAssetUrl(path.join(fontDir, fileName))}")`
        )
        cssBlocks.push(rewritten)
      } catch {
        // Skip fonts whose files aren't available yet
      }
    }

    // User-uploaded fonts: generate @font-face with local-asset:// URLs
    const registry = await readUserFontRegistry()
    for (const entry of registry.fonts) {
      const fontDir = path.join(getUserFontFilesRoot(), entry.id)
      for (const file of entry.files) {
        const fileUrl = localAssetUrl(path.join(fontDir, file.file))
        cssBlocks.push(
          `@font-face{font-family:"${cssEscapeString(entry.family)}";src:url("${cssEscapeString(fileUrl)}") format("${normalizeFontFileFormat(file.format, file.file)}");font-weight:${file.weight};font-style:${file.style};font-display:swap}`
        )
      }
    }

    return cssBlocks.join('\n')
  })

  ipcMain.handle('fonts:listSchemes', async () => ({ items: await listFontSchemes() }))

  ipcMain.handle('fonts:saveScheme', async (_event, payload: unknown) => ({
    success: true,
    scheme: await saveFontScheme(payload)
  }))

  ipcMain.handle('fonts:deleteScheme', async (_event, schemeId: unknown) => {
    const id = typeof schemeId === 'string' ? schemeId.trim() : ''
    if (!id) throw new Error('字体组合 ID 不能为空')
    await deleteFontScheme(id)
    return { success: true }
  })
}
