export type GenerationRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type GenerationPageStatus = 'pending' | 'generating' | 'completed' | 'failed'

export type GenerationPreviewPage = {
  id: string
  pageNumber: number
  title: string
  htmlPath?: string
  pageId?: string
  sourceUrl?: string
  status: GenerationPageStatus
  previewVersion?: number
}

export type GenerationLogEvent = {
  text: string
  time?: string
}

export type GenerationStageKey = 'preflight' | 'planning' | 'rendering' | 'validation'
