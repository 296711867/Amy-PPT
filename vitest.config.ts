import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// 开发时若在仓库旁边存在 html2pptx 源码检出，则优先指向源码；
// 否则回退到 node_modules 中已安装的包，保证测试开箱可跑。
const html2pptxSourceRoot = fileURLToPath(new URL('../html2pptx/src', import.meta.url))
const html2pptxDistRoot = fileURLToPath(
  new URL('./node_modules/@arcsin1/html2pptx/dist', import.meta.url)
)
const useSourceCheckout = fs.existsSync(`${html2pptxSourceRoot}/index.ts`)
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
