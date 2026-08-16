import path from 'path'
import { fileURLToPath } from 'url'
import {
  findDynamicAllowedLocalAssetRoot,
  isPathAllowedByDynamicRoot,
  normalizeExistingPath
} from '../io/local-asset-roots'

const HTTP_PROTOCOLS = new Set(['http:', 'https:'])

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function isHttpUrl(value: string): boolean {
  const parsed = parseUrl(value)
  return parsed ? HTTP_PROTOCOLS.has(parsed.protocol.toLowerCase()) : false
}

export function isLocalAssetUrl(value: string): boolean {
  const parsed = parseUrl(value)
  return parsed?.protocol.toLowerCase() === 'local-asset:'
}

export function isFileUrl(value: string): boolean {
  const parsed = parseUrl(value)
  return (
    parsed?.protocol.toLowerCase() === 'file:' &&
    (parsed.hostname === '' || parsed.hostname.toLowerCase() === 'localhost')
  )
}

export function localAssetPathFromUrl(value: string): string | null {
  if (!isLocalAssetUrl(value)) return null
  try {
    return decodeURIComponent(value.replace(/^local-asset:\/\//i, '').split(/[?#]/, 1)[0])
  } catch {
    return null
  }
}

export function isAllowedWebViewSource(value: string): boolean {
  if (!value.trim()) return true
  if (value.trim().toLowerCase() === 'about:blank') return true
  if (isLocalAssetUrl(value)) return Boolean(resolveWebViewSourceRoot(value))
  const filePath = isFileUrl(value) ? filePathFromUrl(value) : null
  return filePath ? isPathAllowedByDynamicRoot(filePath) : false
}

export function isPathInside(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function filePathFromUrl(value: string): string | null {
  const parsed = parseUrl(value)
  if (!parsed || parsed.protocol.toLowerCase() !== 'file:') return null
  try {
    return fileURLToPath(parsed)
  } catch {
    return null
  }
}

export function resolveWebViewSourceRoot(value: string): string | null {
  const filePath = isFileUrl(value)
    ? filePathFromUrl(value)
    : isLocalAssetUrl(value)
      ? localAssetPathFromUrl(value)
      : null
  return filePath ? findDynamicAllowedLocalAssetRoot(filePath) : null
}

export function resolveUnboundLocalMainFrameRoot(
  value: string,
  resourceType: string
): string | null {
  if (resourceType !== 'mainFrame' || !isAllowedWebViewSource(value)) return null
  return resolveWebViewSourceRoot(value)
}

export function isAllowedGuestLocalRequest(
  value: string,
  guestRoot: string,
  staticRoots: string[] = []
): boolean {
  const filePath = isFileUrl(value)
    ? filePathFromUrl(value)
    : isLocalAssetUrl(value)
      ? localAssetPathFromUrl(value)
      : null
  if (!filePath) return false
  const normalizedFile = normalizeExistingPath(filePath)
  return [guestRoot, ...staticRoots].some((root) =>
    isPathInside(normalizedFile, normalizeExistingPath(root))
  )
}

export function isAllowedMainRendererLocalRequest(
  value: string,
  rendererRoot: string,
  staticRoots: string[] = []
): boolean {
  if (isFileUrl(value)) return isAllowedGuestLocalRequest(value, rendererRoot)
  const localAssetPath = localAssetPathFromUrl(value)
  if (!localAssetPath) return false
  const normalizedFile = normalizeExistingPath(localAssetPath)
  return (
    isPathAllowedByDynamicRoot(normalizedFile) ||
    staticRoots.some((root) => isPathInside(normalizedFile, normalizeExistingPath(root)))
  )
}

export function isAllowedWebViewNavigation(value: string, initialSource = ''): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.toLowerCase() === 'about:blank') return true

  if (isLocalAssetUrl(trimmed)) {
    const initialRoot = resolveWebViewSourceRoot(initialSource)
    const targetPath = localAssetPathFromUrl(trimmed)
    return Boolean(
      initialRoot && targetPath && isPathInside(normalizeExistingPath(targetPath), initialRoot)
    )
  }

  const filePath = isFileUrl(trimmed) ? filePathFromUrl(trimmed) : null
  if (!filePath) return false
  if (!isPathAllowedByDynamicRoot(filePath)) return false
  const initialFilePath = isFileUrl(initialSource) ? filePathFromUrl(initialSource) : null
  if (!initialFilePath || !isPathAllowedByDynamicRoot(initialFilePath)) return false
  const initialRoot = path.dirname(normalizeExistingPath(initialFilePath))
  return isPathInside(normalizeExistingPath(filePath), initialRoot)
}

export function isAllowedMainWindowNavigation(
  value: string,
  options: { rendererOrigin?: string; rendererRootPath: string }
): boolean {
  const parsed = parseUrl(value)
  if (!parsed) return false
  const protocol = parsed.protocol.toLowerCase()
  if (protocol === 'file:' && isFileUrl(value)) {
    const filePath = filePathFromUrl(value)
    return filePath ? isPathInside(filePath, options.rendererRootPath) : false
  }
  if (!HTTP_PROTOCOLS.has(protocol) || !options.rendererOrigin) return false
  return parsed.origin === options.rendererOrigin
}
