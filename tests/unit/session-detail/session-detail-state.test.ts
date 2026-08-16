import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sessionDetailSource = fs.readFileSync(
  path.resolve('src/renderer/src/pages/session-detail.tsx'),
  'utf8'
)

describe('SessionDetailPage load state contract', () => {
  it('keeps loading, invalid-session, missing-size, and retry states visible', () => {
    expect(sessionDetailSource).toContain("kind=\"loading\"")
    expect(sessionDetailSource).toContain("kind={isNotFound ? 'not-found' : 'error'}")
    expect(sessionDetailSource).toContain('kind="missing-size"')
    expect(sessionDetailSource).toContain('handleRetrySessionLoad')
    expect(sessionDetailSource).toContain('trySessionSlideSize(currentSession)')
    expect(sessionDetailSource).not.toContain('if (!id || !slideSize) {\n    return <div')
  })
})
