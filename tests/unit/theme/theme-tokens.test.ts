import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { UI_THEME_IDS } from '../../../src/shared/ui-theme'
import { UI_THEME_OPTIONS } from '../../../src/renderer/src/theme/ui-theme'
import { zh } from '../../../src/renderer/src/i18n/zh'
import { en } from '../../../src/renderer/src/i18n/en'

const tokensCss = fs.readFileSync(
  path.join(process.cwd(), 'src/renderer/src/theme/tokens.css'),
  'utf8'
)

/** Extract each `:root[data-ui-theme='<id>'] { ... }` block's token set. */
const extractThemeBlocks = (css: string): Map<string, Set<string>> => {
  const blocks = new Map<string, Set<string>>()
  const blockRe = /:root\[data-ui-theme='([a-z-]+)'\]\s*\{([\s\S]*?)\n\}/g
  for (const match of css.matchAll(blockRe)) {
    const [, id, body] = match
    const tokens = new Set(
      Array.from(body.matchAll(/--ui-[a-z0-9-]+(?=\s*:)/g)).map((m) => m[0])
    )
    blocks.set(id, tokens)
  }
  return blocks
}

describe('UI theme token completeness', () => {
  const blocks = extractThemeBlocks(tokensCss)

  it('defines a token block for every registered theme id and vice versa', () => {
    expect(Array.from(blocks.keys()).sort()).toEqual([...UI_THEME_IDS].sort())
  })

  it('gives every theme the identical token set (missing tokens fail in CI)', () => {
    const referenceId = UI_THEME_IDS[0]
    const reference = blocks.get(referenceId)
    expect(reference, `reference theme ${referenceId} parsed`).toBeTruthy()

    for (const id of UI_THEME_IDS) {
      const tokens = blocks.get(id)!
      const missing = Array.from(reference!).filter((token) => !tokens.has(token))
      const extra = Array.from(tokens).filter((token) => !reference!.has(token))
      expect(
        missing,
        `theme ${id} is missing tokens: ${missing.join(', ')}`
      ).toEqual([])
      expect(extra, `theme ${id} defines unknown tokens: ${extra.join(', ')}`).toEqual([])
    }
  })

  it('keeps every theme block free of empty token values', () => {
    for (const match of tokensCss.matchAll(/(--ui-[a-z0-9-]+)\s*:\s*;/g)) {
      throw new Error(`token ${match[1]} has an empty value`)
    }
  })

  it('exposes every registered theme in the settings picker with i18n labels', () => {
    expect(UI_THEME_OPTIONS.map((option) => option.id).sort()).toEqual([
      ...UI_THEME_IDS
    ].sort())

    const dictionary = { zh: (zh as { settings: Record<string, unknown> }).settings, en: (en as { settings: Record<string, unknown> }).settings }
    for (const option of UI_THEME_OPTIONS) {
      for (const [locale, settings] of Object.entries(dictionary)) {
        expect(
          settings[option.labelKey.replace('settings.', '')],
          `${locale} is missing ${option.labelKey}`
        ).toBeTruthy()
        expect(
          settings[option.descriptionKey.replace('settings.', '')],
          `${locale} is missing ${option.descriptionKey}`
        ).toBeTruthy()
      }
      expect(option.swatches).toHaveLength(3)
    }
  })
})
