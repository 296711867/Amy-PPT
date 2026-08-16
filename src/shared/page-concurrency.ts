/**
 * 用户可选的页面生成并发偏好：
 * - auto：按页数自动（≥3 页双路并行），限流时运行中自动降级为逐页
 * - serial：始终逐页生成，适合限流严格的模型（如智谱 GLM 免费档）
 * - parallel：始终双页并行，速度优先
 */
export type PageConcurrencyPreference = 'auto' | 'serial' | 'parallel'

export const PAGE_CONCURRENCY_SETTING_KEY = 'page_concurrency'

export const PAGE_CONCURRENCY_PREFERENCES: readonly PageConcurrencyPreference[] = [
  'auto',
  'serial',
  'parallel'
]

export const DEFAULT_PAGE_CONCURRENCY_PREFERENCE: PageConcurrencyPreference = 'auto'

export function normalizePageConcurrencyPreference(value: unknown): PageConcurrencyPreference {
  return PAGE_CONCURRENCY_PREFERENCES.includes(value as PageConcurrencyPreference)
    ? (value as PageConcurrencyPreference)
    : DEFAULT_PAGE_CONCURRENCY_PREFERENCE
}

/** Resolve the initial worker count for a run before any adaptive downgrade. */
export function resolvePageWorkerCount(
  preference: PageConcurrencyPreference,
  totalPages: number
): 1 | 2 {
  if (preference === 'serial') return 1
  if (preference === 'parallel') return totalPages >= 2 ? 2 : 1
  return totalPages >= 3 ? 2 : 1
}
