import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import log from 'electron-log/main.js'
import { normalizeThinkingAssistantReply, normalizeThinkingMessages } from './reply-normalizer'
import type {
  ThinkingChatMessage,
  ThinkingPageOutlineUpdate,
  ThinkingStage,
  ThinkingSource,
  ThinkingWorkspace,
  ThinkingWorkspaceListItem
} from '@shared/thinking'

const THINKING_ID_RE = /^[a-zA-Z0-9_-]{6,32}$/

export function assertValidThinkingId(id: string): void {
  if (!THINKING_ID_RE.test(id)) {
    throw new Error(`Invalid thinkingId: ${id}`)
  }
}

export function resolveThinkingDir(storagePath: string, thinkingId: string): string {
  return path.join(storagePath, 'thinking', thinkingId)
}

export function buildInitialThinkingMd(): string {
  return `# Thinking Brief

## Topic

## Audience

## Setting

## Tone

## Style

## Font
auto

## Page Count
0
`
}

export function buildInitialContextMd(stage: ThinkingStage = 'collect'): string {
  return `## Stage: collect

## User Intent

## Confirmed Decisions

## Open Questions

## Created: ${new Date().toISOString()}
`.replace(/^## Stage:\s*collect/m, `## Stage: ${stage}`)
}

export async function createWorkspace(storagePath: string): Promise<ThinkingWorkspace> {
  const thinkingId = nanoid()
  const dir = resolveThinkingDir(storagePath, thinkingId)
  const sourcesDir = path.join(dir, 'sources')
  const assetsDir = path.join(dir, 'assets')

  await fs.promises.mkdir(sourcesDir, { recursive: true })
  await fs.promises.mkdir(assetsDir, { recursive: true })

  const thinkingMd = buildInitialThinkingMd()
  const contextMd = buildInitialContextMd('collect')

  const thinkingMdPath = path.join(dir, 'thinking.md')
  const contextMdPath = path.join(dir, 'context.md')

  await fs.promises.writeFile(thinkingMdPath, thinkingMd, 'utf-8')
  await fs.promises.writeFile(contextMdPath, contextMd, 'utf-8')

  log.info(`[thinking] workspace created: ${thinkingId}`)

  return {
    thinkingId,
    thinkingMd,
    contextMd,
    stage: 'collect',
    sources: [],
    messages: []
  }
}

export async function readWorkspace(
  storagePath: string,
  thinkingId: string
): Promise<ThinkingWorkspace> {
  assertValidThinkingId(thinkingId)
  const dir = resolveThinkingDir(storagePath, thinkingId)

  const thinkingMdPath = path.join(dir, 'thinking.md')
  const contextMdPath = path.join(dir, 'context.md')

  if (!fs.existsSync(thinkingMdPath)) {
    throw new Error(`Thinking workspace not found: ${thinkingId}`)
  }

  const [thinkingMd, contextMd] = await Promise.all([
    fs.promises.readFile(thinkingMdPath, 'utf-8'),
    fs.promises.readFile(contextMdPath, 'utf-8')
  ])

  const stage = parseStageFromContextMd(contextMd)
  const [sources, messages] = await Promise.all([parseSourcesList(dir), readMessagesList(dir)])

  return { thinkingId, thinkingMd, contextMd, stage, sources, messages }
}

export async function deleteWorkspace(storagePath: string, thinkingId: string): Promise<void> {
  await readWorkspace(storagePath, thinkingId)
  const dir = resolveThinkingDir(storagePath, thinkingId)
  await fs.promises.rm(dir, { recursive: true, force: true })
  log.info(`[thinking] workspace deleted: ${thinkingId}`)
}

export async function writeThinkingMd(dir: string, content: string): Promise<void> {
  const filePath = path.join(dir, 'thinking.md')
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

function normalizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function replaceThinkingPageOutline(
  thinkingMd: string,
  update: ThinkingPageOutlineUpdate
): string {
  const pageNumber = Math.floor(Number(update.pageNumber))
  const title = normalizeSingleLine(update.title).slice(0, 200)
  const role = normalizeSingleLine(update.role).slice(0, 80)
  const objective = normalizeSingleLine(update.objective).slice(0, 1000)
  const summary = update.summary.trim().slice(0, 5000)
  const keyPoints = update.keyPoints
    .map((point) => normalizeSingleLine(point).slice(0, 1000))
    .filter(Boolean)
    .slice(0, 20)

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error('Invalid page number')
  }
  if (!title || !role || !objective || !summary || keyPoints.length === 0) {
    throw new Error('Page outline fields cannot be empty')
  }

  const headingRegex = new RegExp(`^##\\s*Page\\s+${pageNumber}\\s*:.+$`, 'm')
  const headingMatch = thinkingMd.match(headingRegex)
  if (!headingMatch || typeof headingMatch.index !== 'number') {
    throw new Error(`Page ${pageNumber} was not found in thinking.md`)
  }

  const start = headingMatch.index
  const remaining = thinkingMd.slice(start + headingMatch[0].length)
  const nextHeadingMatch = remaining.match(/^##\s+.+$/m)
  const end =
    nextHeadingMatch && typeof nextHeadingMatch.index === 'number'
      ? start + headingMatch[0].length + nextHeadingMatch.index
      : thinkingMd.length
  const section = [
    `## Page ${pageNumber}: ${title}`,
    `- Role: ${role}`,
    `- Objective: ${objective}`,
    ...(update.layoutIntent ? [`- Layout Intent: ${update.layoutIntent}`] : []),
    ...(update.layoutId ? [`- Layout: ${update.layoutId}`] : []),
    '',
    summary,
    '',
    ...keyPoints.map((point) => `- ${point}`)
  ].join('\n')

  return (
    `${thinkingMd.slice(0, start).trimEnd()}\n\n${section}\n\n${thinkingMd
      .slice(end)
      .trimStart()}`.trimEnd() + '\n'
  )
}

export async function writeContextMd(dir: string, content: string): Promise<void> {
  const filePath = path.join(dir, 'context.md')
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

export async function writeMessagesList(
  dir: string,
  messages: ThinkingChatMessage[]
): Promise<void> {
  const filePath = path.join(dir, 'messages.json')
  const normalized = normalizeThinkingMessages(messages)
  await fs.promises.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
}

export async function scanLatestWorkspace(
  storagePath: string
): Promise<{ thinkingId: string; updatedAt: number } | null> {
  const thinkingRoot = path.join(storagePath, 'thinking')
  if (!fs.existsSync(thinkingRoot)) return null

  const entries = await fs.promises.readdir(thinkingRoot, { withFileTypes: true })
  const dirs = entries
    .filter((e) => e.isDirectory() && THINKING_ID_RE.test(e.name))
    .map((e) => path.join(thinkingRoot, e.name))

  if (dirs.length === 0) return null

  let latestDir = ''
  let latestMtime = 0

  for (const dir of dirs) {
    const thinkingMdPath = path.join(dir, 'thinking.md')
    if (!fs.existsSync(thinkingMdPath)) continue
    const stat = await fs.promises.stat(thinkingMdPath)
    if (stat.mtimeMs > latestMtime) {
      latestMtime = stat.mtimeMs
      latestDir = dir
    }
  }

  if (!latestDir) return null

  return {
    thinkingId: path.basename(latestDir),
    updatedAt: latestMtime
  }
}

export async function scanWorkspaceList(
  storagePath: string,
  limit = 50
): Promise<ThinkingWorkspaceListItem[]> {
  const thinkingRoot = path.join(storagePath, 'thinking')
  if (!fs.existsSync(thinkingRoot)) return []

  const entries = await fs.promises.readdir(thinkingRoot, { withFileTypes: true })
  const items: ThinkingWorkspaceListItem[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || !THINKING_ID_RE.test(entry.name)) continue

    const dir = path.join(thinkingRoot, entry.name)
    const thinkingMdPath = path.join(dir, 'thinking.md')
    const contextMdPath = path.join(dir, 'context.md')
    if (!fs.existsSync(thinkingMdPath)) continue

    try {
      const [thinkingMd, thinkingStat] = await Promise.all([
        fs.promises.readFile(thinkingMdPath, 'utf-8'),
        fs.promises.stat(thinkingMdPath)
      ])
      let contextMd = ''
      let contextMtime = 0
      try {
        const [content, stat] = await Promise.all([
          fs.promises.readFile(contextMdPath, 'utf-8'),
          fs.promises.stat(contextMdPath)
        ])
        contextMd = content
        contextMtime = stat.mtimeMs
      } catch {
        contextMd = ''
      }

      items.push({
        thinkingId: entry.name,
        updatedAt: Math.max(thinkingStat.mtimeMs, contextMtime),
        topic: parseTopicFromThinkingMd(thinkingMd),
        stage: parseStageFromContextMd(contextMd)
      })
    } catch (error) {
      log.warn('[thinking] failed to scan workspace list item', {
        thinkingId: entry.name,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, Math.max(1, limit))
}

function parseTopicFromThinkingMd(thinkingMd: string): string {
  const inline = thinkingMd.match(/^##\s*Topic\s*:\s*(.+)/m)
  if (inline) return inline[1].trim()
  const newline = thinkingMd.match(/^##\s*Topic\s*\n\s*(.+)/m)
  return newline ? newline[1].trim() : ''
}

export function parseStageFromContextMd(content: string): ThinkingStage {
  const match = content.match(/^## Stage:\s*(\S+)/m)
  if (!match) return 'collect'
  const stage = match[1] as ThinkingStage
  const validStages: ThinkingStage[] = ['collect', 'outline', 'draft', 'refine', 'ready']
  return validStages.includes(stage) ? stage : 'collect'
}

export async function parseSourcesList(dir: string): Promise<ThinkingSource[]> {
  const sourcesDir = path.join(dir, 'sources')
  if (!fs.existsSync(sourcesDir)) return []

  const entries = await fs.promises.readdir(sourcesDir, { withFileTypes: true })
  const manifestByFileName = new Map<string, ThinkingSource>()
  try {
    const rawManifest = await fs.promises.readFile(path.join(dir, 'sources.json'), 'utf-8')
    const parsed = JSON.parse(rawManifest)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const record = item as Record<string, unknown>
        const id = typeof record.id === 'string' ? record.id : ''
        const name = typeof record.name === 'string' ? record.name : ''
        const kind = typeof record.kind === 'string' ? record.kind : ''
        const fileName = typeof record.fileName === 'string' ? record.fileName : ''
        if (!id || !name || !fileName) continue
        if (!['markdown', 'text', 'csv', 'docx', 'image'].includes(kind)) continue
        manifestByFileName.set(fileName, {
          id,
          name,
          kind: kind as ThinkingSource['kind']
        })
      }
    }
  } catch {
    // Older workspaces do not have a manifest; fall back to file names.
  }
  const sources: ThinkingSource[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) continue
    const manifestSource = manifestByFileName.get(entry.name)
    if (manifestSource) {
      sources.push(manifestSource)
      continue
    }
    const ext = path.extname(entry.name).toLowerCase()
    let kind: ThinkingSource['kind'] = 'text'
    if (entry.name.endsWith('.image.md')) kind = 'image'
    else if (ext === '.md') kind = 'markdown'
    else if (ext === '.csv') kind = 'csv'
    else if (ext === '.docx') kind = 'docx'
    else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) kind = 'image'

    sources.push({
      id: entry.name,
      name: entry.name,
      kind
    })
  }

  return sources
}

async function readMessagesList(dir: string): Promise<ThinkingChatMessage[]> {
  const filePath = path.join(dir, 'messages.json')
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): ThinkingChatMessage[] => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const role = record.role === 'user' || record.role === 'assistant' ? record.role : null
      const rawContent = typeof record.content === 'string' ? record.content : ''
      const content = role === 'assistant' ? normalizeThinkingAssistantReply(rawContent) : rawContent
      const timestamp = Number(record.timestamp)
      if (!role || !content.trim()) return []
      const attachments = Array.isArray(record.attachments)
        ? record.attachments.filter((source): source is ThinkingSource => {
            if (!source || typeof source !== 'object') return false
            const item = source as Record<string, unknown>
            return (
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              (item.kind === 'markdown' ||
                item.kind === 'text' ||
                item.kind === 'csv' ||
                item.kind === 'docx' ||
                item.kind === 'image')
            )
          })
        : undefined
      return [
        {
          role,
          content,
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
          ...(attachments && attachments.length > 0 ? { attachments } : {})
        }
      ]
    })
  } catch {
    return []
  }
}
