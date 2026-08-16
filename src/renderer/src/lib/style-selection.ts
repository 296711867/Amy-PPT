export interface StyleSelectionOption {
  id: string
  styleKey?: string | null
}

const DEFAULT_STYLE_KEY = 'minimal-white'

const normalizeStyleKey = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() || ''

export function findStableDefaultStyleId(
  options: readonly StyleSelectionOption[]
): string {
  const byStyleKey = options.find(
    (option) => normalizeStyleKey(option.styleKey) === DEFAULT_STYLE_KEY && option.id.trim()
  )
  if (byStyleKey) return byStyleKey.id

  const byId = options.find(
    (option) => normalizeStyleKey(option.id) === DEFAULT_STYLE_KEY && option.id.trim()
  )
  return byId?.id || ''
}

export function resolveStyleIdOrStableDefault(
  styleId: string | null | undefined,
  options: readonly StyleSelectionOption[]
): string {
  const explicitStyleId = styleId?.trim() || ''
  return explicitStyleId || findStableDefaultStyleId(options)
}
