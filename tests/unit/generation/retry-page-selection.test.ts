import { describe, expect, it } from 'vitest'
import { selectRetrySessionPages } from '../../../src/main/generation/retry-page-selection'

const sessionPage = (args: {
  id: string
  slug: string
  pageNumber: number
  updatedAt: number
}) =>
  ({
    id: args.id,
    file_slug: args.slug,
    page_number: args.pageNumber,
    updated_at: args.updatedAt,
    created_at: args.updatedAt
  }) as never

describe('selectRetrySessionPages', () => {
  it('prefers the requested failed-run record only among duplicate page numbers', () => {
    const oldPage = sessionPage({ id: 'old-1', slug: 'page-old', pageNumber: 1, updatedAt: 1 })
    const latestPage = sessionPage({
      id: 'latest-1',
      slug: 'page-latest',
      pageNumber: 1,
      updatedAt: 2
    })

    const result = selectRetrySessionPages({
      sessionPages: [oldPage, latestPage],
      sourceRunPages: [{ page_id: 'page-latest' } as never]
    })

    expect(result.selected).toEqual([latestPage])
    expect(result.staleIds).toEqual(['old-1'])
  })

  it('keeps completed pages outside a failed-run subset', () => {
    const first = sessionPage({ id: 'page-1', slug: 'page-one', pageNumber: 1, updatedAt: 1 })
    const failedSecond = sessionPage({
      id: 'page-2',
      slug: 'page-two',
      pageNumber: 2,
      updatedAt: 2
    })
    const third = sessionPage({ id: 'page-3', slug: 'page-three', pageNumber: 3, updatedAt: 3 })
    const failedFifth = sessionPage({
      id: 'page-5',
      slug: 'page-five',
      pageNumber: 5,
      updatedAt: 5
    })

    const result = selectRetrySessionPages({
      sessionPages: [first, failedSecond, third, failedFifth],
      sourceRunPages: [
        { page_id: 'page-two' } as never,
        { page_id: 'page-five' } as never
      ]
    })

    expect(result.selected.map((page) => page.id)).toEqual([
      'page-1',
      'page-2',
      'page-3',
      'page-5'
    ])
    expect(result.staleIds).toEqual([])
  })

  it('falls back to the newest active record for each page number', () => {
    const result = selectRetrySessionPages({
      sessionPages: [
        sessionPage({ id: 'old-1', slug: 'page-old', pageNumber: 1, updatedAt: 1 }),
        sessionPage({ id: 'new-1', slug: 'page-new', pageNumber: 1, updatedAt: 3 }),
        sessionPage({ id: 'new-2', slug: 'page-two', pageNumber: 2, updatedAt: 2 })
      ]
    })

    expect(result.selected.map((page) => page.id)).toEqual(['new-1', 'new-2'])
    expect(result.staleIds).toEqual(['old-1'])
  })
})
