import fs from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'
import {
  BUILT_IN_FONT_SCHEMES,
  collectFontSchemeFamilies,
  normalizeUserFontScheme,
  type AvailableFontScheme,
  type FontScheme
} from '@shared/font-schemes'
import { assertFontFamilyAvailable, getAvailableFonts, getUserFontsRoot } from './font-registry'

interface FontSchemeFile {
  version: 1
  schemes: FontScheme[]
}

const getSchemePath = (): string => path.join(getUserFontsRoot(), 'schemes.json')

const readSchemes = async (): Promise<FontScheme[]> => {
  try {
    const raw = await fs.promises.readFile(getSchemePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<FontSchemeFile>
    return Array.isArray(parsed.schemes)
      ? parsed.schemes
          .map(normalizeUserFontScheme)
          .filter((item): item is FontScheme => Boolean(item))
      : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

const writeSchemes = async (schemes: FontScheme[]): Promise<void> => {
  await fs.promises.mkdir(getUserFontsRoot(), { recursive: true })
  const target = getSchemePath()
  const temporary = `${target}.tmp`
  await fs.promises.writeFile(
    temporary,
    `${JSON.stringify({ version: 1, schemes } satisfies FontSchemeFile, null, 2)}\n`,
    'utf-8'
  )
  await fs.promises.rename(temporary, target)
}

const withAvailability = async (schemes: FontScheme[]): Promise<AvailableFontScheme[]> => {
  const available = new Set((await getAvailableFonts()).map((font) => font.family))
  return schemes.map((scheme) => {
    const missingFamilies = collectFontSchemeFamilies(scheme).filter((family) => !available.has(family))
    return { ...scheme, available: missingFamilies.length === 0, missingFamilies }
  })
}

export const listFontSchemes = async (): Promise<AvailableFontScheme[]> =>
  withAvailability([...BUILT_IN_FONT_SCHEMES, ...(await readSchemes())])

export const saveFontScheme = async (value: unknown): Promise<AvailableFontScheme> => {
  const requestedId =
    value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string'
      ? String((value as Record<string, unknown>).id).trim()
      : ''
  const input = normalizeUserFontScheme({
    ...(value && typeof value === 'object' ? value : {}),
    id: requestedId || `scheme_${nanoid(10)}`
  })
  if (!input) throw new Error('字体组合信息不完整')
  if (BUILT_IN_FONT_SCHEMES.some((scheme) => scheme.id === input.id)) {
    throw new Error('内置字体组合不能覆盖')
  }
  for (const family of collectFontSchemeFamilies(input)) {
    await assertFontFamilyAvailable(family, '字体组合')
  }
  const schemes = await readSchemes()
  const duplicateName = schemes.find(
    (scheme) => scheme.id !== input.id && scheme.name.toLowerCase() === input.name.toLowerCase()
  )
  if (duplicateName) throw new Error(`字体组合名称已存在：${input.name}`)
  const now = Math.floor(Date.now() / 1000)
  const index = schemes.findIndex((scheme) => scheme.id === input.id)
  const saved: FontScheme = {
    ...input,
    builtIn: false,
    createdAt: index >= 0 ? schemes[index].createdAt || now : now,
    updatedAt: now
  }
  if (index >= 0) schemes[index] = saved
  else schemes.push(saved)
  await writeSchemes(schemes)
  return { ...saved, available: true, missingFamilies: [] }
}

export const deleteFontScheme = async (id: string): Promise<void> => {
  if (BUILT_IN_FONT_SCHEMES.some((scheme) => scheme.id === id)) {
    throw new Error('内置字体组合不能删除')
  }
  const schemes = await readSchemes()
  const next = schemes.filter((scheme) => scheme.id !== id)
  if (next.length === schemes.length) throw new Error('字体组合不存在')
  await writeSchemes(next)
}
