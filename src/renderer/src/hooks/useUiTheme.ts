import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { applyUiTheme } from '@renderer/theme/ui-theme'

export function useUiTheme(): void {
  const settings = useSettingsStore((state) => state.settings)

  useEffect(() => {
    if (settings?.theme) applyUiTheme(settings.theme)
  }, [settings?.theme])
}
