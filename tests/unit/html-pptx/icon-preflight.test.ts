import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertPptxPagesHaveResolvedIcons } from '../../../src/main/io/html-pptx/icon-preflight'

const temporaryDirectories: string[] = []

const writePage = async (html: string): Promise<string> => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'amy-ppt-icon-preflight-'))
  temporaryDirectories.push(directory)
  const htmlPath = path.join(directory, 'page-1.html')
  await fs.promises.writeFile(htmlPath, html, 'utf-8')
  return htmlPath
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true }))
  )
})

describe('PPTX icon preflight', () => {
  it('allows pages that contain only expanded inline SVG', async () => {
    const htmlPath = await writePage(
      '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M3 12h18"/></svg>'
    )

    await expect(
      assertPptxPagesHaveResolvedIcons([{ pageId: 'page-1', pageNumber: 1, htmlPath }])
    ).resolves.toBeUndefined()
  })

  it('stops export and reports known, unknown, empty, and wrong-tag references', async () => {
    const htmlPath = await writePage(
      '<svg data-icon="rocket"></svg><svg data-icon="missing-icon"></svg><svg data-icon=""></svg><div data-icon="star"></div>'
    )

    await expect(
      assertPptxPagesHaveResolvedIcons([{ pageId: 'page-1', pageNumber: 1, htmlPath }])
    ).rejects.toThrowError(
      /P1 \(page-1\):[\s\S]*rocket[\s\S]*unexpanded-known-id[\s\S]*missing-icon[\s\S]*unknown-id[\s\S]*\(empty\)[\s\S]*wrong-tag/
    )
  })
})
