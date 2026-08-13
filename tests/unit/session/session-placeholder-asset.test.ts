import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { SESSION_ASSET_FILE_NAMES } from '../../../src/main/presentation/assets/page-assets'

describe('session image placeholder asset', () => {
  it('ships the placeholder with every session asset scaffold', () => {
    expect(SESSION_ASSET_FILE_NAMES).toContain('amy-image-placeholder.png')
    const assetPath = path.join(process.cwd(), 'resources', 'amy-image-placeholder.png')
    expect(fs.existsSync(assetPath)).toBe(true)
    expect(fs.statSync(assetPath).size).toBeGreaterThan(10_000)
  })
})
