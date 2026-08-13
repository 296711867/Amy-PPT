import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createWorkspace,
  readWorkspace,
  replaceThinkingPageOutline,
  resolveThinkingDir,
  writeMessagesList
} from '../../../src/main/thinking/workspace'

const tempDirs: string[] = []

async function makeStorageRoot(): Promise<string> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'thinking-workspace-test-'))
  tempDirs.push(dir)
  return dir
}

describe('thinking workspace messages', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.promises.rm(dir, { recursive: true, force: true })))
  })

  it('persists and restores sanitized chat messages', async () => {
    const storageRoot = await makeStorageRoot()
    const workspace = await createWorkspace(storageRoot)
    const thinkingDir = resolveThinkingDir(storageRoot, workspace.thinkingId)

    await writeMessagesList(thinkingDir, [
      {
        role: 'user',
        content: '2026 ai短剧的发展',
        timestamp: 1000
      },
      {
        role: 'assistant',
        content: '"topic": "2026年AI短剧的发展",\n  "userIntent": "规划演示"\n}\n\n我已确认主题。',
        timestamp: 1001
      },
      {
        role: 'assistant',
        content: 'context.md updated for stage collect.',
        timestamp: 1002
      }
    ])

    const restored = await readWorkspace(storageRoot, workspace.thinkingId)

    expect(restored.messages).toEqual([
      {
        role: 'user',
        content: '2026 ai短剧的发展',
        timestamp: 1000
      },
      {
        role: 'assistant',
        content: '我已确认主题。',
        timestamp: 1001
      }
    ])
  })
})

describe('replaceThinkingPageOutline', () => {
  it('updates only the selected page and keeps the remaining outline', () => {
    const original = `# Thinking Brief

## Topic
Quarterly review

## Page 1: Cover
- Role: cover
- Objective: Introduce the review

Original summary

- Original point

## Page 2: Results
- Role: data
- Objective: Present results

Keep this summary

- Keep this point

## Appendix
Keep this section
`

    const updated = replaceThinkingPageOutline(original, {
      pageNumber: 1,
      title: 'Executive Overview',
      role: 'cover',
      objective: 'Set the context for the review',
      summary: 'Updated summary',
      keyPoints: ['Updated point', 'Next point']
    })

    expect(updated).toContain('## Page 1: Executive Overview')
    expect(updated).toContain('- Objective: Set the context for the review')
    expect(updated).toContain('Updated summary')
    expect(updated).toContain('- Updated point')
    expect(updated).toContain('## Page 2: Results')
    expect(updated).toContain('Keep this summary')
    expect(updated).toContain('## Appendix\nKeep this section')
    expect(updated).not.toContain('Original summary')
  })

  it('rejects incomplete page outlines', () => {
    expect(() =>
      replaceThinkingPageOutline('## Page 1: Cover\n', {
        pageNumber: 1,
        title: '',
        role: 'cover',
        objective: 'Introduce',
        summary: 'Summary',
        keyPoints: ['Point']
      })
    ).toThrow('Page outline fields cannot be empty')
  })

  it('preserves a non-page section after the edited page', () => {
    const updated = replaceThinkingPageOutline(
      `## Page 1: Cover
- Role: cover
- Objective: Introduce

Summary

- Point

## Appendix
Keep this section
`,
      {
        pageNumber: 1,
        title: 'New cover',
        role: 'cover',
        objective: 'Introduce the topic',
        summary: 'New summary',
        keyPoints: ['New point']
      }
    )

    expect(updated).toContain('## Appendix\nKeep this section')
  })
})
