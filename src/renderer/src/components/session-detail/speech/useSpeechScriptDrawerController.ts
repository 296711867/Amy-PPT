import { useMemo } from 'react'
import { ipc } from '@renderer/lib/ipc'
import { useGenerateStore, useSessionDetailUiStore, useToastStore } from '@renderer/store'
import { useT } from '@renderer/i18n'
import { useModelAction } from '@renderer/hooks/useModelAction'
import type { SpeechConfig } from '@shared/speech'
import { normalizePagesForSelection } from '../shared/pageUtils'

export function useSpeechScriptDrawerController(sessionId: string) {
  const t = useT()
  const modelAction = useModelAction()
  const currentPages = useGenerateStore((state) => state.currentPages)
  const selectedPageId = useSessionDetailUiStore((state) => state.selectedPageId)
  const open = useSessionDetailUiStore((state) => state.speechScriptDialogOpen)
  const isGenerating = useSessionDetailUiStore((state) => state.isGeneratingSpeechScript)
  const speechProgress = useSessionDetailUiStore((state) => state.speechProgress)
  const speechConfig = useSessionDetailUiStore((state) => state.speechConfig)
  const setSpeechConfig = useSessionDetailUiStore((state) => state.setSpeechConfig)
  const setOpen = useSessionDetailUiStore((state) => state.setSpeechScriptDialogOpen)
  const toastError = useToastStore((state) => state.error)

  const pages = useMemo(() => normalizePagesForSelection(currentPages), [currentPages])
  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null,
    [pages, selectedPageId]
  )

  const handleGenerate = async (config: SpeechConfig): Promise<void> => {
    const detailState = useSessionDetailUiStore.getState()
    if (!sessionId || detailState.isGeneratingSpeechScript) return
    detailState.setIsGeneratingSpeechScript(true)
    detailState.setSpeechProgress(null)
    try {
      const modelConfigId = await modelAction.ensureModelActive(config.modelConfigId)
      if (!modelConfigId) return
      const result = await ipc.generateSpeechScript(sessionId, {
        ...config,
        modelConfigId,
        currentPageId: config.scope === 'single' ? selectedPage?.id : undefined
      })
      if (!result.success) {
        toastError(t('sessionDetail.speechScriptError'))
      }
    } catch (error) {
      toastError(error instanceof Error ? error.message : t('sessionDetail.speechScriptError'))
    } finally {
      const state = useSessionDetailUiStore.getState()
      state.setIsGeneratingSpeechScript(false)
      state.setSpeechProgress(null)
    }
  }

  return {
    open,
    isGenerating,
    speechProgress,
    speechConfig,
    modelAction,
    currentPageNumber: selectedPage?.pageNumber,
    currentPageTitle: selectedPage?.title || undefined,
    setSpeechConfig,
    generate: (config: SpeechConfig) => void handleGenerate(config),
    close: () => {
      setOpen(false)
      useSessionDetailUiStore.getState().setWorkspaceTab('preview')
    }
  }
}
