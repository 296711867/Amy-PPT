/**
 * Rate limiting is a transient failure: retry the page with a long backoff
 * before letting the circuit breaker pause the whole run. A shared cooldown
 * timestamp keeps parallel workers from retrying into the same 429 window.
 */
export const MAX_RATE_LIMIT_RETRIES = 2
export const RATE_LIMIT_RETRY_DELAYS_MS: readonly number[] = [15_000, 30_000]
export const RATE_LIMIT_JITTER_MAX_MS = 4_000
const RATE_LIMIT_MIN_WAIT_MS = 1_000

export type RateLimitBackoff = {
  /** 1-based rate-limit retry attempt this backoff belongs to. */
  attempt: number
  /** How long the calling page should wait before its next attempt. */
  waitMs: number
  /** New value for the shared cooldown clock (monotonic across workers). */
  cooldownUntil: number
}

export const resolveRateLimitBackoff = (args: {
  attemptsAlreadyUsed: number
  cooldownUntil: number
  nowMs: number
  random: () => number
}): RateLimitBackoff | null => {
  const attempt = args.attemptsAlreadyUsed + 1
  if (attempt > MAX_RATE_LIMIT_RETRIES) return null

  const baseDelayMs =
    RATE_LIMIT_RETRY_DELAYS_MS[Math.min(attempt, RATE_LIMIT_RETRY_DELAYS_MS.length) - 1]
  const cooldownUntil = Math.max(args.cooldownUntil, args.nowMs + baseDelayMs)
  const jitterMs = Math.floor(args.random() * RATE_LIMIT_JITTER_MAX_MS)
  const waitMs = Math.max(RATE_LIMIT_MIN_WAIT_MS, cooldownUntil - args.nowMs + jitterMs)

  return { attempt, waitMs, cooldownUntil }
}
