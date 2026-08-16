import { AIMessage, ChatMessageChunk } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { describe, expect, it, vi } from 'vitest'
import {
  createThinkingToolAllowlistMiddleware,
  normalizeThinkingModelResponse
} from '../../../src/main/thinking/model-response'

describe('thinking model response adapter', () => {
  it('keeps valid AI messages and commands unchanged', () => {
    const message = new AIMessage('ready')
    const command = new Command({ update: { messages: [] } })

    expect(normalizeThinkingModelResponse(message)).toBe(message)
    expect(normalizeThinkingModelResponse(command)).toBe(command)
  })

  it('keeps structured agent responses unchanged', () => {
    const response = { structuredResponse: { status: 'ok' }, messages: [] }

    expect(normalizeThinkingModelResponse(response)).toBe(response)
  })

  it('converts a serialized ChatResult generation into an AIMessage', () => {
    const response = {
      generations: [
        [
          {
            message: {
              type: 'ai',
              data: {
                content: 'ready from generation',
                additional_kwargs: { trace: 'test' }
              }
            }
          }
        ]
      ]
    }

    const normalized = normalizeThinkingModelResponse(response)

    expect(normalized).toBeInstanceOf(AIMessage)
    expect((normalized as AIMessage).content).toBe('ready from generation')
    expect((normalized as AIMessage).additional_kwargs).toEqual({ trace: 'test' })
  })

  it('normalizes generic ChatMessageChunk tool calls from additional kwargs', () => {
    const response = new ChatMessageChunk({
      role: 'assistant',
      content: '',
      additional_kwargs: {
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"/page-1.html"}' }
          }
        ]
      }
    })

    const normalized = normalizeThinkingModelResponse(response)

    expect(normalized).toBeInstanceOf(AIMessage)
    expect((normalized as AIMessage).tool_calls).toEqual([
      { name: 'read_file', args: { path: '/page-1.html' }, id: 'call-1' }
    ])
  })

  it('collapses generic ChatMessageChunk tool call chunks from additional kwargs', () => {
    const response = new ChatMessageChunk({
      role: 'assistant',
      content: '',
      additional_kwargs: {
        tool_call_chunks: [
          { id: 'call-2', name: 'read_file', args: '{"path":', index: 0 },
          { id: 'call-2', args: '"/page-2.html"}', index: 0 }
        ]
      }
    })

    const normalized = normalizeThinkingModelResponse(response)

    expect(normalized).toBeInstanceOf(AIMessage)
    expect((normalized as AIMessage).tool_calls).toEqual([
      {
        name: 'read_file',
        args: { path: '/page-2.html' },
        id: 'call-2',
        type: 'tool_call'
      }
    ])
  })

  it('accepts a role-less generic ChatMessageChunk from GLM thinking streams', () => {
    // GLM thinking deltas may carry only reasoning_content without a role;
    // the OpenAI converter then yields ChatMessageChunk with role undefined.
    const response = new ChatMessageChunk({
      content: '方案已更新',
      additional_kwargs: { reasoning_content: '分析中' },
      response_metadata: { model_provider: 'openai' }
    } as never)

    const normalized = normalizeThinkingModelResponse(response)

    expect(normalized).toBeInstanceOf(AIMessage)
    expect((normalized as AIMessage).content).toBe('方案已更新')
    expect((normalized as AIMessage).additional_kwargs).toEqual({
      reasoning_content: '分析中'
    })
  })

  it('rejects generic chunks that carry an explicit non-assistant role', () => {
    const response = new ChatMessageChunk({ role: 'tool', content: 'payload' })

    expect(() => normalizeThinkingModelResponse(response)).toThrow(
      /unsupported response object/
    )
  })

  it('filters tools and converts an assistant payload returned by the handler', async () => {
    const handler = vi.fn(async (request: { tools?: Array<{ name: string }> }) => {
      expect(request.tools?.map((tool) => tool.name)).toEqual(['allowed'])
      return { role: 'assistant', content: 'ready' }
    })
    const middleware = createThinkingToolAllowlistMiddleware(new Set(['allowed']))

    const response = await middleware.wrapModelCall?.(
      {
        tools: [{ name: 'allowed' }, { name: 'blocked' }]
      } as never,
      handler as never
    )

    expect(response).toBeInstanceOf(AIMessage)
    expect((response as AIMessage).content).toBe('ready')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('throws a diagnostic error for an unknown response object', () => {
    expect(() => normalizeThinkingModelResponse({ generations: [] })).toThrow(
      /unsupported response object/
    )
  })
})
