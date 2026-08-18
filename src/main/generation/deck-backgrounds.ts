import fs from 'fs'
import path from 'path'
import log from 'electron-log/main.js'
import type { ImageModelProvider } from '@shared/image-generation'
import type {
  DeckBackgroundAsset,
  DeckBackgroundManifest,
  DeckBackgroundPolicy,
  DeckBackgroundWhitespace,
  OutlineItem
} from '@shared/generation'
import type { SlideSizePreset } from '@shared/slide-size'
import {
  assertModelText,
  extractJsonBlock,
  resolveModel,
  runWithModelTemperatureControl
} from '../agent-runtime/model'
import { resolveImageGenerationProvider } from '../agent-runtime/provider/image'
import type { ResolvedImageModelConfig } from '../agent-runtime/provider/image'
import { readString } from '../agent-runtime/provider/image/providers/utils'
import { uiText, type AppLocale } from '../config/locale-utils'
import type { GenerationModelControl } from './context'

const VALID_IMAGE_PROVIDERS = new Set<ImageModelProvider>([
  'jimeng',
  'jimeng4',
  'agnes',
  'siliconflow',
  'openaiCompatible',
  'gemini',
  'seedream'
])

const CONTENT_WHITESPACE: DeckBackgroundWhitespace[] = [
  'blank-left',
  'blank-right',
  'blank-top-center'
]

const MANIFEST_RELATIVE_PATH = './assets/backgrounds/manifest.json'

const parseConfig = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

const generationSizeForSlide = (slideSize: SlideSizePreset): string => {
  const ratio = slideSize.width / slideSize.height
  if (ratio >= 1.5) return '16:9'
  if (ratio >= 1.15) return '4:3'
  if (ratio <= 0.67) return '9:16'
  if (ratio <= 0.86) return '3:4'
  return '1:1'
}

const whitespaceInstruction = (whitespace: DeckBackgroundWhitespace): string => {
  switch (whitespace) {
    case 'blank-left':
      return 'Keep the left 58% calm, low-contrast, and almost empty for PPT text. Place all thematic subjects and visual detail in the right 35%; do not let them cross the center.'
    case 'blank-right':
      return 'Keep the right 58% calm, low-contrast, and almost empty for PPT text. Place all thematic subjects and visual detail in the left 35%; do not let them cross the center.'
    case 'blank-top-center':
      return 'Keep the upper central 62% calm, low-contrast, and almost empty for a PPT title and content. Concentrate thematic detail along the lower edge and side corners.'
    case 'cover-safe':
      return 'Create a strong cover composition while preserving a large low-detail title-safe area across the central-left region.'
    case 'ending-safe':
      return 'Create a restrained closing composition with a large calm central area for the final takeaway, thanks, or call to action.'
  }
}

const requiredPromptSuffix = (
  whitespace: DeckBackgroundWhitespace,
  slideSize: SlideSizePreset
): string =>
  [
    `Full-canvas PowerPoint background for an exact ${slideSize.width}x${slideSize.height} canvas.`,
    whitespaceInstruction(whitespace),
    'The empty area must remain genuinely usable: smooth tonal transitions only, no subject, icon, pattern, bright highlight, strong line, or high-contrast texture behind future text.',
    'No readable text, no letters, no numbers, no logo, no watermark, no UI, no chart labels, no mock presentation frame, and no decorative border.',
    'Professional presentation background, coherent lighting and palette, edge-to-edge composition, with important visual subjects safely away from the slide crop.'
  ].join(' ')

type BackgroundPlanItem = {
  role: DeckBackgroundAsset['role']
  whitespace: DeckBackgroundWhitespace
  prompt: string
}

const buildRequestedPlan = (pageCount: number, contentCount: number): BackgroundPlanItem[] => {
  const requested: BackgroundPlanItem[] = [
    { role: 'cover', whitespace: 'cover-safe', prompt: '' }
  ]
  if (pageCount >= 3) {
    for (let index = 0; index < contentCount; index += 1) {
      requested.push({ role: 'content', whitespace: CONTENT_WHITESPACE[index], prompt: '' })
    }
  }
  if (pageCount >= 2) requested.push({ role: 'ending', whitespace: 'ending-safe', prompt: '' })
  return requested
}

const buildPromptPlan = async (args: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  maxTokens: number
  topic: string
  stylePrompt: string
  slideSize: SlideSizePreset
  requested: BackgroundPlanItem[]
  signal: AbortSignal
  modelControl?: GenerationModelControl
}): Promise<BackgroundPlanItem[]> => {
  const client = args.modelControl
    ? runWithModelTemperatureControl(args.modelControl, () =>
        resolveModel(
          args.provider,
          args.apiKey,
          args.model,
          args.baseUrl,
          0.35,
          args.maxTokens
        )
      )
    : resolveModel(
        args.provider,
        args.apiKey,
        args.model,
        args.baseUrl,
        0.35,
        args.maxTokens
      )
  const response = await client.invoke(
    [
      {
        role: 'system' as const,
        content: [
          'You are a senior PPT art director writing prompts for a background-image model.',
          'Create a coherent background family for one presentation. Translate the topic into meaningful visual subjects and translate the selected style into palette, material, lighting, texture, and art direction.',
          'These are backgrounds, not posters or web hero banners. Empty content-safe regions are mandatory and must remain quiet enough for dense PPT text.',
          'Return only a raw JSON array. Each item must contain exactly role, whitespace, prompt.',
          'Keep role and whitespace exactly as requested. Prompt must be detailed English suitable for an image model.',
          'Never request text, letters, numbers, logos, watermarks, charts, UI, presentation mockups, frames, or borders.'
        ].join('\n')
      },
      {
        role: 'user' as const,
        content: [
          `Presentation topic: ${args.topic}`,
          `Selected style rules:\n${args.stylePrompt}`,
          `Canvas: ${args.slideSize.width}x${args.slideSize.height}`,
          `Required variants: ${JSON.stringify(args.requested.map(({ role, whitespace }) => ({ role, whitespace })))}`,
          'Make every content variant visually related but compositionally distinct. The thematic subject must sit on the opposite side from the requested blank region.'
        ].join('\n\n')
      }
    ],
    { signal: args.signal }
  )
  const text = assertModelText(response, { maxTokens: args.maxTokens })
  const parsed = JSON.parse(extractJsonBlock(text)) as unknown
  if (!Array.isArray(parsed) || parsed.length !== args.requested.length) {
    throw new Error('Background prompt plan returned an unexpected item count')
  }
  return args.requested.map((expected, index) => {
    const item = parsed[index]
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : ''
    if (!prompt) throw new Error(`Background prompt ${index + 1} is empty`)
    return {
      ...expected,
      prompt: `${prompt}\n${requiredPromptSuffix(expected.whitespace, args.slideSize)}`
    }
  })
}

export const readDeckBackgroundManifest = async (
  projectDir: string
): Promise<DeckBackgroundManifest | null> => {
  const manifestPath = path.join(projectDir, 'assets', 'backgrounds', 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const parsed = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8')) as DeckBackgroundManifest
    if (parsed.version !== 1 || !Array.isArray(parsed.assets) || parsed.assets.length === 0) {
      return null
    }
    const allFilesExist = parsed.assets.every((asset) =>
      fs.existsSync(path.resolve(projectDir, asset.path.replace(/^\.\//, '')))
    )
    return allFilesExist ? parsed : null
  } catch {
    return null
  }
}

export const isDeckBackgroundManifestCompatible = (
  manifest: DeckBackgroundManifest,
  policy: DeckBackgroundPolicy,
  pageCount: number,
  slideSizeId: string
): boolean => {
  if (!policy.enabled || manifest.slideSizeId !== slideSizeId) return false

  const expectedContentCount = pageCount >= 3 ? policy.contentBackgroundCount : 0
  const expectedEndingCount = pageCount >= 2 ? 1 : 0
  return (
    manifest.assets.filter((asset) => asset.role === 'cover').length === 1 &&
    manifest.assets.filter((asset) => asset.role === 'content').length ===
      expectedContentCount &&
    manifest.assets.filter((asset) => asset.role === 'ending').length === expectedEndingCount
  )
}

export const assignDeckBackgroundAssets = (
  outlineItems: OutlineItem[],
  manifest: DeckBackgroundManifest | null
): OutlineItem[] => {
  if (!manifest || outlineItems.length === 0) return outlineItems
  return outlineItems.map((item, index) => {
    const asset = resolveDeckBackgroundAsset(manifest, index + 1, outlineItems.length)
    return asset ? { ...item, backgroundAsset: asset } : item
  })
}

export const resolveDeckBackgroundAsset = (
  manifest: DeckBackgroundManifest | null,
  pageNumber: number,
  totalPages: number
): DeckBackgroundAsset | undefined => {
  if (!manifest) return undefined
  const cover = manifest.assets.find((asset) => asset.role === 'cover')
  const ending = manifest.assets.find((asset) => asset.role === 'ending')
  const content = manifest.assets.filter((asset) => asset.role === 'content')
  if (pageNumber <= 1) return cover
  if (pageNumber >= totalPages && totalPages > 1) return ending
  return content[(pageNumber - 2) % Math.max(1, content.length)]
}

export const validateAssignedDeckBackground = (
  html: string,
  asset: DeckBackgroundAsset | undefined,
  locale: AppLocale = 'zh'
): string[] => {
  if (!asset) return []

  const backgroundTag = html.match(
    /<img\b(?=[^>]*\bdata-role\s*=\s*["']deck-background["'])[^>]*>/i
  )?.[0]
  if (!backgroundTag) {
    return [
      uiText(
        locale,
        '缺少 data-role="deck-background" 的全画布背景图片层',
        'the full-canvas background image layer with data-role="deck-background" is missing'
      )
    ]
  }

  const src = backgroundTag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] || ''
  const normalizedSrc = src.replace(/\\/g, '/')
  const normalizedAssetPath = asset.path.replace(/\\/g, '/')
  if (!normalizedSrc.includes(normalizedAssetPath)) {
    return [
      uiText(
        locale,
        `背景图片层没有引用分配的路径 ${asset.path}`,
        `the background image layer does not reference the assigned path ${asset.path}`
      )
    ]
  }

  return []
}

export async function prepareDeckBackgroundAssets(args: {
  db: {
    getActiveImageModelConfig(): Promise<
      | { id: string; name: string; provider: string; active: number; modelConfig: string }
      | undefined
    >
  }
  decryptApiKey(value: string): string
  projectDir: string
  policy: DeckBackgroundPolicy
  pageCount: number
  slideSize: SlideSizePreset
  topic: string
  stylePrompt: string
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  maxTokens: number
  signal: AbortSignal
  modelControl?: GenerationModelControl
  onStatus?: (status: {
    state: 'planning' | 'generating' | 'generated' | 'failed'
    current: number
    total: number
    role?: DeckBackgroundAsset['role']
    whitespace?: DeckBackgroundWhitespace
    detail?: string
  }) => void
}): Promise<DeckBackgroundManifest | null> {
  if (!args.policy.enabled) return null
  const existing = await readDeckBackgroundManifest(args.projectDir)
  if (
    existing &&
    isDeckBackgroundManifestCompatible(
      existing,
      args.policy,
      args.pageCount,
      args.slideSize.id
    )
  ) {
    return existing
  }

  // 背景图是增强项，绝不能因为它炸掉整套生成：
  // 模型缺失、配置不完整、生成中途失败都降级为「跳过背景图」并回报原因。
  const skipBackgrounds = (reason: string, logLevel: 'warn' | 'error' = 'warn'): null => {
    log[logLevel]('[generate:deck-backgrounds] skipping background package', { reason })
    args.onStatus?.({ state: 'failed', current: 0, total: 0, detail: reason })
    return null
  }

  const rawConfig = await args.db.getActiveImageModelConfig().catch(() => undefined)
  if (!rawConfig || !VALID_IMAGE_PROVIDERS.has(rawConfig.provider as ImageModelProvider)) {
    return skipBackgrounds('没有可用的生图模型，已跳过背景图（可在设置中配置生图模型）')
  }
  const config: ResolvedImageModelConfig = {
    id: rawConfig.id,
    name: rawConfig.name,
    provider: rawConfig.provider as ImageModelProvider,
    active: rawConfig.active === 1,
    modelConfig: parseConfig(args.decryptApiKey(rawConfig.modelConfig || '{}'))
  }
  const configuredModel = readString(config.modelConfig, 'model')
  if (!configuredModel) {
    return skipBackgrounds(
      `生图模型「${rawConfig.name}」缺少 model 字段，已跳过背景图（请在设置中生图模型里填写 model）`
    )
  }
  const requested = buildRequestedPlan(args.pageCount, args.policy.contentBackgroundCount)
  args.onStatus?.({ state: 'planning', current: 0, total: requested.length })
  try {
    const plan = await buildPromptPlan({ ...args, requested })
    const adapter = resolveImageGenerationProvider(config.provider)
    const backgroundsDir = path.join(args.projectDir, 'assets', 'backgrounds')
    await fs.promises.mkdir(backgroundsDir, { recursive: true })
    const assets: DeckBackgroundAsset[] = []
    for (let index = 0; index < plan.length; index += 1) {
      if (args.signal.aborted) throw args.signal.reason
      const item = plan[index]
      args.onStatus?.({
        state: 'generating',
        current: index + 1,
        total: plan.length,
        role: item.role,
        whitespace: item.whitespace
      })
      const [result] = await adapter.generate(config, {
        prompt: item.prompt,
        size: generationSizeForSlide(args.slideSize),
        count: 1,
        signal: args.signal
      })
      if (!result) throw new Error(`背景图 ${index + 1} 生成结果为空`)
      const extension = /^\.[a-z0-9]{2,5}$/i.test(result.extension) ? result.extension : '.png'
      const suffix = item.role === 'content' ? `-${item.whitespace}` : ''
      const fileName = `${item.role}${suffix}${extension}`
      await fs.promises.writeFile(path.join(backgroundsDir, fileName), result.bytes)
      assets.push({
        role: item.role,
        whitespace: item.whitespace,
        path: `./assets/backgrounds/${fileName}`,
        prompt: item.prompt
      })
      args.onStatus?.({
        state: 'generated',
        current: index + 1,
        total: plan.length,
        role: item.role,
        whitespace: item.whitespace
      })
    }
    const manifest: DeckBackgroundManifest = {
      version: 1,
      slideSizeId: args.slideSize.id,
      assets
    }
    await fs.promises.writeFile(
      path.join(backgroundsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    )
    log.info('[generate:deck-backgrounds] package generated', {
      assetCount: assets.length,
      manifestPath: MANIFEST_RELATIVE_PATH
    })
    return manifest
  } catch (error) {
    if (args.signal.aborted || error === args.signal.reason) throw error
    return skipBackgrounds(
      `背景图生成失败，已跳过（${
        error instanceof Error ? error.message : String(error)
      }），演示生成将继续`
    , 'error')
  }
}
