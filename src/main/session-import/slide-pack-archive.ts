import { unzipSync } from 'fflate'

export const normalizeSlidePackArchivePath = (rawName: string): string | null => {
  const normalized = rawName.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.endsWith('/')) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0 || parts.some((part) => part === '..' || part === '.')) return null
  return parts.join('/')
}

export const tryReadSlidePackZip = (zipData: Uint8Array): Record<string, Uint8Array> | null => {
  try {
    return unzipSync(zipData)
  } catch {
    return null
  }
}

export const archiveHasRootIndexHtml = (zipData: Uint8Array): boolean => {
  const files = tryReadSlidePackZip(zipData)
  if (!files) return false
  return Object.keys(files).some((rawName) => {
    const relativePath = normalizeSlidePackArchivePath(rawName)
    return relativePath?.toLowerCase() === 'index.html'
  })
}

export const findSlidePackResourceZipInsideZip = (zipData: Uint8Array): Uint8Array | null => {
  const files = tryReadSlidePackZip(zipData)
  if (!files) return null
  const candidates = Object.entries(files)
    .map(([name, data]) => ({ name: normalizeSlidePackArchivePath(name), data }))
    .filter((entry): entry is { name: string; data: Uint8Array } => {
      if (!entry.name) return false
      return entry.name.toLowerCase().endsWith('.app/contents/resources/slides.zip')
    })
    .filter((entry) => archiveHasRootIndexHtml(entry.data))

  if (candidates.length !== 1) return null
  return candidates[0].data
}
