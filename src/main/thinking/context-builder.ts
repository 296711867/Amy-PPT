import fs from 'fs'
import path from 'path'
import log from 'electron-log/main.js'
import type { ThinkingChatMessage, ThinkingStage } from '@shared/thinking'
import { getStagePrompt } from './prompts'
import { VALID_TRANSITIONS } from './stage-manager'

const MAX_INLINE_THINKING_CHARS = 12_000
const MAX_INLINE_THINKING_PAGES = 24
const MAX_THINKING_MAP_PAGES = 160

export interface ThinkingContextArgs {
  stage: ThinkingStage
  thinkingMd: string
  contextMd: string
  sourcesDir: string
  userMessage: string
  recentMessages?: ThinkingChatMessage[]
}

function countThinkingPages(markdown: string): number {
  const matches = markdown.match(/^##\s*Page\s+\d+\s*:/gm)
  return matches ? matches.length : 0
}

function readSection(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const inline = markdown.match(new RegExp(`^##\\s*${escaped}\\s*:\\s*(.+)`, 'm'))
  if (inline?.[1]?.trim()) return inline[1].trim()
  const block = markdown.match(
    new RegExp(`^##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`, 'm')
  )
  return block?.[1]?.trim() || ''
}

function buildThinkingPageMap(markdown: string): string {
  const pageHeadings = Array.from(markdown.matchAll(/^##\s*Page\s+(\d+)\s*:\s*(.+)$/gm))
  const lines = pageHeadings.slice(0, MAX_THINKING_MAP_PAGES).map((match) => {
    const pageNumber = Number.parseInt(match[1], 10)
    const title = match[2].trim()
    return Number.isFinite(pageNumber) && title ? `- Page ${pageNumber}: ${title}` : ''
  }).filter(Boolean)

  return [
    '# Thinking Brief Summary',
    readSection(markdown, 'Topic') ? `## Topic\n${readSection(markdown, 'Topic')}` : '',
    readSection(markdown, 'Audience') ? `## Audience\n${readSection(markdown, 'Audience')}` : '',
    readSection(markdown, 'Setting') ? `## Setting\n${readSection(markdown, 'Setting')}` : '',
    readSection(markdown, 'Tone') ? `## Tone\n${readSection(markdown, 'Tone')}` : '',
    readSection(markdown, 'Style') ? `## Style\n${readSection(markdown, 'Style')}` : '',
    readSection(markdown, 'Font') ? `## Font\n${readSection(markdown, 'Font')}` : '',
    readSection(markdown, 'Page Count') ? `## Page Count\n${readSection(markdown, 'Page Count')}` : '',
    lines.length > 0 ? `## Page Map\n${lines.join('\n')}` : '',
    pageHeadings.length > lines.length
      ? `\nOnly the first ${lines.length} page headings are shown. Use update_thinking_document with pageStart to modify page ranges instead of reading or rewriting the full thinking.md.`
      : '\nUse update_thinking_document with pageStart to modify page ranges instead of reading or rewriting the full thinking.md.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildCurrentThinkingContext(thinkingMd: string): string {
  const trimmed = thinkingMd.trim()
  if (!trimmed) return ''
  const pageCount = countThinkingPages(trimmed)
  if (trimmed.length <= MAX_INLINE_THINKING_CHARS && pageCount <= MAX_INLINE_THINKING_PAGES) {
    return trimmed
  }
  return buildThinkingPageMap(trimmed)
}

export async function buildThinkingContext(args: ThinkingContextArgs): Promise<{
  systemPrompt: string
  userMessage: string
  sourceContent: string
}> {
  const { stage, thinkingMd, contextMd, sourcesDir, userMessage, recentMessages } = args

  const stagePrompt = getStagePrompt(stage)
  const validTargets = VALID_TRANSITIONS[stage].filter((s) => s !== stage)
  const stageAwareSuffix =
    validTargets.length > 0
      ? `\n\nYou are in stage "${stage}". When the user's intent clearly matches a later stage, call update_context_document with \`stage\` set to the target stage. Valid transitions from ${stage}: ${validTargets.join(', ')}.`
      : ''
  const systemPrompt = stagePrompt + stageAwareSuffix

  // Build source file index instead of inlining content — AI will use read_file/grep tools to read on demand
  let sourceContent = ''
  if (fs.existsSync(sourcesDir)) {
    const entries = await fs.promises.readdir(sourcesDir)
    const fileEntries: string[] = []
    for (const entry of entries) {
      const filePath = path.join(sourcesDir, entry)
      try {
        const stat = await fs.promises.stat(filePath)
        if (!stat.isFile()) continue
        fileEntries.push(`- /sources/${entry}`)
      } catch {
        // skip unreadable files
      }
    }
    if (fileEntries.length > 0) {
      sourceContent = fileEntries.join('\n')
    }
  }

  const contextParts: string[] = []

  const currentThinkingContext = buildCurrentThinkingContext(thinkingMd)
  if (currentThinkingContext) {
    contextParts.push(`## Current Thinking Brief\n${currentThinkingContext}`)
  }

  if (contextMd.trim()) {
    contextParts.push(`## Context\n${contextMd}`)
  }

  if (sourceContent) {
    contextParts.push(
      [
        '## Available Source Files',
        'The following source files are available.',
        'Use grep first, then read_file with a small offset/limit around relevant lines. For large files, build the outline incrementally from source sections instead of reading the whole file in one pass.',
        sourceContent
      ].join('\n')
    )
  } else {
    contextParts.push(
      [
        '## Source Files',
        'No source files are available for this turn.',
        'Do not call read_file, grep/search, glob, or ls. Work only from the current thinking brief, context, recent conversation, and user message.'
      ].join('\n')
    )
  }

  const recentConversation = Array.isArray(recentMessages)
    ? recentMessages
        .slice(-8)
        .map((message) => {
          const role = message.role === 'assistant' ? 'Assistant' : 'User'
          return `${role}: ${message.content.trim()}`
        })
        .filter((line) => line.trim().length > 0)
        .join('\n\n')
    : ''

  if (recentConversation) {
    contextParts.push(`## Recent Conversation\n${recentConversation}`)
  }

  contextParts.push(`## User Message\n${userMessage}`)

  const fullUserMessage = contextParts.join('\n\n')

  log.info('[thinking:context] built', {
    stage,
    hasThinkingMd: thinkingMd.trim().length > 0,
    thinkingMdLength: thinkingMd.trim().length,
    thinkingPageCount: countThinkingPages(thinkingMd),
    thinkingContextLength: currentThinkingContext.length,
    hasSources: sourceContent.length > 0,
    recentMessages: recentMessages?.length || 0,
    messageLength: fullUserMessage.length
  })

  return {
    systemPrompt,
    userMessage: fullUserMessage,
    sourceContent
  }
}
