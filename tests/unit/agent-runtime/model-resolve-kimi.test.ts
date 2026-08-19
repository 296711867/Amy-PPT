import { beforeEach, describe, expect, it, vi } from 'vitest'

// 捕获传入 ChatOpenAICompletions 的构造参数，便于断言 kimi 分支的兼容处理
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

describe('resolveModel kimi provider', () => {
  beforeEach(() => {
    openaiCtor.mockClear()
  })

  it('routes kimi through OpenAI Chat Completions against the coding endpoint', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')

    resolveModel(
      'kimi',
      'secret-key',
      'kimi-for-coding',
      'https://api.kimi.com/coding/v1',
      undefined,
      4096
    )

    expect(openaiCtor).toHaveBeenCalledTimes(1)
    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opts.model).toBe('kimi-for-coding')
    expect(opts.apiKey).toBe('secret-key')
    expect(opts.configuration).toEqual({ baseURL: 'https://api.kimi.com/coding/v1' })
    // 非 openai.com 主机在 auto 模式下显式禁用 thinking，保证 JSON 输出可见；
    // Kimi 关闭 thinking 会自动路由到 K2.6，仍可正常出稿。
    expect(opts.modelKwargs).toEqual({ thinking: { type: 'disabled' } })
  })

  it('respects the explicit omit mode for gateways without thinking support', async () => {
    const { resolveModel } = await import('../../../src/main/agent-runtime/model/resolve')
    const { runWithModelTemperatureControl } = await import(
      '../../../src/main/agent-runtime/model/runtime'
    )

    runWithModelTemperatureControl({ thinkingParameterMode: 'omit' }, () =>
      resolveModel('kimi', 'secret-key', 'k3', 'https://api.kimi.com/coding/v1', undefined, 8192)
    )

    const opts = openaiCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opts.modelKwargs).toEqual({})
  })
})
