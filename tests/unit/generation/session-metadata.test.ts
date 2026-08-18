import { describe, expect, it } from 'vitest'
import { mergeSessionMetadata } from '../../../src/main/generation/metadata-parser'

describe('generation session metadata', () => {
  it('preserves visual generation policies when run metadata is updated', () => {
    expect(
      mergeSessionMetadata(
        JSON.stringify({
          source: 'thinking',
          imagePolicy: 'ai',
          deckBackgroundPolicy: { enabled: true, contentBackgroundCount: 3 }
        }),
        {
          lastRunId: 'run-2',
          entryMode: 'multi_page'
        }
      )
    ).toEqual({
      source: 'thinking',
      imagePolicy: 'ai',
      deckBackgroundPolicy: { enabled: true, contentBackgroundCount: 3 },
      lastRunId: 'run-2',
      entryMode: 'multi_page'
    })
  })
})
