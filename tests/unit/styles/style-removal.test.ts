import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rmWithRetry } from '../../helpers/rm-retry'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'ohmyppt-test-user-data'))
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

vi.mock('../../../src/main/io/assets-handlers', () => ({
  allowLocalAssetRoot: vi.fn()
}))

import { initializeStyles } from '../../../src/main/styles/style-initializer'
import { PPTDatabase } from '../../../src/main/db/database'

async function makeStyle(
  root: string,
  style: string,
  version: string
): Promise<void> {
  const styleDir = path.join(root, style)
  await mkdir(styleDir, { recursive: true })
  await writeFile(
    path.join(styleDir, 'style.json'),
    JSON.stringify(
      {
        style,
        name: { zh: style, en: style },
        description: 'Test style',
        category: '测试',
        aliases: [],
        styleCase: 'Unit test',
        version,
        source: 'builtin'
      },
      null,
      2
    ) + '\n',
    'utf8'
  )
  await writeFile(path.join(styleDir, 'SKILL.md'), '# Style Skill\n', 'utf8')
}

async function writeManifest(root: string, version: string): Promise<void> {
  await writeFile(
    path.join(root, 'manifest.json'),
    JSON.stringify({ version, time: '2026-08-15', author: '296711867' }, null, 2) + '\n',
    'utf8'
  )
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await readFile(path.join(target, 'style.json'), 'utf8')
    return true
  } catch {
    return false
  }
}

describe('system style removal', () => {
  const roots: string[] = []

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rmWithRetry(root)
    }
  })

  it('prunes installed system styles that are no longer bundled', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'ohmyppt-style-prune-'))
    roots.push(tmp)
    const bundled = path.join(tmp, 'bundled')
    const installed = path.join(tmp, 'installed')
    await makeStyle(bundled, 'minimal-white', '1.0.0')
    await writeManifest(bundled, '2.0.0')

    await initializeStyles({ bundledSourcePath: bundled, installedRootPath: installed })
    expect(await pathExists(path.join(installed, 'system', 'minimal-white'))).toBe(true)

    // 模拟一次历史版本装过、新版本已下架的风格，同时发布 manifest 版本升级
    await makeStyle(path.join(installed, 'system'), 'vaporwave', '1.0.0')
    await writeManifest(bundled, '3.0.0')

    await initializeStyles({ bundledSourcePath: bundled, installedRootPath: installed })

    expect(await pathExists(path.join(installed, 'system', 'vaporwave'))).toBe(false)
    expect(await pathExists(path.join(installed, 'system', 'minimal-white'))).toBe(true)
    const manifest = JSON.parse(
      await readFile(path.join(installed, 'system', 'manifest.json'), 'utf8')
    ) as { version: string }
    expect(manifest.version).toBe('3.0.0')
  })

  it('deactivates builtin style rows whose installed package disappears', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'ohmyppt-style-deactivate-'))
    roots.push(tmp)
    const installed = path.join(tmp, 'installed')
    await makeStyle(path.join(installed, 'system'), 'minimal-white', '1.0.0')
    await makeStyle(path.join(installed, 'system'), 'vaporwave', '1.0.0')

    const db = new PPTDatabase(path.join(tmp, 'test.db'))
    try {
      await db.init()
      await db.syncInstalledStylesToDatabase(installed)
      expect(db.getStyleRowByStyleSync('vaporwave')?.active).not.toBe(false)
      expect(db.getStyleRowByStyleSync('minimal-white')?.active).not.toBe(false)

      await rm(path.join(installed, 'system', 'vaporwave'), {
        recursive: true,
        force: true
      })
      await db.syncInstalledStylesToDatabase(installed)

      expect(db.getStyleRowByStyleSync('vaporwave')?.active).toBe(false)
      expect(db.getStyleRowByStyleSync('minimal-white')?.active).not.toBe(false)
    } finally {
      await db.close()
    }
  })
})
