import type { ThinkingStage } from '@shared/thinking'

export type ThinkingIntent =
  | 'restart'
  | 'plan_outline'
  | 'expand_draft'
  | 'refine'
  | 'confirm_ready'
  | 'collect_info'
  | 'small_chat'

export interface ThinkingIntentRoute {
  intent: ThinkingIntent
  requestedStage: ThinkingStage | null
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export function routeThinkingIntent(args: {
  userMessage: string
  currentStage?: ThinkingStage
}): ThinkingIntentRoute {
  const text = args.userMessage.trim()
  const lower = text.toLowerCase()

  if (/let's start over|start over|从头开始|重新开始/.test(lower)) {
    return route('restart', 'collect', 'high', 'User explicitly asked to restart.')
  }

  if (/可以了|生成吧|开始生成|确认生成|就按这个|ready|confirm|looks good/.test(lower)) {
    return route('confirm_ready', 'ready', 'high', 'User confirmed the current plan.')
  }

  if (
    /展开|细化|详细|继续写|完善.*细节|补充.*细节|丰富.*内容|内容.*丰富|丰富一下|深入.*展开|逐页写|写详细|完善一下|expand|detail|flesh out/.test(
      lower
    )
  ) {
    return route('expand_draft', 'draft', 'high', 'User asked to flesh out details.')
  }

  if (/refine|polish|tweak|优化|调整.*细节|润色/.test(lower)) {
    return route('refine', 'refine', 'high', 'User asked to refine or polish existing content.')
  }

  if (
    /adjust.*outline|change.*structure|大纲|拆页|规划|需要.*设计|设计吧|设计一下|出大纲|调整.*大纲|修改.*结构|可以[，,]?\s*规划一下|规划一下|开始吧/.test(
      lower
    )
  ) {
    return route('plan_outline', 'outline', 'high', 'User asked for outline or page planning.')
  }

  if (args.currentStage === 'collect') {
    return route('collect_info', null, 'medium', 'Collecting requirements before planning.')
  }

  return route('small_chat', null, 'low', 'No workflow transition intent detected.')
}

function route(
  intent: ThinkingIntent,
  requestedStage: ThinkingStage | null,
  confidence: ThinkingIntentRoute['confidence'],
  reason: string
): ThinkingIntentRoute {
  return {
    intent,
    requestedStage,
    confidence,
    reason
  }
}
