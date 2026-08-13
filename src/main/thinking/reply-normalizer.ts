export function isWorkflowToolOutputText(text: string): boolean {
  const value = text.trim()
  return /^context\.md updated for stage \w+\./.test(value) || value === 'thinking.md updated'
}

export function normalizeThinkingAssistantReply(text: string): string {
  let next = text.trim()
  if (!next || isWorkflowToolOutputText(next)) return ''

  // Some providers stream tool-call JSON arguments as text before the actual reply.
  // Keep the human-facing tail instead of persisting the internal argument payload.
  if (/^"?topic"?\s*:/.test(next) && next.includes('"userIntent"')) {
    const end = next.indexOf('}\n\n')
    if (end >= 0) {
      next = next.slice(end + 3).trim()
    }
  }

  return isWorkflowToolOutputText(next) ? '' : next
}

export function normalizeThinkingMessages<T extends { role: string; content: string }>(
  messages: T[]
): T[] {
  return messages.flatMap((message) => {
    if (message.role !== 'assistant') return message.content.trim() ? [message] : []
    const content = normalizeThinkingAssistantReply(message.content)
    return content ? [{ ...message, content }] : []
  })
}
