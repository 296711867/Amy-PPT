import {
  DEFAULT_UI_THEME_ID,
  UI_THEME_CHROME,
  normalizeUiThemeId,
  type UiThemeId
} from '@shared/ui-theme'

export const UI_THEME_STORAGE_KEY = 'amy-ppt:ui-theme'
const LEGACY_UI_THEME_STORAGE_KEY = 'oh-my-ppt:ui-theme'

export type UiThemeOption = {
  id: UiThemeId
  labelKey:
    | 'settings.themeSage'
    | 'settings.themeStudio'
    | 'settings.themeCoral'
    | 'settings.themePastel'
    | 'settings.themeMidnight'
  descriptionKey:
    | 'settings.themeSageDescription'
    | 'settings.themeStudioDescription'
    | 'settings.themeCoralDescription'
    | 'settings.themePastelDescription'
    | 'settings.themeMidnightDescription'
  swatches: readonly [string, string, string]
}

export const UI_THEME_OPTIONS: readonly UiThemeOption[] = [
  {
    id: 'sage',
    labelKey: 'settings.themeSage',
    descriptionKey: 'settings.themeSageDescription',
    swatches: ['#f5f1e8', '#5d6b4d', '#c77a62']
  },
  {
    id: 'studio',
    labelKey: 'settings.themeStudio',
    descriptionKey: 'settings.themeStudioDescription',
    swatches: ['#f3f6f6', '#27636b', '#d88955']
  },
  {
    id: 'coral',
    labelKey: 'settings.themeCoral',
    descriptionKey: 'settings.themeCoralDescription',
    swatches: ['#fff8f2', '#d9685a', '#6f7f68']
  },
  {
    id: 'pastel',
    labelKey: 'settings.themePastel',
    descriptionKey: 'settings.themePastelDescription',
    swatches: ['#fff8fa', '#df617d', '#8bb5a8']
  },
  {
    id: 'midnight',
    labelKey: 'settings.themeMidnight',
    descriptionKey: 'settings.themeMidnightDescription',
    swatches: ['#171a1b', '#75b9b0', '#e39a62']
  }
]

export const readCachedUiTheme = (storage?: Pick<Storage, 'getItem'>): UiThemeId => {
  if (!storage) return DEFAULT_UI_THEME_ID
  return normalizeUiThemeId(
    storage.getItem(UI_THEME_STORAGE_KEY) || storage.getItem(LEGACY_UI_THEME_STORAGE_KEY)
  )
}

export const applyUiTheme = (
  value: unknown,
  options?: {
    root?: HTMLElement
    storage?: Pick<Storage, 'setItem'>
  }
): UiThemeId => {
  const theme = normalizeUiThemeId(value)
  const root =
    options?.root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  const storage =
    options?.storage ?? (typeof window === 'undefined' ? undefined : window.localStorage)

  if (root) {
    root.dataset.uiTheme = theme
    root.style.colorScheme = UI_THEME_CHROME[theme].colorScheme
  }
  storage?.setItem(UI_THEME_STORAGE_KEY, theme)
  return theme
}

export const initializeCachedUiTheme = (): UiThemeId => {
  if (typeof window === 'undefined') return DEFAULT_UI_THEME_ID
  return applyUiTheme(readCachedUiTheme(window.localStorage))
}
