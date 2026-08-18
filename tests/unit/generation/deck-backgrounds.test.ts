import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assignDeckBackgroundAssets,
  isDeckBackgroundManifestCompatible,
  prepareDeckBackgroundAssets,
  resolveDeckBackgroundAsset,
  validateAssignedDeckBackground
} from '../../../src/main/generation/deck-backgrounds'
import { rmWithRetry } from '../../helpers/rm-retry'
import { normalizeDeckBackgroundPolicy } from '../../../src/shared/generation'

vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const manifest = {
  version: 1 as const,
  slideSizeId: 'wide-16-9',
  assets: [
    { role: 'cover' as const, whitespace: 'cover-safe' as const, path: './cover.png', prompt: 'cover' },
    { role: 'content' as const, whitespace: 'blank-left' as const, path: './left.png', prompt: 'left' },
    { role: 'content' as const, whitespace: 'blank-right' as const, path: './right.png', prompt: 'right' },
    { role: 'content' as const, whitespace: 'blank-top-center' as const, path: './top.png', prompt: 'top' },
    { role: 'ending' as const, whitespace: 'ending-safe' as const, path: './ending.png', prompt: 'ending' }
  ]
}

describe('deck background policy', () => {
  it('normalizes disabled defaults and clamps content variants to 1-3', () => {
    expect(normalizeDeckBackgroundPolicy(null)).toEqual({
      enabled: false,
      contentBackgroundCount: 1
    })
    expect(normalizeDeckBackgroundPolicy({ enabled: true, contentBackgroundCount: 3 })).toEqual({
      enabled: true,
      contentBackgroundCount: 3
    })
    expect(normalizeDeckBackgroundPolicy({ enabled: true, contentBackgroundCount: 8 })).toEqual({
      enabled: true,
      contentBackgroundCount: 1
    })
  })

  it('assigns cover, rotating content variants, and ending by full-deck page number', () => {
    const assigned = assignDeckBackgroundAssets(
      Array.from({ length: 7 }, (_, index) => ({ title: `Page ${index + 1}`, contentOutline: '' })),
      manifest
    )

    expect(assigned.map((item) => item.backgroundAsset?.path)).toEqual([
      './cover.png',
      './left.png',
      './right.png',
      './top.png',
      './left.png',
      './right.png',
      './ending.png'
    ])
  })

  it('resolves retry pages against the original deck rather than the retry subset', () => {
    expect(resolveDeckBackgroundAsset(manifest, 2, 5)?.path).toBe('./left.png')
    expect(resolveDeckBackgroundAsset(manifest, 5, 5)?.path).toBe('./ending.png')
  })

  it('reuses cached assets only when policy, page roles, and canvas still match', () => {
    expect(
      isDeckBackgroundManifestCompatible(
        manifest,
        { enabled: true, contentBackgroundCount: 3 },
        7,
        'wide-16-9'
      )
    ).toBe(true)
    expect(
      isDeckBackgroundManifestCompatible(
        manifest,
        { enabled: true, contentBackgroundCount: 1 },
        7,
        'wide-16-9'
      )
    ).toBe(false)
    expect(
      isDeckBackgroundManifestCompatible(
        manifest,
        { enabled: false, contentBackgroundCount: 3 },
        7,
        'wide-16-9'
      )
    ).toBe(false)
    expect(
      isDeckBackgroundManifestCompatible(
        manifest,
        { enabled: true, contentBackgroundCount: 3 },
        7,
        'standard-4-3'
      )
    ).toBe(false)
  })

  it('requires the assigned path on the marked background image', () => {
    const asset = manifest.assets[1]

    expect(
      validateAssignedDeckBackground(
        '<section><img src="./left.png" data-role="deck-background" class="absolute inset-0" /></section>',
        asset
      )
    ).toEqual([])
    expect(validateAssignedDeckBackground('<section></section>', asset)).toEqual([
      '缺少 data-role="deck-background" 的全画布背景图片层'
    ])
    expect(
      validateAssignedDeckBackground(
        '<section><img data-role="deck-background" src="./wrong.png" /></section>',
        asset
      )
    ).toEqual(['背景图片层没有引用分配的路径 ./left.png'])
  })

  describe('prepareDeckBackgroundAssets fail-soft', () => {
    const tempDirs: string[] = []
  const basePrepareArgs = () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amy-deck-bg-'))
    tempDirs.push(projectDir)
    return {
      projectDir,
      policy: { enabled: true, contentBackgroundCount: 1 },
      pageCount: 3,
      slideSize: { id: 'wide-16-9', label: '', width: 1600, height: 900 } as never,
      topic: '测试主题',
      stylePrompt: 'style',
      provider: 'zhipu',
      apiKey: 'key',
      model: 'glm-5.2',
      baseUrl: '',
      maxTokens: 4096,
      signal: new AbortController().signal
    }
  }

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) await rmWithRetry(dir)
  })

  it('skips backgrounds instead of failing the run when the image model config lacks a model', async () => {
    const statuses: Array<{ state: string; detail?: string }> = []
    const result = await prepareDeckBackgroundAssets({
      ...basePrepareArgs(),
      db: {
        getActiveImageModelConfig: async () => ({
          id: 'img-1',
          name: 'Agnes 默认',
          provider: 'agnes',
          active: 1,
          modelConfig: '{}'
        })
      },
      decryptApiKey: (value: string) => value,
      onStatus: (status) => statuses.push({ state: status.state, detail: status.detail })
    })

    expect(result).toBeNull()
    expect(statuses).toEqual([
      { state: 'failed', detail: expect.stringContaining('缺少 model 字段') }
    ])
  })

  it('skips backgrounds when no image model is configured at all', async () => {
    const statuses: Array<{ state: string }> = []
    const result = await prepareDeckBackgroundAssets({
      ...basePrepareArgs(),
      db: { getActiveImageModelConfig: async () => undefined },
      decryptApiKey: (value: string) => value,
      onStatus: (status) => statuses.push({ state: status.state })
    })

    expect(result).toBeNull()
    expect(statuses).toEqual([{ state: 'failed' }])
  })
  })

  it('localizes validation messages for english sessions', () => {
    const asset = manifest.assets[1]

    expect(validateAssignedDeckBackground('<section></section>', asset, 'en')).toEqual([
      'the full-canvas background image layer with data-role="deck-background" is missing'
    ])
    expect(
      validateAssignedDeckBackground(
        '<section><img data-role="deck-background" src="./wrong.png" /></section>',
        asset,
        'en'
      )
    ).toEqual([
      'the background image layer does not reference the assigned path ./left.png'
    ])
  })

  it('does not require a background when the feature is disabled for the page', () => {
    expect(validateAssignedDeckBackground('<section></section>', undefined)).toEqual([])
  })
})
