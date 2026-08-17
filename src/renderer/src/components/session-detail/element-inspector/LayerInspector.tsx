import { Layers } from 'lucide-react'
import { Input } from '../../ui/Input'
import { InspectorSection } from './InspectorSection'
import type { ElementEditorProps } from './types'
import { useT } from '@renderer/i18n'

const MIN_Z_INDEX = -999
const MAX_Z_INDEX = 9999

export function LayerInspector({ draft, onDraftChange }: ElementEditorProps): React.JSX.Element {
  const t = useT()
  return (
    <InspectorSection
      title={t('sessionDetail.zIndex')}
      icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ui-border-strong)]/40 bg-[var(--ui-surface-elevated)]/40 text-[13px] font-medium text-primary transition-colors hover:bg-[var(--ui-action-soft)]/60"
          onClick={() => {
            const current = parseInt(draft.layoutZIndex || '0', 10) || 0
            onDraftChange(
              { ...draft, layoutZIndex: String(Math.max(MIN_Z_INDEX, current - 1)) },
              { commit: true, fields: ['layoutZIndex'] }
            )
          }}
          aria-label={t('sessionDetail.decrease')}
        >
          -
        </button>
        <Input
          type="number"
          min={MIN_Z_INDEX}
          max={MAX_Z_INDEX}
          value={draft.layoutZIndex}
          onChange={(event) => onDraftChange({ ...draft, layoutZIndex: event.target.value })}
          onBlur={(event) =>
            onDraftChange(
              { ...draft, layoutZIndex: event.target.value },
              { commit: true, fields: ['layoutZIndex'] }
            )
          }
          className="h-8 flex-1 rounded-full border border-[var(--ui-border-strong)]/72 bg-[var(--ui-surface-elevated)]/88 px-2.5 text-center text-xs text-foreground shadow-[inset_0_1px_2px_rgba(74,59,42,0.05)] focus-visible:border-[var(--ui-focus)] focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ui-border-strong)]/40 bg-[var(--ui-surface-elevated)]/40 text-[13px] font-medium text-primary transition-colors hover:bg-[var(--ui-action-soft)]/60"
          onClick={() => {
            const current = parseInt(draft.layoutZIndex || '0', 10) || 0
            onDraftChange(
              { ...draft, layoutZIndex: String(Math.min(MAX_Z_INDEX, current + 1)) },
              { commit: true, fields: ['layoutZIndex'] }
            )
          }}
          aria-label={t('sessionDetail.increase')}
        >
          +
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
        {t('sessionDetail.zIndexNegativeHint')}
      </p>
    </InspectorSection>
  )
}
