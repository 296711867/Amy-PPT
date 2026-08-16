import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExportOutputTransaction } from '../../../src/main/io/export-output-transaction'

const logState = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('electron-log/main.js', () => ({ default: logState }))

const temporaryDirectories: string[] = []

afterEach(async () => {
  logState.warn.mockClear()
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  )
})

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'amy-ppt-export-transaction-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('export output transaction', () => {
  it('writes a file to staging and commits it to the selected target', async () => {
    const directory = await createTemporaryDirectory()
    const targetPath = path.join(directory, 'slides.pdf')
    await fs.promises.writeFile(targetPath, 'old-output', 'utf-8')

    const transaction = await createExportOutputTransaction(targetPath)
    await fs.promises.writeFile(transaction.tempPath, 'new-output', 'utf-8')

    expect(await fs.promises.readFile(targetPath, 'utf-8')).toBe('old-output')
    await transaction.commit()

    expect(await fs.promises.readFile(targetPath, 'utf-8')).toBe('new-output')
    expect(await fs.promises.rm(transaction.tempPath, { force: true })).toBeUndefined()
  })

  it('keeps a committed target when backup and staging cleanup fail', async () => {
    const directory = await createTemporaryDirectory()
    const targetPath = path.join(directory, 'slides.pdf')
    await fs.promises.writeFile(targetPath, 'old-output', 'utf-8')

    const transaction = await createExportOutputTransaction(targetPath)
    await fs.promises.writeFile(transaction.tempPath, 'new-output', 'utf-8')
    const stagingDir = path.dirname(transaction.tempPath)
    const originalRename = fs.promises.rename.bind(fs.promises)
    let firstRename = true
    const renameSpy = vi.spyOn(fs.promises, 'rename').mockImplementation((...args) => {
      if (firstRename && String(args[0]) === transaction.tempPath) {
        firstRename = false
        return Promise.reject(Object.assign(new Error('target exists'), { code: 'EEXIST' }))
      }
      return originalRename(...args)
    })
    const originalRm = fs.promises.rm.bind(fs.promises)
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockImplementation((...args) => {
      const target = String(args[0])
      if (target.includes('.slides.pdf.backup-') || target === stagingDir) {
        return Promise.reject(new Error('cleanup unavailable'))
      }
      return originalRm(...args)
    })

    try {
      await expect(transaction.commit()).resolves.toBeUndefined()
      await expect(fs.promises.readFile(targetPath, 'utf-8')).resolves.toBe('new-output')
      expect(logState.warn).toHaveBeenCalledTimes(2)
    } finally {
      renameSpy.mockRestore()
      rmSpy.mockRestore()
    }
  })

  it('removes a failed file export without touching an existing target', async () => {
    const directory = await createTemporaryDirectory()
    const targetPath = path.join(directory, 'slides.mp4')
    await fs.promises.writeFile(targetPath, 'existing-video', 'utf-8')

    const transaction = await createExportOutputTransaction(targetPath)
    await fs.promises.writeFile(transaction.tempPath, 'partial-video', 'utf-8')
    await transaction.cleanup()

    expect(await fs.promises.readFile(targetPath, 'utf-8')).toBe('existing-video')
    await expect(fs.promises.lstat(transaction.tempPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('commits a PNG directory as one output and cleans a failed directory export', async () => {
    const directory = await createTemporaryDirectory()
    const targetPath = path.join(directory, 'png-export')
    const transaction = await createExportOutputTransaction(targetPath)
    await fs.promises.mkdir(transaction.tempPath, { recursive: true })
    await fs.promises.writeFile(path.join(transaction.tempPath, '01-cover.png'), 'png-data', 'utf-8')
    await transaction.commit()

    expect(await fs.promises.readFile(path.join(targetPath, '01-cover.png'), 'utf-8')).toBe(
      'png-data'
    )

    const failedTargetPath = path.join(directory, 'failed-png-export')
    const failedTransaction = await createExportOutputTransaction(failedTargetPath)
    await fs.promises.mkdir(failedTransaction.tempPath, { recursive: true })
    await fs.promises.writeFile(
      path.join(failedTransaction.tempPath, '01-partial.png'),
      'partial-png',
      'utf-8'
    )
    await failedTransaction.cleanup()

    await expect(fs.promises.lstat(failedTargetPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
