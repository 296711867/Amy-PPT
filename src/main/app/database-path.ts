import fs from 'fs'
import path from 'path'

const NEW_DATABASE_NAME = 'amy-ppt.db'
const NEW_DEVELOPMENT_DATABASE_NAME = 'amy-ppt.dev.db'
const LEGACY_DATABASE_NAME = 'ohmyppt.db'
const LEGACY_DEVELOPMENT_DATABASE_NAME = 'ohmyppt.dev.db'

const copyDatabaseFamilyIfMissing = (sourcePath: string, targetPath: string): boolean => {
  if (fs.existsSync(targetPath) || !fs.existsSync(sourcePath)) return false
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
  for (const suffix of ['-wal', '-shm']) {
    const sourceSidecar = `${sourcePath}${suffix}`
    if (fs.existsSync(sourceSidecar)) fs.copyFileSync(sourceSidecar, `${targetPath}${suffix}`)
  }
  return true
}

export function resolveBrandDatabasePath(args: {
  isDev: boolean
  cwd: string
  userDataPath: string
}): { path: string; migratedFrom?: string } {
  if (args.isDev) {
    const targetPath = path.join(args.cwd, NEW_DEVELOPMENT_DATABASE_NAME)
    const legacyPath = path.join(args.cwd, LEGACY_DEVELOPMENT_DATABASE_NAME)
    return copyDatabaseFamilyIfMissing(legacyPath, targetPath)
      ? { path: targetPath, migratedFrom: legacyPath }
      : { path: targetPath }
  }

  const targetPath = path.join(args.userDataPath, NEW_DATABASE_NAME)
  const parent = path.dirname(args.userDataPath)
  const candidates = [
    path.join(args.userDataPath, LEGACY_DATABASE_NAME),
    path.join(parent, 'OhMyPPT', LEGACY_DATABASE_NAME),
    path.join(parent, 'Oh My PPT', LEGACY_DATABASE_NAME)
  ]
  const legacyPath = candidates.find((candidate) => fs.existsSync(candidate))
  return legacyPath && copyDatabaseFamilyIfMissing(legacyPath, targetPath)
    ? { path: targetPath, migratedFrom: legacyPath }
    : { path: targetPath }
}
