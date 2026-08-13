import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuardedFilesystemBackend } from '../../../src/main/agent-runtime/agent/backend'

vi.mock('../../../src/main/agent-runtime/skills/backend', () => ({
  createProductSkillsMiddlewareSet: vi.fn(() => [])
}))

const temporaryDirectories: string[] = []

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ohmyppt-backend-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true }))
  )
})

describe('GuardedFilesystemBackend selector edit validation', () => {
  it('keeps an accepted selector edit', async () => {
    const rootDir = await createTemporaryDirectory()
    const pagePath = path.join(rootDir, 'page-1.html')
    await fs.promises.writeFile(pagePath, '<p>Old copy</p>', 'utf-8')
    const validateEditedFile = vi.fn(async () => undefined)
    const backend = new GuardedFilesystemBackend({
      rootDir,
      virtualMode: true,
      validateEditedFile
    })

    await expect(backend.edit('/page-1.html', 'Old copy', 'New copy')).resolves.toMatchObject({
      path: '/page-1.html',
      occurrences: 1
    })
    expect(validateEditedFile).toHaveBeenCalledWith('/page-1.html')
    await expect(fs.promises.readFile(pagePath, 'utf-8')).resolves.toBe('<p>New copy</p>')
  })

  it('restores the exact old file when post-edit validation fails', async () => {
    const rootDir = await createTemporaryDirectory()
    const pagePath = path.join(rootDir, 'page-1.html')
    const previousHtml = '<p>Old copy</p><p>Keep this exact shell</p>'
    await fs.promises.writeFile(pagePath, previousHtml, 'utf-8')
    const backend = new GuardedFilesystemBackend({
      rootDir,
      virtualMode: true,
      validateEditedFile: async () => {
        throw new Error('render-text-clipped: body copy is clipped')
      }
    })

    await expect(backend.edit('/page-1.html', 'Old copy', 'New copy')).resolves.toEqual({
      error: 'render-text-clipped: body copy is clipped'
    })
    await expect(fs.promises.readFile(pagePath, 'utf-8')).resolves.toBe(previousHtml)
  })
})
