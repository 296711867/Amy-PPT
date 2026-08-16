const REDACTED_VALUE = '[REDACTED]'

const normalizeCredentialKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '')

const normalizeScopeProvider = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

const normalizeScopeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

/**
 * Text model credentials are bound to the provider and endpoint they were created for.
 * Keep unknown provider values distinct from the runtime provider fallback so an invalid
 * renderer payload cannot inherit an OpenAI key by accident.
 */
export const buildTextCredentialScope = (provider: unknown, baseUrl: unknown): string =>
  JSON.stringify({
    provider: normalizeScopeProvider(provider),
    baseUrl: normalizeScopeString(baseUrl)
  })

const IMAGE_ROUTE_KEYS = new Set(['baseurl', 'endpoint'])

const normalizeRouteValue = (value: unknown): unknown => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(normalizeRouteValue)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizeRouteValue(item)])
  )
}

const collectImageRouteFields = (
  value: unknown,
  path: string[] = [],
  result: Array<{ path: string; value: unknown }> = []
): Array<{ path: string; value: unknown }> => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageRouteFields(item, [...path, String(index)], result))
    return result
  }
  if (!isRecord(value)) return result

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = normalizeCredentialKey(key)
    const nextPath = [...path, normalizedKey]
    if (IMAGE_ROUTE_KEYS.has(normalizedKey)) {
      result.push({ path: nextPath.join('.'), value: normalizeRouteValue(item) })
    }
    collectImageRouteFields(item, nextPath, result)
  }

  return result
}

/**
 * Image credentials are scoped by provider and every known routing field, including
 * nested fields such as httpOptions.baseUrl. The sorted path/value list is deterministic
 * and deliberately conservative when a route field is added, removed, or moved.
 */
export const buildImageCredentialScope = (provider: unknown, modelConfig: unknown): string =>
  JSON.stringify({
    provider: normalizeScopeProvider(provider),
    routes: collectImageRouteFields(modelConfig).sort((left, right) =>
      left.path.localeCompare(right.path)
    )
  })

export const isSensitiveCredentialKey = (key: string): boolean => {
  const normalized = normalizeCredentialKey(key)
  if (!normalized) return false

  return (
    normalized.includes('apikey') ||
    normalized.includes('secret') ||
    normalized.includes('accesskey') ||
    normalized.includes('authorization') ||
    normalized.includes('password') ||
    normalized.includes('credential') ||
    normalized.includes('privatekey') ||
    normalized.includes('signingkey') ||
    normalized === 'auth' ||
    normalized === 'token' ||
    normalized.endsWith('token')
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isHeadersKey = (key: string): boolean => normalizeCredentialKey(key) === 'headers'

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (!isRecord(value)) return value

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
}

/** Remove credential-shaped keys before a config crosses the renderer boundary. */
export const redactCredentials = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactCredentials)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitiveCredentialKey(key))
      .map(([key, item]) => [key, isHeadersKey(key) ? {} : redactCredentials(item)])
  )
}

const findMatchingKey = (
  record: Record<string, unknown>,
  key: string
): string | undefined => {
  const normalizedKey = normalizeCredentialKey(key)
  return Object.keys(record).find(
    (candidate) => normalizeCredentialKey(candidate) === normalizedKey
  )
}

const mergeCredentialRecords = (
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> => {
  // Ordinary fields must follow the edited payload exactly. Only credential-shaped
  // fields omitted by the payload are copied from the stored config.
  const merged = cloneValue(incoming) as Record<string, unknown>

  for (const [existingKey, existingValue] of Object.entries(existing)) {
    const incomingKey = findMatchingKey(incoming, existingKey)

    if (isHeadersKey(existingKey)) {
      if (!incomingKey) {
        merged[existingKey] = cloneValue(existingValue)
      } else {
        const incomingHeaders = merged[incomingKey]
        // The list API keeps the headers object shape but removes every value. Treat
        // an empty object as omitted credentials; a non-empty object replaces all
        // stored headers as one credential bundle.
        if (isRecord(incomingHeaders) && Object.keys(incomingHeaders).length === 0) {
          merged[incomingKey] = cloneValue(existingValue)
        }
      }
      continue
    }

    if (isSensitiveCredentialKey(existingKey)) {
      if (!incomingKey) merged[existingKey] = cloneValue(existingValue)
      continue
    }

    if (!incomingKey) continue

    const incomingValue = merged[incomingKey]
    if (isRecord(existingValue) && isRecord(incomingValue)) {
      // Nested objects receive the same sensitive-only treatment. Arrays are
      // intentionally replacement values and are never merged by index.
      merged[incomingKey] = mergeCredentialRecords(existingValue, incomingValue)
    }
  }

  return merged
}

/** Merge an edited config while preserving omitted credential fields. */
export const mergeCredentialConfig = (existing: unknown, incoming: unknown): unknown => {
  if (isRecord(existing) && isRecord(incoming)) {
    return mergeCredentialRecords(existing, incoming)
  }
  return cloneValue(incoming)
}

export const parseJsonRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const stringifyJsonRecord = (value: Record<string, unknown>): string => {
  return JSON.stringify(value, null, 2)
}

export const redactCredentialJson = (value: unknown): string => {
  const parsed = parseJsonRecord(value)
  if (!parsed) return '{}'
  return stringifyJsonRecord(redactCredentials(parsed) as Record<string, unknown>)
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Redact known secret values and common key/value forms in error text. */
export const redactSensitiveText = (value: unknown, secrets: unknown[] = []): string => {
  let text =
    value instanceof Error ? value.message : typeof value === 'string' ? value : String(value)

  for (const secret of secrets) {
    if (typeof secret !== 'string' || !secret) continue
    text = text.replace(new RegExp(escapeRegExp(secret), 'g'), REDACTED_VALUE)
  }

  const sensitiveKey =
    '(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?key(?:[_-]?id)?|authorization|password|token|credential)'
  const assignmentPattern = new RegExp(
    `(["']?${sensitiveKey}["']?\\s*[:=]\\s*["']?)([^"'\\s,}&]+)(["']?)`,
    'gi'
  )
  return text.replace(assignmentPattern, `$1${REDACTED_VALUE}$3`)
}
