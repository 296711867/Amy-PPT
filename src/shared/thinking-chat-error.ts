import type { ThinkingChatErrorKind, ThinkingChatFailure } from './thinking'

const ERROR_MARKER = /\[THINKING_CHAT_ERROR:([a-z-]+)\]/i

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error || '').trim()
}

function isKind(value: string): value is ThinkingChatErrorKind {
  return [
    'connection',
    'response-format',
    'authentication',
    'rate-limit',
    'timeout',
    'unknown'
  ].includes(value)
}

export function classifyThinkingChatError(error: unknown): ThinkingChatErrorKind {
  const message = getErrorText(error)
  const markedKind = message.match(ERROR_MARKER)?.[1]?.toLowerCase() || ''
  if (isKind(markedKind)) return markedKind
  if (
    /Cannot read propert(?:y|ies).*undefined.*map|Cannot read propert(?:y|ies).*map.*undefined/i.test(
      message
    )
  ) {
    return 'response-format'
  }
  if (/401|403|unauthori[sz]ed|forbidden|invalid api.?key|authentication/i.test(message)) {
    return 'authentication'
  }
  if (/429|rate.?limit|too many requests|quota/i.test(message)) return 'rate-limit'
  if (/timeout|timed out|aborterror|signal timed out/i.test(message)) return 'timeout'
  if (
    /fetch failed|network|econn(?:reset|refused|aborted)|enotfound|socket|broken pipe|epipe|disconnected/i.test(
      message
    )
  ) {
    return 'connection'
  }
  return 'unknown'
}

export function normalizeThinkingChatFailure(
  error: unknown,
  locale: 'zh' | 'en' = 'zh'
): ThinkingChatFailure {
  const kind = classifyThinkingChatError(error)
  const technicalDetail = getErrorText(error).replace(ERROR_MARKER, '').trim().slice(0, 1200)
  const zhMessages: Record<ThinkingChatErrorKind, string> = {
    connection: '模型服务连接已中断。请检查网络或服务地址，然后重新连接。',
    'response-format':
      '模型接口返回格式与当前 Provider 不匹配。Responses API 请选择 OpenAI Responses；Chat Completions 接口请选择 OpenAI / 兼容。',
    authentication: '模型服务拒绝了身份验证。请检查 API Key 和模型配置。',
    'rate-limit': '模型服务当前请求过多或额度不足，请稍后重试。',
    timeout: '模型响应超时。可以重试，或在高级设置中适当延长 Agent 超时时间。',
    unknown: 'LLM 回复失败，本次请求没有完成。'
  }
  const enMessages: Record<ThinkingChatErrorKind, string> = {
    connection: 'The model connection was interrupted. Check the network or service URL, then reconnect.',
    'response-format':
      'The model response does not match the selected provider. Use OpenAI Responses for a Responses API, or OpenAI / compatible for Chat Completions.',
    authentication: 'The model service rejected authentication. Check the API key and model configuration.',
    'rate-limit': 'The model service is rate limited or out of quota. Try again later.',
    timeout: 'The model response timed out. Retry or increase the Agent timeout in Advanced Settings.',
    unknown: 'The LLM reply failed and this request did not complete.'
  }

  return {
    kind,
    message: (locale === 'en' ? enMessages : zhMessages)[kind],
    technicalDetail,
    reconnectable: kind === 'connection' || kind === 'timeout' || kind === 'unknown'
  }
}

export function createThinkingChatIpcError(error: unknown): Error {
  const failure = normalizeThinkingChatFailure(error, 'zh')
  return new Error(
    `[THINKING_CHAT_ERROR:${failure.kind}] ${failure.message}\n${failure.technicalDetail}`.trim()
  )
}
