export type SpeechScope = 'all' | 'single'
export type SpeechLength = 'short' | 'medium' | 'long'
export type SpeechStyle = 'formal' | 'conversational' | 'storytelling' | 'custom'

export interface SpeechConfig {
  scope: SpeechScope
  length: SpeechLength
  style: SpeechStyle
  customStyle?: string
  modelConfigId?: string
}
