import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests use the lockfile dependency by default. Maintainers can explicitly opt into a
// neighboring html2pptx source checkout without making results depend on local folders.
const html2pptxSourceRoot = fileURLToPath(new URL('../html2pptx/src', import.meta.url))
const html2pptxDistRoot = fileURLToPath(
  new URL('./node_modules/@arcsin1/html2pptx/dist', import.meta.url)
)
const useSourceCheckout =
  process.env.AMY_PPT_USE_LOCAL_HTML2PPTX === '1' &&
  fs.existsSync(`${html2pptxSourceRoot}/index.ts`)
const resolveHtml2pptx = (sourceEntry: string, distEntry: string): string =>
  useSourceCheckout
    ? `${html2pptxSourceRoot}/${sourceEntry}.ts`
    : `${html2pptxDistRoot}/${distEntry}.js`

export default defineConfig({
  resolve: {
    alias: {
      '@arcsin1/html2pptx/animation': resolveHtml2pptx('animation-writer', 'animation-writer'),
      '@arcsin1/html2pptx/ooxml': resolveHtml2pptx('ooxml-writer', 'ooxml-writer'),
      '@arcsin1/html2pptx/node': resolveHtml2pptx('node', 'node'),
      '@arcsin1/html2pptx': resolveHtml2pptx('index', 'index'),
      '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    environmentMatchGlobs: [['tests/unit/runtime/**', 'happy-dom']]
  }
})
