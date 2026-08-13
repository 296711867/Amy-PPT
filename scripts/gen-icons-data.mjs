/**
 * 从 lucide-react 全集导出图标库数据（JSON），供后续 harness / agent 机制使用
 * （如 data-icon 落盘替换、按需查询 path、未知 id 校验）。
 *
 * 输出：resources/icons/lucide-icons.json
 * 结构：{ version, source, viewBox, strokeAttrs, count, icons: { id: innerMarkup } }
 *
 * 跑法：node scripts/gen-icons-data.mjs
 */
import { writeFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const ICONS_DIR = resolve(projectRoot, 'node_modules/lucide-react/dist/esm/icons')

async function loadInnerSvg(iconId) {
  const mod = await import(`lucide-react/dist/esm/icons/${iconId}.js`)
  const node = mod.__iconNode
  if (!node) throw new Error(`no __iconNode`)
  return node
    .map(([tag, attrs]) => {
      const clean = Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'key'))
      const parts = Object.entries(clean).map(([k, v]) => `${k}="${v}"`).join(' ')
      return `<${tag} ${parts} />`
    })
    .join('')
}

async function main() {
  const files = await readdir(ICONS_DIR)
  const ids = files.filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort()

  const icons = {}
  let missing = 0
  for (const id of ids) {
    try {
      icons[id] = await loadInnerSvg(id)
    } catch {
      missing += 1
    }
  }

  const data = {
    version: '0.574.0',
    source: 'lucide-react (ISC)',
    viewBox: '0 0 24 24',
    strokeAttrs:
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"',
    usage:
      '每个 value 是可直接粘贴到 <svg> 内的 inner markup。外层：<svg viewBox="0 0 24 24" {strokeAttrs}>{inner}</svg>。供 harness/agent 的 data-icon 落盘替换、按需查询使用。',
    count: Object.keys(icons).length,
    icons
  }

  const outPath = resolve(projectRoot, 'resources/icons/lucide-icons.json')
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(data, null, 0), 'utf-8')

  console.log(`✓ 导出 ${data.count} 个图标 → ${outPath}`)
  if (missing > 0) console.log(`✗ 跳过 ${missing} 个无 node`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
