import { describe, expect, it } from 'vitest'
import type { DeepStringShape, I18nKey, TranslationParams } from '../../../src/renderer/src/i18n'
import { en } from '../../../src/renderer/src/i18n/en'
import { zh } from '../../../src/renderer/src/i18n/zh'
import { buildManualEditPrompt } from '../../../src/renderer/src/store/editSessionStore'

const createTranslator = (messages: DeepStringShape<typeof zh>) =>
  ((key: I18nKey, params?: TranslationParams): string => {
    const value = key.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined
      return (current as Record<string, unknown>)[part]
    }, messages)
    if (typeof value !== 'string') return key
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params?.[name]) : match
    )
  })

const counts = {
  added: 2,
  deleted: 1,
  moved: 3,
  text: 4,
  properties: 5
}

describe('edit session history prompt locale', () => {
  it('uses English labels and punctuation in English mode', () => {
    expect(buildManualEditPrompt(createTranslator(en), counts)).toBe(
      'Added 2 element(s), Deleted 1 element(s), Adjusted the position of 3 element(s), ' +
        'Edited text in 4 element(s), Edited properties of 5 element(s)'
    )
  })

  it('keeps Chinese labels and punctuation in Chinese mode', () => {
    expect(buildManualEditPrompt(createTranslator(zh), counts)).toBe(
      '添加 2 个元素、删除 1 个元素、调整 3 个元素位置、编辑 4 个元素文字、编辑 5 个元素属性'
    )
  })

  it('uses the localized generic label when there are no edits', () => {
    expect(buildManualEditPrompt(createTranslator(en), {
      added: 0,
      deleted: 0,
      moved: 0,
      text: 0,
      properties: 0
    })).toBe(en.sessionDetail.manualAdjustHistory)
    expect(buildManualEditPrompt(createTranslator(zh), {
      added: 0,
      deleted: 0,
      moved: 0,
      text: 0,
      properties: 0
    })).toBe(zh.sessionDetail.manualAdjustHistory)
  })
})
