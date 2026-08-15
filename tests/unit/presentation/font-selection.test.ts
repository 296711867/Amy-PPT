import { describe, expect, it } from 'vitest'
import { normalizeFontSelection } from '../../../src/shared/generation'
import { BUILT_IN_FONT_SCHEMES, normalizeUserFontScheme } from '../../../src/shared/font-schemes'
import { normalizeFontFileFormat } from '../../../src/shared/font-file'
import { buildBasePageStyleTag } from '../../../src/main/presentation/html/page-shell'
import { requireSlideSizePreset } from '../../../src/shared/slide-size'

describe('presentation font selection', () => {
  it('inherits body as subtitle for old two-font sessions', () => {
    expect(
      normalizeFontSelection({
        mode: 'pair',
        title: { source: 'google', family: 'Montserrat' },
        body: { source: 'google', family: 'Inter' }
      })
    ).toEqual({
      mode: 'pair',
      presetId: undefined,
      title: { source: 'google', family: 'Montserrat', id: undefined },
      subtitle: { source: 'google', family: 'Inter', id: undefined },
      body: { source: 'google', family: 'Inter', id: undefined }
    })
  })

  it('preserves system fonts and preset identifiers', () => {
    const selection = normalizeFontSelection({
      mode: 'pair',
      presetId: 'office-business',
      title: { source: 'system', family: 'Microsoft YaHei' },
      subtitle: { source: 'system', family: 'Microsoft YaHei' },
      body: { source: 'system', family: 'Arial' }
    })
    expect(selection).toMatchObject({ mode: 'pair', presetId: 'office-business' })
    if (selection.mode === 'pair') expect(selection.body.source).toBe('system')
  })

  it('provides five built-in schemes with three roles', () => {
    expect(BUILT_IN_FONT_SCHEMES).toHaveLength(5)
    expect(BUILT_IN_FONT_SCHEMES.every((scheme) => scheme.title && scheme.subtitle && scheme.body)).toBe(true)
  })

  it('normalizes user schemes and rejects incomplete data', () => {
    expect(normalizeUserFontScheme({ id: 'x', name: 'X' })).toBeNull()
    expect(
      normalizeUserFontScheme({
        id: 'x',
        name: 'X',
        title: { source: 'google', family: 'Inter' },
        subtitle: { source: 'google', family: 'Inter' },
        body: { source: 'google', family: 'Noto Sans SC' }
      })
    ).toMatchObject({ id: 'x', builtIn: false })
  })

  it('uses the correct CSS source format for uploaded files', () => {
    expect(normalizeFontFileFormat(undefined, 'font.ttf')).toBe('truetype')
    expect(normalizeFontFileFormat(undefined, 'font.otf')).toBe('opentype')
    expect(normalizeFontFileFormat(undefined, 'font.woff2')).toBe('woff2')
  })

  it('routes secondary headings through the subtitle font variable', () => {
    const css = buildBasePageStyleTag(requireSlideSizePreset('wide-16-9'))
    expect(css).toContain('var(--ppt-subtitle-font')
    expect(css).toContain('[data-role="subtitle"]')
  })
})
