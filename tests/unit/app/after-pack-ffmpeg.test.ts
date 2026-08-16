import fs from 'fs/promises'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tempRoots: string[] = []

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.after-pack-test-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('afterPack ffmpeg handling', () => {
  it('keeps packaging optional when the platform encoder is absent', async () => {
    const root = await makeTempRoot()
    const appOutDir = path.join(root, 'out')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const imported = await import('../../../build/after-pack.cjs')
    const defaultExport = imported.default as unknown
    const hook =
      typeof defaultExport === 'function'
        ? (defaultExport as (context: Record<string, unknown>) => Promise<void>)
        : ((defaultExport as { default: (context: Record<string, unknown>) => Promise<void> })
            .default)

    await expect(
      hook({
        electronPlatformName: 'win32',
        arch: 1,
        appOutDir,
        packager: {
          projectDir: root,
          getResourcesDir: () => path.join(appOutDir, 'resources')
        }
      })
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('optional bundled ffmpeg missing'))
  })
})
