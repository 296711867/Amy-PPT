import { Check, Loader2, Redo2, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useT } from '@renderer/i18n'
import { useSessionDetailRuntimeStore } from '@renderer/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/Tooltip'

export function PrimaryActions({
  disabled,
  isSavingEdits,
  canUndo,
  canRedo,
  hasPendingEdits
}: {
  disabled: boolean
  isSavingEdits: boolean
  canUndo: boolean
  canRedo: boolean
  hasPendingEdits: boolean
}): React.JSX.Element {
  const t = useT()
  const actions = useSessionDetailRuntimeStore((state) => state.workspaceRibbonActions)

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-[0.95rem] bg-[var(--ui-workspace-surface-muted)]/60 px-1 py-0.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.32)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-6 shrink-0 items-center justify-center rounded-full px-2.5 text-[10px] font-bold leading-none transition-colors disabled:pointer-events-none disabled:opacity-45',
              hasPendingEdits
                ? 'bg-[var(--ui-workspace-selected)] text-[var(--ui-workspace-on-selected)] shadow-[0_4px_10px_rgb(var(--ui-workspace-shadow-color)/0.15)] hover:bg-[var(--ui-action-hover)]'
                : 'bg-[var(--ui-workspace-surface)]/75 text-[var(--ui-workspace-text-muted)] shadow-[inset_0_1px_0_rgb(255_255_255/0.42)]'
            )}
            onClick={() => actions?.onSaveCurrentPage()}
            disabled={disabled || !hasPendingEdits}
            aria-label={t('sessionDetail.saveCurrentPageTooltip')}
          >
            {isSavingEdits ? (
              <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin text-current" />
            ) : (
              <Check className="mr-1 h-2.5 w-2.5 text-current" />
            )}
            {t('sessionDetail.saveCurrentPage')}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('sessionDetail.saveCurrentPageTooltip')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-45',
              hasPendingEdits
                ? 'text-[var(--ui-warning)] hover:bg-[var(--ui-workspace-surface)]/70'
                : 'text-[var(--ui-workspace-text-muted)]'
            )}
            onClick={() => actions?.onDiscardAllEdits()}
            disabled={disabled || !hasPendingEdits}
            aria-label={t('sessionDetail.discardAllEditsTooltip')}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('sessionDetail.discardAllEditsTooltip')}</TooltipContent>
      </Tooltip>
      <div className="ml-0.5 flex items-center gap-0.5 rounded-full bg-[var(--ui-workspace-rail)]/55 p-0.5 shadow-[inset_0_1px_3px_rgb(var(--ui-workspace-shadow-color)/0.045)]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[var(--ui-workspace-selected)] transition-colors hover:bg-[var(--ui-workspace-selected-soft)]/70 hover:text-[var(--ui-workspace-text)] disabled:pointer-events-none disabled:text-[var(--ui-workspace-text-muted)] disabled:opacity-45"
              onClick={() => actions?.onUndo()}
              disabled={disabled || !canUndo}
              aria-label={t('sessionDetail.undoCurrentPageTooltip')}
            >
              <Undo2 className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('sessionDetail.undoCurrentPageTooltip')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[var(--ui-workspace-selected)] transition-colors hover:bg-[var(--ui-workspace-selected-soft)]/70 hover:text-[var(--ui-workspace-text)] disabled:pointer-events-none disabled:text-[var(--ui-workspace-text-muted)] disabled:opacity-45"
              onClick={() => actions?.onRedo()}
              disabled={disabled || !canRedo}
              aria-label={t('sessionDetail.redoCurrentPageTooltip')}
            >
              <Redo2 className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('sessionDetail.redoCurrentPageTooltip')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
