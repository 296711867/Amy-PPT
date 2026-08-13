import { describe, expect, it } from 'vitest'
import { hasCommittedGeneratedPage } from '../../../src/main/generation/page-commit'

describe('hasCommittedGeneratedPage', () => {
  it('preserves a changed non-placeholder page after a post-write stream failure', () => {
    expect(
      hasCommittedGeneratedPage(
        '<html><body data-placeholder-page="1">等待模型填充这一页内容</body></html>',
        '<html><body><main><h1>Validated deck page</h1></main></body></html>'
      )
    ).toBe(true)
  })

  it('rejects unchanged, empty, and placeholder output', () => {
    const page = '<html><body><main><h1>Existing page</h1></main></body></html>'
    expect(hasCommittedGeneratedPage(page, page)).toBe(false)
    expect(hasCommittedGeneratedPage(page, '')).toBe(false)
    expect(
      hasCommittedGeneratedPage(
        page,
        '<html><body><div data-placeholder-page="1">等待模型填充这一页内容</div></body></html>'
      )
    ).toBe(false)
  })
})
