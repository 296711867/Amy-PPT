export const UI_THEME_IDS = ['sage', 'studio', 'coral', 'pastel', 'midnight'] as const

export type UiThemeId = (typeof UI_THEME_IDS)[number]

export type UiThemeChrome = {
  backgroundColor: string
  symbolColor: string
  colorScheme: 'light' | 'dark'
}

export const DEFAULT_UI_THEME_ID: UiThemeId = 'coral'

export const UI_THEME_CHROME: Record<UiThemeId, UiThemeChrome> = {
  sage: {
    backgroundColor: '#f5f1e8',
    symbolColor: '#5d6b4d',
    colorScheme: 'light'
  },
  studio: {
    backgroundColor: '#f3f6f6',
    symbolColor: '#275b63',
    colorScheme: 'light'
  },
  coral: {
    backgroundColor: '#fff8f2',
    symbolColor: '#6d3f32',
    colorScheme: 'light'
  },
  pastel: {
    backgroundColor: '#fff8fa',
    symbolColor: '#6b4552',
    colorScheme: 'light'
  },
  midnight: {
    backgroundColor: '#171a1b',
    symbolColor: '#dce6e2',
    colorScheme: 'dark'
  }
}

export const isUiThemeId = (value: unknown): value is UiThemeId =>
  typeof value === 'string' && UI_THEME_IDS.includes(value as UiThemeId)

export const normalizeUiThemeId = (value: unknown): UiThemeId =>
  isUiThemeId(value) ? value : DEFAULT_UI_THEME_ID
