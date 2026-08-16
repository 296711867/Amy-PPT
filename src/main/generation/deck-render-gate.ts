export type DeckRenderGateReport = {
  available: boolean
  unavailablePages: Array<{ pageId: string; reason: string }>
}

export function resolveIncompleteDeckRenderPages(report: DeckRenderGateReport): Array<{
  pageId: string
  reason: string
}> {
  if (report.available) return []
  return report.unavailablePages.filter((page) => page.pageId.trim().length > 0)
}
