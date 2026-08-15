import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { parsePptxXmlDeckMetadata } from '../../../src/main/io/pptx-import/xml-shape-metadata'

const SLIDE_XML = `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr/>
          <p:nvPr><p:ph type="ctrTitle"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content Placeholder 2"/>
          <p:cNvSpPr/>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Subtitle 3"/>
          <p:cNvSpPr/>
          <p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="5" name="Picture 4"/>
          <p:cNvPicPr/>
          <p:nvPr><p:ph type="pic" idx="2"/></p:nvPr>
        </p:nvPicPr>
        <p:blipFill/>
        <p:spPr/>
      </p:pic>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="6" name="Freeform 5"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`

const buildPptxBuffer = (): Buffer => {
  const files = {
    'ppt/slides/slide1.xml': Buffer.from(SLIDE_XML, 'utf8')
  }
  return Buffer.from(zipSync(files))
}

describe('pptx placeholder metadata extraction', () => {
  it('extracts placeholder type and idx per shape name, including pictures', () => {
    const metadata = parsePptxXmlDeckMetadata(buildPptxBuffer())
    const slide = metadata.slides.get(1)
    expect(slide).toBeTruthy()

    expect(slide!.byName.get('Title 1')).toMatchObject({ placeholderType: 'ctrTitle' })
    expect(slide!.byName.get('Content Placeholder 2')).toMatchObject({
      placeholderType: 'body',
      placeholderIdx: '1'
    })
    expect(slide!.byName.get('Subtitle 3')).toMatchObject({ placeholderType: 'subTitle' })
    expect(slide!.byName.get('Picture 4')).toMatchObject({ placeholderType: 'pic' })
    expect(slide!.byName.get('Freeform 5')?.placeholderType).toBeUndefined()
  })

  it('returns empty metadata for a non-zip buffer instead of throwing', () => {
    const metadata = parsePptxXmlDeckMetadata(Buffer.from('not a zip'))
    expect(metadata.slides.size).toBe(0)
    expect(metadata.themeColors.size).toBe(0)
  })
})
