import { Toaster } from 'sonner'
import 'sonner/dist/styles.css'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { DEFAULT_UI_THEME_ID, UI_THEME_CHROME } from '@shared/ui-theme'

export function AppToaster(): React.JSX.Element {
  const themeId = useSettingsStore((state) => state.settings?.theme) ?? DEFAULT_UI_THEME_ID

  return (
    <Toaster
      theme={UI_THEME_CHROME[themeId].colorScheme}
      position="top-center"
      offset={{ top: 12 }}
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        className: 'app-no-drag'
      }}
    />
  )
}
