import type { SessionStyleSelection } from '@shared/generation'

export const AI_STYLE_MAX_DESCRIPTION_LENGTH = 2000
export const AI_STYLE_MAX_THEME_COLORS = 5

export const DEFAULT_AI_THEME_COLORS = ['#1d4ed8', '#f59e0b', '#111827'] as const

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export const normalizeAiStyleDescription = (value: string): string =>
  value.trim().slice(0, AI_STYLE_MAX_DESCRIPTION_LENGTH)

export const normalizeHexColor = (value: string): string | null => {
  const compact = value.trim()
  if (!HEX_COLOR_PATTERN.test(compact)) return null
  const hex = compact.slice(1).toLowerCase()
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : hex
  return `#${expanded}`
}

export const normalizeAiThemeColors = (values: readonly string[]): string[] =>
  Array.from(
    new Set(values.map(normalizeHexColor).filter((value): value is string => Boolean(value)))
  ).slice(0, AI_STYLE_MAX_THEME_COLORS)

export const buildSessionStyleSelection = (args: {
  mode: 'preset' | 'ai'
  styleId: string
  description: string
  themeColors: readonly string[]
}): SessionStyleSelection | null => {
  if (args.mode === 'preset') {
    const styleId = args.styleId.trim()
    return styleId ? { mode: 'preset', styleId } : null
  }

  const description = normalizeAiStyleDescription(args.description)
  const themeColors = normalizeAiThemeColors(args.themeColors)
  if (!description || themeColors.length === 0) return null
  return { mode: 'ai', description, themeColors }
}
