import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import type { ModelRuntimeConfig } from '../agent-runtime/model'
import { extractJsonBlock, extractModelText, resolveModel } from '../agent-runtime/model'
import type {
  DeckNarrativeViolation,
  NarrativePageSnapshot
} from '../presentation/html/deck-narrative-validator'

export type NarrativeReviewIssue = DeckNarrativeViolation & {
  confidence: number
}

export type DeckNarrativeLLMReview = {
  available: boolean
  issues: NarrativeReviewIssue[]
  unavailableReason?: string
}

const MAX_REVIEW_ISSUES = 12
const MAX_ISSUE_PAGE_IDS = 3
const BLOCKING_CONFIDENCE = 0.85

export function selectNarrativeRepairPageIds(args: {
  deterministicIssues: DeckNarrativeViolation[]
  semanticIssues: NarrativeReviewIssue[]
  maxPages?: number
}): string[] {
  const maxPages = Math.max(0, Math.min(10, args.maxPages ?? 2))
  return Array.from(
    new Set(
      [...args.deterministicIssues, ...args.semanticIssues]
        .filter((issue) => issue.severity === 'error')
        .flatMap((issue) => issue.pageIds)
    )
  ).slice(0, maxPages)
}

const boundedText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text
}

const normalizeConfidence = (value: unknown): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(1, parsed))
}

export function normalizeNarrativeReview(
  value: unknown,
  allowedPageIds: readonly string[]
): DeckNarrativeLLMReview {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const rawIssues = Array.isArray(record.issues) ? record.issues : []
  const allowed = new Set(allowedPageIds)
  const issues: NarrativeReviewIssue[] = []

  for (const candidate of rawIssues.slice(0, MAX_REVIEW_ISSUES)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const issue = candidate as Record<string, unknown>
    const code = boundedText(issue.code, 80).toLowerCase()
    const detail = boundedText(issue.detail, 500)
    const fix = boundedText(issue.fix, 500)
    const confidence = normalizeConfidence(issue.confidence)
    const requestedSeverity = issue.severity === 'error' ? 'error' : 'warn'
    const severity =
      requestedSeverity === 'error' && confidence >= BLOCKING_CONFIDENCE ? 'error' : 'warn'
    const pageIds = Array.isArray(issue.pageIds)
      ? Array.from(
          new Set(
            issue.pageIds
              .map((pageId) => String(pageId ?? '').trim())
              .filter((pageId) => allowed.has(pageId))
          )
        ).slice(0, MAX_ISSUE_PAGE_IDS)
      : []
    if (!/^[a-z0-9][a-z0-9-]*$/.test(code) || !detail || !fix || pageIds.length === 0) continue
    issues.push({ code, severity, confidence, pageIds, detail, fix })
  }

  return { available: true, issues }
}

export function buildDeckNarrativeReviewPrompts(args: {
  topic: string
  deckTitle: string
  userMessage: string
  outlineItems: Array<{ title: string; contentOutline: string; layoutIntent?: string }>
  pages: NarrativePageSnapshot[]
}): { system: string; user: string } {
  const pagePayload = [...args.pages]
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((page, index) => ({
      pageId: page.pageId,
      pageNumber: page.pageNumber,
      plannedTitle: boundedText(page.plannedTitle || args.outlineItems[index]?.title, 180),
      plannedContent: boundedText(args.outlineItems[index]?.contentOutline, 600),
      renderedTitle: boundedText(page.renderedTitle, 180),
      bodyText: boundedText(page.bodyText, 1200),
      layoutIntent: page.layoutIntent || args.outlineItems[index]?.layoutIntent || 'concept',
      hasVisualEvidence: page.hasVisualEvidence,
      hasQuantitativeEvidence: page.hasQuantitativeEvidence
    }))
  const system = [
    'You are a read-only senior presentation narrative reviewer.',
    'Judge communication structure and audience-facing expression, not visual styling.',
    'Do not rewrite facts, invent evidence, question source truth, or request access to files.',
    'Check whether the opening establishes purpose or tension, each slide has one distinct narrative job, the sequence advances cumulatively, takeaway titles communicate claims, evidence is interpreted, and the ending resolves the opening with a conclusion or action.',
    'Use error only for a clear defect assigned to one or more specific pages. Use warn for subjective improvements or uncertain judgments.',
    'Set confidence from 0 to 1. Only use confidence >= 0.85 when the defect is explicit in the supplied text.',
    'Return exactly one raw JSON object with an issues array. No Markdown or commentary.',
    'Each issue must contain: code, severity (error or warn), confidence, pageIds, detail, fix.',
    'Use short kebab-case codes prefixed with narrative-. Return at most 12 issues.'
  ].join('\n')
  const user = JSON.stringify({
    communicationContext: {
      topic: boundedText(args.topic, 300),
      deckTitle: boundedText(args.deckTitle, 300),
      userRequest: boundedText(args.userMessage, 2000)
    },
    pages: pagePayload
  })
  return { system, user }
}

export async function reviewDeckNarrativeWithLLM(args: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  temperature?: number
  maxTokens?: number
  modelRuntime?: ModelRuntimeConfig
  modelTimeoutMs?: number
  signal?: AbortSignal
  topic: string
  deckTitle: string
  userMessage: string
  outlineItems: Array<{ title: string; contentOutline: string; layoutIntent?: string }>
  pages: NarrativePageSnapshot[]
  client?: Pick<BaseLanguageModel, 'invoke'>
}): Promise<DeckNarrativeLLMReview> {
  if (args.signal?.aborted) {
    return { available: false, issues: [], unavailableReason: 'Narrative review canceled' }
  }
  try {
    const client =
      args.client ||
      resolveModel(
        args.provider,
        args.apiKey,
        args.model,
        args.baseUrl,
        args.temperature,
        Math.min(args.maxTokens || 4096, 4096),
        args.modelRuntime
      )
    const prompts = buildDeckNarrativeReviewPrompts(args)
    const timeoutSignal = AbortSignal.timeout(Math.max(1_000, args.modelTimeoutMs || 90_000))
    const signal = args.signal ? AbortSignal.any([timeoutSignal, args.signal]) : timeoutSignal
    const response = await client.invoke(
      [
        { role: 'system' as const, content: prompts.system },
        { role: 'user' as const, content: prompts.user }
      ],
      { signal }
    )
    const raw = extractModelText(response)
    const parsed = JSON.parse(extractJsonBlock(raw))
    return normalizeNarrativeReview(
      parsed,
      args.pages.map((page) => page.pageId)
    )
  } catch (error) {
    return {
      available: false,
      issues: [],
      unavailableReason: boundedText(error instanceof Error ? error.message : error, 500)
    }
  }
}
