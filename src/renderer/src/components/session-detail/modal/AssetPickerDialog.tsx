import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ipc } from '@renderer/lib/ipc'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../../ui/Dialog'
import { Button } from '../../ui/Button'
import { useT } from '@renderer/i18n'
import { localAssetUrl } from '@shared/local-asset'

interface AssetEntry {
  fileName: string
  relativePath: string
  absolutePath: string
}

function CheckIcon({ checked }: { checked: boolean }): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-200',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-[var(--ui-border-strong)]/80 bg-white/70 text-transparent group-hover:border-[var(--ui-workspace-border)]'
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6L5 8.5L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function AssetPickerDialog({
  sessionId,
  assetType,
  open,
  onClose,
  onConfirm
}: {
  sessionId: string
  assetType: 'image' | 'video'
  open: boolean
  onClose: () => void
  onConfirm: (relativePath: string, fileName: string) => void
}): React.JSX.Element {
  const t = useT()
  const [assets, setAssets] = useState<AssetEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playingPath, setPlayingPath] = useState<string | null>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  useEffect(() => {
    if (!open) {
      setSelected(null)
      setPlayingPath(null)
      videoRefs.current.clear()
      return
    }
    setLoading(true)
    ipc
      .listAssets(sessionId, assetType)
      .then((result) => setAssets(result.assets))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false))
  }, [open, sessionId, assetType])

  const handleConfirm = (): void => {
    if (!selected) return
    const asset = assets.find((a) => a.relativePath === selected)
    if (!asset) return
    onConfirm(asset.relativePath, asset.fileName)
    onClose()
  }

  const title = assetType === 'image' ? t('editMode.chooseImage') : t('editMode.chooseVideo')
  const isVideo = assetType === 'video'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('editMode.assetPickerHint')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {t('editMode.loadingAssets')}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {t('editMode.noAssets')}
          </div>
        ) : (
          <div className="grid max-h-[340px] grid-cols-3 gap-2 overflow-y-auto p-1">
            {assets.map((asset) => {
              const checked = selected === asset.relativePath
              return (
                <div
                  key={asset.relativePath}
                  className={cn(
                    'group overflow-hidden rounded-lg border-2 transition-all duration-200',
                    checked
                      ? 'border-primary ring-2 ring-[var(--ui-focus)]/40 shadow-md shadow-[var(--ui-focus)]/20'
                      : 'border-[var(--ui-border-strong)]/60 hover:border-[var(--ui-workspace-border)] hover:shadow-md hover:shadow-[var(--ui-focus)]/40 active:scale-[0.97]'
                  )}
                >
                  <div className="relative aspect-[4/3]">
                    {isVideo ? (
                      playingPath === asset.relativePath ? (
                        <video
                          ref={(el) => {
                            if (el) videoRefs.current.set(asset.relativePath, el)
                          }}
                          src={localAssetUrl(asset.absolutePath)}
                          controls
                          autoPlay
                          playsInline
                          className="h-full w-full bg-black"
                        />
                      ) : (
                        <>
                          <video
                            src={localAssetUrl(asset.absolutePath)}
                            preload="metadata"
                            muted
                            playsInline
                            className="h-full w-full object-cover bg-black"
                          />
                          <button
                            type="button"
                            onClick={() => setPlayingPath(asset.relativePath)}
                            className="absolute inset-0 flex items-center justify-center bg-black/15 transition-opacity hover:bg-black/25"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow backdrop-blur-sm">
                              <Play className="h-4 w-4 translate-x-[1px] text-foreground" />
                            </div>
                          </button>
                        </>
                      )
                    ) : (
                      <img
                        src={localAssetUrl(asset.absolutePath)}
                        alt={asset.fileName}
                        className={cn(
                          'h-full w-full object-cover transition-transform duration-200',
                          !checked && 'group-hover:scale-105'
                        )}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setSelected(checked ? null : asset.relativePath)}
                      className="absolute right-1.5 top-1.5 z-10 cursor-pointer"
                    >
                      <CheckIcon checked={checked} />
                    </button>
                  </div>
                  <div className="bg-[var(--ui-surface-elevated)] px-1.5 py-1 text-[10px] text-muted-foreground truncate">
                    {asset.fileName}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('editMode.cancel')}
          </Button>
          <Button size="sm" disabled={!selected} onClick={handleConfirm}>
            {t('editMode.confirmAdd')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
