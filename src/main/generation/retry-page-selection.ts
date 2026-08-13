import type { GenerationPageRecord, SessionPageRecord } from '../db/database'

export function selectRetrySessionPages(args: {
  sessionPages: SessionPageRecord[]
  sourceRunPages?: GenerationPageRecord[]
}): { selected: SessionPageRecord[]; staleIds: string[] } {
  const sourcePageIds = new Set(
    (args.sourceRunPages || []).map((page) => page.page_id).filter(Boolean)
  )
  let selected: SessionPageRecord[]

  if (sourcePageIds.size > 0) {
    selected = args.sessionPages.filter((page) => sourcePageIds.has(page.file_slug))
  } else {
    const latestByPageNumber = new Map<number, SessionPageRecord>()
    for (const page of args.sessionPages) {
      const previous = latestByPageNumber.get(page.page_number)
      if (
        !previous ||
        page.updated_at > previous.updated_at ||
        (page.updated_at === previous.updated_at && page.created_at >= previous.created_at)
      ) {
        latestByPageNumber.set(page.page_number, page)
      }
    }
    selected = Array.from(latestByPageNumber.values())
  }

  const selectedIds = new Set(selected.map((page) => page.id))
  return {
    selected: selected.sort((a, b) => a.page_number - b.page_number),
    staleIds: args.sessionPages
      .filter((page) => !selectedIds.has(page.id))
      .map((page) => page.id)
  }
}
