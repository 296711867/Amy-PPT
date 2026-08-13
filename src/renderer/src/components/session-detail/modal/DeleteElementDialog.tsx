import { useT } from '@renderer/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from '../../ui/AlertDialog'

interface DeleteElementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DeleteElementDialog({
  open,
  onOpenChange,
  onConfirm
}: DeleteElementDialogProps): React.JSX.Element {
  const t = useT()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('sessionDetail.deleteElement')}</AlertDialogTitle>
        <AlertDialogDescription>{t('sessionDetail.deleteElementConfirm')}</AlertDialogDescription>
        <div className="flex justify-end gap-2">
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#c0392b] text-white hover:bg-[#a93226]"
            onClick={onConfirm}
          >
            {t('common.delete')}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
