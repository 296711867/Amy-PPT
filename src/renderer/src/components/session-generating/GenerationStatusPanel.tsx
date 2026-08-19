import type React from 'react'
import { CheckCircle2, CircleAlert, Loader2, PauseCircle, Settings } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { ModelSplitButton } from '@renderer/components/model/ModelActionButton'
import { cn } from '@renderer/lib/utils'
import type { ModelActionState } from '@renderer/hooks/useModelAction'
import type { GenerationRunStatus, GenerationStageKey } from './types'

export function GenerationStatusPanel({
  status,
  progress,
  stages,
  stageLabels,
  currentStage,
  completedPageCount,
  totalPages,
  error,
  technicalError,
  pendingPageCount,
  pausedLabel,
  pausedProgressLabel,
  pageUnitLabel,
  errorDetailsLabel,
  reconnectLabel,
  interruptedLabel,
  enterEditorLabel,
  continueRemainingLabel,
  regenerateLabel,
  checkSettingsLabel,
  cancelLabel,
  isCancelling,
  hasRetryablePages,
  canEnterEditor,
  showEditorShortcut,
  modelAction,
  onEnterEditor,
  onContinueRemaining,
  onRegenerate,
  onOpenSettings,
  onCancel
}: {
  status: GenerationRunStatus
  progress: number
  stages: readonly GenerationStageKey[]
  stageLabels: Record<GenerationStageKey, string>
  currentStage: string
  completedPageCount: number
  totalPages: number
  error: string | null
  technicalError?: string | null
  pendingPageCount?: number
  pausedLabel?: string
  pausedProgressLabel?: string
  pageUnitLabel?: string
  errorDetailsLabel?: string
  reconnectLabel?: string
  interruptedLabel: string
  enterEditorLabel: string
  continueRemainingLabel: string
  regenerateLabel: string
  checkSettingsLabel?: string
  cancelLabel: string
  isCancelling?: boolean
  hasRetryablePages: boolean
  canEnterEditor: boolean
  showEditorShortcut: boolean
  modelAction: ModelActionState
  onEnterEditor: () => void
  onContinueRemaining: (modelConfigId: string) => void
  onRegenerate: (modelConfigId: string) => void
  onOpenSettings?: () => void
  onCancel: () => void
}): React.JSX.Element {
  if (status === 'paused' || status === 'failed' || status === 'cancelled') {
    const isPaused = status === 'paused'
    return (
      <div
        className={cn(
          'mb-4 shrink-0 rounded-lg px-4 py-3 shadow-[0_8px_20px_rgba(120,73,65,0.08)]',
          isPaused
            ? 'border border-warning/40 bg-warning/15 text-warning'
            : 'border border-[var(--ui-danger)]/40 bg-[var(--ui-danger-soft)] text-destructive'
        )}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            {isPaused ? (
              <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="shrink-0 rounded-md border border-[var(--ui-danger)]/40 bg-[var(--ui-danger-soft)] px-2 py-1 text-xs font-semibold text-destructive">
              {isPaused ? pausedLabel || '生成已暂停' : interruptedLabel}
            </span>
            <div className="min-w-0 text-xs">
              <div className="text-muted-foreground">{error}</div>
              {isPaused && (
                <div className="mt-1 text-muted-foreground">
                  {pausedProgressLabel || '已完成'} {completedPageCount}/{totalPages}{' '}
                  {pageUnitLabel || '页'}
                  {typeof pendingPageCount === 'number' && pendingPageCount > 0
                    ? `，${pendingPageCount} 页等待继续`
                    : ''}
                </div>
              )}
              {technicalError && (
                <details className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    {errorDetailsLabel || '错误详情'}
                  </summary>
                  <div className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--ui-border-strong)] bg-white/60 p-2 font-mono">
                    {technicalError}
                  </div>
                </details>
              )}
            </div>
            {canEnterEditor && (
              <button
                type="button"
                onClick={onEnterEditor}
                className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                {enterEditorLabel}
              </button>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5">
            {isPaused && onOpenSettings && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg px-2.5 text-xs shadow-none"
                onClick={onOpenSettings}
              >
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                {checkSettingsLabel || '检查模型设置'}
              </Button>
            )}
            <ModelSplitButton
              modelAction={modelAction}
              label={
                isPaused && hasRetryablePages
                  ? reconnectLabel || '重新连接并继续'
                  : hasRetryablePages
                    ? continueRemainingLabel
                    : regenerateLabel
              }
              tone="subtle"
              size="sm"
              onRun={(modelConfigId) => {
                if (hasRetryablePages) {
                  onContinueRemaining(modelConfigId)
                } else {
                  onRegenerate(modelConfigId)
                }
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const activeStageIndex = stages.indexOf(currentStage as GenerationStageKey)

  return (
    <div className="mb-4 shrink-0 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-elevated)] px-4 py-2 text-primary shadow-[0_12px_28px_rgba(78,91,63,0.13)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary">
            <span className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {stages.map((stage, index) => {
                const isActive = index === activeStageIndex
                const isDone = index < activeStageIndex || status === 'completed'
                return (
                  <span
                    key={stage}
                    className={cn(
                      'inline-flex items-center gap-1 leading-4',
                      isDone && 'text-primary',
                      isActive && 'font-semibold text-foreground',
                      !isDone && !isActive && 'text-muted-foreground'
                    )}
                  >
                    {isDone && <CheckCircle2 className="h-3 w-3" />}
                    {isActive && (status === 'queued' || status === 'running') && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                    {stage === 'rendering' && completedPageCount > 0
                      ? `${stageLabels[stage]} ${completedPageCount}/${totalPages}`
                      : stageLabels[stage]}
                  </span>
                )
              })}
            </span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-2 font-medium">
              <span className="font-semibold">{progress}%</span>
              {showEditorShortcut && (
                <Button
                  size="sm"
                  className="h-6 rounded-md px-2 text-[10px] shadow-none"
                  onClick={onEnterEditor}
                >
                  {enterEditorLabel}
                </Button>
              )}
              {(status === 'queued' || status === 'running') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 rounded-md px-2 text-[10px] shadow-none"
                  disabled={isCancelling}
                  aria-busy={isCancelling || undefined}
                  onClick={onCancel}
                >
                  {isCancelling && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {cancelLabel}
                </Button>
              )}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full border border-[var(--ui-border-strong)]/80 bg-[var(--ui-surface-elevated)] shadow-[inset_0_1px_2px_rgba(74,58,40,0.12)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#9ecf8a_0%,#6f9f59_52%,#4f7b3f_100%)] bg-[length:200%_100%] transition-[width] duration-500"
              style={{
                width: `${Math.max(2, progress)}%`,
                animation: 'gen-shimmer-move 2.8s linear infinite'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
