import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { findSlidePackResourceZipInsideZip } from '../../../src/main/session-import/slide-pack-archive'

const createDeckZip = (): Uint8Array =>
  zipSync({
    'index.html': strToU8('<html><head><title>Deck</title></head><body></body></html>'),
    'page-1.html': strToU8('<html><body>Page 1</body></html>')
  })

describe('slide-pack app archive detection', () => {
  it('finds slides.zip inside a macOS app slide-pack package', () => {
    const appZip = zipSync({
      'Deck-macos-arm64.app/Contents/Info.plist': strToU8('<plist></plist>'),
      'Deck-macos-arm64.app/Contents/MacOS/Deck-macos-arm64': strToU8('viewer'),
      'Deck-macos-arm64.app/Contents/Resources/slides.zip': createDeckZip()
    })

    const deckZip = findSlidePackResourceZipInsideZip(appZip)

    expect(deckZip).not.toBeNull()
    expect(Object.keys(unzipSync(deckZip as Uint8Array)).sort()).toEqual([
      'index.html',
      'page-1.html'
    ])
  })

  it('ignores app resource zips that are not importable slide decks', () => {
    const appZip = zipSync({
      'Deck-macos-arm64.app/Contents/Resources/slides.zip': zipSync({
        'nested/index.html': strToU8('<html></html>')
      })
    })

    expect(findSlidePackResourceZipInsideZip(appZip)).toBeNull()
  })
})
