export type FontFileFormat = 'woff2' | 'truetype' | 'opentype'

export const normalizeFontFileFormat = (
  value: unknown,
  fileName: string
): FontFileFormat => {
  if (value === 'woff2' || value === 'truetype' || value === 'opentype') return value
  const normalized = fileName.trim().toLowerCase()
  if (normalized.endsWith('.ttf')) return 'truetype'
  if (normalized.endsWith('.otf')) return 'opentype'
  return 'woff2'
}
