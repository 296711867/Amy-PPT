import fs from 'fs'
import { parse } from 'postcss'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UI_THEME_ID,
  UI_THEME_CHROME,
  normalizeUiThemeId
} from '../../../src/shared/ui-theme'
import {
  UI_THEME_OPTIONS,
  UI_THEME_STORAGE_KEY,
  applyUiTheme,
  readCachedUiTheme
} from '../../../src/renderer/src/theme/ui-theme'

describe('UI theme registry', () => {
  it('normalizes legacy and unknown values to the default theme', () => {
    expect(normalizeUiThemeId('studio')).toBe('studio')
    expect(normalizeUiThemeId('coral')).toBe('coral')
    expect(normalizeUiThemeId('pastel')).toBe('pastel')
    expect(normalizeUiThemeId('midnight')).toBe('midnight')
    expect(DEFAULT_UI_THEME_ID).toBe('coral')
    expect(normalizeUiThemeId('light')).toBe(DEFAULT_UI_THEME_ID)
    expect(normalizeUiThemeId(undefined)).toBe(DEFAULT_UI_THEME_ID)
  })

  it('keeps renderer options and native window chrome in sync', () => {
    expect(UI_THEME_OPTIONS.map((option) => option.id)).toEqual(Object.keys(UI_THEME_CHROME))
  })

  it('applies a normalized theme to the root and cache', () => {
    const root = { dataset: {}, style: {} } as unknown as HTMLElement
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }

    expect(applyUiTheme('midnight', { root, storage })).toBe('midnight')
    expect(root.dataset.uiTheme).toBe('midnight')
    expect(root.style.colorScheme).toBe('dark')
    expect(values.get(UI_THEME_STORAGE_KEY)).toBe('midnight')
    expect(readCachedUiTheme(storage)).toBe('midnight')
  })

  it('defines a complete token block and settings entry for every theme', () => {
    const css = fs.readFileSync('src/renderer/src/theme/tokens.css', 'utf8')
    const stylesheet = parse(css)
    const settings = fs.readFileSync(
      'src/renderer/src/components/settings/GeneralSettingsTab.tsx',
      'utf8'
    )
    const requiredThemeTokens = [
      '--ui-feature-surface-4',
      '--ui-feature-accent-4',
      '--ui-font-tag-primary',
      '--ui-font-tag-primary-soft',
      '--ui-font-tag-primary-border',
      '--ui-font-tag-secondary',
      '--ui-font-tag-secondary-soft',
      '--ui-font-tag-secondary-border',
      '--ui-font-tag-tertiary',
      '--ui-font-tag-tertiary-soft',
      '--ui-font-tag-tertiary-border'
    ]

    for (const option of UI_THEME_OPTIONS) {
      expect(css).toContain(`data-ui-theme='${option.id}'`)
      const themeRule = stylesheet.nodes.find(
        (node) =>
          node.type === 'rule' && node.selectors.includes(`:root[data-ui-theme='${option.id}']`)
      )
      const declaredTokens = new Set<string>()
      themeRule?.walkDecls((declaration) => declaredTokens.add(declaration.prop))
      expect([...declaredTokens]).toEqual(expect.arrayContaining(requiredThemeTokens))
    }
    expect(css).toContain('--ui-background:')
    expect(css).toContain('--ui-action:')
    expect(css).toContain('--ui-danger:')
    expect(settings).toContain('settings.themeStyle')
    expect(settings).toContain('UI_THEME_OPTIONS.map')
  })
})
