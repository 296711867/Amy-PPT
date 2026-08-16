import fs from 'fs'
import path from 'path'

const dynamicAllowedRoots = new Set<string>()
const companionRootsByPrimaryRoot = new Map<string, Set<string>>()

const realpathSync = (filePath: string): string => {
  try {
    return fs.realpathSync.native(filePath)
  } catch {
    return fs.realpathSync(filePath)
  }
}

export const normalizeExistingPath = (filePath: string): string => {
  const resolved = path.resolve(filePath)
  let current = resolved
  const missingParts: string[] = []

  // Resolve the existing prefix as well as the final path. This prevents a
  // missing file below a symlink or junction from falling back to its lexical path.
  while (true) {
    try {
      const existingPath = realpathSync(current)
      return path.join(existingPath, ...missingParts.reverse())
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return resolved
      missingParts.push(path.basename(current))
      current = parent
    }
  }
}

export function allowLocalAssetRoot(rootPath: string): void {
  if (!rootPath.trim()) return
  dynamicAllowedRoots.add(normalizeExistingPath(rootPath))
}

export function revokeLocalAssetRoot(rootPath: string): void {
  if (!rootPath.trim()) return
  dynamicAllowedRoots.delete(normalizeExistingPath(rootPath))
}

export function revokeLocalAssetRootsUnder(rootPath: string): void {
  if (!rootPath.trim()) return
  const normalizedRoot = normalizeExistingPath(rootPath)
  for (const allowedRoot of dynamicAllowedRoots) {
    if (isPathInside(allowedRoot, normalizedRoot)) dynamicAllowedRoots.delete(allowedRoot)
  }
  for (const primaryRoot of companionRootsByPrimaryRoot.keys()) {
    if (isPathInside(primaryRoot, normalizedRoot)) companionRootsByPrimaryRoot.delete(primaryRoot)
  }
}

export function allowLocalAssetCompanionRoot(primaryRootPath: string, companionRootPath: string): void {
  if (!primaryRootPath.trim() || !companionRootPath.trim()) return
  const primaryRoot = normalizeExistingPath(primaryRootPath)
  const companionRoot = normalizeExistingPath(companionRootPath)
  const roots = companionRootsByPrimaryRoot.get(primaryRoot) || new Set<string>()
  roots.add(companionRoot)
  companionRootsByPrimaryRoot.set(primaryRoot, roots)
}

export function getLocalAssetCompanionRoots(primaryRootPath: string): string[] {
  if (!primaryRootPath.trim()) return []
  return [...(companionRootsByPrimaryRoot.get(normalizeExistingPath(primaryRootPath)) || [])]
}

export function getDynamicAllowedLocalAssetRoots(): string[] {
  return [...dynamicAllowedRoots]
}

const isPathInside = (targetPath: string, rootPath: string): boolean => {
  const comparableTarget = process.platform === 'win32' ? targetPath.toLowerCase() : targetPath
  const comparableRoot = process.platform === 'win32' ? rootPath.toLowerCase() : rootPath
  const relative = path.relative(comparableRoot, comparableTarget)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/** Check a file path against roots that were explicitly registered by the main process. */
export function isPathAllowedByDynamicRoot(filePath: string): boolean {
  if (!filePath.trim()) return false
  const normalizedFile = normalizeExistingPath(filePath)
  return getDynamicAllowedLocalAssetRoots().some((rootPath) =>
    isPathInside(normalizedFile, normalizeExistingPath(rootPath))
  )
}

export function findDynamicAllowedLocalAssetRoot(filePath: string): string | null {
  if (!filePath.trim()) return null
  const normalizedFile = normalizeExistingPath(filePath)
  return (
    getDynamicAllowedLocalAssetRoots()
      .map(normalizeExistingPath)
      .filter((rootPath) => isPathInside(normalizedFile, rootPath))
      .sort((left, right) => right.length - left.length)[0] || null
  )
}
