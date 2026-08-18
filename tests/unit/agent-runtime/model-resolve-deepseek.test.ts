import { beforeEach, describe, expect, it, vi } from 'vitest'

// 捕获传入 ChatOpenAICompletions 的构造参数，便于断言 deepseek 分支的兼容处理
const openaiCtor = vi.hoisted(() => vi.fn())

vi.mock('@langchain/openai', () => ({
  ChatOpenAICompletions: class {
    constructor(opts: unknown) {
      openaiCtor(opts)
    }
  }
}))

vi.mock('@langchain/anthropic', () => ({ ChatAnthropic: vi.fn() }))
vi.mock('@langchain/google-genai', () => ({ ChatGoogleGenerativeAI: vi.fn() }))
vi.mock('electron-log/main.js', () => ({ default: { info: vi.fn(), error: vi.fn() } }))

vi.mock('../../../src/main/agent-runtime/model/responses-compat', () => ({
  CompatibleChatOpenAIResponses: vi.fn()
}))

vi.mock('../../../src/main/agent-runtime/model/usage', () => ({
  ModelUsageCallbackHandler: class {
    constructor(_opts: unknown) {}
  }
}))

describe('resolveModel deepseek provider', () => {
  beforeEach(() => {
    openaiCtor.mockClear()
  })

  it('routes deepseek through OpenAI Chat Completions against the official endpoint', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')

    resolveModel(
      'deepseek',
      'secret-key',
      'deepseek-v4-pro',
      'https://api.deepseek.com',
      undefined,
      4096
    )

    expect(openaiCtor).toHaveBeenCalledTimes(1)
    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opts.model).toBe('deepseek-v4-pro')
    expect(opts.apiKey).toBe('secret-key')
    expect(opts.configuration).toEqual({ baseURL: 'https://api.deepseek.com' })
    // DeepSeek 官方支持 thinking 参数：auto 模式下默认禁用，保证 JSON 输出可见
    expect(opts.modelKwargs).toEqual({ thinking: { type: 'disabled' } })
  })

  it('respects the explicit omit mode for gateways without thinking support', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')
    const { runWithModelTemperatureControl } = await import(
      '../../../src/main/agent-runtime/model/runtime'
    )

    runWithModelTemperatureControl({ thinkingParameterMode: 'omit' }, () =>
      resolveModel(
        'deepseek',
        'secret-key',
        'deepseek-v4-flash',
        'https://gateway.example.com/v1/',
        undefined,
        4096
      )
    )

    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opts.configuration).toEqual({ baseURL: 'https://gateway.example.com/v1' })
    expect(opts.modelKwargs).toEqual({})
  })
})
