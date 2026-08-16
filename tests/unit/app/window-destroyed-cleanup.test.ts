import fs from 'fs'
import { describe, expect, it } from 'vitest'

// webContents.id / window.webContents are native Electron getters that throw
// "Object has been destroyed" once teardown begins. Cleanup callbacks attached
// with `.once('destroyed', ...)` must only touch ids captured while the
// contents were still alive.
describe('window destroyed-cleanup safety', () => {
  const source = fs.readFileSync('src/main/app/window.ts', 'utf8')

  it('deletes the renderer root through an id captured before destruction', () => {
    expect(source).toContain('const mainWebContentsId = window.webContents.id')
    expect(source).toContain('rendererRootsByWebContentsId.delete(mainWebContentsId)')
    expect(source).not.toContain('rendererRootsByWebContentsId.delete(window.webContents.id)')
  })

  it('deletes guest roots through an id captured before destruction', () => {
    expect(source).toContain('const guestWebContentsId = guestWebContents.id')
    expect(source).toContain('guestRootsByWebContentsId.delete(guestWebContentsId)')
    expect(source).not.toContain('guestRootsByWebContentsId.delete(guestWebContents.id)')
  })

  it('guards guest listener removal with a destroyed check', () => {
    const cleanup = source.match(
      /const cleanup = \(\): void => \{[\s\S]*?\n    \}/
    )?.[0]
    expect(cleanup).toContain('if (guestWebContents.isDestroyed()) return')
    expect(cleanup).toContain("removeListener('will-navigate'")
  })
})
