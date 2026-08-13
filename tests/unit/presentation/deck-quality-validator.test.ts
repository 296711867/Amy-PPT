import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isReady: () => false },
  BrowserWindow: class BrowserWindow {}
}))

import type { DeckPageQualityObservation } from '../../../src/main/presentation/html/deck-quality-validator'
import { evaluateDeckQuality } from '../../../src/main/presentation/html/deck-quality-validator'
import { requireSlideSizePreset } from '../../../src/shared/slide-size'

const slideSize = requireSlideSizePreset('wide-16-9')

const page = (
  pageNumber: number,
  overrides: Partial<DeckPageQualityObservation> = {}
): DeckPageQualityObservation => ({
  pageId: `page-${pageNumber}`,
  pageNumber,
  title: `Page ${pageNumber}`,
  layoutIntent: pageNumber === 1 ? 'cover' : 'concept',
  declaredSlideSizeId: slideSize.id,
  declaredWidth: slideSize.width,
  declaredHeight: slideSize.height,
  metrics: {
    title: {
      text: `Page ${pageNumber}`,
      rect: { x: 96, y: 72, width: 560, height: 58 },
      fontFamily: 'Montserrat',
      fontSize: 48,
      color: 'rgb(15, 23, 42)',
      lineCount: 1
    },
    bodyFontFamily: 'Inter',
    textBounds: { x: 96, y: 72, width: 1408, height: 690 },
    textCharacters: 220,
    elementCount: 42,
    visualCount: 1,
    cardCount: 2,
    backgroundColor: 'rgb(255, 255, 255)',
    dominantColors: ['rgb(255, 255, 255)', 'rgb(15, 23, 42)'],
    layoutSignature: `layout-${pageNumber % 2}`
  },
  ...overrides
})

const designContract = {
  theme: 'editorial',
  background: 'white',
  palette: ['#ffffff', '#0f172a', '#dc2626'],
  titleStyle: 'strong',
  layoutMotif: 'editorial grid',
  chartStyle: 'flat',
  shapeLanguage: 'restrained',
  titleFont: 'Montserrat',
  bodyFont: 'Inter'
}

describe('deck quality validator', () => {
  it('accepts a coherent deck with varied adjacent silhouettes', () => {
    expect(
      evaluateDeckQuality({
        pages: [page(1), page(2), page(3), page(4)],
        slideSize,
        designContract
      })
    ).toEqual([])
  })

  it('blocks deterministic canvas and core-font contract drift', () => {
    const violations = evaluateDeckQuality({
      pages: [
        page(1),
        page(2, {
          declaredWidth: 1200,
          metrics: {
            ...page(2).metrics,
            title: { ...page(2).metrics.title!, fontFamily: 'Arial' },
            bodyFontFamily: 'Arial'
          }
        }),
        page(3)
      ],
      slideSize,
      designContract
    })

    expect(violations.filter((violation) => violation.severity === 'error')).toEqual([
      expect.objectContaining({ code: 'deck-slide-size-mismatch', pageIds: ['page-2'] }),
      expect.objectContaining({ code: 'deck-font-system-drift', pageIds: ['page-2'] })
    ])
  })

  it('keeps title, margin, density, silhouette, and UI judgments advisory', () => {
    const repeated = [2, 3, 4, 5].map((pageNumber) =>
      page(pageNumber, {
        metrics: {
          ...page(pageNumber).metrics,
          title: {
            ...page(pageNumber).metrics.title!,
            rect:
              pageNumber === 5
                ? { x: 430, y: 250, width: 560, height: 58 }
                : { x: 96, y: 72, width: 560, height: 58 }
          },
          textBounds:
            pageNumber === 5
              ? { x: 20, y: 60, width: 1540, height: 780 }
              : { x: 96, y: 72, width: 1408, height: 690 },
          textCharacters: pageNumber === 4 ? 1000 : 220,
          elementCount: pageNumber === 4 ? 180 : 42,
          cardCount: pageNumber <= 3 ? 7 : 2,
          layoutSignature: 'same-layout'
        }
      })
    )
    const violations = evaluateDeckQuality({
      pages: [page(1), ...repeated],
      slideSize,
      designContract
    })
    const codes = violations.map((violation) => violation.code)

    expect(codes).toContain('deck-title-anchor-drift')
    expect(codes).toContain('deck-text-margin-rhythm')
    expect(codes).toContain('deck-density-spike')
    expect(codes).toContain('deck-repeated-silhouette')
    expect(codes).toContain('deck-web-ui-pattern')
    expect(violations.every((violation) => violation.severity === 'warn')).toBe(true)
  })

  it('does not enforce the generated font contract on inherited templates', () => {
    const violations = evaluateDeckQuality({
      pages: [
        page(1),
        page(2, {
          metrics: {
            ...page(2).metrics,
            title: { ...page(2).metrics.title!, fontFamily: 'Template Display' },
            bodyFontFamily: 'Template Sans'
          }
        })
      ],
      slideSize,
      designContract,
      preserveTemplate: true
    })

    expect(violations.map((violation) => violation.code)).not.toContain('deck-font-system-drift')
  })

  it('advises on palette drift, wrapped titles, and undersized title hierarchy', () => {
    const drifted = page(2, {
      metrics: {
        ...page(2).metrics,
        title: {
          ...page(2).metrics.title!,
          fontSize: 28,
          lineCount: 2
        },
        dominantColors: ['rgb(0, 255, 255)', 'rgb(170, 0, 255)', 'rgb(255, 255, 255)']
      }
    })
    const violations = evaluateDeckQuality({
      pages: [page(1), drifted, page(3)],
      slideSize,
      designContract
    })
    const codes = violations.map((violation) => violation.code)

    expect(codes).toContain('deck-palette-drift')
    expect(codes).toContain('deck-title-wrapped')
    expect(codes).toContain('deck-title-size-rhythm')
  })
})
