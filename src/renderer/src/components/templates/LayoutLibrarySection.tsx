import { useCallback, useEffect, useState } from 'react'
import { LayoutGrid, Loader2, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToastStore } from '../../store'
import { ipc } from '../../lib/ipc'
import { useT } from '../../i18n'

type LayoutAssetListItem = Awaited<ReturnType<typeof ipc.layoutAssetsList>>['assets'][number]

/**
 * 版式库区块：上传的 PPTX 模板在导入时会自动把可参数化的页面收进版式库。
 * 这里提供只读浏览 + 删除；"锁定模式"生成接入后按容量查询调用。
 */
export function LayoutLibrarySection(): React.JSX.Element {
  const t = useT()
  const { success, error } = useToastStore()
  const [assets, setAssets] = useState<LayoutAssetListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await ipc.layoutAssetsList()
      setAssets(result.assets)
    } catch (err) {
      error(t('templates.layoutLibraryLoadFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    } finally {
      setLoading(false)
    }
  }, [error, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleDelete = async (id: string): Promise<void> => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await ipc.layoutAssetsDelete(id)
      success(t('templates.layoutLibraryDeleted'))
      await refresh()
    } catch (err) {
      error(t('templates.layoutLibraryDeleteFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (!loading && assets.length === 0) return <></>

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            {t('templates.layoutLibraryTitle')}
          </h2>
          <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            {t('templates.layoutLibraryCount', { count: assets.length })}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((current) => !current)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            t(expanded ? 'templates.layoutLibraryCollapse' : 'templates.layoutLibraryExpand')
          )}
        </Button>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
        {t('templates.layoutLibraryHint')}
      </p>
      {expanded && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('templates.layoutLibraryColTitle')}</th>
                <th className="px-3 py-2 font-medium">{t('templates.layoutLibraryColRoles')}</th>
                <th className="px-3 py-2 font-medium">{t('templates.layoutLibraryColSlots')}</th>
                <th className="px-3 py-2 font-medium">{t('templates.layoutLibraryColCapacity')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-t border-border bg-[var(--ui-surface-elevated)]/60">
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-foreground">
                    {asset.title}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{asset.roles.join(' / ')}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[
                      asset.slotSummary.title ? t('templates.layoutLibrarySlotTitle') : '',
                      asset.slotSummary.lists > 0
                        ? `${t('templates.layoutLibrarySlotList')}×${asset.slotSummary.lists}`
                        : '',
                      asset.slotSummary.media > 0
                        ? `${t('templates.layoutLibrarySlotMedia')}×${asset.slotSummary.media}`
                        : '',
                      asset.slotSummary.texts > 0
                        ? `${t('templates.layoutLibrarySlotText')}×${asset.slotSummary.texts}`
                        : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {asset.capacity.moduleMax > 0
                      ? `${asset.capacity.moduleMin}-${asset.capacity.moduleMax}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === asset.id}
                      onClick={() => void handleDelete(asset.id)}
                      aria-label={t('templates.layoutLibraryDelete')}
                    >
                      {deletingId === asset.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
