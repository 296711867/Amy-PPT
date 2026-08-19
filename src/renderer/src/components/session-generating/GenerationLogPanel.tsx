import type React from 'react'
import dayjs from 'dayjs'
import { CircleAlert, Loader2, PauseCircle, Sparkles } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/ScrollArea'
import type { GenerationLogEvent, GenerationRunStatus } from './types'

export function GenerationLogPanel({
  events,
  status,
  pageCountLabel,
  growingLabel,
  failedLabel,
  logTitle,
  viewportRef,
  onViewportScroll
}: {
  events: GenerationLogEvent[]
  status: GenerationRunStatus
  pageCountLabel: string
  growingLabel: string
  failedLabel: string
  logTitle: string
  viewportRef?: React.Ref<HTMLDivElement>
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>
}): React.JSX.Element {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-[var(--ui-border-strong)]/72 bg-[var(--ui-surface-elevated)]/82 p-2.5 shadow-[0_14px_30px_rgba(78,91,63,0.1)]">
      <div className="mb-2 flex min-h-8 items-center pr-14">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="min-w-0 truncate">{logTitle}</span>
        </div>
        <span
          className="absolute right-2.5 top-2.5 z-20 inline-flex h-6 min-w-10 items-center justify-center rounded-md border border-[var(--ui-workspace-border)] bg-[var(--ui-selected)] px-2 text-[11px] font-semibold text-foreground shadow-sm"
          title={pageCountLabel}
        >
          {pageCountLabel}
        </span>
      </div>

      <ScrollArea
        className="min-h-0 flex-1 rounded-lg border border-[var(--ui-border-strong)]/55 bg-[var(--ui-surface-elevated)]/38"
        viewportRef={viewportRef}
        onViewportScroll={onViewportScroll}
        viewportClassName="px-2 py-2"
      >
        <div className="space-y-2">
          {events.map((event, index) => (
            <div
              key={`${event.text}-${index}`}
              className="rounded-lg border border-[var(--ui-border-strong)]/70 bg-white/46 px-2.5 py-1.5 text-xs leading-5 text-primary shadow-[0_6px_14px_rgba(93,107,77,0.06)]"
            >
              {event.time && (
                <div className="mb-0.5 text-[10px] leading-4 text-muted-foreground">
                  {dayjs(event.time).format('HH:mm:ss')}
                </div>
              )}
              <div className="break-words">{event.text}</div>
            </div>
          ))}

          {status === 'queued' || status === 'running' ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ui-border-strong)]/70 bg-white/46 px-2.5 py-1.5 text-xs text-muted-foreground shadow-[0_6px_14px_rgba(93,107,77,0.06)]">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              <span className="min-w-0 truncate">{growingLabel}</span>
            </div>
          ) : status === 'paused' ? (
            <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/15 px-2.5 py-1.5 text-xs text-warning shadow-[0_6px_14px_rgba(93,107,77,0.06)]">
              <PauseCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">生成已暂停</span>
            </div>
          ) : status === 'failed' || status === 'cancelled' ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ui-danger)]/40 bg-[var(--ui-danger-soft)] px-2.5 py-1.5 text-xs text-destructive shadow-[0_6px_14px_rgba(93,107,77,0.06)]">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{failedLabel}</span>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  )
}
