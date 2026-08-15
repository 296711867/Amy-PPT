export const extractModelText = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const content = 'content' in value ? (value as { content?: unknown }).content : undefined
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          return typeof (item as { text?: unknown }).text === 'string'
            ? String((item as { text?: unknown }).text)
            : ''
        }
        return ''
      })
      .join('\n')
      .trim()
  }
  return ''
}

export type ModelResponseDiagnostics = {
  finishReason: string
  outputTokens: number | null
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const readNumber = (record: Record<string, unknown> | null, keys: string[]): number | null => {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  }
  return null
}

export const readModelResponseDiagnostics = (value: unknown): ModelResponseDiagnostics => {
  const response = asRecord(value)
  const responseMetadata = asRecord(response?.response_metadata)
  const usageMetadata = asRecord(response?.usage_metadata)
  const tokenUsage = asRecord(responseMetadata?.tokenUsage)
  const finishReason = String(
    responseMetadata?.finish_reason ?? responseMetadata?.finishReason ?? response?.finish_reason ?? ''
  ).trim()
  const outputTokens =
    readNumber(usageMetadata, ['output_tokens', 'outputTokens']) ??
    readNumber(tokenUsage, ['completionTokens', 'output_tokens', 'outputTokens'])

  return { finishReason, outputTokens }
}

export const assertModelText = (
  value: unknown,
  options: { maxTokens?: number; locale?: 'zh' | 'en' } = {}
): string => {
  const text = extractModelText(value).trim()
  if (text) return text

  const diagnostics = readModelResponseDiagnostics(value)
  const exhaustedBudget =
    diagnostics.finishReason.toLowerCase() === 'length' ||
    (typeof options.maxTokens === 'number' &&
      diagnostics.outputTokens !== null &&
      diagnostics.outputTokens >= options.maxTokens)
  if (options.locale === 'en') {
    throw new Error(
      exhaustedBudget
        ? `The model used the full ${diagnostics.outputTokens ?? options.maxTokens} output-token budget but returned no visible text. Disable deep thinking for structured JSON generation or increase max tokens.`
        : 'The model returned an empty response with no visible text. Check the provider protocol and model compatibility.'
    )
  }
  throw new Error(
    exhaustedBudget
      ? `模型已耗尽 ${diagnostics.outputTokens ?? options.maxTokens} 个输出 token，但没有返回可见文本。请关闭结构化 JSON 生成中的深度思考，或提高最大输出 token。`
      : '模型返回了空响应，没有可见文本。请检查 Provider 协议与模型兼容性。'
  )
}

export const extractJsonBlock = (raw: string): string => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const extractBalanced = (
    start: number,
    open: '{' | '[',
    close: '}' | ']'
  ): string | null => {
    let depth = 0
    let inString = false
    let escaped = false

    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }
      if (char === '"') {
        inString = true
        continue
      }
      if (char === open) depth += 1
      if (char === close) {
        depth -= 1
        if (depth === 0) return raw.slice(start, index + 1)
      }
    }
    return null
  }

  for (let start = 0; start < raw.length; start += 1) {
    const char = raw[start]
    const block =
      char === '{'
        ? extractBalanced(start, '{', '}')
        : char === '['
          ? extractBalanced(start, '[', ']')
          : null
    if (!block) continue
    try {
      JSON.parse(block)
      return block.trim()
    } catch {
      // This can be a prose bracket or malformed model output; keep scanning.
    }
  }
  return raw.trim()
}
