export type GenerationFailureCode =
  | 'MODEL_RESPONSE_FORMAT'
  | 'MODEL_AUTH'
  | 'MODEL_RATE_LIMIT'
  | 'MODEL_TIMEOUT'
  | 'MODEL_CONNECTION'
  | 'PAGE_VALIDATION'
  | 'PAGE_WRITE'
  | 'STORAGE'
  | 'UNKNOWN'

export type GenerationFailureScope = 'page' | 'system'
export type GenerationFailureAction = 'retry-page' | 'pause-run' | 'stop-run'

export type GenerationFailureInfo = {
  code: GenerationFailureCode
  scope: GenerationFailureScope
  action: GenerationFailureAction
  retryable: boolean
  fingerprint: string
  titleZh: string
  detailZh: string
  technicalDetail: string
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Generation failed')

const fingerprintDetail = (message: string): string =>
  message
    .toLowerCase()
    .replace(/[a-f\d]{8}-[a-f\d-]{27,}/g, '<uuid>')
    .replace(/\b\d{3,}\b/g, '<number>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)

export function classifyGenerationError(error: unknown): GenerationFailureInfo {
  const technicalDetail = errorMessage(error)
  const normalized = technicalDetail.toLowerCase()
  let code: GenerationFailureCode = 'UNKNOWN'
  let scope: GenerationFailureScope = 'page'
  let action: GenerationFailureAction = 'retry-page'
  let retryable = true
  let titleZh = '页面生成失败'
  let detailZh = '当前页面未能生成，可单独重试该页面。'

  if (
    /undefined.*(?:map|reading ['"]map['"])|openai_responses_invalid_payload|response\.output|responses api.*(?:payload|format)/i.test(
      technicalDetail
    ) ||
    /invalid response from ['"]?wrapModelCall|expected AIMessage or Command/i.test(technicalDetail)
  ) {
    code = 'MODEL_RESPONSE_FORMAT'
    scope = 'system'
    action = 'pause-run'
    retryable = false
    titleZh = '模型响应格式异常'
    detailZh = '当前接口返回格式与 Provider 不兼容，已暂停后续页面生成。'
  } else if (
    /\b(?:401|403)\b|unauthorized|forbidden|invalid api key|authentication/i.test(normalized)
  ) {
    code = 'MODEL_AUTH'
    scope = 'system'
    action = 'pause-run'
    retryable = false
    titleZh = '模型鉴权失败'
    detailZh = 'API Key、接口地址或访问权限无效，已暂停后续页面生成。'
  } else if (/\b429\b|rate.?limit|too many requests|quota/i.test(normalized)) {
    code = 'MODEL_RATE_LIMIT'
    scope = 'system'
    action = 'pause-run'
    titleZh = '模型服务限流'
    detailZh = '模型服务暂时拒绝了请求，已暂停后续页面生成。'
  } else if (/timed?\s*out|timeout|aborterror.*time/i.test(normalized)) {
    code = 'MODEL_TIMEOUT'
    scope = 'system'
    action = 'pause-run'
    titleZh = '模型请求超时'
    detailZh = '模型服务长时间没有响应，已暂停后续页面生成。'
  } else if (
    /econnreset|econnrefused|enotfound|socket hang up|fetch failed|network error|broken pipe|epipe/i.test(
      normalized
    )
  ) {
    code = 'MODEL_CONNECTION'
    scope = 'system'
    action = 'pause-run'
    titleZh = '模型连接中断'
    detailZh = '应用与模型服务的连接已中断，已暂停后续页面生成。'
  } else if (
    /eacces|eperm|enospc|no space left|permission denied|read-only file system/i.test(normalized)
  ) {
    code = 'STORAGE'
    scope = 'system'
    action = 'stop-run'
    retryable = false
    titleZh = '文件存储失败'
    detailZh = '存储目录不可写或空间不足，已停止后续页面生成。'
  } else if (
    /质量校验未通过|浏览器渲染校验未通过|deck-level quality|harness-quality|rendered-quality|deck-quality|deck-(?:slide|font)-|render-(?:scale|text)-|font-below-floor|emoji-as-icon|padding-below-floor/i.test(
      normalized
    )
  ) {
    code = 'PAGE_VALIDATION'
    titleZh = '页面质量检查失败'
    detailZh = '当前页面未达到 PPT 可读性规则，可根据工具反馈修正后重试。'
  } else if (/落盘校验|不允许写入|未知页面|page write|write.*page/i.test(normalized)) {
    code = 'PAGE_WRITE'
    retryable = false
    titleZh = '页面写入失败'
    detailZh = '当前页面没有通过写入检查，可修正页面后单独重试。'
  } else if (
    /html.*(?:校验|验证|validation)|页面.*(?:校验|验证)|未闭合标签|缺少\s*<html>|占位内容|placeholder/i.test(
      normalized
    )
  ) {
    code = 'PAGE_VALIDATION'
    titleZh = '页面结构检查失败'
    detailZh = '当前页面内容不符合 PPT 页面结构规则，可自动修复或单独重试。'
  }

  return {
    code,
    scope,
    action,
    retryable,
    fingerprint: `${code}:${fingerprintDetail(technicalDetail)}`,
    titleZh,
    detailZh,
    technicalDetail
  }
}

export const isSystemGenerationFailure = (failure: GenerationFailureInfo): boolean =>
  failure.scope === 'system'
