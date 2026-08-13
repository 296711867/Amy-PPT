import { describe, expect, it, vi } from 'vitest'
import { prepareDeckImageAssets } from '../../../src/main/generation/deck-images'

describe('deck image preparation', () => {
  const imageOutline = [
    {
      title: 'Five-part overview',
      contentOutline: 'One; Two; Three; Four; Five',
      layoutIntent: 'image-focus' as const,
      layoutId: 'five-cards-2-3-image'
    },
    {
      title: 'Four points',
      contentOutline: 'One; Two; Three; Four',
      layoutIntent: 'concept' as const,
      layoutId: 'four-cards-grid'
    }
  ]

  it('uses the bundled placeholder when AI image generation is disabled', async () => {
    const onStatus = vi.fn()
    const result = await prepareDeckImageAssets({
      db: { getActiveImageModelConfig: vi.fn() },
      decryptApiKey: (value) => value,
      projectDir: process.cwd(),
      imagePolicy: 'placeholder',
      outlineItems: imageOutline,
      signal: new AbortController().signal,
      onStatus
    })

    expect(result[0].imageAssetPath).toBe('./assets/amy-image-placeholder.png')
    expect(result[1].imageAssetPath).toBeUndefined()
    expect(onStatus).toHaveBeenCalledWith({ pageNumber: 1, state: 'placeholder' })
  })

  it('falls back to the placeholder when no image model is configured', async () => {
    const onStatus = vi.fn()
    const result = await prepareDeckImageAssets({
      db: { getActiveImageModelConfig: vi.fn().mockResolvedValue(undefined) },
      decryptApiKey: (value) => value,
      projectDir: process.cwd(),
      imagePolicy: 'ai',
      outlineItems: imageOutline,
      signal: new AbortController().signal,
      onStatus
    })

    expect(result[0]).toMatchObject({
      imagePolicy: 'ai',
      imageAssetPath: './assets/amy-image-placeholder.png'
    })
    expect(onStatus).toHaveBeenCalledWith({
      pageNumber: 1,
      state: 'placeholder',
      detail: 'No active image model'
    })
  })

  it('creates one replaceable placeholder per gallery slot', async () => {
    const result = await prepareDeckImageAssets({
      db: { getActiveImageModelConfig: vi.fn() },
      decryptApiKey: (value) => value,
      projectDir: process.cwd(),
      imagePolicy: 'placeholder',
      outlineItems: [
        {
          title: 'Six examples',
          contentOutline: 'One; Two; Three; Four; Five; Six',
          layoutIntent: 'image-focus',
          layoutId: 'six-images-grid'
        }
      ],
      signal: new AbortController().signal
    })

    expect(result[0].imageAssetPaths).toHaveLength(6)
    expect(result[0].imageAssetPaths).toEqual(
      Array.from({ length: 6 }, () => './assets/amy-image-placeholder.png')
    )
  })

  it('reuses a complete generated image set instead of regenerating it', async () => {
    const getActiveImageModelConfig = vi.fn()
    const existingPaths = ['./images/one.png', './images/two.png']
    const result = await prepareDeckImageAssets({
      db: { getActiveImageModelConfig },
      decryptApiKey: (value) => value,
      projectDir: process.cwd(),
      imagePolicy: 'ai',
      outlineItems: [
        {
          title: 'Two examples',
          contentOutline: 'One; Two',
          layoutIntent: 'image-focus',
          layoutId: 'two-images-caption',
          imageAssetPath: existingPaths[0],
          imageAssetPaths: existingPaths
        }
      ],
      signal: new AbortController().signal
    })

    expect(result[0].imageAssetPaths).toEqual(existingPaths)
    expect(getActiveImageModelConfig).not.toHaveBeenCalled()
  })
})
