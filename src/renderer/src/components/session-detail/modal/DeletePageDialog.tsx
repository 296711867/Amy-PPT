import { useT } from '@renderer/i18n'
import { ipc } from '@renderer/lib/ipc'
import { useGenerateStore, useSessionDetailUiStore, useToastStore } from '@renderer/store'
import { Button } from '../../ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/Dialog'

interface DeletePageDialogProps {
  sessionId: string
}

export function DeletePageDialog({ sessionId }: DeletePageDialogProps): React.JSX.Element {
  const t = useT()
  const pageId = useSessionDetailUiStore((state) => state.deleteConfirmPageId)
  const selectedPageId = useSessionDetailUiStore((state) => state.selectedPageId)
  const isManagingPages = useSessionDetailUiStore((state) => state.isManagingPages)
  const setPageId = useSessionDetailUiStore((state) => state.setDeleteConfirmPageId)
  const toastError = useToastStore((state) => state.error)
  const open = Boolean(pageId)

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && !isManagingPages) setPageId(null)
  }

  const handleConfirmDeletePage = async (): Promise<void> => {
    if (!sessionId || !pageId) return
    useSessionDetailUiStore.getState().setIsManagingPages(true)
    try {
      const result = await ipc.deleteSessionPages({
        sessionId,
        pageIds: [pageId],
        selectedPageId: selectedPageId || undefined
      })
      useGenerateStore.getState().setPages(result.generatedPages)
      useSessionDetailUiStore.getState().setSelectedPageId(result.selectedPageId)
      useSessionDetailUiStore.getState().bumpPreviewKey()
      setPageId(null)
      void ipc
        .clearSpeechScript(sessionId)
        .catch((err) => console.warn('[speech] clearSpeechScript failed', err))
    } catch (error) {
      toastError(error instanceof Error ? error.message : t('pageManagement.deleteFailed'))
    } finally {
      useSessionDetailUiStore.getState().setIsManagingPages(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>{t('pageManagement.deleteConfirmTitle')}</DialogTitle>
          <DialogDescription>{t('pageManagement.deleteConfirmDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isManagingPages}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleConfirmDeletePage()}
            disabled={isManagingPages}
          >
            {t('pageManagement.deleteConfirmAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
