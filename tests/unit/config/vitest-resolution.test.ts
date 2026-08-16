import fs from 'fs'
import { describe, expect, it } from 'vitest'

describe('Vitest dependency resolution', () => {
  it('requires an explicit opt-in before using a neighboring html2pptx checkout', () => {
    const source = fs.readFileSync('vitest.config.ts', 'utf-8')

    expect(source).toContain("process.env.AMY_PPT_USE_LOCAL_HTML2PPTX === '1'")
    expect(source).toContain("new URL('./node_modules/@arcsin1/html2pptx/dist'")
  })
})
