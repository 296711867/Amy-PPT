import type { ThinkingActivity } from './thinking'

export function mergeThinkingActivity(
  activities: ThinkingActivity[],
  incoming: ThinkingActivity,
  limit = 12
): ThinkingActivity[] {
  const summary = incoming.summary.trim()
  if (!summary) return activities

  const index = activities.findIndex((activity) => activity.id === incoming.id)
  if (index >= 0) {
    const next = [...activities]
    next[index] = { ...next[index], ...incoming, summary }
    return next.slice(-limit)
  }

  return [...activities, { ...incoming, summary }].slice(-limit)
}

export function settleThinkingActivities(
  activities: ThinkingActivity[],
  status: 'completed' | 'failed'
): ThinkingActivity[] {
  return activities.map((activity) =>
    activity.status === 'running' || activity.status === 'retrying'
      ? { ...activity, status }
      : activity
  )
}
