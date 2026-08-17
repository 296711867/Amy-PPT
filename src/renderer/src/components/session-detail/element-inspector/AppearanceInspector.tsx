import { Palette } from 'lucide-react'
import { Input } from '../../ui/Input'
import { ColorPicker } from '../../ui/ColorPicker'
import { InspectorSection } from './InspectorSection'
import type { ElementEditorProps } from './types'
import { useT } from '@renderer/i18n'

export function AppearanceInspector({
  selection,
  draft,
  onDraftChange
}: ElementEditorProps): React.JSX.Element {
  const t = useT()
  const isVideo = selection.elementTag === 'video'
  const colorLabel = selection.snapshot?.computed.svgPaintColor
    ? t('sessionDetail.visualColor')
    : t('sessionDetail.backgroundColor')
  return (
    <InspectorSection
      title={t('sessionDetail.appearance')}
      icon={<Palette className="h-3.5 w-3.5 text-muted-foreground" />}
    >
      <div className="space-y-2.5">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('sessionDetail.opacity')}
          </span>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={draft.opacity}
            onChange={(event) => onDraftChange({ ...draft, opacity: event.target.value })}
            onBlur={(event) =>
              onDraftChange(
                { ...draft, opacity: event.target.value },
                { commit: true, fields: ['opacity'] }
              )
            }
            className="h-8 rounded-full border border-[var(--ui-border-strong)]/72 bg-[var(--ui-surface-elevated)]/88 px-2.5 text-xs text-foreground shadow-[inset_0_1px_2px_rgba(74,59,42,0.05)] focus-visible:border-[var(--ui-focus)] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </label>
        {!isVideo && (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {colorLabel}
            </span>
            <div className="flex items-center gap-2">
              <ColorPicker
                value={draft.backgroundColor || '#ffffff'}
                onChange={(v) => onDraftChange({ ...draft, backgroundColor: v })}
                onCommit={(v) =>
                  onDraftChange(
                    { ...draft, backgroundColor: v },
                    { commit: true, fields: ['backgroundColor'] }
                  )
                }
              />
              <Input
                value={draft.backgroundColor}
                onChange={(event) =>
                  onDraftChange({ ...draft, backgroundColor: event.target.value })
                }
                onBlur={(event) =>
                  onDraftChange(
                    { ...draft, backgroundColor: event.target.value },
                    { commit: true, fields: ['backgroundColor'] }
                  )
                }
                className="h-8 rounded-full border border-[var(--ui-border-strong)]/72 bg-[var(--ui-surface-elevated)]/88 px-2.5 text-xs text-foreground shadow-[inset_0_1px_2px_rgba(74,59,42,0.05)] focus-visible:border-[var(--ui-focus)] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </label>
        )}
      </div>
    </InspectorSection>
  )
}
