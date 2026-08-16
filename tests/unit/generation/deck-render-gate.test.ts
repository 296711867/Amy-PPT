import { describe, expect, it } from 'vitest'
import { resolveIncompleteDeckRenderPages } from '../../../src/main/generation/deck-render-gate'

describe('deck render completion gate', () => {
  it('keeps a fully rendered deck out of the retry queue', () => {
    expect(
      resolveIncompleteDeckRenderPages({ available: true, unavailablePages: [] })
    ).toEqual([])
  })

  it('returns only concrete unavailable pages when deck validation is incomplete', () => {
    expect(
      resolveIncompleteDeckRenderPages({
        available: false,
        unavailablePages: [
          { pageId: 'page-1', reason: 'render timeout' },
          { pageId: '', reason: 'invalid diagnostic' },
          { pageId: 'page-3', reason: 'master stylesheet failed' }
        ]
      })
    ).toEqual([
      { pageId: 'page-1', reason: 'render timeout' },
      { pageId: 'page-3', reason: 'master stylesheet failed' }
    ])
  })
})
