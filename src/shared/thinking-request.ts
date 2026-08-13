import type { ThinkingChatMessage, ThinkingSource } from './thinking'

export function appendThinkingUserMessage(
  messages: ThinkingChatMessage[],
  request: { content: string; attachments?: ThinkingSource[] },
  appendUserMessage: boolean,
  timestamp = Date.now()
): ThinkingChatMessage[] {
  if (!appendUserMessage) return messages
  return [
    ...messages,
    {
      role: 'user',
      content: request.content,
      timestamp,
      ...(request.attachments && request.attachments.length > 0
        ? { attachments: request.attachments }
        : {})
    }
  ]
}
