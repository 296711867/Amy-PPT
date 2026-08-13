import { FolderSearch, Palette } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import type { SettingsTranslate } from './types'
import { UI_THEME_OPTIONS } from '@renderer/theme/ui-theme'
import type { UiThemeId } from '@shared/ui-theme'

interface GeneralSettingsTabProps {
  lang: 'zh' | 'en'
  theme: UiThemeId
  storagePath: string
  t: SettingsTranslate
  onChoosePath: () => void
  onLangChange: (lang: 'zh' | 'en') => void
  onThemeChange: (theme: UiThemeId) => void
}

export function GeneralSettingsTab({
  lang,
  theme,
  storagePath,
  t,
  onChoosePath,
  onLangChange,
  onThemeChange
}: GeneralSettingsTabProps): React.JSX.Element {
  const selectedTheme =
    UI_THEME_OPTIONS.find((option) => option.id === theme) ?? UI_THEME_OPTIONS[0]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">{t('settings.interface')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('settings.language')}</label>
            <Select value={lang} onValueChange={(v) => onLangChange(v === 'en' ? 'en' : 'zh')}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('settings.languagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">{t('settings.chinese')}</SelectItem>
                <SelectItem value="en">{t('settings.english')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4 text-primary" />
              {t('settings.themeStyle')}
            </label>
            <Select value={theme} onValueChange={(value) => onThemeChange(value as UiThemeId)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('settings.themePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {UI_THEME_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="inline-flex items-center gap-2.5">
                      <span className="inline-flex overflow-hidden rounded border border-border">
                        {option.swatches.map((color) => (
                          <span
                            key={color}
                            className="h-4 w-3"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      {t(option.labelKey)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t(selectedTheme.descriptionKey)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base">{t('settings.storage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('settings.storagePath')}</label>
            <div className="flex gap-2">
              <Input
                value={storagePath}
                readOnly
                placeholder={t('settings.storagePlaceholder')}
                className="h-10 min-w-0 flex-1"
              />
              <Button
                variant="secondary"
                onClick={onChoosePath}
                className="h-10 min-w-[96px] shrink-0 rounded-lg border border-border px-4"
              >
                <FolderSearch className="mr-1.5 h-4 w-4" />
                {t('settings.choose')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('settings.storageHint')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
