import type { ImageGenerationMessage } from '@renderer/store'
import type { ImageGenerationHistoryRecord } from '@shared/image-generation.js'

export function buildImageMessageCacheKey(sessionId: string, pageId: string): string {
  return `${sessionId}:${pageId}`
}

export function mergeImageMessages(
  ...groups: ImageGenerationMessage[][]
): ImageGenerationMessage[] {
  const messagesById = new Map<string, ImageGenerationMessage>()
  for (const message of groups.flat()) {
    messagesById.set(message.id, message)
  }
  return [...messagesById.values()]
    .sort((a, b) => {
      const byTime = a.createdAt - b.createdAt
      if (byTime !== 0) return byTime
      if (a.role === b.role) return a.id.localeCompare(b.id)
      return a.role === 'user' ? -1 : 1
    })
    .slice(-48)
}

export function imageHistoryToMessages(
  histories: ImageGenerationHistoryRecord[]
): ImageGenerationMessage[] {
  return [...histories]
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((history) => [
      {
        id: `${history.id}:user`,
        role: 'user' as const,
        content: history.prompt,
        createdAt: history.createdAt
      },
      {
        id: `${history.id}:assistant`,
        role: 'assistant' as const,
        content: '',
        assets: history.assets,
        createdAt: history.createdAt
      }
    ])
}
