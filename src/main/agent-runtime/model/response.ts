import {
  AIMessage,
  collapseToolCallChunks,
  type AIMessageFields,
  type ToolCallChunk
} from '@langchain/core/messages'
import { isCommand } from '@langchain/langgraph'

type ObjectRecord = Record<string, unknown>

const getObject = (value: unknown): ObjectRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectRecord) : null

const getNestedRecords = (record: ObjectRecord): ObjectRecord[] =>
  [record.data, record.kwargs, record.lc_kwargs]
    .map(getObject)
    .filter((value): value is ObjectRecord => value !== null)

type NormalizedToolCall = NonNullable<AIMessageFields['tool_calls']>[number]
type NormalizedInvalidToolCall = NonNullable<AIMessageFields['invalid_tool_calls']>[number]

const readMessageField = (record: ObjectRecord, key: string): unknown => {
  if (record[key] !== undefined) return record[key]
  for (const nested of getNestedRecords(record)) {
    if (nested[key] !== undefined) return nested[key]
  }
  return undefined
}

const readMessageArray = (record: ObjectRecord, key: string): unknown[] | undefined => {
  const direct = readMessageField(record, key)
  if (Array.isArray(direct) && direct.length > 0) return direct
  const additional = getObject(readMessageField(record, 'additional_kwargs'))
  const nested = additional?.[key]
  return Array.isArray(nested) && nested.length > 0 ? nested : undefined
}

const readToolCallData = (
  record: ObjectRecord
): {
  toolCalls?: unknown[]
  toolCallChunks?: unknown[]
  hasToolCallData: boolean
} => {
  const toolCalls = readMessageArray(record, 'tool_calls') || readMessageArray(record, 'toolCalls')
  const toolCallChunks = readMessageArray(record, 'tool_call_chunks')
  return {
    toolCalls,
    toolCallChunks,
    hasToolCallData: Boolean(toolCalls?.length || toolCallChunks?.length)
  }
}

const parseToolCallArgs = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const normalizeToolCalls = (calls: unknown[]): {
  toolCalls: NormalizedToolCall[]
  invalidToolCalls: NormalizedInvalidToolCall[]
} => {
  const toolCalls: NormalizedToolCall[] = []
  const invalidToolCalls: NormalizedInvalidToolCall[] = []

  for (const call of calls) {
    const record = getObject(call)
    if (!record) continue
    const functionRecord = getObject(record.function)
    const name = String(record.name ?? functionRecord?.name ?? '').trim()
    const id = typeof record.id === 'string' ? record.id : undefined
    const rawArgs = functionRecord?.arguments ?? record.args
    const args = parseToolCallArgs(rawArgs)
    if (name && args) {
      toolCalls.push({
        name,
        args,
        ...(id ? { id } : {}),
        ...(record.type === 'tool_call' ? { type: 'tool_call' as const } : {})
      })
      continue
    }
    if (name || id) {
      invalidToolCalls.push({
        name: name || undefined,
        args: typeof rawArgs === 'string' ? rawArgs : String(rawArgs ?? ''),
        id,
        error: 'Malformed args.'
      })
    }
  }

  return { toolCalls, invalidToolCalls }
}

const normalizeToolCallChunks = (chunks: unknown[]): {
  toolCalls: NormalizedToolCall[]
  invalidToolCalls: NormalizedInvalidToolCall[]
} => {
  const normalizedChunks = chunks.flatMap((chunk): ToolCallChunk[] => {
    const record = getObject(chunk)
    if (!record) return []
    const args = record.args
    return [
      {
        ...(typeof record.id === 'string' ? { id: record.id } : {}),
        ...(typeof record.name === 'string' ? { name: record.name } : {}),
        args:
          typeof args === 'string'
            ? args
            : args === undefined
              ? ''
              : (() => {
                  try {
                    return JSON.stringify(args)
                  } catch {
                    return String(args)
                  }
                })(),
        ...(typeof record.index === 'number' ? { index: record.index } : {})
      }
    ]
  })
  const collapsed = collapseToolCallChunks(normalizedChunks)
  return {
    toolCalls: collapsed.tool_calls as NormalizedToolCall[],
    invalidToolCalls: collapsed.invalid_tool_calls as NormalizedInvalidToolCall[]
  }
}

const readSerializedMessageId = (record: ObjectRecord): string => {
  const id = readMessageField(record, 'id')
  if (Array.isArray(id)) return id.map((part) => String(part)).join('/')
  return typeof id === 'string' ? id : ''
}

const readMessageType = (record: ObjectRecord): string => {
  const role = String(readMessageField(record, 'role') || '').toLowerCase()
  if (role) return role

  const directType = String(record.type || '').toLowerCase()
  if (directType && directType !== 'constructor') return directType

  for (const nested of getNestedRecords(record)) {
    const nestedRole = String(nested.role || '').toLowerCase()
    if (nestedRole) return nestedRole
    const nestedType = String(nested.type || '').toLowerCase()
    if (nestedType && nestedType !== 'constructor') return nestedType
  }

  try {
    if (typeof record._getType === 'function') return String(record._getType()).toLowerCase()
  } catch {
    // Some serialized message shims expose _getType but throw when detached from the class.
  }

  const serializedId = readSerializedMessageId(record).toLowerCase()
  if (serializedId.includes('aimessagechunk')) return 'aimessagechunk'
  if (serializedId.includes('aimessage')) return 'aimessage'
  return directType
}

const describeResponse = (record: ObjectRecord): string => {
  const constructorName = record.constructor?.name || 'Object'
  const type = readMessageType(record) || 'unknown'
  const keys = Object.keys(record).slice(0, 20).sort().join(',') || 'none'
  return `constructor=${constructorName}; type=${type}; keys=${keys}`
}

const isStructuredModelResponse = (record: ObjectRecord): boolean =>
  'structuredResponse' in record && 'messages' in record

const findGenerationMessage = (value: unknown): ObjectRecord | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = findGenerationMessage(item)
      if (message) return message
    }
    return null
  }

  const record = getObject(value)
  if (!record) return null
  const message = getObject(record.message)
  if (message) return message
  return Array.isArray(record.generations) ? findGenerationMessage(record.generations) : null
}

const isAssistantMessage = (record: ObjectRecord): boolean => {
  const type = readMessageType(record)
  const constructorName = String(record.constructor?.name || '').toLowerCase()
  const serializedId = readSerializedMessageId(record).toLowerCase()
  return (
    type === 'ai' ||
    type === 'assistant' ||
    type === 'aimessage' ||
    type === 'aimessagechunk' ||
    // OpenAI-compatible thinking streams (e.g. GLM reasoning chunks) may emit
    // deltas without an explicit role; the converter then yields a generic
    // ChatMessageChunk that is still assistant output. Explicit non-assistant
    // roles surface as their own type and stay rejected below.
    (type === 'generic' && constructorName === 'chatmessagechunk') ||
    constructorName === 'aimessage' ||
    constructorName === 'aimessagechunk' ||
    serializedId.includes('aimessage')
  )
}

/**
 * Convert compatible-provider response shims into the internal LangChain response contract.
 * Unknown objects stay rejected so malformed provider payloads do not enter the agent loop.
 */
export function normalizeModelResponse(response: unknown): unknown {
  if (AIMessage.isInstance(response) || isCommand(response)) return response

  const responseRecord = getObject(response)
  if (!responseRecord) {
    throw new Error(
      `Model returned an unsupported response: expected an object, got ${typeof response}`
    )
  }
  if (isStructuredModelResponse(responseRecord)) return response

  const candidate =
    getObject(responseRecord.message) ||
    findGenerationMessage(responseRecord.generations) ||
    responseRecord
  const content = readMessageField(candidate, 'content')
  const { toolCalls: rawToolCalls, toolCallChunks, hasToolCallData } = readToolCallData(candidate)
  const normalizedToolCalls = rawToolCalls ? normalizeToolCalls(rawToolCalls) : null
  const normalizedToolCallChunks = toolCallChunks
    ? normalizeToolCallChunks(toolCallChunks)
    : { toolCalls: [], invalidToolCalls: [] }
  const toolCalls = [
    ...(normalizedToolCalls?.toolCalls || []),
    ...normalizedToolCallChunks.toolCalls
  ]
  const invalidToolCalls = [
    ...(normalizedToolCalls?.invalidToolCalls || []),
    ...normalizedToolCallChunks.invalidToolCalls
  ]

  if (
    !isAssistantMessage(candidate) ||
    (typeof content !== 'string' && !Array.isArray(content) && !hasToolCallData)
  ) {
    throw new Error(
      `Model returned an unsupported response object: ${describeResponse(candidate)}`
    )
  }

  const id = readMessageField(candidate, 'id')
  const name = readMessageField(candidate, 'name')
  const existingInvalidToolCalls = readMessageField(candidate, 'invalid_tool_calls')
  const usageMetadata = readMessageField(candidate, 'usage_metadata')

  return new AIMessage({
    content:
      typeof content === 'string' || Array.isArray(content)
        ? (content as AIMessageFields['content'])
        : '',
    additional_kwargs: getObject(readMessageField(candidate, 'additional_kwargs')) || {},
    response_metadata: getObject(readMessageField(candidate, 'response_metadata')) || {},
    ...(toolCalls.length ? { tool_calls: toolCalls as AIMessageFields['tool_calls'] } : {}),
    ...(Array.isArray(existingInvalidToolCalls) || invalidToolCalls.length
      ? {
          invalid_tool_calls: [
            ...(Array.isArray(existingInvalidToolCalls) ? existingInvalidToolCalls : []),
            ...invalidToolCalls
          ] as AIMessageFields['invalid_tool_calls']
        }
      : {}),
    ...(getObject(usageMetadata)
      ? { usage_metadata: usageMetadata as AIMessageFields['usage_metadata'] }
      : {}),
    ...(typeof id === 'string' ? { id } : {}),
    ...(typeof name === 'string' ? { name } : {})
  })
}

export const normalizeAgentModelResponse = normalizeModelResponse
