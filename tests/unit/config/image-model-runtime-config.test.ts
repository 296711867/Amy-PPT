import { describe, expect, it, vi } from 'vitest'
import { resolveImageModelRuntimeConfig } from '../../../src/main/config/image-model-runtime-config'

describe('image model runtime config', () => {
  it('keeps ordinary image model configs on the stored encrypted-config path', () => {
    const decryptConfig = vi.fn(() =>
      JSON.stringify({ model: 'agnes-image-2.0-flash', apiKey: 'stored-key' })
    )

    expect(
      resolveImageModelRuntimeConfig({
        config: {
          id: 'regular-image-model',
          provider: 'agnes',
          modelConfig: 'encrypted-config'
        },
        decryptConfig,
        environment: {}
      })
    ).toEqual({ model: 'agnes-image-2.0-flash', apiKey: 'stored-key' })
    expect(decryptConfig).toHaveBeenCalledWith('encrypted-config')
  })

  it('resolves the Codex BBT profile from its fixed model and environment credentials', () => {
    const decryptConfig = vi.fn(() => '')

    expect(
      resolveImageModelRuntimeConfig({
        config: {
          id: 'codex-bbt-image-model',
          provider: 'agnes',
          modelConfig: 'enc:v1:unavailable-in-this-user-context'
        },
        decryptConfig,
        environment: {
          BBT_IMAGE_API_KEY: 'environment-key'
        }
      })
    ).toEqual({
      model: 'gpt-image-2',
      baseUrl: 'http://192.168.177.54:3002/v1',
      apiKey: 'environment-key'
    })
    expect(decryptConfig).not.toHaveBeenCalled()
  })

  it('honors the BBT endpoint override without reading the stored encrypted payload', () => {
    const decryptConfig = vi.fn(() => {
      throw new Error('must not decrypt the BBT environment profile')
    })

    expect(
      resolveImageModelRuntimeConfig({
        config: {
          id: 'codex-bbt-image-model',
          provider: 'agnes',
          modelConfig: 'enc:v1:old-user-ciphertext'
        },
        decryptConfig,
        environment: {
          BBT_IMAGE_API_KEY: 'environment-key',
          BBT_IMAGE_BASE_URL: 'http://127.0.0.1:3002/v1/'
        }
      })
    ).toMatchObject({
      model: 'gpt-image-2',
      baseUrl: 'http://127.0.0.1:3002/v1/'
    })
    expect(decryptConfig).not.toHaveBeenCalled()
  })
})
