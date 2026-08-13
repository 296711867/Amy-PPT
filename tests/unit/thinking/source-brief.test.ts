import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildThinkingSourceBrief } from '../../../src/main/thinking/source-brief'

const tempDirs: string[] = []

const makeTempThinkingDir = async (): Promise<string> => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'thinking-source-brief-'))
  tempDirs.push(dir)
  await fs.promises.mkdir(path.join(dir, 'sources'), { recursive: true })
  return dir
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.promises.rm(dir, { recursive: true, force: true }))
  )
})

describe('thinking source brief', () => {
  it('returns empty when the current message has no document attachments', async () => {
    const thinkingDir = await makeTempThinkingDir()

    await expect(buildThinkingSourceBrief({ thinkingDir })).resolves.toBe('')
    await expect(
      buildThinkingSourceBrief({
        thinkingDir,
        attachments: [{ id: 'image-1', name: '截图.png', kind: 'image' }]
      })
    ).resolves.toBe('')
  })

  it('builds a lightweight deterministic outline card for attached sources', async () => {
    const thinkingDir = await makeTempThinkingDir()
    await fs.promises.writeFile(
      path.join(thinkingDir, 'sources.json'),
      JSON.stringify([
        { id: 'source-1', name: '增长方案.md', kind: 'markdown', fileName: 'growth.md' },
        { id: 'source-2', name: '未发送.md', kind: 'markdown', fileName: 'unused.md' }
      ])
    )
    await fs.promises.writeFile(
      path.join(thinkingDir, 'sources/growth.md'),
      [
        '# 增长方案',
        '',
        '## 背景',
        '这里说明背景和目标。',
        '',
        '## 增长策略',
        '- 自然流量',
        '- 短视频转化',
        '',
        '### 转化指标',
        '- GMV grew 15%',
        '',
        '## 执行计划',
        '- 周期',
        '- 责任人'
      ].join('\n')
    )
    await fs.promises.writeFile(
      path.join(thinkingDir, 'sources/unused.md'),
      ['# 未发送', '## 不应出现'].join('\n')
    )

    const brief = await buildThinkingSourceBrief({
      thinkingDir,
      attachments: [{ id: 'source-1', name: '增长方案.md', kind: 'markdown' }]
    })

    expect(brief).toContain('## Source Brief')
    expect(brief).toContain('### 增长方案.md')
    expect(brief).toContain('- Source file: /sources/growth.md')
    expect(brief).toContain('- Top-level title: 增长方案')
    expect(brief).toContain('- Headings detected: 5')
    expect(brief).toContain('Page candidates')
    expect(brief).toContain('## 增长策略')
    expect(brief).toContain('### 转化指标')
    expect(brief).not.toContain('未发送')
    expect(brief).not.toContain('这里说明背景和目标')
  })

  it('returns a bounded fallback for very large attached sources', async () => {
    const thinkingDir = await makeTempThinkingDir()
    await fs.promises.writeFile(
      path.join(thinkingDir, 'sources.json'),
      JSON.stringify([{ id: 'source-1', name: '大文档.md', kind: 'markdown', fileName: 'large.md' }])
    )
    await fs.promises.writeFile(
      path.join(thinkingDir, 'sources/large.md'),
      ['# 大文档', 'x'.repeat(1_500_001)].join('\n')
    )

    const brief = await buildThinkingSourceBrief({
      thinkingDir,
      attachments: [{ id: 'source-1', name: '大文档.md', kind: 'markdown' }]
    })

    expect(brief).toContain('## Source Brief')
    expect(brief).toContain('### 大文档.md')
    expect(brief).toContain('File is large')
    expect(brief).toContain('Use grep/read_file')
    expect(brief.length).toBeLessThan(700)
  })

  it('returns a source-level fallback when scanning fails', async () => {
    const thinkingDir = await makeTempThinkingDir()
    await fs.promises.writeFile(
      path.join(thinkingDir, 'sources.json'),
      JSON.stringify([{ id: 'source-1', name: '缺失.md', kind: 'markdown', fileName: 'missing.md' }])
    )

    const brief = await buildThinkingSourceBrief({
      thinkingDir,
      attachments: [{ id: 'source-1', name: '缺失.md', kind: 'markdown' }]
    })

    expect(brief).toContain('## Source Brief')
    expect(brief).toContain('### 缺失.md')
    expect(brief).toContain('Source brief scan failed')
    expect(brief).toContain('/sources/missing.md')
  })
})
