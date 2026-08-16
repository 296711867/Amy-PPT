import { describe, expect, it } from 'vitest'
import {
  classifyThinkingChatError,
  createThinkingChatIpcError,
  normalizeThinkingChatFailure
} from '../../../src/shared/thinking-chat-error'

describe('thinking chat error normalization', () => {
  it('classifies the OpenAI Responses undefined.map failure', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'map')")

    expect(classifyThinkingChatError(error)).toBe('response-format')
    expect(normalizeThinkingChatFailure(error).message).toContain('Provider')
  })

  it('preserves a structured error kind across Electron IPC wrapping', () => {
    const ipcError = createThinkingChatIpcError(new Error('fetch failed: ECONNRESET'))
    const wrapped = new Error(`Error invoking remote method 'thinking:chat': ${ipcError.message}`)

    expect(classifyThinkingChatError(wrapped)).toBe('connection')
    expect(normalizeThinkingChatFailure(wrapped).reconnectable).toBe(true)
  })

  it('recognizes authentication, rate limit and timeout failures', () => {
    expect(classifyThinkingChatError(new Error('401 Unauthorized'))).toBe('authentication')
    expect(classifyThinkingChatError(new Error('429 rate limit exceeded'))).toBe('rate-limit')
    expect(classifyThinkingChatError(new Error('Request timed out'))).toBe('timeout')
  })

  it('distinguishes agent response contract failures from connection failures', () => {
    const error = new Error(
      'Invalid response from "wrapModelCall": expected AIMessage or Command, got object'
    )

    expect(classifyThinkingChatError(error)).toBe('model-response')
    expect(normalizeThinkingChatFailure(error).message).toContain('模型已连接')
    expect(normalizeThinkingChatFailure(error).reconnectable).toBe(true)
  })
})
