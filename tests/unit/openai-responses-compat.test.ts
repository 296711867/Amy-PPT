import { describe, expect, it, vi } from 'vitest'
import {
  CompatibleChatOpenAIResponses,
  OPENAI_RESPONSES_FORMAT_ERROR_CODE,
  isOpenAIResponsesFormatError,
  normalizeOpenAIResponsesResponse,
  normalizeOpenAIResponsesStream
} from '../../src/main/agent-runtime/model'

describe('CompatibleChatOpenAIResponses', () => {
  it('passes through non-stream Responses API payloads with output arrays', async () => {
    const model = new CompatibleChatOpenAIResponses({
      model: 'gpt-5.1',
      apiKey: 'secret'
    })
    const payload = { id: 'resp_1', output: [] }
    vi.spyOn(Object.getPrototypeOf(CompatibleChatOpenAIResponses.prototype), 'completionWithRetry')
      .mockResolvedValueOnce(payload)

    await expect(
      model.completionWithRetry({ model: 'gpt-5.1', input: 'OK', stream: false })
    ).resolves.toBe(payload)
  })

  it('throws a stable error when non-stream payloads are missing output arrays', async () => {
    const model = new CompatibleChatOpenAIResponses({
      model: 'gpt-5.1',
      apiKey: 'secret'
    })
    vi.spyOn(Object.getPrototypeOf(CompatibleChatOpenAIResponses.prototype), 'completionWithRetry')
      .mockResolvedValueOnce({ id: 'chatcmpl_1', choices: [] })

    await expect(
      model.completionWithRetry({ model: 'gpt-5.1', input: 'OK', stream: false })
    ).rejects.toMatchObject({
      name: OPENAI_RESPONSES_FORMAT_ERROR_CODE
    })
  })

  it('passes through valid stream events', async () => {
    const model = new CompatibleChatOpenAIResponses({
      model: 'gpt-5.1',
      apiKey: 'secret'
    })
    const stream = (async function* () {
      yield { type: 'response.created' }
    })()
    vi.spyOn(Object.getPrototypeOf(CompatibleChatOpenAIResponses.prototype), 'completionWithRetry')
      .mockResolvedValueOnce(stream)

    const normalized = await model.completionWithRetry({ model: 'gpt-5.1', input: 'OK', stream: true })
    const events = []
    for await (const event of normalized) events.push(event)
    expect(events).toEqual([{ type: 'response.created' }])
  })

  it('adds an empty output array to incomplete response.completed snapshots', async () => {
    const stream = (async function* () {
      yield { type: 'response.output_text.delta', delta: 'done' }
      yield {
        type: 'response.completed',
        response: { id: 'resp_1', status: 'completed', usage: null }
      }
    })()

    const events = []
    for await (const event of normalizeOpenAIResponsesStream(stream as never)) events.push(event)

    expect(events[0]).toMatchObject({ type: 'response.output_text.delta', delta: 'done' })
    expect(events[1]).toMatchObject({
      type: 'response.completed',
      response: { id: 'resp_1', output: [] }
    })
  })

  it('preserves a complete response.completed snapshot', async () => {
    const completed = {
      type: 'response.completed',
      response: {
        id: 'resp_2',
        status: 'completed',
        output: [{ type: 'message', content: [] }]
      }
    }
    const stream = (async function* () {
      yield completed
    })()

    const events = []
    for await (const event of normalizeOpenAIResponsesStream(stream as never)) events.push(event)

    expect(events[0]).toBe(completed)
  })

  it('normalizes nested arrays used by the LangChain Responses converter', () => {
    const response = normalizeOpenAIResponsesResponse({
      id: 'resp_nested',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'done' }]
        },
        {
          type: 'reasoning'
        }
      ]
    })

    expect(response.output).toEqual([
      {
        type: 'message',
        content: [{ type: 'output_text', text: 'done', annotations: [] }]
      },
      {
        type: 'reasoning',
        summary: []
      }
    ])
  })

  it('adds an empty content array to incomplete message output items', () => {
    const response = normalizeOpenAIResponsesResponse({
      id: 'resp_message',
      output: [{ type: 'message' }]
    })

    expect(response.output).toEqual([{ type: 'message', content: [] }])
  })
})

describe('isOpenAIResponsesFormatError', () => {
  it('matches current and older V8 undefined map errors', () => {
    expect(
      isOpenAIResponsesFormatError(
        new TypeError("Cannot read properties of undefined (reading 'map')")
      )
    ).toBe(true)
    expect(isOpenAIResponsesFormatError(new TypeError("Cannot read property 'map' of undefined"))).toBe(
      true
    )
  })
})
