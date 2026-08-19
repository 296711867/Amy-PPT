const formatCompactTokenValue = (value: number, divisor: number, suffix: string): string => {
  const rounded = Math.round((value / divisor) * 10) / 10
  return `${String(rounded).replace(/\.0$/, '')}${suffix}`
}

/** Formats a session's persisted token total without hiding unknown historical usage. */
export const formatSessionTokenCount = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'

  const normalized = Math.max(0, Math.floor(value))
  if (normalized >= 1_000_000) {
    return formatCompactTokenValue(normalized, 1_000_000, 'M')
  }

  if (normalized >= 1_000) {
    const compact = formatCompactTokenValue(normalized, 1_000, 'K')
    return compact === '1000K' ? formatCompactTokenValue(normalized, 1_000_000, 'M') : compact
  }

  return normalized.toLocaleString()
}
