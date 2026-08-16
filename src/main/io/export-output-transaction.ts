import { randomUUID } from 'crypto'
import log from 'electron-log/main.js'
import fs from 'fs'
import path from 'path'

export type ExportOutputTransaction = {
  outputPath: string
  tempPath: string
  commit(): Promise<void>
  cleanup(): Promise<void>
}

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.lstat(filePath)
    return true
  } catch {
    return false
  }
}

const isExistingTargetError = (error: unknown): boolean => {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
  return code === 'EEXIST' || code === 'EPERM' || code === 'ENOTEMPTY' || code === 'EISDIR'
}

const restoreBackup = async (targetPath: string, backupPath: string): Promise<void> => {
  if (await pathExists(targetPath)) {
    await fs.promises.rm(targetPath, { recursive: true, force: true })
  }
  await fs.promises.rename(backupPath, targetPath)
}

const logCleanupFailure = (kind: 'backup' | 'staging', targetPath: string, error: unknown): void => {
  log.warn('[export-output-transaction] cleanup pending', {
    kind,
    targetPath,
    message: error instanceof Error ? error.message : String(error)
  })
}

export const createExportOutputTransaction = async (
  outputPath: string
): Promise<ExportOutputTransaction> => {
  const normalizedOutputPath = path.resolve(outputPath)
  const parentDir = path.dirname(normalizedOutputPath)
  const baseName = path.basename(normalizedOutputPath)
  await fs.promises.mkdir(parentDir, { recursive: true })

  const stagingDir = await fs.promises.mkdtemp(path.join(parentDir, `.${baseName}.tmp-`))
  const tempPath = path.join(stagingDir, baseName)
  let settled = false

  const cleanup = async (): Promise<void> => {
    if (settled) return
    settled = true
    try {
      await fs.promises.rm(stagingDir, { recursive: true, force: true })
    } catch (error) {
      logCleanupFailure('staging', stagingDir, error)
    }
  }

  const commit = async (): Promise<void> => {
    if (settled) throw new Error('导出事务已结束')
    await fs.promises.lstat(tempPath)

    let backupPath = ''
    let targetCommitted = false
    try {
      await fs.promises.rename(tempPath, normalizedOutputPath)
      targetCommitted = true
    } catch (error) {
      if (!isExistingTargetError(error) || !(await pathExists(normalizedOutputPath))) throw error

      backupPath = path.join(
        parentDir,
        `.${baseName}.backup-${Date.now()}-${randomUUID()}`
      )
      await fs.promises.rename(normalizedOutputPath, backupPath)
      try {
        await fs.promises.rename(tempPath, normalizedOutputPath)
      } catch (commitError) {
        await restoreBackup(normalizedOutputPath, backupPath).catch((restoreError) => {
          throw new AggregateError(
            [commitError, restoreError],
            '导出提交失败，且无法恢复原有目标'
          )
        })
        throw commitError
      }
      targetCommitted = true
    }

    // Once the target rename succeeds, the export is committed. Cleanup must not
    // be allowed to turn a completed export into a failed one.
    if (!targetCommitted) throw new Error('导出目标未提交')
    settled = true
    if (backupPath) {
      try {
        await fs.promises.rm(backupPath, { recursive: true, force: true })
      } catch (error) {
        logCleanupFailure('backup', backupPath, error)
      }
    }
    try {
      await fs.promises.rm(stagingDir, { recursive: true, force: true })
    } catch (error) {
      logCleanupFailure('staging', stagingDir, error)
    }
  }

  return {
    outputPath: normalizedOutputPath,
    tempPath,
    commit,
    cleanup
  }
}
