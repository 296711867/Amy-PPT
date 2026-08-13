import type { DeckQualityReport, DeckQualityViolation } from './deck-quality-validator'

const violationKey = (code: string, pageId: string): string => `${code}:${pageId}`

export function findNewDeckHardViolations(args: {
  before: DeckQualityReport
  after: DeckQualityReport
  pageIds?: readonly string[]
}): DeckQualityViolation[] {
  const scopedPageIds = args.pageIds?.length ? new Set(args.pageIds) : null
  const beforeKeys = new Set(
    args.before.violations
      .filter((violation) => violation.severity === 'error')
      .flatMap((violation) =>
        violation.pageIds.map((pageId) => violationKey(violation.code, pageId))
      )
  )

  return args.after.violations
    .filter((violation) => violation.severity === 'error')
    .map((violation) => ({
      ...violation,
      pageIds: violation.pageIds.filter(
        (pageId) =>
          (!scopedPageIds || scopedPageIds.has(pageId)) &&
          !beforeKeys.has(violationKey(violation.code, pageId))
      )
    }))
    .filter((violation) => violation.pageIds.length > 0)
}
