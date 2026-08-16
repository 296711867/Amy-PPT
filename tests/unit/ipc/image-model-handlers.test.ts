import { beforeEach, describe, expect, it, vi } from 'vitest'

const imageHandlersState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  return {
    handlers,
    ipcMainMock: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        handlers.set(channel, handler)
      })
    },
    localeMock: {
      readAppLocale: vi.fn(async () => 'zh'),
      uiText: vi.fn((locale: string, zh: string, en: string) => (locale === 'en' ? en : zh))
    },
    logMock: {
      error: vi.fn(),
      info: vi.fn()
    },
    encryptApiKeyMock: vi.fn((value: string) => `encrypted:${value}`),
    decryptApiKeyMock: vi.fn((value: unknown) => String(value ?? ''))
  }
})

vi.mock('electron', () => ({
  ipcMain: imageHandlersState.ipcMainMock
}))

vi.mock('electron-log/main.js', () => ({
  default: imageHandlersState.logMock
}))

vi.mock('../../../src/main/config/locale-utils', () => ({
  readAppLocale: imageHandlersState.localeMock.readAppLocale,
  uiText: imageHandlersState.localeMock.uiText
}))

async function registerWithDb(overrides: Partial<Record<string, unknown>> = {}) {
  vi.resetModules()
  imageHandlersState.handlers.clear()
  const { registerImageModelHandlers } =
    await import('../../../src/main/config/image-model-handlers')
  const db = {
    listImageModelConfigs: vi.fn(async () => []),
    upsertImageModelConfig: vi.fn(async () => 'image-model-1'),
    ...overrides
  }
  const ctx = {
    db,
    encryptApiKey: imageHandlersState.encryptApiKeyMock,
    decryptApiKey: imageHandlersState.decryptApiKeyMock
  }
  registerImageModelHandlers(ctx as never)
  return {
    db,
    getHandler: (channel: string) => imageHandlersState.handlers.get(channel)
  }
}

describe('registerImageModelHandlers credential boundaries', () => {
  beforeEach(() => {
    imageHandlersState.handlers.clear()
    imageHandlersState.ipcMainMock.handle.mockClear()
    imageHandlersState.localeMock.readAppLocale.mockReset()
    imageHandlersState.localeMock.readAppLocale.mockResolvedValue('zh')
    imageHandlersState.logMock.error.mockClear()
    imageHandlersState.logMock.info.mockClear()
    imageHandlersState.encryptApiKeyMock.mockReset()
    imageHandlersState.encryptApiKeyMock.mockImplementation((value: string) => `encrypted:${value}`)
    imageHandlersState.decryptApiKeyMock.mockReset()
    imageHandlersState.decryptApiKeyMock.mockImplementation((value: unknown) => String(value ?? ''))
  })

  it('does not return nested image credentials from imageModels:list', async () => {
    imageHandlersState.decryptApiKeyMock.mockReturnValue(
      JSON.stringify({
        model: 'image-model',
        apiKey: 'top-secret',
        headers: {
          Authorization: 'secret',
          Cookie: 'session-cookie',
          'X-Auth': 'custom-auth',
          'X-Custom': 'custom-value'
        },
        httpOptions: {
          HeAdErS: { Cookie: 'nested-cookie', 'X-Trace': 'trace-value' }
        }
      })
    )
    const { getHandler } = await registerWithDb({
      listImageModelConfigs: vi.fn(async () => [
        {
          id: 'image-model-1',
          name: 'Image model',
          provider: 'openaiCompatible',
          active: 1,
          modelConfig: 'encrypted-config',
          createdAt: 1,
          updatedAt: 2
        }
      ])
    })
    const result = await getHandler('imageModels:list')?.()
    expect(result).toEqual([
      expect.objectContaining({
        modelConfig: '{\n  "model": "image-model",\n  "headers": {},\n  "httpOptions": {\n    "HeAdErS": {}\n  }\n}'
      })
    ])
  })

  it('preserves omitted image credentials when editing an existing config', async () => {
    const existing = {
      id: 'image-model-1',
      name: 'Image model',
      provider: 'openaiCompatible',
      active: 1,
      modelConfig: 'encrypted-config',
      createdAt: 1,
      updatedAt: 2
    }
    const upsertImageModelConfig = vi.fn(async () => 'image-model-1')
    const { db, getHandler } = await registerWithDb({
      listImageModelConfigs: vi.fn(async () => [existing]),
      upsertImageModelConfig
    })
    imageHandlersState.decryptApiKeyMock.mockImplementation((value: unknown) => {
      if (value === 'encrypted-config') {
        return JSON.stringify({ model: 'old-model', apiKey: 'old-key', nested: { keep: true } })
      }
      return String(value ?? '')
    })

    await getHandler('imageModels:upsert')?.(undefined, {
      id: 'image-model-1',
      name: 'Updated image model',
      provider: 'openaiCompatible',
      modelConfig: JSON.stringify({ model: 'new-model', nested: { keep: false } })
    })

    expect(db.upsertImageModelConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'image-model-1',
        modelConfig: `encrypted:${JSON.stringify(
          { model: 'new-model', nested: { keep: false }, apiKey: 'old-key' },
          null,
          2
        )}`
      })
    )
  })

  it('replaces image credentials when they are explicitly provided', async () => {
    const upsertImageModelConfig = vi.fn(async () => 'image-model-1')
    const { db, getHandler } = await registerWithDb({
      listImageModelConfigs: vi.fn(async () => [
        {
          id: 'image-model-1',
          name: 'Image model',
          provider: 'openaiCompatible',
          active: 1,
          modelConfig: 'encrypted-config',
          createdAt: 1,
          updatedAt: 2
        }
      ]),
      upsertImageModelConfig
    })
    imageHandlersState.decryptApiKeyMock.mockReturnValue(
      JSON.stringify({ model: 'old-model', apiKey: 'old-key' })
    )

    await getHandler('imageModels:upsert')?.(undefined, {
      id: 'image-model-1',
      name: 'Image model',
      provider: 'openaiCompatible',
      modelConfig: JSON.stringify({ model: 'new-model', API_KEY: 'new-key' })
    })

    expect(db.upsertImageModelConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: `encrypted:${JSON.stringify(
          { model: 'new-model', API_KEY: 'new-key' },
          null,
          2
        )}`
      })
    )
  })

  it.each([
    {
      name: 'top-level baseUrl',
      provider: 'gemini',
      existingConfig: {
        model: 'gemini-old',
        baseUrl: 'https://trusted.example/v1',
        apiKey: 'old-api-key',
        token: 'old-token',
        headers: {
          Authorization: 'Bearer old-authorization',
          Cookie: 'old-cookie',
          'X-Auth': 'old-auth',
          'X-Custom': 'old-custom',
          secret: 'old-secret'
        }
      },
      incomingConfig: {
        model: 'gemini-new',
        baseUrl: 'https://attacker.example/v1',
        apiKey: 'new-api-key'
      }
    },
    {
      name: 'endpoint',
      provider: 'openaiCompatible',
      existingConfig: {
        model: 'image-old',
        endpoint: 'https://trusted.example/image',
        apiKey: 'old-api-key',
        token: 'old-token',
        headers: {
          Authorization: 'Bearer old-authorization',
          Cookie: 'old-cookie',
          'X-Auth': 'old-auth',
          'X-Custom': 'old-custom',
          secret: 'old-secret'
        }
      },
      incomingConfig: {
        model: 'image-new',
        endpoint: 'https://attacker.example/image',
        apiKey: 'new-api-key'
      }
    },
    {
      name: 'nested Gemini baseUrl',
      provider: 'gemini',
      existingConfig: {
        model: 'gemini-old',
        httpOptions: { baseUrl: 'https://trusted.example/gemini' },
        apiKey: 'old-api-key',
        token: 'old-token',
        headers: {
          Authorization: 'Bearer old-authorization',
          Cookie: 'old-cookie',
          'X-Auth': 'old-auth',
          'X-Custom': 'old-custom',
          secret: 'old-secret'
        }
      },
      incomingConfig: {
        model: 'gemini-new',
        httpOptions: { baseUrl: 'https://attacker.example/gemini' },
        apiKey: 'new-api-key'
      }
    }
  ])('does not retain credentials when $name changes', async ({
    provider,
    existingConfig,
    incomingConfig
  }) => {
    const upsertImageModelConfig = vi.fn(async () => 'image-model-1')
    const { db, getHandler } = await registerWithDb({
      listImageModelConfigs: vi.fn(async () => [
        {
          id: 'image-model-1',
          name: 'Image model',
          provider,
          active: 1,
          modelConfig: 'encrypted-config',
          createdAt: 1,
          updatedAt: 2
        }
      ]),
      upsertImageModelConfig
    })
    imageHandlersState.decryptApiKeyMock.mockReturnValue(JSON.stringify(existingConfig))

    await getHandler('imageModels:upsert')?.(undefined, {
      id: 'image-model-1',
      name: 'Image model',
      provider,
      modelConfig: JSON.stringify(incomingConfig)
    })

    const savedConfig = upsertImageModelConfig.mock.calls[0]?.[0] as { modelConfig: string }
    expect(savedConfig.modelConfig).toBe(
      `encrypted:${JSON.stringify(incomingConfig, null, 2)}`
    )
    expect(savedConfig.modelConfig).not.toContain('old-api-key')
    expect(savedConfig.modelConfig).not.toContain('old-token')
    expect(savedConfig.modelConfig).not.toContain('old-authorization')
    expect(savedConfig.modelConfig).not.toContain('old-cookie')
    expect(savedConfig.modelConfig).not.toContain('old-auth')
    expect(savedConfig.modelConfig).not.toContain('old-custom')
    expect(savedConfig.modelConfig).not.toContain('old-secret')
    expect(db.upsertImageModelConfig).toHaveBeenCalled()
  })

  it('does not retain credentials when the image provider changes', async () => {
    const upsertImageModelConfig = vi.fn(async () => 'image-model-1')
    const { db, getHandler } = await registerWithDb({
      listImageModelConfigs: vi.fn(async () => [
        {
          id: 'image-model-1',
          name: 'Image model',
          provider: 'openaiCompatible',
          active: 1,
          modelConfig: 'encrypted-config',
          createdAt: 1,
          updatedAt: 2
        }
      ]),
      upsertImageModelConfig
    })
    imageHandlersState.decryptApiKeyMock.mockReturnValue(
      JSON.stringify({
        model: 'old-model',
        apiKey: 'old-api-key',
        token: 'old-token',
        headers: {
          Authorization: 'Bearer old-authorization',
          Cookie: 'old-cookie',
          'X-Auth': 'old-auth',
          'X-Custom': 'old-custom',
          secret: 'old-secret'
        }
      })
    )

    const incomingConfig = { model: 'gemini-new', apiKey: 'new-api-key' }
    await getHandler('imageModels:upsert')?.(undefined, {
      id: 'image-model-1',
      name: 'Image model',
      provider: 'gemini',
      modelConfig: JSON.stringify(incomingConfig)
    })

    const savedConfig = upsertImageModelConfig.mock.calls[0]?.[0] as { modelConfig: string }
    expect(savedConfig.modelConfig).toBe(
      `encrypted:${JSON.stringify(incomingConfig, null, 2)}`
    )
    expect(savedConfig.modelConfig).not.toContain('old-api-key')
    expect(savedConfig.modelConfig).not.toContain('old-token')
    expect(savedConfig.modelConfig).not.toContain('old-authorization')
    expect(savedConfig.modelConfig).not.toContain('old-cookie')
    expect(savedConfig.modelConfig).not.toContain('old-auth')
    expect(savedConfig.modelConfig).not.toContain('old-custom')
    expect(savedConfig.modelConfig).not.toContain('old-secret')
    expect(db.upsertImageModelConfig).toHaveBeenCalled()
  })

  it('preserves nested credentials when the image scope is unchanged', async () => {
    const upsertImageModelConfig = vi.fn(async () => 'image-model-1')
    const { db, getHandler } = await registerWithDb({
      listImageModelConfigs: vi.fn(async () => [
        {
          id: 'image-model-1',
          name: 'Gemini image model',
          provider: 'gemini',
          active: 1,
          modelConfig: 'encrypted-config',
          createdAt: 1,
          updatedAt: 2
        }
      ]),
      upsertImageModelConfig
    })
    imageHandlersState.decryptApiKeyMock.mockReturnValue(
      JSON.stringify({
        model: 'gemini-old',
        httpOptions: { baseUrl: ' https://trusted.example/gemini ' },
        apiKey: 'old-api-key',
        token: 'old-token',
        headers: {
          Authorization: 'Bearer old-authorization',
          Cookie: 'old-cookie',
          'X-Auth': 'old-auth',
          'X-Custom': 'old-custom',
          secret: 'old-secret'
        }
      })
    )

    await getHandler('imageModels:upsert')?.(undefined, {
      id: 'image-model-1',
      name: 'Gemini image model',
      provider: 'gemini',
      modelConfig: JSON.stringify({
        model: 'gemini-new',
        httpOptions: { baseUrl: 'https://trusted.example/gemini' },
        headers: {}
      })
    })

    const savedConfig = upsertImageModelConfig.mock.calls[0]?.[0] as { modelConfig: string }
    expect(savedConfig.modelConfig).toContain('old-api-key')
    expect(savedConfig.modelConfig).toContain('old-token')
    expect(savedConfig.modelConfig).toContain('old-authorization')
    expect(savedConfig.modelConfig).toContain('old-secret')
    expect(db.upsertImageModelConfig).toHaveBeenCalled()
  })
})
