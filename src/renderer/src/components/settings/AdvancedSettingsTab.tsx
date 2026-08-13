import type { ConfigurableModelTimeoutProfile } from '@shared/model-timeout.js'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import type { SettingsTranslate, TimeoutField } from './types'

interface AdvancedSettingsTabProps {
  proxyUrl: string
  savingTimeouts: boolean
  timeoutFields: TimeoutField[]
  timeoutSeconds: Record<ConfigurableModelTimeoutProfile, string>
  t: SettingsTranslate
  onProxyUrlChange: (value: string) => void
  onSaveAdvanced: () => void
  onTimeoutChange: (profile: ConfigurableModelTimeoutProfile, value: string) => void
}

export function AdvancedSettingsTab({
  proxyUrl,
  savingTimeouts,
  timeoutFields,
  timeoutSeconds,
  t,
  onProxyUrlChange,
  onSaveAdvanced,
  onTimeoutChange
}: AdvancedSettingsTabProps): React.JSX.Element {
  return (
    <>
      <Card className="mb-4">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">{t('settings.timeoutSection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <p className="text-xs text-muted-foreground">{t('settings.timeoutHint')}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {timeoutFields.map((field) => (
              <div key={field.profile}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {field.label}
                </label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('settings.timeoutPlaceholder')}
                  value={timeoutSeconds[field.profile]}
                  onChange={(e) => onTimeoutChange(field.profile, e.target.value)}
                  className="h-10"
                />
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {field.hint}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">{t('settings.proxySection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('settings.proxyLabel')}</label>
            <Input
              value={proxyUrl}
              onChange={(e) => onProxyUrlChange(e.target.value)}
              placeholder={t('settings.proxyPlaceholder')}
              className="h-10"
            />
            <p className="mt-2 text-xs text-muted-foreground">{t('settings.proxyHint')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSaveAdvanced} disabled={savingTimeouts}>
          {savingTimeouts ? t('common.saving') : t('settings.saveTimeouts')}
        </Button>
      </div>
    </>
  )
}
