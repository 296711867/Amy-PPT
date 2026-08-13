import { isPlaceholderPageHtml } from '../presentation/html/html-utils'

/** A controlled page write is durable even when the model stream fails during its final reply. */
export function hasCommittedGeneratedPage(beforeHtml: string, afterHtml: string): boolean {
  return Boolean(afterHtml && afterHtml !== beforeHtml && !isPlaceholderPageHtml(afterHtml))
}
