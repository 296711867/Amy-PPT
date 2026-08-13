import type { GenerationDbPort } from './context'

export async function retireActiveSessionPagesForReplacement(
  db: Pick<GenerationDbPort, 'listSessionPages' | 'softDeleteSessionPages'>,
  sessionId: string
): Promise<number> {
  const activePages = await db.listSessionPages(sessionId)
  const activePageIds = activePages.map((page) => page.id).filter(Boolean)
  if (activePageIds.length === 0) return 0
  await db.softDeleteSessionPages(sessionId, activePageIds)
  return activePageIds.length
}
