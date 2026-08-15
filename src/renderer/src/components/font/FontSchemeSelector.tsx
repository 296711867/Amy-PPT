import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Settings2, Type } from 'lucide-react'
import type { FontSelection } from '@shared/generation'
import type { AvailableFontScheme } from '@shared/font-schemes'
import { fontSchemeToSelection } from '@shared/font-schemes'
import { ipc, type FontListItem } from '@renderer/lib/ipc'
import { useLang } from '@renderer/i18n'
import { Button } from '../ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'

interface FontSchemeSelectorProps {
  value: FontSelection
  onChange: (value: FontSelection) => void
  compact?: boolean
}

const selectId = (font: FontListItem): string => `${font.source}:${font.id}`

const selectionId = (font: Extract<FontSelection, { mode: 'pair' }>['title']): string =>
  `${font.source}:${font.id || font.family}`

export function FontSchemeSelector({
  value,
  onChange,
  compact = false
}: FontSchemeSelectorProps): ReactElement {
  const navigate = useNavigate()
  const { lang, t } = useLang()
  const familiesSeparator = lang === 'en' ? ', ' : '、'
  const [fonts, setFonts] = useState<FontListItem[]>([])
  const [schemes, setSchemes] = useState<AvailableFontScheme[]>([])
  const [expanded, setExpanded] = useState(value.mode === 'pair' && !value.presetId)

  useEffect(() => {
    let active = true
    void Promise.all([ipc.listFonts(), ipc.listFontSchemes()]).then(([fontResult, schemeResult]) => {
      if (!active) return
      setFonts([...fontResult.userFonts, ...fontResult.systemFonts, ...fontResult.googleFonts])
      setSchemes(schemeResult.items)
    })
    return () => {
      active = false
    }
  }, [])

  const currentSchemeId = value.mode === 'pair' ? value.presetId || 'custom' : 'auto'
  const roleFonts = (role: 'title' | 'subtitle' | 'body'): FontListItem[] => {
    const filtered = fonts.filter((font) => font.role.includes(role))
    return filtered.length > 0 ? filtered : fonts
  }
  const resolveFont = (id: string): FontListItem | undefined => fonts.find((font) => selectId(font) === id)
  const customValue =
    value.mode === 'pair'
      ? {
          title: selectionId(value.title),
          subtitle: selectionId(value.subtitle || value.body),
          body: selectionId(value.body)
        }
      : { title: '', subtitle: '', body: '' }

  const roleLabel = (role: 'title' | 'subtitle' | 'body'): string =>
    role === 'title'
      ? t('fonts.schemeRoleTitle')
      : role === 'subtitle'
        ? t('fonts.schemeRoleSubtitle')
        : t('fonts.schemeRoleBody')

  const selectedSummary = useMemo(() => {
    if (value.mode !== 'pair') return t('fonts.schemeAutoSummary')
    const scheme = schemes.find((item) => item.id === value.presetId)
    if (scheme) return `${scheme.title.family} / ${scheme.subtitle.family} / ${scheme.body.family}`
    return `${value.title.family} / ${(value.subtitle || value.body).family} / ${value.body.family}`
  }, [schemes, t, value])

  const updateCustom = (role: 'title' | 'subtitle' | 'body', id: string): void => {
    const selected = resolveFont(id)
    if (!selected) return
    const fallback = value.mode === 'pair' ? value : null
    const firstBody = roleFonts('body')[0] || selected
    const firstTitle = roleFonts('title')[0] || selected
    const firstSubtitle = roleFonts('subtitle')[0] || firstBody
    onChange({
      mode: 'pair',
      title:
        role === 'title'
          ? selected
          : fallback?.title || { source: firstTitle.source, family: firstTitle.family, id: firstTitle.id },
      subtitle:
        role === 'subtitle'
          ? selected
          : fallback?.subtitle || {
              source: firstSubtitle.source,
              family: firstSubtitle.family,
              id: firstSubtitle.id
            },
      body:
        role === 'body'
          ? selected
          : fallback?.body || { source: firstBody.source, family: firstBody.family, id: firstBody.id }
    })
  }

  const renderCustomSelect = (
    role: 'title' | 'subtitle' | 'body',
    selected: string
  ): ReactElement => {
    const label = roleLabel(role)
    return (
      <div className="min-w-0">
        <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
        <Select value={selected} onValueChange={(id) => updateCustom(role, id)}>
          <SelectTrigger className={compact ? 'h-8 min-w-0 text-xs' : 'h-9 min-w-0'}>
            <SelectValue placeholder={t('fonts.schemeSelectPlaceholder', { role: label })} />
          </SelectTrigger>
          <SelectContent>
            {roleFonts(role).map((font) => (
              <SelectItem key={selectId(font)} value={selectId(font)} textValue={font.family}>
                <span style={{ fontFamily: `"${font.family}", sans-serif` }}>{font.family}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setExpanded(false)
            onChange({ mode: 'auto' })
          }}
          className={`flex min-h-16 items-center gap-3 rounded-md border p-3 text-left transition-colors ${
            currentSchemeId === 'auto'
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card hover:bg-accent'
          }`}
        >
          <Type className="h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t('fonts.schemeAutoName')}</span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {t('fonts.schemeAutoHint')}
            </span>
          </span>
          {currentSchemeId === 'auto' ? <Check className="ml-auto h-4 w-4" /> : null}
        </button>
        {schemes.map((scheme) => (
          <button
            type="button"
            key={scheme.id}
            disabled={!scheme.available}
            onClick={() => {
              setExpanded(false)
              onChange(fontSchemeToSelection(scheme))
            }}
            className={`min-h-16 rounded-md border p-3 text-left transition-colors ${
              currentSchemeId === scheme.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-accent'
            } disabled:cursor-not-allowed disabled:opacity-45`}
            title={
              scheme.available
                ? scheme.description
                : t('fonts.schemeMissingTitle', {
                    families: scheme.missingFamilies.join(familiesSeparator)
                  })
            }
          >
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{scheme.name}</span>
              {currentSchemeId === scheme.id ? <Check className="ml-auto h-4 w-4" /> : null}
            </span>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
              {scheme.available
                ? `${scheme.title.family} / ${scheme.subtitle.family} / ${scheme.body.family}`
                : t('fonts.schemeMissing', {
                    families: scheme.missingFamilies.join(familiesSeparator)
                  })}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-card px-3 text-xs hover:bg-accent"
        onClick={() => setExpanded((current) => !current)}
      >
        <Settings2 className="h-4 w-4" />
        <span>{t('fonts.schemeCustom')}</span>
        <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
          {selectedSummary}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {renderCustomSelect('title', customValue.title)}
            {renderCustomSelect('subtitle', customValue.subtitle)}
            {renderCustomSelect('body', customValue.body)}
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/fonts')}>
              {t('fonts.schemeManage')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
