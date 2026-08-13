import type { LayoutIntent } from './layout-intent'

export const UNIVERSAL_LAYOUT_IDS = [
  'one-text-focus',
  'one-text-editorial',
  'two-cards-split',
  'two-cards-stair',
  'two-text-asymmetric',
  'three-cards-row',
  'three-cards-stack',
  'three-cards-stair',
  'three-text-feature',
  'four-cards-grid',
  'four-cards-row',
  'four-text-feature',
  'five-cards-2-3',
  'five-text-feature',
  'six-cards-grid',
  'six-cards-columns',
  'six-text-feature',
  'image-left-two-cards',
  'two-cards-left-image',
  'two-images-caption',
  'two-images-card-caption',
  'two-images-row-square',
  'three-images-row',
  'three-images-feature',
  'three-images-row-square',
  'four-images-grid',
  'four-images-feature',
  'four-images-grid-square',
  'three-images-row-portrait',
  'four-images-row-portrait',
  'five-images-row-portrait',
  'five-images-2-3',
  'five-images-feature',
  'five-images-2-3-square',
  'six-images-grid',
  'six-images-feature',
  'six-images-row-portrait',
  'six-images-grid-square',
  'five-cards-2-3-image'
] as const

export type UniversalLayoutId = (typeof UNIVERSAL_LAYOUT_IDS)[number]
export type UniversalLayoutFamily = 'text' | 'mixed' | 'gallery'

export const CONTENT_STRUCTURE_IDS = [
  'single-focus',
  'parallel',
  'comparison',
  'sequence',
  'hierarchy',
  'grouped',
  'image-support',
  'gallery'
] as const

export type ContentStructure = (typeof CONTENT_STRUCTURE_IDS)[number]

export const VISUAL_ASPECTS = ['auto', 'landscape', 'portrait', 'square', 'mixed'] as const
export type VisualAspect = (typeof VISUAL_ASPECTS)[number]

export const CONTENT_DENSITIES = ['light', 'standard', 'dense'] as const
export type ContentDensity = (typeof CONTENT_DENSITIES)[number]

export type UniversalLayoutCandidateQuery = {
  moduleCount: number
  intent?: LayoutIntent
  contentStructure?: ContentStructure
  visualAspect?: VisualAspect
  contentDensity?: ContentDensity
}

export type UniversalLayoutDefinition = {
  id: UniversalLayoutId
  intent: LayoutIntent
  family: UniversalLayoutFamily
  moduleCount: number
  imageCount: number
  imageAspect?: Exclude<VisualAspect, 'auto'>
  silhouette: string
  name: string
  prompt: string
}

const flatTextRule =
  'This is a presentation composition, not a web UI. Prefer flat typography and restrained emphasis; cards are optional containers, never buttons, widgets, pills, or nested panels.'
const imageRule =
  'Every image slot is a real replaceable <img> frame with object-fit: cover. Keep captions outside the image and never simulate an image with CSS.'

export const UNIVERSAL_LAYOUTS: readonly UniversalLayoutDefinition[] = [
  {
    id: 'one-text-focus',
    intent: 'summary',
    family: 'text',
    moduleCount: 1,
    imageCount: 0,
    silhouette: 'single-center',
    name: 'Single statement focus',
    prompt: `Use one dominant statement or conclusion in the optical center with one short support line. Preserve generous negative space. ${flatTextRule}`
  },
  {
    id: 'one-text-editorial',
    intent: 'concept',
    family: 'text',
    moduleCount: 1,
    imageCount: 0,
    silhouette: 'single-offset',
    name: 'Single editorial column',
    prompt: `Use one substantial text block offset to one side, with a large section number, keyword, or thin rule balancing the opposite side. ${flatTextRule}`
  },
  {
    id: 'two-cards-split',
    intent: 'concept',
    family: 'text',
    moduleCount: 2,
    imageCount: 0,
    silhouette: 'two-even',
    name: 'Two-part split',
    prompt: `Use exactly two substantial text regions in one horizontal row. Keep their top and bottom edges aligned; use equal width for parallel ideas or a 5:4 ratio when one idea is primary. ${flatTextRule}`
  },
  {
    id: 'two-cards-stair',
    intent: 'process',
    family: 'text',
    moduleCount: 2,
    imageCount: 0,
    silhouette: 'two-stair',
    name: 'Two-step staircase',
    prompt: `Use exactly two wide horizontal text regions as a clear rising staircase. Offset the second consistently in both axes and connect them only for sequence, progress, or dependency. ${flatTextRule}`
  },
  {
    id: 'two-text-asymmetric',
    intent: 'comparison',
    family: 'text',
    moduleCount: 2,
    imageCount: 0,
    silhouette: 'two-asymmetric',
    name: 'Two-part asymmetric emphasis',
    prompt: `Use one large primary text region taking about 60 percent of the content width and one compact secondary region taking about 40 percent. Align them to a shared baseline. ${flatTextRule}`
  },
  {
    id: 'three-cards-row',
    intent: 'concept',
    family: 'text',
    moduleCount: 3,
    imageCount: 0,
    silhouette: 'three-row',
    name: 'Three-part row',
    prompt: `Use exactly three equal text regions in one row. Give each the same title/body alignment and keep gaps mathematically equal. ${flatTextRule}`
  },
  {
    id: 'three-cards-stack',
    intent: 'concept',
    family: 'text',
    moduleCount: 3,
    imageCount: 0,
    silhouette: 'three-stack',
    name: 'Three-part vertical stack',
    prompt: `Use exactly three wide, shallow text regions stacked vertically. Keep equal heights and gaps; each line uses a marker or icon, secondary title, and concise body. ${flatTextRule}`
  },
  {
    id: 'three-cards-stair',
    intent: 'process',
    family: 'text',
    moduleCount: 3,
    imageCount: 0,
    silhouette: 'three-stair',
    name: 'Three-step staircase',
    prompt: `Use exactly three wide, shallow text regions in a rising staircase. Offsets must be regular and the sequence must read immediately from first to third. ${flatTextRule}`
  },
  {
    id: 'three-text-feature',
    intent: 'concept',
    family: 'text',
    moduleCount: 3,
    imageCount: 0,
    silhouette: 'three-feature',
    name: 'One feature plus two supports',
    prompt: `Use one large primary text region on one side and two equal secondary regions stacked on the other. The primary point owns about half the content area. ${flatTextRule}`
  },
  {
    id: 'four-cards-grid',
    intent: 'concept',
    family: 'text',
    moduleCount: 4,
    imageCount: 0,
    silhouette: 'four-grid',
    name: 'Four-part 2 by 2 grid',
    prompt: `Use exactly four equal text regions in a 2 by 2 grid. Align every edge and keep row and column gaps equal. ${flatTextRule}`
  },
  {
    id: 'four-cards-row',
    intent: 'concept',
    family: 'text',
    moduleCount: 4,
    imageCount: 0,
    silhouette: 'four-row',
    name: 'Four-part row',
    prompt: `Use exactly four narrow text regions in one row for very short parallel points. If copy exceeds two short body lines per point, use the 2 by 2 grid instead. ${flatTextRule}`
  },
  {
    id: 'four-text-feature',
    intent: 'concept',
    family: 'text',
    moduleCount: 4,
    imageCount: 0,
    silhouette: 'four-feature',
    name: 'One feature plus three supports',
    prompt: `Use one large primary region spanning the full content height on one side and three shallow support regions stacked on the other. ${flatTextRule}`
  },
  {
    id: 'five-cards-2-3',
    intent: 'concept',
    family: 'text',
    moduleCount: 5,
    imageCount: 0,
    silhouette: 'five-two-three',
    name: 'Five-part centered 2 plus 3',
    prompt: `Use exactly five equal text regions across two centered rows: two centered in the first row and three centered in the second. Share one width, height, and gap system. ${flatTextRule}`
  },
  {
    id: 'five-text-feature',
    intent: 'concept',
    family: 'text',
    moduleCount: 5,
    imageCount: 0,
    silhouette: 'five-feature',
    name: 'One feature plus four supports',
    prompt: `Use one large primary region on the left and four equal support regions in a 2 by 2 arrangement on the right. ${flatTextRule}`
  },
  {
    id: 'six-cards-grid',
    intent: 'concept',
    family: 'text',
    moduleCount: 6,
    imageCount: 0,
    silhouette: 'six-grid',
    name: 'Six-part 3 by 2 grid',
    prompt: `Use exactly six equal text regions in a 3-column by 2-row grid. Keep copy brief and all geometry identical. ${flatTextRule}`
  },
  {
    id: 'six-cards-columns',
    intent: 'comparison',
    family: 'text',
    moduleCount: 6,
    imageCount: 0,
    silhouette: 'six-columns',
    name: 'Six-part paired columns',
    prompt: `Use two broad columns, each containing three aligned shallow text regions. Use this when the six points form two meaningful groups. ${flatTextRule}`
  },
  {
    id: 'six-text-feature',
    intent: 'concept',
    family: 'text',
    moduleCount: 6,
    imageCount: 0,
    silhouette: 'six-feature',
    name: 'Two features plus four supports',
    prompt: `Use two emphasized regions across the top and four compact support regions across the bottom. Keep the bottom row lighter and shorter. ${flatTextRule}`
  },
  {
    id: 'image-left-two-cards',
    intent: 'image-focus',
    family: 'mixed',
    moduleCount: 2,
    imageCount: 1,
    imageAspect: 'portrait',
    silhouette: 'image-left-stack-right',
    name: 'Left image plus two right text regions',
    prompt: `Place one tall image on the left taking about 45 percent of the content width and exactly two equal text regions stacked on the right. Align the image to the full height of the stack. ${imageRule} ${flatTextRule}`
  },
  {
    id: 'two-cards-left-image',
    intent: 'image-focus',
    family: 'mixed',
    moduleCount: 2,
    imageCount: 1,
    imageAspect: 'portrait',
    silhouette: 'stack-left-image-right',
    name: 'Two left text regions plus right image',
    prompt: `Place exactly two equal text regions stacked on the left and one tall image on the right taking about 45 percent of the content width. Align both sides to the same content height. ${imageRule} ${flatTextRule}`
  },
  {
    id: 'two-images-caption',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 2,
    imageCount: 2,
    imageAspect: 'landscape',
    silhouette: 'two-images-flat',
    name: 'Two images with flat captions',
    prompt: `Use exactly two equal image frames side by side. Put a short heading and one concise caption directly below each image without enclosing the caption in a card. ${imageRule}`
  },
  {
    id: 'two-images-card-caption',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 2,
    imageCount: 2,
    imageAspect: 'landscape',
    silhouette: 'two-images-caption-blocks',
    name: 'Two images with caption blocks',
    prompt: `Use exactly two equal image frames side by side, each with one shallow text block directly below it. The two image-plus-text units must share identical geometry. ${imageRule} ${flatTextRule}`
  },
  {
    id: 'two-images-row-square',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 2,
    imageCount: 2,
    imageAspect: 'square',
    silhouette: 'two-squares-row',
    name: 'Two square images in one row',
    prompt: `Use exactly two equal square image frames in one centered horizontal row. Keep generous space between them and place at most a short heading plus one concise caption below each square. ${imageRule}`
  },
  {
    id: 'three-images-row',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 3,
    imageCount: 3,
    imageAspect: 'landscape',
    silhouette: 'three-images-row',
    name: 'Three-image row',
    prompt: `Use exactly three equal image frames in one row with one short caption per image. Keep all crops and caption baselines consistent. ${imageRule}`
  },
  {
    id: 'three-images-feature',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 3,
    imageCount: 3,
    imageAspect: 'mixed',
    silhouette: 'three-images-feature',
    name: 'One large image plus two stacked images',
    prompt: `Use one large image occupying about 60 percent of the gallery width and exactly two smaller images stacked on the other side. Each image gets at most one short caption. ${imageRule}`
  },
  {
    id: 'three-images-row-square',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 3,
    imageCount: 3,
    imageAspect: 'square',
    silhouette: 'three-squares-row',
    name: 'Three square images in one row',
    prompt: `Use exactly three equal square image frames in one horizontal row. Keep identical crops and equal gaps; each square may have one short label or caption. ${imageRule}`
  },
  {
    id: 'four-images-grid',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 4,
    imageCount: 4,
    imageAspect: 'landscape',
    silhouette: 'four-images-grid',
    name: 'Four-image 2 by 2 grid',
    prompt: `Use exactly four equal image frames in a 2 by 2 grid. Keep one crop ratio and equal gaps; captions are optional and limited to one short line. ${imageRule}`
  },
  {
    id: 'four-images-feature',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 4,
    imageCount: 4,
    imageAspect: 'mixed',
    silhouette: 'four-images-feature',
    name: 'One large image plus three-image strip',
    prompt: `Use one large landscape image across the upper content area and exactly three equal smaller images in a row below. Preserve one clear hero-to-support hierarchy. ${imageRule}`
  },
  {
    id: 'four-images-grid-square',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 4,
    imageCount: 4,
    imageAspect: 'square',
    silhouette: 'four-squares-grid',
    name: 'Four square images in a 2 by 2 grid',
    prompt: `Use exactly four equal square image frames in a 2 by 2 grid. Align every edge and keep equal row and column gaps. Captions are optional and limited to one line. ${imageRule}`
  },
  {
    id: 'three-images-row-portrait',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 3,
    imageCount: 3,
    imageAspect: 'portrait',
    silhouette: 'three-portraits-row',
    name: 'Three portrait images in one row',
    prompt: `Use exactly three tall portrait image frames in one horizontal row. Give every frame the same 3:4 or 9:16 ratio and equal gaps. Put only a short label or one-line caption below each frame. ${imageRule}`
  },
  {
    id: 'four-images-row-portrait',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 4,
    imageCount: 4,
    imageAspect: 'portrait',
    silhouette: 'four-portraits-row',
    name: 'Four portrait images in one row',
    prompt: `Use exactly four tall portrait image frames in one horizontal row. Keep identical aspect ratios, heights, crop behavior, and gaps. Captions must be limited to one short line. ${imageRule}`
  },
  {
    id: 'five-images-row-portrait',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 5,
    imageCount: 5,
    imageAspect: 'portrait',
    silhouette: 'five-portraits-row',
    name: 'Five portrait images in one row',
    prompt: `Use exactly five narrow portrait image frames in one horizontal row. This layout is only for genuinely tall visuals with very short labels. Keep all five frames identical and do not add card bodies below them. ${imageRule}`
  },
  {
    id: 'five-images-2-3',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 5,
    imageCount: 5,
    imageAspect: 'landscape',
    silhouette: 'five-images-two-three',
    name: 'Five landscape images in centered 2 plus 3 rows',
    prompt: `Use exactly five landscape image frames across two centered rows: two larger frames in the first row and three smaller equal frames in the second. Keep captions outside frames and preserve equal gaps within each row. ${imageRule}`
  },
  {
    id: 'five-images-feature',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 5,
    imageCount: 5,
    imageAspect: 'mixed',
    silhouette: 'five-images-feature',
    name: 'One feature image plus four supports',
    prompt: `Use exactly one large feature image on the left and four equal support images in a 2 by 2 grid on the right. Use this only when one visual is clearly primary. ${imageRule}`
  },
  {
    id: 'five-images-2-3-square',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 5,
    imageCount: 5,
    imageAspect: 'square',
    silhouette: 'five-squares-two-three',
    name: 'Five square images in centered 2 plus 3 rows',
    prompt: `Use exactly five equal square image frames in two centered rows: two in the first row and three in the second. Use one shared frame size and gap system; labels must stay short. ${imageRule}`
  },
  {
    id: 'six-images-grid',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 6,
    imageCount: 6,
    imageAspect: 'landscape',
    silhouette: 'six-images-grid',
    name: 'Six-image 3 by 2 grid',
    prompt: `Use exactly six equal image frames in a 3-column by 2-row gallery. Use captions only when essential and keep them to one short line. ${imageRule}`
  },
  {
    id: 'six-images-feature',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 6,
    imageCount: 6,
    imageAspect: 'mixed',
    silhouette: 'six-images-feature',
    name: 'One large image plus five support images',
    prompt: `Use one large image on the left and exactly five smaller images in a compact, aligned arrangement on the right. The large image is the visual anchor; the other five are supporting evidence. ${imageRule}`
  },
  {
    id: 'six-images-row-portrait',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 6,
    imageCount: 6,
    imageAspect: 'portrait',
    silhouette: 'six-portraits-row',
    name: 'Six portrait images in one row',
    prompt: `Use exactly six slim portrait image frames in one horizontal row. This is a contact-sheet composition for tall visuals: identical 3:4 or 9:16 frames, equal narrow gaps, no body copy, and at most one short label per image. ${imageRule}`
  },
  {
    id: 'six-images-grid-square',
    intent: 'image-focus',
    family: 'gallery',
    moduleCount: 6,
    imageCount: 6,
    imageAspect: 'square',
    silhouette: 'six-squares-grid',
    name: 'Six square images in a 3 by 2 grid',
    prompt: `Use exactly six equal square image frames in a 3-column by 2-row grid. Maintain identical crops, equal gaps, and at most one short label per image. ${imageRule}`
  },
  {
    id: 'five-cards-2-3-image',
    intent: 'image-focus',
    family: 'mixed',
    moduleCount: 5,
    imageCount: 1,
    silhouette: 'mixed-five-two-three',
    name: 'Five-part 2 plus 3 with image slot',
    prompt: `Use a two-row centered composition. The first row contains one large image plus one primary text region; the second row contains three equal support regions. ${imageRule} ${flatTextRule}`
  }
] as const

const UNIVERSAL_LAYOUT_BY_ID = new Map(UNIVERSAL_LAYOUTS.map((layout) => [layout.id, layout]))

const CONTENT_STRUCTURE_SET = new Set<string>(CONTENT_STRUCTURE_IDS)
const VISUAL_ASPECT_SET = new Set<string>(VISUAL_ASPECTS)
const CONTENT_DENSITY_SET = new Set<string>(CONTENT_DENSITIES)

const CONTENT_STRUCTURE_GUIDANCE: Record<ContentStructure, string> = {
  'single-focus': 'one thesis, quote, conclusion, or dominant idea',
  parallel: 'peer ideas with equal importance',
  comparison: 'alternatives, before/after states, or paired evidence',
  sequence: 'ordered steps, stages, dependencies, or progression',
  hierarchy: 'one or two primary ideas supported by secondary points',
  grouped: 'points that form two or more meaningful clusters',
  'image-support': 'one replaceable image supporting text modules',
  gallery: 'multiple distinct visuals with captions or short labels'
}

export const normalizeContentStructure = (value: unknown): ContentStructure | undefined => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
  return CONTENT_STRUCTURE_SET.has(normalized) ? (normalized as ContentStructure) : undefined
}

export const normalizeVisualAspect = (value: unknown): VisualAspect => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return VISUAL_ASPECT_SET.has(normalized) ? (normalized as VisualAspect) : 'auto'
}

export const normalizeContentDensity = (value: unknown): ContentDensity => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return CONTENT_DENSITY_SET.has(normalized) ? (normalized as ContentDensity) : 'standard'
}

export const getUniversalLayout = (value: unknown): UniversalLayoutDefinition | null => {
  const layout = UNIVERSAL_LAYOUT_BY_ID.get(String(value || '').trim() as UniversalLayoutId)
  return layout ? { ...layout } : null
}

export const normalizeUniversalLayoutId = (value: unknown): UniversalLayoutId | undefined =>
  getUniversalLayout(value)?.id

export const getUniversalLayoutImageCount = (value: unknown): number =>
  getUniversalLayout(value)?.imageCount || 0

export const getUniversalLayoutImageAspect = (
  value: unknown
): Exclude<VisualAspect, 'auto'> | undefined => getUniversalLayout(value)?.imageAspect

const pickUnusedLayout = (
  candidates: readonly UniversalLayoutDefinition[],
  recentLayoutIds: readonly UniversalLayoutId[]
): UniversalLayoutId | undefined => {
  const recent = new Set(recentLayoutIds)
  const recentSilhouettes = new Set(
    recentLayoutIds.map((id) => getUniversalLayout(id)?.silhouette).filter(Boolean)
  )
  return (
    candidates.find((layout) => !recent.has(layout.id) && !recentSilhouettes.has(layout.silhouette))
      ?.id ||
    candidates.find((layout) => !recent.has(layout.id))?.id ||
    candidates[0]?.id
  )
}

const structureScore = (
  layout: UniversalLayoutDefinition,
  structure: ContentStructure | undefined
): number => {
  if (!structure) return 0
  const silhouette = layout.silhouette
  switch (structure) {
    case 'single-focus':
      return Number(layout.moduleCount === 1) * 20 + Number(silhouette.includes('center')) * 4
    case 'parallel':
      return Number(/row|grid|even|flat|stack/.test(silhouette)) * 8
    case 'comparison':
      return Number(/split|asymmetric|columns|even/.test(silhouette)) * 8
    case 'sequence':
      return Number(/stair|stack/.test(silhouette)) * 8
    case 'hierarchy':
      return Number(/feature|asymmetric|offset/.test(silhouette)) * 8
    case 'grouped':
      return Number(/columns|two-three|grid/.test(silhouette)) * 8
    case 'image-support':
      return Number(layout.family === 'mixed') * 20
    case 'gallery':
      return Number(layout.family === 'gallery') * 20
  }
}

const intentScore = (layout: UniversalLayoutDefinition, intent: LayoutIntent | undefined): number => {
  if (intent === 'process' || intent === 'timeline') {
    return Number(/stair|stack/.test(layout.silhouette)) * 5
  }
  if (intent === 'comparison') {
    return Number(/split|asymmetric|columns|even/.test(layout.silhouette)) * 5
  }
  if (intent === 'summary' || intent === 'quote') {
    return Number(/single|feature/.test(layout.silhouette)) * 5
  }
  return 0
}

const visualAspectScore = (
  layout: UniversalLayoutDefinition,
  visualAspect: VisualAspect | undefined
): number => {
  const normalized = normalizeVisualAspect(visualAspect)
  if (layout.family !== 'gallery') return 0
  if (normalized === 'auto') {
    return layout.imageAspect === 'landscape' ? 3 : layout.imageAspect === 'mixed' ? 1 : 0
  }
  return layout.imageAspect === normalized ? 12 : layout.imageAspect === 'mixed' ? 3 : -12
}

const densityScore = (
  layout: UniversalLayoutDefinition,
  contentDensity: ContentDensity | undefined
): number => {
  const normalized = normalizeContentDensity(contentDensity)
  if (normalized === 'light') {
    return Number(/row|single|feature/.test(layout.silhouette)) * 3
  }
  if (normalized === 'dense') {
    return Number(/grid|stack|columns|two-three/.test(layout.silhouette)) * 4
  }
  return 0
}

const isStructureCompatible = (
  layout: UniversalLayoutDefinition,
  structure: ContentStructure | undefined
): boolean => {
  if (!structure) return true
  const silhouette = layout.silhouette
  switch (structure) {
    case 'single-focus':
      return layout.moduleCount === 1
    case 'parallel':
      return /row|grid|even|flat|stack|asymmetric/.test(silhouette)
    case 'comparison':
      return /split|asymmetric|columns|even|row|grid/.test(silhouette)
    case 'sequence':
      return /stair|stack/.test(silhouette)
    case 'hierarchy':
      return /feature|asymmetric|offset/.test(silhouette)
    case 'grouped':
      return /columns|two-three|grid/.test(silhouette)
    case 'image-support':
      return layout.family === 'mixed'
    case 'gallery':
      return layout.family === 'gallery'
  }
}

/**
 * The authoritative "content structure -> candidate layouts" bridge.
 * Agents may rank these candidates, while the host validates and rotates the final choice.
 */
export const getUniversalLayoutCandidates = (
  query: UniversalLayoutCandidateQuery
): UniversalLayoutDefinition[] => {
  const moduleCount = Math.max(1, Math.min(6, Math.floor(query.moduleCount)))
  const structure = normalizeContentStructure(query.contentStructure)
  const requiredFamily: UniversalLayoutFamily | undefined =
    structure === 'image-support'
      ? 'mixed'
      : structure === 'gallery'
        ? 'gallery'
        : query.intent === 'image-focus'
          ? undefined
          : 'text'

  let candidates = UNIVERSAL_LAYOUTS.filter(
    (layout) =>
      layout.moduleCount === moduleCount && (!requiredFamily || layout.family === requiredFamily)
  )

  const structureCandidates = candidates.filter((layout) =>
    isStructureCompatible(layout, structure)
  )
  if (structure) candidates = structureCandidates

  if (query.intent === 'image-focus' && !structure) {
    const visualCandidates = candidates.filter((layout) => layout.imageCount > 0)
    if (visualCandidates.length > 0) candidates = visualCandidates
  }

  const visualAspect = normalizeVisualAspect(query.visualAspect)
  if (visualAspect !== 'auto' && candidates.some((layout) => layout.family === 'gallery')) {
    const exactAspectCandidates = candidates.filter(
      (layout) => layout.imageAspect === visualAspect
    )
    const mixedAspectCandidates = candidates.filter((layout) => layout.imageAspect === 'mixed')
    if (exactAspectCandidates.length > 0) candidates = exactAspectCandidates
    else if (mixedAspectCandidates.length > 0) candidates = mixedAspectCandidates
  }

  return [...candidates].sort((a, b) => {
    const scoreDifference =
      structureScore(b, structure) +
      intentScore(b, query.intent) +
      visualAspectScore(b, query.visualAspect) +
      densityScore(b, query.contentDensity) -
      (structureScore(a, structure) +
        intentScore(a, query.intent) +
        visualAspectScore(a, query.visualAspect) +
        densityScore(a, query.contentDensity))
    return scoreDifference || UNIVERSAL_LAYOUT_IDS.indexOf(a.id) - UNIVERSAL_LAYOUT_IDS.indexOf(b.id)
  })
}

export const resolveUniversalLayoutId = (args: {
  value?: unknown
  moduleCount: number
  intent?: LayoutIntent
  contentStructure?: ContentStructure
  visualAspect?: VisualAspect
  contentDensity?: ContentDensity
  recentLayoutIds?: readonly UniversalLayoutId[]
}): UniversalLayoutId | undefined => {
  const recentLayoutIds = args.recentLayoutIds || []
  const explicit = getUniversalLayout(args.value)
  let candidates = getUniversalLayoutCandidates(args)
  if (candidates.length === 0) {
    candidates = getUniversalLayoutCandidates({
      moduleCount: args.moduleCount,
      intent: args.intent
    })
  }
  const explicitIsCompatible = explicit && candidates.some((layout) => layout.id === explicit.id)
  if (explicitIsCompatible && !recentLayoutIds.includes(explicit.id)) return explicit.id
  return pickUnusedLayout(candidates, recentLayoutIds)
}

export const diversifyUniversalLayoutSequence = <
  T extends {
    layoutId?: unknown
    moduleCount?: number
    contentStructure?: ContentStructure
    visualAspect?: VisualAspect
    contentDensity?: ContentDensity
    layoutIntent?: LayoutIntent
  }
>(
  items: readonly T[]
): Array<T & { layoutId?: UniversalLayoutId }> => {
  const recentLayoutIds: UniversalLayoutId[] = []
  return items.map((item) => {
    const layout = getUniversalLayout(item.layoutId)
    const moduleCount = Number.isFinite(item.moduleCount)
      ? Math.max(1, Math.min(6, Math.floor(item.moduleCount as number)))
      : layout?.moduleCount
    if (!moduleCount) return { ...item, layoutId: undefined }
    const layoutId = resolveUniversalLayoutId({
      value: layout?.id,
      moduleCount,
      intent: item.layoutIntent || layout?.intent,
      contentStructure: item.contentStructure,
      visualAspect: item.visualAspect,
      contentDensity: item.contentDensity,
      recentLayoutIds: recentLayoutIds.slice(-2)
    })
    if (layoutId) recentLayoutIds.push(layoutId)
    return { ...item, layoutId }
  })
}

export const formatUniversalLayoutCatalogPrompt = (): string =>
  UNIVERSAL_LAYOUTS.map(
    (layout) =>
      `- ${layout.id}: family=${layout.family}; contentModules=${layout.moduleCount}; imageSlots=${layout.imageCount}; imageAspect=${layout.imageAspect || 'none'}; silhouette=${layout.silhouette}; ${layout.prompt}`
  ).join('\n')

export const formatContentStructureCandidatePrompt = (): string =>
  CONTENT_STRUCTURE_IDS.map((structure) => {
    const candidateIds = Array.from({ length: 6 }, (_unused, index) => index + 1)
      .flatMap((moduleCount) =>
        getUniversalLayoutCandidates({ moduleCount, contentStructure: structure }).map(
          (layout) => layout.id
        )
      )
      .filter((id, index, all) => all.indexOf(id) === index)
    return `- ${structure}: ${CONTENT_STRUCTURE_GUIDANCE[structure]}; candidates=${candidateIds.join(', ') || 'none'}`
  }).join('\n')

export const formatUniversalLayoutPrompt = (value: unknown): string => {
  const layout = getUniversalLayout(value)
  if (!layout) return ''
  return [
    `Selected universal layout: ${layout.name} (${layout.id}).`,
    `Required content modules: ${layout.moduleCount}. Required image slots: ${layout.imageCount}. Required image aspect: ${layout.imageAspect || 'none'}.`,
    `Hard geometry contract: ${layout.prompt}`,
    'Do not replace this composition with a dashboard, web-app card wall, or a different module/image count. The active style may change color, type, shape, border, and decoration only.'
  ].join('\n')
}
