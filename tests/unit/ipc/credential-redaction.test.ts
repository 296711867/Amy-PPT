import { describe, expect, it } from 'vitest'
import {
  mergeCredentialConfig,
  redactCredentialJson,
  redactCredentials,
  redactSensitiveText
} from '../../../src/main/config/credential-redaction'

describe('credential redaction', () => {
  it('removes sensitive keys recursively without changing public fields', () => {
    const result = redactCredentials({
      model: 'image-model',
      API_KEY: 'top-secret',
      nested: {
        Secret_Key: 'nested-secret',
        headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session-cookie',
          'X-Auth': 'custom-auth',
          'X-Custom': 'custom-value',
          Accept: 'application/json'
        },
        httpOptions: {
          HEADERS: { Cookie: 'nested-cookie', 'X-Trace': 'trace-value' }
        }
      },
      sizes: ['2K'],
      variants: [{ headers: { Cookie: 'array-cookie', 'X-Auth': 'array-auth' } }]
    })

    expect(result).toEqual({
      model: 'image-model',
      nested: {
        headers: {},
        httpOptions: {
          HEADERS: {}
        }
      },
      sizes: ['2K'],
      variants: [{ headers: {} }]
    })
  })

  it('preserves omitted credentials and replaces explicitly supplied ones', () => {
    const existing = {
      model: 'old-model',
      apiKey: 'old-key',
      secretKey: 'old-secret-key',
      nested: { secretKey: 'old-secret', keep: true }
    }

    expect(
      mergeCredentialConfig(existing, {
        model: 'new-model',
        nested: { keep: false }
      })
    ).toEqual({
      model: 'new-model',
      apiKey: 'old-key',
      secretKey: 'old-secret-key',
      nested: { secretKey: 'old-secret', keep: false }
    })

    expect(
      mergeCredentialConfig(existing, {
        api_key: 'new-key',
        nested: { SECRET_KEY: 'new-secret' }
      })
    ).toEqual({
      secretKey: 'old-secret-key',
      api_key: 'new-key',
      nested: { SECRET_KEY: 'new-secret' }
    })
  })

  it('only restores omitted nested credentials and replaces arrays as a whole', () => {
    expect(
      mergeCredentialConfig(
        {
          model: 'old-model',
          apiKey: 'old-key',
          requestBody: {
            prompt: 'old-prompt',
            temperature: 0.7,
            apiKey: 'nested-key'
          },
          modelKwargs: { seed: 1, token: 'nested-token' },
          generationConfig: { size: 'old-size', secretKey: 'nested-secret' },
          variants: [{ label: 'old', apiKey: 'array-key' }]
        },
        {
          model: 'new-model',
          requestBody: { prompt: 'new-prompt' },
          modelKwargs: {},
          generationConfig: { size: 'new-size' },
          variants: [{ label: 'new' }]
        }
      )
    ).toEqual({
      model: 'new-model',
      apiKey: 'old-key',
      requestBody: { prompt: 'new-prompt', apiKey: 'nested-key' },
      modelKwargs: { token: 'nested-token' },
      generationConfig: { size: 'new-size', secretKey: 'nested-secret' },
      variants: [{ label: 'new' }]
    })
  })

  it('retains empty headers for the same scope but replaces supplied headers', () => {
    const existing = {
      httpOptions: {
        baseUrl: 'https://trusted.example',
        HEADERS: { Cookie: 'old-cookie', 'X-Auth': 'old-auth' }
      }
    }

    expect(
      mergeCredentialConfig(existing, {
        httpOptions: {
          baseUrl: 'https://trusted.example',
          headers: {}
        }
      })
    ).toEqual({
      httpOptions: {
        baseUrl: 'https://trusted.example',
        headers: { Cookie: 'old-cookie', 'X-Auth': 'old-auth' }
      }
    })

    expect(
      mergeCredentialConfig(existing, {
        httpOptions: {
          baseUrl: 'https://trusted.example',
          headers: { 'X-Custom': 'new-value' }
        }
      })
    ).toEqual({
      httpOptions: {
        baseUrl: 'https://trusted.example',
        headers: { 'X-Custom': 'new-value' }
      }
    })
  })

  it('redacts JSON and known values from error text', () => {
    expect(redactCredentialJson('{"model":"m","aPiKey":"secret","nested":{"TOKEN":"x"}}')).toBe(`{
  "model": "m",
  "nested": {}
}`)
    expect(redactSensitiveText('request failed apiKey=secret-value', ['secret-value'])).toBe(
      'request failed apiKey=[REDACTED]'
    )
  })
})
