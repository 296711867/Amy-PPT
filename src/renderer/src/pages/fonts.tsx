import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/Dialog'
import { Input } from '@renderer/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/Select'
import { ipc, type FontListItem, type FontRole, type FontScript } from '@renderer/lib/ipc'
import type { AvailableFontScheme, FontScheme } from '@shared/font-schemes'
import { useToastStore } from '@renderer/store'
import { useT } from '@renderer/i18n'
import { Edit3, FolderOpen, Loader2, Plus, Trash2, Type, Upload, X } from 'lucide-react'

const roleClassName = (role: FontRole[]): string => {
  const hasTitle = role.includes('title')
  const hasBody = role.includes('body')
  if (hasTitle && hasBody) {
    return 'ui-font-tag-tertiary'
  }
  if (hasTitle) {
    return 'ui-font-tag-primary'
  }
  if (hasBody) {
    return 'ui-font-tag-secondary'
  }
  return 'border-border bg-secondary text-muted-foreground'
}

const scriptsClassName = (scripts: FontScript[]): string => {
  const hasLatin = scripts.includes('latin')
  const hasCjk = scripts.includes('cjk')
  if (hasLatin && hasCjk) {
    return 'ui-font-tag-secondary'
  }
  if (hasCjk) {
    return 'ui-font-tag-primary'
  }
  if (hasLatin) {
    return 'ui-font-tag-tertiary'
  }
  return 'border-border bg-secondary text-muted-foreground'
}

const roleFromValue = (value: string): FontRole[] => {
  if (value === 'title') return ['title']
  if (value === 'subtitle') return ['subtitle']
  if (value === 'body') return ['body']
  return ['title', 'subtitle', 'body']
}

const scriptsFromValue = (value: string): FontScript[] => {
  if (value === 'latin') return ['latin']
  if (value === 'cjk') return ['cjk']
  return ['latin', 'cjk']
}

const previewText = (scripts: FontScript[]): string => {
  const hasCjk = scripts.includes('cjk')
  if (hasCjk) return 'Aa 永远好奇'
  return 'Aa Always Curious'
}

const WEIGHT_FROM_NAME: Record<string, string> = {
  thin: '100',
  hairline: '100',
  extralight: '200',
  ultralight: '200',
  light: '300',
  regular: '400',
  normal: '400',
  medium: '500',
  semibold: '600',
  demibold: '600',
  bold: '700',
  extrabold: '800',
  ultrabold: '800',
  black: '900',
  heavy: '900'
}

const guessWeightAndStyle = (filePath: string): { weight: string; style: 'normal' | 'italic' } => {
  const name =
    filePath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.(woff2|ttf|otf)$/i, '') || ''
  const isItalic = /\bitalic\b/i.test(name)
  const weight =
    Object.entries(WEIGHT_FROM_NAME).find(([key]) => {
      const re = new RegExp(`(?:[-_]|\\b)${key}(?:[-_]|\\b|$)`, 'i')
      return re.test(name)
    })?.[1] || '400'
  return { weight, style: isItalic ? 'italic' : 'normal' }
}

export function FontsPage(): React.JSX.Element {
  const { success, error } = useToastStore()
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [googleFonts, setGoogleFonts] = useState<FontListItem[]>([])
  const [systemFonts, setSystemFonts] = useState<FontListItem[]>([])
  const [userFonts, setUserFonts] = useState<FontListItem[]>([])
  const [fontSchemes, setFontSchemes] = useState<AvailableFontScheme[]>([])
  const [family, setFamily] = useState('')
  const [category, setCategory] = useState('sans')
  const [role, setRole] = useState('both')
  const [scripts, setScripts] = useState('mixed')
  const [fileEntries, setFileEntries] = useState<
    Array<{ path: string; weight: string; style: 'normal' | 'italic' }>
  >([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editFont, setEditFont] = useState<FontListItem | null>(null)
  const [schemeOpen, setSchemeOpen] = useState(false)
  const [editingScheme, setEditingScheme] = useState<FontScheme | null>(null)
  const [schemeName, setSchemeName] = useState('')
  const [schemeDescription, setSchemeDescription] = useState('')
  const [schemeTitleId, setSchemeTitleId] = useState('')
  const [schemeSubtitleId, setSchemeSubtitleId] = useState('')
  const [schemeBodyId, setSchemeBodyId] = useState('')

  const roleToLabel = (r: FontRole[]): string => {
    const hasTitle = r.includes('title')
    const hasSubtitle = r.includes('subtitle')
    const hasBody = r.includes('body')
    if (hasTitle && hasSubtitle && hasBody) return t('fonts.roleBoth')
    if (hasTitle) return t('fonts.roleTitle')
    if (hasSubtitle) return t('fonts.roleSubtitle')
    if (hasBody) return t('fonts.roleBody')
    return t('fonts.roleNone')
  }

  const scriptsToLabel = (s: FontScript[]): string => {
    const hasLatin = s.includes('latin')
    const hasCjk = s.includes('cjk')
    if (hasLatin && hasCjk) return t('fonts.scriptsMixed')
    if (hasCjk) return t('fonts.scriptsCjk')
    if (hasLatin) return t('fonts.scriptsLatin')
    return t('fonts.scriptsNone')
  }

  const categoryLabels: Record<string, string> = {
    sans: t('fonts.categorySans'),
    serif: t('fonts.categorySerif'),
    display: t('fonts.categoryDisplay'),
    handwriting: t('fonts.categoryHandwriting'),
    monospace: t('fonts.categoryMonospace')
  }

  const loadFonts = async (): Promise<void> => {
    setLoading(true)
    try {
      const [result, schemes] = await Promise.all([ipc.listFonts(), ipc.listFontSchemes()])
      setGoogleFonts(result.googleFonts)
      setSystemFonts(result.systemFonts)
      setUserFonts(result.userFonts)
      setFontSchemes(schemes.items)
    } catch (err) {
      error(t('fonts.loadFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPreviewCss = async (): Promise<void> => {
    try {
      const css = await ipc.loadFontPreviewCss()
      if (!css) return
      const id = 'font-preview-styles'
      let el = document.getElementById(id) as HTMLStyleElement | null
      if (!el) {
        el = document.createElement('style')
        el.id = id
        document.head.appendChild(el)
      }
      el.textContent = css
      setPreviewReady(true)
    } catch {
      // Preview is non-critical
    }
  }

  useEffect(() => {
    void loadFonts()
    void loadPreviewCss()
  }, [])

  const handleChooseFiles = async (): Promise<void> => {
    try {
      const result = await ipc.chooseFontFiles()
      if (!result.canceled) {
        setFileEntries(
          (result.filePaths || []).map((p) => ({ path: p, ...guessWeightAndStyle(p) }))
        )
      }
    } catch (err) {
      error(t('fonts.chooseFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    }
  }

  const updateFileEntry = (index: number, field: 'weight' | 'style', value: string): void => {
    setFileEntries((prev) =>
      prev.map((e, i) =>
        i === index
          ? { ...e, [field]: field === 'style' ? (value as 'normal' | 'italic') : value }
          : e
      )
    )
  }

  const removeFileEntry = (index: number): void => {
    setFileEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async (): Promise<void> => {
    const familyText = family.trim()
    if (!familyText) {
      error(t('fonts.fillFamily'))
      return
    }
    if (fileEntries.length === 0) {
      error(t('fonts.selectFile'))
      return
    }
    if (!scripts) {
      error(t('fonts.selectScripts'))
      return
    }
    setUploading(true)
    try {
      await ipc.uploadFont({
        family: familyText,
        category,
        role: roleFromValue(role),
        scripts: scriptsFromValue(scripts),
        files: fileEntries.map((entry) => {
          const w = Number.parseInt(entry.weight, 10)
          return {
            path: entry.path,
            weight: Number.isFinite(w) ? w : 400,
            style: entry.style
          }
        })
      })
      success(t('fonts.uploaded'))
      setUploadOpen(false)
      setFamily('')
      setCategory('sans')
      setRole('both')
      setScripts('')
      setFileEntries([])
      await loadFonts()
      void loadPreviewCss()
    } catch (err) {
      error(t('fonts.uploadFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (font: FontListItem): Promise<void> => {
    try {
      await ipc.deleteFont(font.id)
      success(t('fonts.deleted'))
      await loadFonts()
      void loadPreviewCss()
    } catch (err) {
      error(t('fonts.deleteFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    }
  }

  const allFonts = [...userFonts, ...systemFonts, ...googleFonts]
  const fontSelectId = (font: FontListItem): string => `${font.source}:${font.id}`
  const resolveFont = (id: string): FontListItem | undefined =>
    allFonts.find((font) => fontSelectId(font) === id)
  const openSchemeEditor = (scheme?: FontScheme): void => {
    setEditingScheme(scheme || null)
    setSchemeName(scheme?.name || '')
    setSchemeDescription(scheme?.description || '')
    const findId = (family: string | undefined): string =>
      allFonts.find((font) => font.family === family)?.id
        ? fontSelectId(allFonts.find((font) => font.family === family)!)
        : ''
    setSchemeTitleId(findId(scheme?.title.family))
    setSchemeSubtitleId(findId(scheme?.subtitle.family))
    setSchemeBodyId(findId(scheme?.body.family))
    setSchemeOpen(true)
  }
  const schemeRoleLabel = (role: 'title' | 'subtitle' | 'body'): string =>
    role === 'title'
      ? t('fonts.schemeRoleTitle')
      : role === 'subtitle'
        ? t('fonts.schemeRoleSubtitle')
        : t('fonts.schemeRoleBody')

  const saveScheme = async (): Promise<void> => {
    const title = resolveFont(schemeTitleId)
    const subtitle = resolveFont(schemeSubtitleId)
    const body = resolveFont(schemeBodyId)
    if (!schemeName.trim() || !title || !subtitle || !body) {
      error(t('fonts.schemeFillRequired'))
      return
    }
    try {
      await ipc.saveFontScheme({
        id: editingScheme?.id || '',
        name: schemeName.trim(),
        description: schemeDescription.trim(),
        builtIn: false,
        title: { source: title.source, family: title.family, id: title.id },
        subtitle: { source: subtitle.source, family: subtitle.family, id: subtitle.id },
        body: { source: body.source, family: body.family, id: body.id }
      })
      setSchemeOpen(false)
      success(t('fonts.schemeSaved'))
      await loadFonts()
    } catch (err) {
      error(t('fonts.schemeSaveFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    }
  }

  const handleDeleteScheme = async (scheme: AvailableFontScheme): Promise<void> => {
    try {
      await ipc.deleteFontScheme(scheme.id)
      success(t('fonts.schemeDeleted'))
      await loadFonts()
    } catch (err) {
      error(t('fonts.schemeDeleteFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    }
  }

  const updateUploadedFont = async (): Promise<void> => {
    if (!editFont || !family.trim()) return
    try {
      await ipc.updateFont({
        id: editFont.id,
        family: family.trim(),
        category,
        role: roleFromValue(role),
        scripts: scriptsFromValue(scripts)
      })
      setEditFont(null)
      success(t('fonts.fontUpdated'))
      await loadFonts()
      void loadPreviewCss()
    } catch (err) {
      error(t('fonts.fontUpdateFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t('fonts.eyebrow')}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="organic-serif text-[32px] font-semibold leading-none text-foreground">
            {t('fonts.title')}
          </h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void ipc.revealFontsFolder()}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('fonts.openFolder')}
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('fonts.upload')}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">{t('fonts.description')}</p>
      </div>

      <div className="space-y-4">
        <Dialog open={schemeOpen} onOpenChange={setSchemeOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingScheme ? t('fonts.schemeEditTitle') : t('fonts.schemeCreateTitle')}
              </DialogTitle>
              <DialogDescription>{t('fonts.schemeDialogDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder={t('fonts.schemeNamePlaceholder')}
                value={schemeName}
                onChange={(e) => setSchemeName(e.target.value)}
              />
              <Input
                placeholder={t('fonts.schemeDescriptionPlaceholder')}
                value={schemeDescription}
                onChange={(e) => setSchemeDescription(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  ['title', schemeTitleId, setSchemeTitleId],
                  ['subtitle', schemeSubtitleId, setSchemeSubtitleId],
                  ['body', schemeBodyId, setSchemeBodyId]
                ] as const).map(([targetRole, value, setter]) => {
                  const label = schemeRoleLabel(targetRole)
                  return (
                    <div key={targetRole}>
                      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
                      <Select value={value} onValueChange={setter}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('fonts.schemeSelectPlaceholder', { role: label })}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {allFonts
                            .filter((font) => font.role.includes(targetRole))
                            .map((font) => (
                              <SelectItem key={fontSelectId(font)} value={fontSelectId(font)}>
                                {font.family}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void saveScheme()}>{t('fonts.schemeSave')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(editFont)} onOpenChange={(open) => !open && setEditFont(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('fonts.editFontTitle')}</DialogTitle>
              <DialogDescription>{t('fonts.editFontDescription')}</DialogDescription>
            </DialogHeader>
            <Input
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              placeholder={t('fonts.familyName')}
            />
            <div className="grid grid-cols-3 gap-2">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{t('fonts.roleAllLevels')}</SelectItem>
                  <SelectItem value="title">{t('fonts.schemeRoleTitle')}</SelectItem>
                  <SelectItem value="subtitle">{t('fonts.schemeRoleSubtitle')}</SelectItem>
                  <SelectItem value="body">{t('fonts.schemeRoleBody')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={scripts} onValueChange={setScripts}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latin">{t('fonts.scriptsLatin')}</SelectItem>
                  <SelectItem value="cjk">{t('fonts.scriptsCjk')}</SelectItem>
                  <SelectItem value="mixed">{t('fonts.scriptsMixed')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void updateUploadedFont()}>{t('fonts.saveChanges')}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="flex-row items-center justify-between p-5 pb-3">
            <div>
              <CardTitle className="text-base">{t('fonts.schemeCardTitle')}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('fonts.schemeCardDesc')}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => openSchemeEditor()}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('fonts.schemeCreate')}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2 p-5 pt-0 sm:grid-cols-2">
            {fontSchemes.map((scheme) => (
              <div key={scheme.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{scheme.name}</span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {scheme.builtIn ? t('fonts.schemeBuiltInTag') : t('fonts.schemeCustomTag')}
                  </span>
                  {!scheme.available ? (
                    <span className="text-[10px] text-destructive">
                      {t('fonts.schemeMissingTag')}
                    </span>
                  ) : null}
                  {!scheme.builtIn ? (
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label={t('fonts.schemeEditTitle')}
                        onClick={() => openSchemeEditor(scheme)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label={t('fonts.schemeDeleteLabel', { name: scheme.name })}
                        onClick={() => void handleDeleteScheme(scheme)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {scheme.title.family} / {scheme.subtitle.family} / {scheme.body.family}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upload dialog */}
        <Dialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open)
            if (!open) {
              setFamily('')
              setCategory('sans')
              setRole('both')
              setScripts('mixed')
              setFileEntries([])
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('fonts.uploadDialogTitle')}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/70">
                {t('fonts.uploadDialogDescription')} {t('fonts.uploadDialogDownloadPre')}{' '}
                <a
                  href="https://gwfh.mranftl.com/fonts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-[var(--ui-action-hover)]"
                >
                  {t('fonts.googleFontsHelperLink')}
                </a>{' '}
                {t('fonts.uploadDialogDownloadPost')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
              <div>
                <label className="mb-1 block text-sm font-medium">{t('fonts.familyName')}</label>
                <Input
                  placeholder={t('fonts.familyNamePlaceholder')}
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t('fonts.role')}</label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">{t('fonts.roleBoth')}</SelectItem>
                    <SelectItem value="title">{t('fonts.roleTitle')}</SelectItem>
                    <SelectItem value="subtitle">{t('fonts.roleSubtitle')}</SelectItem>
                    <SelectItem value="body">{t('fonts.roleBody')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t('fonts.scripts')}</label>
                <Select value={scripts} onValueChange={setScripts}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('fonts.scriptsPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latin">{t('fonts.scriptsLatin')}</SelectItem>
                    <SelectItem value="cjk">{t('fonts.scriptsCjk')}</SelectItem>
                    <SelectItem value="mixed">{t('fonts.scriptsMixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label className="mb-1 block text-sm font-medium">{t('fonts.category')}</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void handleChooseFiles()}
              >
                <Type className="mr-1.5 h-3.5 w-3.5" />
                {t('fonts.chooseFiles')}
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-1.5 text-left font-medium">File</th>
                  <th className="pb-1.5 text-center font-medium" style={{ width: 72 }}>
                    Font Weight
                  </th>
                  <th className="pb-1.5 text-center font-medium" style={{ width: 110 }}>
                    Style
                  </th>
                  <th className="pb-1.5 font-medium" style={{ width: 32 }}></th>
                </tr>
              </thead>
              {fileEntries.length > 0 && (
                <tbody>
                  {fileEntries.map((entry, i) => (
                    <tr key={entry.path} className="border-b border-border align-middle">
                      <td className="py-1.5 pr-2">
                        <span className="block truncate text-foreground">
                          {entry.path.split(/[\\/]/).pop() || entry.path}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <Input
                          value={entry.weight}
                          inputMode="numeric"
                          onChange={(e) => updateFileEntry(i, 'weight', e.target.value)}
                          className="h-7 w-[64px] text-center text-sm"
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <Select
                          value={entry.style}
                          onValueChange={(v) => updateFileEntry(i, 'style', v)}
                        >
                          <SelectTrigger className="h-7 w-[110px] text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="italic">Italic</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFileEntry(i)}
                          aria-label={t('fonts.removeFile')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-[120px]"
                onClick={() => void handleUpload()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('fonts.uploadButton')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* User fonts */}
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">{t('fonts.uploadedFonts')}</CardTitle>
            {userFonts.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('fonts.fontCount', { count: userFonts.length })}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('fonts.loading')}</p>
            ) : userFonts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-secondary/60 py-6 text-center text-sm text-muted-foreground">
                {t('fonts.emptyUpload')}
              </div>
            ) : (
              <div className="space-y-2">
                {userFonts.map((font) => (
                  <div
                    key={font.id}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card/80 p-3 transition-all hover:border-[var(--ui-border-strong)] hover:shadow-[0_8px_20px_rgb(var(--ui-shadow-color)/0.1)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{font.family}</p>
                      {previewReady && (
                        <p
                          className="mt-1 truncate text-lg text-muted-foreground"
                          style={{ fontFamily: `"${font.family}", sans-serif` }}
                        >
                          {previewText(font.scripts)}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 font-medium ${roleClassName(font.role)}`}
                        >
                          {roleToLabel(font.role)}
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 font-medium ${scriptsClassName(font.scripts)}`}
                        >
                          {scriptsToLabel(font.scripts)}
                        </span>
                        <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-muted-foreground">
                          {categoryLabels[font.category] || font.category}
                        </span>
                        <span className="text-muted-foreground">
                          {t('fonts.fileCount', { count: font.files?.length || 0 })}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void handleDelete(font)}
                      aria-label={t('fonts.deleteLabel', { family: font.family })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        setEditFont(font)
                        setFamily(font.family)
                        setCategory(font.category)
                        setRole(
                          font.role.length > 1 ||
                            (font.role.includes('title') && font.role.includes('body'))
                            ? 'both'
                            : font.role[0] || 'both'
                        )
                        setScripts(
                          font.scripts.includes('cjk') && font.scripts.includes('latin')
                            ? 'mixed'
                            : font.scripts[0] || 'mixed'
                        )
                      }}
                      aria-label={t('fonts.editFontLabel', { family: font.family })}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">{t('fonts.systemFontsTitle')}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t('fonts.systemFontsDesc')}</p>
          </CardHeader>
          <CardContent className="grid gap-2 p-5 pt-0 sm:grid-cols-2">
            {systemFonts.map((font) => (
              <div key={font.id} className="rounded-md border border-border bg-card/60 px-3 py-2.5">
                <p className="text-lg" style={{ fontFamily: `"${font.family}", sans-serif` }}>{previewText(font.scripts)}</p>
                <p className="text-sm font-medium">{font.family}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Google fonts */}
        <Card>
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('fonts.googleFontsTitle')}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{t('fonts.googleFontsDesc')}</p>
              </div>
              <span className="rounded-md bg-accent px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                {googleFonts.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="max-h-[460px] overflow-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                {googleFonts.map((font) => (
                  <div
                    key={font.id}
                    className="rounded-lg border border-border bg-card/60 px-3 py-2.5 transition-colors hover:border-[var(--ui-border-strong)] hover:bg-accent"
                  >
                    {previewReady && (
                      <p
                        className="truncate text-lg text-muted-foreground"
                        style={{ fontFamily: `"${font.family}", sans-serif` }}
                      >
                        {previewText(font.scripts)}
                      </p>
                    )}
                    <p className="text-sm font-medium text-foreground">{font.family}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 font-medium ${roleClassName(font.role)}`}
                      >
                        {roleToLabel(font.role)}
                      </span>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 font-medium ${scriptsClassName(font.scripts)}`}
                      >
                        {scriptsToLabel(font.scripts)}
                      </span>
                      <span className="text-muted-foreground">{font.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
