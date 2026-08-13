import type { ThinkingStage } from '@shared/thinking'
import { routeThinkingIntent } from './intent-router'

export const VALID_TRANSITIONS: Record<ThinkingStage, ThinkingStage[]> = {
  collect: ['collect', 'outline'],
  outline: ['collect', 'draft', 'ready'],
  draft: ['collect', 'outline', 'refine', 'ready'],
  refine: ['collect', 'outline', 'draft', 'ready'],
  ready: ['collect', 'outline']
}

export function checkStageTransition(
  currentStage: ThinkingStage,
  thinkingMd: string
): ThinkingStage {
  const pageCount = countPageHeadings(thinkingMd)
  const hasTopic = hasNonEmptySection(thinkingMd, 'Topic')

  if (currentStage === 'collect' && hasTopic && pageCount >= 2) {
    return 'outline'
  }

  return currentStage
}

export function detectStageFallback(userMessage: string): ThinkingStage | null {
  return routeThinkingIntent({ userMessage }).requestedStage
}

export function resolveRequestedStage(args: {
  currentStage: ThinkingStage
  requestedStage: ThinkingStage | null
  thinkingMd: string
}): ThinkingStage | null {
  if (!args.requestedStage) return null
  if (args.requestedStage === args.currentStage) return args.requestedStage
  if (!VALID_TRANSITIONS[args.currentStage].includes(args.requestedStage)) return null
  if (!hasThinkingContentForStage(args.requestedStage, args.thinkingMd)) return null

  return args.requestedStage
}

export function isValidTransition(from: ThinkingStage, to: ThinkingStage): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

function hasThinkingContentForStage(stage: ThinkingStage, thinkingMd: string): boolean {
  if (stage === 'collect') return true

  const pageCount = countPageHeadings(thinkingMd)
  const hasTopic = hasNonEmptySection(thinkingMd, 'Topic')
  if (stage === 'outline') return hasTopic && pageCount >= 2

  return hasTopic && hasCompletePagePlan(thinkingMd)
}

export function isRestartRequest(userMessage: string): boolean {
  return /let's start over|start over|从头开始|重新开始/i.test(userMessage)
}

function countPageHeadings(thinkingMd: string): number {
  const matches = thinkingMd.match(/^##\s*Page\s+\d+\s*:/gm)
  return matches ? matches.length : 0
}

function hasCompletePagePlan(thinkingMd: string): boolean {
  const pageSections = getPageSections(thinkingMd)
  return pageSections.length >= 2 && pageSections.every(hasCompletePageSection)
}

function getPageSections(thinkingMd: string): string[] {
  const headingRegex = /^##\s*Page\s+\d+\s*:/gm
  const headings = Array.from(thinkingMd.matchAll(headingRegex))
  return headings.map((heading, index) => {
    const start = heading.index || 0
    const next = headings[index + 1]
    const end = typeof next?.index === 'number' ? next.index : thinkingMd.length
    return thinkingMd.slice(start, end).trim()
  })
}

function hasCompletePageSection(pageSection: string): boolean {
  const hasTitle = /^##\s*Page\s+\d+\s*:\s*\S+/m.test(pageSection)
  const hasRole = /^-\s*Role:\s*\S+/mi.test(pageSection)
  const hasObjective = /^-\s*Objective:\s*\S+/mi.test(pageSection)
  const contentLines = pageSection
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^##\s*Page\s+\d+\s*:/i.test(line))
    .filter((line) => !/^-\s*(Role|Objective):/i.test(line))
  const hasSummary = contentLines.some((line) => !line.startsWith('- '))
  const hasKeyPoints = contentLines.some((line) => /^-\s+\S+/.test(line))

  return hasTitle && hasRole && hasObjective && hasSummary && hasKeyPoints
}

function hasNonEmptySection(markdown: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const inline = markdown.match(new RegExp(`^##\\s*${escaped}\\s*:\\s*(.+)`, 'm'))
  if (inline?.[1]?.trim()) return true
  const block = markdown.match(new RegExp(`^##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm'))
  return Boolean(block?.[1]?.trim())
}
