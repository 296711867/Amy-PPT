import { describe, expect, it, vi } from 'vitest'
import {
  buildDeckNarrativeReviewPrompts,
  normalizeNarrativeReview,
  reviewDeckNarrativeWithLLM,
  selectNarrativeRepairPageIds
} from '../../../src/main/generation/deck-narrative-reviewer'
import type { NarrativePageSnapshot } from '../../../src/main/presentation/html/deck-narrative-validator'

const pages: NarrativePageSnapshot[] = [
  {
    pageId: 'page-1',
    pageNumber: 1,
    plannedTitle: 'Why this decision matters',
    renderedTitle: 'The current path is losing qualified demand',
    bodyText: 'The opening establishes the decision and the cost of delay.',
    textBlocks: [],
    layoutIntent: 'cover',
    hasVisualEvidence: true,
    hasQuantitativeEvidence: false
  },
  {
    pageId: 'page-2',
    pageNumber: 2,
    plannedTitle: 'Evidence',
    renderedTitle: 'Search converts twice as often as passive discovery',
    bodyText: 'Observed conversion data identifies where investment should move next.',
    textBlocks: [],
    layoutIntent: 'data-focus',
    hasVisualEvidence: true,
    hasQuantitativeEvidence: true
  }
]

describe('deck narrative LLM reviewer', () => {
  it('bounds repair work to two unique pages in deterministic-first order', () => {
    expect(
      selectNarrativeRepairPageIds({
        deterministicIssues: [
          {
            code: 'narrative-duplicate-title',
            severity: 'error',
            pageIds: ['page-2', 'page-3'],
            detail: 'duplicate',
            fix: 'differentiate'
          }
        ],
        semanticIssues: [
          {
            code: 'narrative-weak-close',
            severity: 'error',
            confidence: 0.95,
            pageIds: ['page-4'],
            detail: 'weak close',
            fix: 'resolve opening'
          }
        ]
      })
    ).toEqual(['page-2', 'page-3'])
  })

  it('keeps only valid page-bound issues and downgrades low-confidence errors', () => {
    const review = normalizeNarrativeReview(
      {
        issues: [
          {
            code: 'narrative-weak-opening',
            severity: 'error',
            confidence: 0.7,
            pageIds: ['page-1'],
            detail: 'The purpose is implied.',
            fix: 'State the audience decision.'
          },
          {
            code: 'narrative-missing-page',
            severity: 'error',
            confidence: 0.99,
            pageIds: ['page-99'],
            detail: 'Unknown page.',
            fix: 'Do something.'
          }
        ]
      },
      ['page-1', 'page-2']
    )

    expect(review.issues).toEqual([
      expect.objectContaining({
        code: 'narrative-weak-opening',
        severity: 'warn',
        pageIds: ['page-1']
      })
    ])
  })

  it('builds a bounded prompt from audience-facing deck facts', () => {
    const prompts = buildDeckNarrativeReviewPrompts({
      topic: 'Growth',
      deckTitle: 'Investment decision',
      userMessage: 'Recommend the next channel investment.',
      outlineItems: pages.map((page) => ({
        title: page.plannedTitle,
        contentOutline: page.bodyText,
        layoutIntent: page.layoutIntent
      })),
      pages
    })

    expect(prompts.system).toContain('read-only')
    expect(JSON.parse(prompts.user).pages[1]).toEqual(
      expect.objectContaining({ pageId: 'page-2', hasQuantitativeEvidence: true })
    )
  })

  it('parses a strict review response without exposing write tools', async () => {
    const invoke = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        issues: [
          {
            code: 'narrative-weak-close',
            severity: 'error',
            confidence: 0.93,
            pageIds: ['page-2'],
            detail: 'The ending does not resolve the opening decision.',
            fix: 'End with the recommended decision and next action.'
          }
        ]
      })
    })
    const review = await reviewDeckNarrativeWithLLM({
      provider: 'openai',
      apiKey: 'test',
      model: 'test',
      baseUrl: '',
      topic: 'Growth',
      deckTitle: 'Investment decision',
      userMessage: 'Recommend the next channel investment.',
      outlineItems: pages.map((page) => ({
        title: page.plannedTitle,
        contentOutline: page.bodyText,
        layoutIntent: page.layoutIntent
      })),
      pages,
      client: { invoke } as never
    })

    expect(review.available).toBe(true)
    expect(review.issues[0]).toEqual(expect.objectContaining({ severity: 'error' }))
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('degrades malformed model output instead of failing generation', async () => {
    const review = await reviewDeckNarrativeWithLLM({
      provider: 'openai',
      apiKey: 'test',
      model: 'test',
      baseUrl: '',
      topic: 'Growth',
      deckTitle: 'Investment decision',
      userMessage: 'Recommend the next channel investment.',
      outlineItems: [],
      pages,
      client: { invoke: vi.fn().mockResolvedValue({ content: 'not json' }) } as never
    })

    expect(review.available).toBe(false)
    expect(review.issues).toEqual([])
    expect(review.unavailableReason).toBeTruthy()
  })

  it('does not invoke the reviewer after the user has canceled the run', async () => {
    const controller = new AbortController()
    controller.abort()
    const invoke = vi.fn()
    const review = await reviewDeckNarrativeWithLLM({
      provider: 'openai',
      apiKey: 'test',
      model: 'test',
      baseUrl: '',
      topic: 'Growth',
      deckTitle: 'Investment decision',
      userMessage: 'Recommend the next channel investment.',
      outlineItems: [],
      pages,
      signal: controller.signal,
      client: { invoke } as never
    })

    expect(review.available).toBe(false)
    expect(review.unavailableReason).toContain('canceled')
    expect(invoke).not.toHaveBeenCalled()
  })
})
