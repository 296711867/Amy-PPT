import { useMemo } from 'react'
import { nanoid } from 'nanoid'
import { useT } from '@renderer/i18n'
import { ipc } from '@renderer/lib/ipc'
import {
  useGenerateStore,
  useSessionDetailRuntimeStore,
  useSessionDetailUiStore,
  useToastStore,
  type ImageGenerationMessage
} from '@renderer/store'
import type { GeneratedImageAsset } from '@shared/image-generation.js'
import {
  buildImageMessageCacheKey,
  imageHistoryToMessages,
  mergeImageMessages
} from '../shared/imageMessageUtils'
import { normalizePagesForSelection } from '../shared/pageUtils'

export function useImageGenerationActions(sessionId: string) {
  const t = useT()
  const currentPages = useGenerateStore((state) => state.currentPages)
  const selectedPageId = useSessionDetailUiStore((state) => state.selectedPageId)
  const addElement = useSessionDetailRuntimeStore((state) => state.addElement)
  const toastSuccess = useToastStore((state) => state.success)
  const toastError = useToastStore((state) => state.error)
  const toastWarning = useToastStore((state) => state.warning)

  const pages = useMemo(() => normalizePagesForSelection(currentPages), [currentPages])
  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null,
    [pages, selectedPageId]
  )

  const generate = async (): Promise<void> => {
    if (!sessionId || !selectedPage?.id) {
      toastError(t('sessionDetail.selectPageFirst'))
      return
    }
    const detailState = useSessionDetailUiStore.getState()
    const prompt = detailState.imagePrompt.trim()
    if (!prompt) {
      toastWarning(t('sessionDetail.imagePromptRequired'))
      return
    }
    if (detailState.isGeneratingImage) return

    const pageId = selectedPage.id
    const selectedPageKey = selectedPage.id
    const cacheKey = buildImageMessageCacheKey(sessionId, pageId)
    const pendingUserMessage: ImageGenerationMessage = {
      id: `pending-image:${nanoid(8)}`,
      role: 'user',
      content: prompt,
      createdAt: Math.floor(Date.now() / 1000)
    }
    detailState.setIsGeneratingImage(true)
    detailState.setImageProgress({ progress: 8, label: t('sessionDetail.imageGenerating') })
    detailState.setImagePrompt('')
    detailState.addImageMessage(pendingUserMessage)
    detailState.addCachedImageMessage(cacheKey, pendingUserMessage)
    try {
      const result = await ipc.generateImage({
        sessionId,
        pageId,
        prompt,
        imageModelConfigId: detailState.selectedImageModelConfigId || undefined,
        size: detailState.imageSize,
        count: 1
      })
      const latestState = useSessionDetailUiStore.getState()
      const persistedMessages = imageHistoryToMessages([result.history])
      const visibleMessages =
        latestState.selectedPageId === selectedPageKey ? latestState.imageMessages : []
      const cachedWithoutPending = mergeImageMessages(
        latestState.imageMessageCache[cacheKey] || [],
        visibleMessages
      ).filter((message) => message.id !== pendingUserMessage.id)
      const nextMessages = mergeImageMessages(cachedWithoutPending, persistedMessages)
      latestState.cacheImageMessages(cacheKey, nextMessages)
      if (useSessionDetailUiStore.getState().selectedPageId === selectedPageKey) {
        latestState.setImageMessages(nextMessages)
      }
      detailState.setImageProgress({ progress: 100, label: t('sessionDetail.imageGenerated') })
      toastSuccess(t('sessionDetail.imageGenerated'), {
        description: t('sessionDetail.imageGeneratedDescription', {
          count: result.history.assets.length
        })
      })
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : t('sessionDetail.imageGenerateFailed')
      toastError(t('sessionDetail.imageGenerateFailed'), { description: message })
    } finally {
      useSessionDetailUiStore.getState().setIsGeneratingImage(false)
    }
  }

  const cancel = async (): Promise<void> => {
    if (!sessionId) return
    try {
      await ipc.cancelImageGeneration(sessionId)
    } finally {
      useSessionDetailUiStore.getState().setIsGeneratingImage(false)
      useSessionDetailUiStore.getState().setImageProgress(null)
    }
  }

  const revealFile = async (filePath: string): Promise<void> => {
    if (!sessionId || !filePath) return
    try {
      await ipc.revealFile(filePath, sessionId)
    } catch (revealError) {
      toastError(revealError instanceof Error ? revealError.message : t('common.retryLater'))
    }
  }

  const addToCanvas = async (asset: GeneratedImageAsset): Promise<void> => {
    if (!selectedPage?.pageId) {
      toastError(t('sessionDetail.selectPageFirst'))
      return
    }
    useSessionDetailUiStore.getState().setInteractionMode('edit')
    try {
      const added = await addElement(asset.relativePath, asset.fileName, {
        persistImmediately: true,
        prompt: '从生图结果添加图片到画布'
      })
      if (added) {
        useSessionDetailUiStore.getState().setWorkspaceTab('edit')
        toastSuccess(t('sessionDetail.imageAddedToCanvas'))
      }
    } catch (addError) {
      toastError(addError instanceof Error ? addError.message : t('sessionDetail.layoutSaveFailed'))
    }
  }

  const setAsBackground = async (asset: GeneratedImageAsset): Promise<void> => {
    if (!selectedPage?.pageId) {
      toastError(t('sessionDetail.selectPageFirst'))
      return
    }
    useSessionDetailUiStore.getState().setInteractionMode('edit')
    useSessionDetailUiStore.getState().setWorkspaceTab('ai')
    try {
      const added = await addElement(asset.relativePath, asset.fileName, {
        persistImmediately: true,
        asBackground: true,
        prompt: '从生图结果设置页面背景'
      })
      if (added) toastSuccess(t('sessionDetail.imageSetAsBackground'))
    } catch (addError) {
      toastError(addError instanceof Error ? addError.message : t('sessionDetail.layoutSaveFailed'))
    }
  }

  return {
    selectedPage,
    generate,
    cancel,
    revealFile,
    addToCanvas,
    setAsBackground
  }
}
