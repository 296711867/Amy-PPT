import { beforeEach, describe, expect, it, vi } from 'vitest'

// 捕获传入 ChatOpenAICompletions 的构造参数，便于断言 zhipu 分支的兼容处理
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

describe('resolveModel zhipu provider', () => {
  beforeEach(() => {
    openaiCtor.mockClear()
  })

  it('routes zhipu through OpenAI Chat Completions with thinking disabled', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')

    resolveModel(
      'zhipu',
      'secret-key',
      'glm-4.6',
      'https://open.bigmodel.cn/api/paas/v4/',
      undefined,
      4096
    )

    expect(openaiCtor).toHaveBeenCalledTimes(1)
    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    // 基本字段透传
    expect(opts.model).toBe('glm-4.6')
    expect(opts.apiKey).toBe('secret-key')
    // base URL 规范化（去掉末尾斜杠）
    expect(opts.configuration).toEqual({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4'
    })
    // Structured JSON needs visible output, so GLM reasoning is disabled explicitly.
    expect(opts.modelKwargs).toEqual({ thinking: { type: 'disabled' } })
  })

  it('keeps a custom self-hosted gateway base url for zhipu', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')

    resolveModel(
      'zhipu',
      'secret-key',
      'glm-4.5-air',
      'https://gateway.example.com/v1/',
      undefined,
      8192
    )

    expect(openaiCtor).toHaveBeenCalledTimes(1)
    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opts.configuration).toEqual({ baseURL: 'https://gateway.example.com/v1' })
    expect(opts.modelKwargs).toEqual({ thinking: { type: 'disabled' } })
  })

  it('respects the explicit omit mode for older Zhipu-compatible gateways', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')
    const { runWithModelTemperatureControl } = await import(
      '../../../src/main/agent-runtime/model/runtime'
    )

    runWithModelTemperatureControl({ thinkingParameterMode: 'omit' }, () =>
      resolveModel(
        'zhipu',
        'secret-key',
        'glm-compatible',
        'https://gateway.example.com/v1',
        undefined,
        4096
      )
    )

    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opts.modelKwargs).toEqual({})
  })
})
