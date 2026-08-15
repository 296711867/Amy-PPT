import type { FontRef, FontSelection } from './generation'

export interface FontScheme {
  id: string
  name: string
  description: string
  builtIn: boolean
  title: FontRef
  subtitle: FontRef
  body: FontRef
  createdAt?: number
  updatedAt?: number
}

export interface AvailableFontScheme extends FontScheme {
  available: boolean
  missingFamilies: string[]
}

const normalizeText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizeFontRef = (value: unknown): FontRef | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const family = normalizeText(record.family)
  if (!family) return null
  const source: FontRef['source'] =
    record.source === 'uploaded' || record.source === 'system' ? record.source : 'google'
  return {
    source,
    family,
    id: typeof record.id === 'string' ? record.id.trim() || undefined : undefined
  }
}

export const normalizeUserFontScheme = (value: unknown): FontScheme | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = normalizeText(record.id)
  const name = normalizeText(record.name)
  const title = normalizeFontRef(record.title)
  const subtitle = normalizeFontRef(record.subtitle)
  const body = normalizeFontRef(record.body)
  if (!id || !name || !title || !subtitle || !body) return null
  return {
    id,
    name,
    description: normalizeText(record.description),
    builtIn: false,
    title,
    subtitle,
    body,
    createdAt: Number.isFinite(Number(record.createdAt)) ? Number(record.createdAt) : undefined,
    updatedAt: Number.isFinite(Number(record.updatedAt)) ? Number(record.updatedAt) : undefined
  }
}

const font = (source: FontRef['source'], family: string, id?: string): FontRef => ({
  source,
  family,
  id
})

/**
 * Five practical presentation combinations. Commercial/system fonts are referenced only by
 * family name and are never redistributed with Amy-PPT.
 */
export const BUILT_IN_FONT_SCHEMES: FontScheme[] = [
  {
    id: 'brand-launch',
    name: '品牌发布',
    description: '醒目中文标题搭配清晰的 OPPO Sans，适合品牌、发布会和宣传型演示。',
    builtIn: true,
    title: font('system', 'PangMenZhengDao', 'system:pangmenzhengdao'),
    subtitle: font('system', 'OPPOSans', 'system:oppo-sans'),
    body: font('system', 'OPPOSans', 'system:oppo-sans')
  },
  {
    id: 'modern-chinese',
    name: '现代中文',
    description: '中性、清楚、覆盖完整，适合大多数中文汇报。',
    builtIn: true,
    title: font('google', 'Noto Sans SC', 'google:noto-sans-sc'),
    subtitle: font('google', 'Noto Sans SC', 'google:noto-sans-sc'),
    body: font('google', 'Noto Sans SC', 'google:noto-sans-sc')
  },
  {
    id: 'office-business',
    name: 'Office 商务',
    description: '微软雅黑与 Arial 的稳健组合，适合内部汇报、方案和数据演示。',
    builtIn: true,
    title: font('system', 'Microsoft YaHei', 'system:microsoft-yahei'),
    subtitle: font('system', 'Microsoft YaHei', 'system:microsoft-yahei'),
    body: font('system', 'Arial', 'system:arial')
  },
  {
    id: 'editorial-publishing',
    name: '编辑出版',
    description: '宋体气质的大标题搭配现代黑体正文，适合文化、教育和内容型演示。',
    builtIn: true,
    title: font('google', 'Noto Serif SC', 'google:noto-serif-sc'),
    subtitle: font('google', 'Noto Sans SC', 'google:noto-sans-sc'),
    body: font('google', 'Noto Sans SC', 'google:noto-sans-sc')
  },
  {
    id: 'international-tech',
    name: '国际科技',
    description: 'Space Grotesk、Inter 与中文黑体组合，适合科技、产品和国际化主题。',
    builtIn: true,
    title: font('google', 'Space Grotesk', 'google:space-grotesk'),
    subtitle: font('google', 'Inter', 'google:inter'),
    body: font('google', 'Noto Sans SC', 'google:noto-sans-sc')
  }
]

export const fontSchemeToSelection = (scheme: FontScheme): FontSelection => ({
  mode: 'pair',
  presetId: scheme.id,
  title: scheme.title,
  subtitle: scheme.subtitle,
  body: scheme.body
})

export const collectFontSchemeFamilies = (scheme: FontScheme): string[] =>
  Array.from(new Set([scheme.title.family, scheme.subtitle.family, scheme.body.family]))
