import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutTemplate, Loader2, Search } from 'lucide-react'
import { useT } from '@renderer/i18n'
import {
  ipc,
  type MergeSourcePageSummary,
  type MergeTemplateSourceSummary
} from '@renderer/lib/ipc'
import { useGenerateStore, useSessionDetailUiStore, useToastStore } from '@renderer/store'
import { localAssetUrl } from '@shared/local-asset'
import { readPageMergeErrorCode, type PageMergeDisabledReason } from '@shared/page-merge'
import { requireSlideSize } from '@shared/slide-size'
import { PreviewIframe } from '../../preview/PreviewIframe'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/Dialog'
import { Input } from '../../ui/Input'
import { ScrollArea } from '../../ui/ScrollArea'
import { usePreviewWindow } from '../hooks/usePreviewWindow'

interface MergeTemplatePagesDialogProps {
  sessionId: string
}

const MAX_MERGE_PAGE_COUNT = 50
const MERGE_PREVIEW_LIMIT = 6

function TemplatePagePreview({
  page,
  renderPreview
}: {
  page: MergeSourcePageSummary
  renderPreview: boolean
}): React.JSX.Element {
  const slideSize = requireSlideSize({
    id: page.slideSizeId,
    width: page.slideWidth,
    height: page.slideHeight
  })

  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{ aspectRatio: `${slideSize.width}/${slideSize.height}` }}
    >
      {renderPreview && (page.htmlPath || page.sourceUrl) ? (
        <PreviewIframe
          src={page.sourceUrl}
          htmlPath={page.htmlPath}
          pageId={page.pageId}
          title={`merge-template-page-${page.pageNumber}`}
          slideSize={slideSize}
          inspectable={false}
          thumbnail
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          P{page.pageNumber}
        </div>
      )}
    </div>
  )
}

export function MergeTemplatePagesDialog({
  sessionId
}: MergeTemplatePagesDialogProps): React.JSX.Element {
  const t = useT()
  const open = useSessionDetailUiStore((state) => state.mergeTemplatePagesDialogOpen)
  const setOpen = useSessionDetailUiStore((state) => state.setMergeTemplatePagesDialogOpen)
  const setIsAddingPage = useSessionDetailUiStore((state) => state.setIsAddingPage)
  const toastSuccess = useToastStore((state) => state.success)
  const toastError = useToastStore((state) => state.error)
  const toastWarning = useToastStore((state) => state.warning)
  const [query, setQuery] = useState('')
  const [sourceTemplates, setSourceTemplates] = useState<MergeTemplateSourceSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [sourcePages, setSourcePages] = useState<MergeSourcePageSummary[]>([])
  const [selectedSourcePageIds, setSelectedSourcePageIds] = useState<Set<string>>(() => new Set())
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [loadingPages, setLoadingPages] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const pageRequestIdRef = useRef(0)

  const getRequestErrorMessage = useCallback(
    (
      error: unknown,
      fallbackKey:
        | 'sessionDetail.mergeTemplateLoadFailed'
        | 'sessionDetail.mergeTemplatePagesFailed'
    ): string => {
      switch (readPageMergeErrorCode(error)) {
        case 'PAGE_MERGE_INVALID_REQUEST':
          return t('sessionDetail.mergeErrorInvalidRequest')
        case 'PAGE_MERGE_NO_PAGE_SELECTED':
          return t('sessionDetail.mergeErrorNoPageSelected')
        case 'PAGE_MERGE_PAGE_LIMIT_EXCEEDED':
          return t('sessionDetail.mergeErrorPageLimit')
        case 'PAGE_MERGE_SESSION_NOT_FOUND':
          return t('sessionDetail.mergeErrorSessionNotFound')
        case 'PAGE_MERGE_SLIDE_SIZE_MISMATCH':
          return t('sessionDetail.mergeErrorSlideSizeMismatch')
        case 'PAGE_MERGE_SOURCE_PAGE_NOT_FOUND':
          return t('sessionDetail.mergeErrorPageNotFound')
        case 'PAGE_MERGE_SOURCE_PAGE_UNAVAILABLE':
          return t('sessionDetail.mergeErrorPageUnavailable')
        case 'PAGE_MERGE_TARGET_FONT_UNAVAILABLE':
          return t('sessionDetail.mergeErrorTargetFont')
        case 'PAGE_MERGE_PAGE_COPY_FAILED':
          return t('sessionDetail.mergeErrorPageCopy')
        default:
          return t(fallbackKey)
      }
    },
    [t]
  )

  const getDisabledReason = useCallback(
    (reason?: PageMergeDisabledReason): string => {
      switch (reason) {
        case 'PAGE_MERGE_SESSION_EMPTY':
          return t('sessionDetail.mergeDisabledSessionEmpty')
        case 'PAGE_MERGE_SLIDE_SIZE_MISMATCH':
          return t('sessionDetail.mergeDisabledSlideSizeMismatch')
        case 'PAGE_MERGE_PAGE_FILE_MISSING':
          return t('sessionDetail.mergeDisabledPageMissing')
        default:
          return ''
      }
    },
    [t]
  )

  const selectedTemplate = sourceTemplates.find((item) => item.id === selectedTemplateId)
  const filteredTemplates = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    if (!keyword) return sourceTemplates
    return sourceTemplates.filter((item) => item.title.toLocaleLowerCase().includes(keyword))
  }, [query, sourceTemplates])
  const selectablePageIds = useMemo(
    () => sourcePages.filter((page) => page.selectable).map((page) => page.id),
    [sourcePages]
  )
  const sourcePageIds = useMemo(() => sourcePages.map((page) => page.id), [sourcePages])
  const selectablePageCount = Math.min(selectablePageIds.length, MAX_MERGE_PAGE_COUNT)
  const allSelectablePagesSelected =
    selectablePageCount > 0 && selectedSourcePageIds.size === selectablePageCount
  const {
    activePreviewIds: previewPageIds,
    viewportRef: pageViewportRef,
    schedulePreviewWindowUpdate
  } = usePreviewWindow({
    enabled: open && !loadingPages && sourcePages.length > 0,
    itemIds: sourcePageIds,
    limit: MERGE_PREVIEW_LIMIT
  })

  useEffect(() => {
    if (!open || !sessionId) return
    let cancelled = false
    setLoadingTemplates(true)
    setLoadError('')
    void ipc
      .listMergeSourceTemplates({ targetSessionId: sessionId })
      .then((templates) => {
        if (cancelled) return
        setSourceTemplates(templates)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(getRequestErrorMessage(error, 'sessionDetail.mergeTemplateLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [getRequestErrorMessage, open, sessionId])

  useEffect(() => {
    if (open) return
    pageRequestIdRef.current += 1
    setQuery('')
    setSourceTemplates([])
    setSelectedTemplateId('')
    setSourcePages([])
    setSelectedSourcePageIds(new Set())
    setLoadingTemplates(false)
    setLoadingPages(false)
    setSubmitting(false)
    setLoadError('')
  }, [open])

  const handleSelectTemplate = async (
    template: MergeTemplateSourceSummary
  ): Promise<void> => {
    if (!template.selectable || loadingPages || submitting) return
    const requestId = pageRequestIdRef.current + 1
    pageRequestIdRef.current = requestId
    setSelectedTemplateId(template.id)
    setSelectedSourcePageIds(new Set())
    setSourcePages([])
    setLoadingPages(true)
    setLoadError('')
    try {
      const pages = await ipc.listMergeSourceTemplatePages({
        targetSessionId: sessionId,
        templateId: template.id
      })
      if (pageRequestIdRef.current !== requestId) return
      setSourcePages(pages)
    } catch (error) {
      if (pageRequestIdRef.current !== requestId) return
      setLoadError(getRequestErrorMessage(error, 'sessionDetail.mergeTemplateLoadFailed'))
    } finally {
      if (pageRequestIdRef.current === requestId) setLoadingPages(false)
    }
  }

  const togglePage = (page: MergeSourcePageSummary): void => {
    if (!page.selectable || submitting) return
    setSelectedSourcePageIds((current) => {
      const next = new Set(current)
      if (next.has(page.id)) next.delete(page.id)
      else if (next.size < MAX_MERGE_PAGE_COUNT) next.add(page.id)
      else toastWarning(t('sessionDetail.mergePageLimitReached', { count: MAX_MERGE_PAGE_COUNT }))
      return next
    })
  }

  const handleToggleAll = (): void => {
    setSelectedSourcePageIds((current) =>
      current.size === selectablePageCount
        ? new Set()
        : new Set(selectablePageIds.slice(0, MAX_MERGE_PAGE_COUNT))
    )
  }

  const handleConfirm = async (): Promise<void> => {
    if (!selectedTemplateId || selectedSourcePageIds.size === 0 || submitting) return
    setSubmitting(true)
    setIsAddingPage(true)
    try {
      const result = await ipc.mergeTemplatePages({
        targetSessionId: sessionId,
        templateId: selectedTemplateId,
        sourcePageIds: Array.from(selectedSourcePageIds)
      })
      useGenerateStore.getState().setPages(result.generatedPages)
      useSessionDetailUiStore.getState().bumpPreviewKey()
      useSessionDetailUiStore.getState().finishAddPage(result.selectedPageId)
      void ipc
        .clearSpeechScript(sessionId)
        .catch((error) => console.warn('[speech] clearSpeechScript failed', error))
      toastSuccess(
        t('sessionDetail.mergeTemplateSuccess', {
          template: selectedTemplate?.title || t('sessionDetail.mergeTemplateUntitled'),
          count: result.insertedPageIds.length
        })
      )
      setOpen(false)
    } catch (error) {
      useSessionDetailUiStore.getState().finishAddPage(undefined)
      toastError(getRequestErrorMessage(error, 'sessionDetail.mergeTemplatePagesFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) setOpen(nextOpen)
      }}
    >
      <DialogContent
        aria-busy={submitting}
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (submitting) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (submitting) event.preventDefault()
        }}
        className="h-[min(760px,82vh)] max-w-[960px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-5"
        showClose={!submitting}
      >
        <fieldset disabled={submitting} className="contents disabled:pointer-events-none">
          <DialogHeader>
            <DialogTitle>{t('sessionDetail.mergeTemplateTitle')}</DialogTitle>
            <DialogDescription>{t('sessionDetail.mergeTemplateDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 grid-cols-[280px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--ui-border-strong)]/75 bg-[var(--ui-surface-elevated)]">
            <div className="flex min-h-0 flex-col border-r border-[var(--ui-border-strong)]/75 bg-muted/75 p-3">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('sessionDetail.mergeTemplateSearchTemplates')}
                  className="h-9 bg-[var(--ui-surface-elevated)] pl-9"
                  disabled={submitting}
                />
              </div>
              <ScrollArea className="min-h-0 flex-1" viewportClassName="pr-2">
                {loadingTemplates ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                    {t('sessionDetail.mergeTemplateNoTemplates')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => {
                      const selected = template.id === selectedTemplateId
                      const slideSize = requireSlideSize({
                        id: template.slideSizeId,
                        width: template.slideWidth,
                        height: template.slideHeight
                      })
                      return (
                        <button
                          key={template.id}
                          type="button"
                          disabled={!template.selectable || loadingPages || submitting}
                          onClick={() => void handleSelectTemplate(template)}
                          className={`flex w-full gap-2.5 rounded-xl border p-2 text-left transition-colors ${
                            selected
                              ? 'border-[var(--ui-focus)] bg-[var(--ui-selected)] shadow-sm'
                              : 'border-[var(--ui-border-strong)] bg-[var(--ui-surface-elevated)]/80 hover:bg-white'
                          } disabled:cursor-not-allowed disabled:opacity-55`}
                        >
                          <div
                            className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
                            style={{ aspectRatio: `${slideSize.width}/${slideSize.height}` }}
                          >
                            {template.thumbnailPath ? (
                              <img
                                src={localAssetUrl(template.thumbnailPath)}
                                alt={template.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground">
                                <LayoutTemplate className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {template.title || t('sessionDetail.mergeTemplateUntitled')}
                              </span>
                              {template.isSource ? (
                                <span className="shrink-0 rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">
                                  {t('sessionDetail.mergeTemplateSourceBadge')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {t('sessionDetail.mergeTemplatePageCount', {
                                count: template.pageCount
                              })}
                            </div>
                            {template.disabledReason ? (
                              <div className="mt-1 text-[10px] text-destructive">
                                {getDisabledReason(template.disabledReason)}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex min-h-0 flex-col bg-[var(--ui-surface-elevated)]/75 p-4">
              <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {selectedTemplate
                      ? selectedTemplate.title || t('sessionDetail.mergeTemplateUntitled')
                      : t('sessionDetail.mergeTemplateSelectTemplate')}
                  </div>
                  {selectedTemplate ? (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {t('sessionDetail.mergeTemplateSelectedCount', {
                        count: selectedSourcePageIds.size,
                        max: selectablePageIds.length
                      })}
                    </div>
                  ) : null}
                </div>
                {selectedTemplate && sourcePages.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-[var(--ui-surface-inset)]/70">
                    <Checkbox
                      checked={allSelectablePagesSelected}
                      disabled={submitting || selectablePageIds.length === 0}
                      onCheckedChange={handleToggleAll}
                    />
                    {selectablePageIds.length > MAX_MERGE_PAGE_COUNT
                      ? t('sessionDetail.mergeTemplateSelectFirstPages', {
                          count: MAX_MERGE_PAGE_COUNT
                        })
                      : t('sessionDetail.mergeTemplateSelectAll')}
                  </label>
                ) : null}
              </div>

              <ScrollArea
                className="min-h-0 flex-1"
                viewportClassName="pr-2"
                viewportRef={pageViewportRef}
                onViewportScroll={schedulePreviewWindowUpdate}
              >
                {loadingPages ? (
                  <div className="flex h-full min-h-56 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : loadError ? (
                  <div className="flex h-full min-h-56 items-center justify-center rounded-xl border border-dashed border-[var(--ui-danger)]/40 px-6 text-center text-sm text-destructive">
                    {loadError}
                  </div>
                ) : !selectedTemplate ? (
                  <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ui-border-strong)] text-muted-foreground">
                    <LayoutTemplate className="mb-3 h-8 w-8 text-muted-foreground" />
                    <span className="text-sm">
                      {t('sessionDetail.mergeTemplateSelectTemplateHint')}
                    </span>
                  </div>
                ) : sourcePages.length === 0 ? (
                  <div className="flex h-full min-h-56 items-center justify-center text-sm text-muted-foreground">
                    {t('sessionDetail.mergeTemplateNoPages')}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {sourcePages.map((page) => {
                      const selected = selectedSourcePageIds.has(page.id)
                      const slideSize = requireSlideSize({
                        id: page.slideSizeId,
                        width: page.slideWidth,
                        height: page.slideHeight
                      })
                      return (
                        <div
                          key={page.id}
                          data-preview-window-id={page.id}
                          aria-disabled={!page.selectable || submitting}
                          onClick={() => {
                            if (page.selectable && !submitting) togglePage(page)
                          }}
                          className={`group relative overflow-hidden rounded-xl border p-2 text-left transition-all ${
                            selected
                              ? 'border-[var(--ui-focus)] bg-[var(--ui-selected)] shadow-[0_8px_18px_rgba(93,107,77,0.14)]'
                              : 'border-[var(--ui-border-strong)] bg-white hover:border-[var(--ui-workspace-border)]'
                          } ${
                            !page.selectable || submitting
                              ? 'cursor-not-allowed opacity-55'
                              : 'cursor-pointer'
                          }`}
                        >
                          <div
                            className="relative w-full overflow-hidden rounded-lg bg-muted"
                            style={{ aspectRatio: `${slideSize.width}/${slideSize.height}` }}
                          >
                            <TemplatePagePreview
                              page={page}
                              renderPreview={previewPageIds.has(page.id)}
                            />
                            <span className="absolute left-2 top-2 z-10 rounded-md bg-[var(--ui-surface-elevated)]/92 px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm">
                              P{page.pageNumber}
                            </span>
                            <span
                              className="absolute right-2 top-2 z-10 rounded bg-[var(--ui-surface-elevated)]/92 p-1 shadow-sm"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <Checkbox
                                checked={selected}
                                disabled={!page.selectable || submitting}
                                aria-label={page.title}
                                onCheckedChange={() => togglePage(page)}
                              />
                            </span>
                          </div>
                          <div className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-4 text-primary">
                            {page.title || t('sessionDetail.untitledPage')}
                          </div>
                          {page.disabledReason ? (
                            <div className="mt-1 text-[10px] text-destructive">
                              {getDisabledReason(page.disabledReason)}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!selectedTemplateId || selectedSourcePageIds.size === 0 || submitting}
              onClick={() => void handleConfirm()}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting
                ? t('sessionDetail.mergeTemplateAddingPages')
                : t('sessionDetail.mergeTemplateAddPages', { count: selectedSourcePageIds.size })}
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  )
}
