import { describe, expect, it } from 'vitest'

import {
  BASE_FONT_PT,
  LETTER_HEIGHT_PT,
  buildResumeDocument,
  groupIntoPages,
  paginateDocument,
  pageCountOf,
  printable,
  resolveLayout,
} from '@/services/resumeDocument'
import { HELVETICA_CHARSET, helveticaWidth } from '@/services/helveticaWidths'
import { parseResume } from '@/services/resumeParser'
import fullResume from '@/test/fixtures/resume-full.txt?raw'
import type { Resume } from '@/types/resume'

const { resume } = parseResume(fullResume)

/**
 * The same greedy wrap the layout uses, driven by whichever measurer it is handed,
 * so the table and the embedded font can be compared break for break.
 */
function wrapWith(measure: (text: string) => number, text: string, maxWidth: number) {
  const words = text.split(' ')
  const segments: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (!current || measure(candidate) <= maxWidth) {
      current = candidate
    } else {
      segments.push(current)
      current = word
    }
  }

  segments.push(current)

  return segments
}

/** A document long enough to cross a page boundary. */
const padded: Resume = {
  ...resume,
  summary: `${resume.summary} ${'Extra sentence that makes the document longer. '.repeat(60)}`,
}

describe('resolveLayout', () => {
  it('turns the preferences into points, so both renderers use one number', () => {
    expect(resolveLayout({ fontSizePt: 11, lineHeight: 1.25, marginIn: 0.5 })).toEqual({
      lineHeight: 1.25,
      marginPt: 36,
      scale: 1,
    })
  })

  it('scales every size with the font size rather than resizing some of them', () => {
    const base = resolveLayout({ fontSizePt: BASE_FONT_PT, marginIn: 0.5 })
    const larger = resolveLayout({ fontSizePt: 13, marginIn: 0.5 })

    expect(larger.scale).toBeCloseTo(13 / BASE_FONT_PT, 5)
    expect(larger.marginPt).toBe(base.marginPt)
  })

  it('refuses a page setup that would be unreadable', () => {
    const settings = resolveLayout({ fontSizePt: 40, lineHeight: 9, marginIn: 6 })

    expect(settings.scale).toBe(14 / BASE_FONT_PT)
    expect(settings.lineHeight).toBe(2)
    expect(settings.marginPt).toBe(1.5 * 72)
  })

  it('falls back rather than producing a NaN page', () => {
    expect(resolveLayout({ fontSizePt: Number.NaN, lineHeight: Number.NaN })).toEqual(
      resolveLayout({ fontSizePt: BASE_FONT_PT, lineHeight: 1.25, marginIn: 0.5 }),
    )
  })
})

describe('paginateDocument', () => {
  it('puts the whole document on one page when it fits', () => {
    const placed = paginateDocument(buildResumeDocument(resume), resolveLayout({}))

    expect(placed.every((item) => item.pageIndex === 0)).toBe(true)
    expect(pageCountOf(buildResumeDocument(resume), resolveLayout({}))).toBe(1)
  })

  it('keeps every line inside both margins', () => {
    const settings = resolveLayout({ marginIn: 0.5 })
    const bottom = LETTER_HEIGHT_PT - settings.marginPt

    for (const item of paginateDocument(buildResumeDocument(padded), settings)) {
      expect(item.topPt).toBeGreaterThanOrEqual(settings.marginPt)
      expect(item.topPt + item.segments.length * item.lineBoxPt).toBeLessThanOrEqual(bottom)
    }
  })

  it('never leaves a line hanging below the bottom margin to save a page', () => {
    const settings = resolveLayout({ marginIn: 0.5 })
    const bottom = LETTER_HEIGHT_PT - settings.marginPt
    const placed = paginateDocument(buildResumeDocument(padded), settings)

    expect(Math.min(...placed.map((item) => bottom - item.topPt))).toBeGreaterThanOrEqual(0)
  })

  it('starts a new page when the next line would not fit', () => {
    const placed = paginateDocument(buildResumeDocument(padded), resolveLayout({}))

    expect(placed.length).toBeGreaterThan(0)
    expect(Math.max(...placed.map((item) => item.pageIndex))).toBeGreaterThan(0)
  })

  it('numbers the pages without skipping one', () => {
    const placed = paginateDocument(buildResumeDocument(padded), resolveLayout({}))
    const indexes = [...new Set(placed.map((item) => item.pageIndex))]

    expect(indexes).toEqual(indexes.map((_, position) => position))
  })

  it('keeps a section heading with the first line of its section', () => {
    const placed = paginateDocument(buildResumeDocument(padded), resolveLayout({}))
    const headings = placed.filter((item) => item.line.keepWithNext)

    expect(headings.length).toBeGreaterThan(0)

    headings.forEach((heading, position) => {
      const following = placed[placed.indexOf(heading) + 1]

      expect(following?.pageIndex).toBe(heading.pageIndex)
      expect(position).toBeGreaterThanOrEqual(0)
    })
  })

  it('wraps without losing or duplicating a single character', () => {
    const placed = paginateDocument(buildResumeDocument(padded), resolveLayout({}))
    const original = buildResumeDocument(padded)

    placed.forEach((item, index) => {
      const source = original[index]!
      const content = printable(source.style === 'bullet' ? `• ${source.text}` : source.text)

      expect(item.segments.join(' ')).toBe(content)
    })
  })

  it('breaks a long line into segments that each fit the content width', () => {
    const settings = resolveLayout({ marginIn: 0.5 })
    const contentWidth = 612 - settings.marginPt * 2
    const placed = paginateDocument(buildResumeDocument(padded), settings)
    const wrapped = placed.filter((item) => item.segments.length > 1)

    expect(wrapped.length).toBeGreaterThan(0)

    wrapped.forEach((item) => {
      item.segments.forEach((segment) => {
        expect(helveticaWidth(segment, item.fontSize, item.bold)).toBeLessThanOrEqual(
          contentWidth - item.indentPt,
        )
      })
    })
  })

  it('groups lines into the pages they were laid out on', () => {
    const settings = resolveLayout({})
    const placed = paginateDocument(buildResumeDocument(padded), settings)
    const pages = groupIntoPages(placed, settings)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.reduce((total, page) => total + page.lines.length, 0)).toBe(placed.length)
    expect(pages.every((page) => page.index === pages.indexOf(page))).toBe(true)
  })

  it('produces one page for a document with nothing in it', () => {
    expect(pageCountOf([], resolveLayout({}))).toBe(1)
  })

  it('reports a larger document when the user asks for larger type', () => {
    const lines = buildResumeDocument(padded)

    expect(pageCountOf(lines, resolveLayout({ fontSizePt: 14 }))).toBeGreaterThan(
      pageCountOf(lines, resolveLayout({ fontSizePt: 8 })),
    )
  })
})

describe('the Helvetica width table', () => {
  it('agrees with the font itself for every character it claims to cover', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const document = await PDFDocument.create()
    const regular = await document.embedFont(StandardFonts.Helvetica)
    const bold = await document.embedFont(StandardFonts.HelveticaBold)
    const mismatches: string[] = []

    for (const character of HELVETICA_CHARSET) {
      for (const [font, isBold] of [
        [regular, false],
        [bold, true],
      ] as const) {
        const fromFont = font.widthOfTextAtSize(character, 11)
        const fromTable = helveticaWidth(character, 11, isBold)

        if (Math.abs(fromFont - fromTable) > 0.01) {
          mismatches.push(
            `${JSON.stringify(character)} ${isBold ? 'bold' : 'regular'}: font ${fromFont}, table ${fromTable}`,
          )
        }
      }
    }

    expect(mismatches).toEqual([])
  })

  /**
   * The table has to model what a PDF reader will actually draw.
   *
   * A text-showing operator for a simple font lays a string out by summing the
   * advance widths of its glyphs; it does not kern. pdf-lib's own string
   * measurement does apply kerning and so comes out roughly 1% narrower than the
   * glyphs it contains, which makes it the wrong thing to measure against. The
   * sum of the per-character widths is the right model, and it is what the
   * exporter wraps with.
   */
  it('sums to the width a PDF reader would draw', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const document = await PDFDocument.create()
    const regular = await document.embedFont(StandardFonts.Helvetica)
    const bold = await document.embedFont(StandardFonts.HelveticaBold)
    const mismatches: string[] = []

    const lines = buildResumeDocument(padded)
      .map((line) => printable(line.style === 'bullet' ? `• ${line.text}` : line.text))
      .filter((text) => text.trim().length > 0)

    for (const text of lines) {
      for (const size of [8, 11, 14]) {
        for (const [font, isBold] of [
          [regular, false],
          [bold, true],
        ] as const) {
          const drawn = [...text].reduce(
            (total, character) => total + font.widthOfTextAtSize(character, size),
            0,
          )

          if (Math.abs(drawn - helveticaWidth(text, size, isBold)) > 0.01) {
            mismatches.push(`${text.slice(0, 32)} at ${size}pt ${isBold ? 'bold' : 'regular'}`)
          }
        }
      }
    }

    expect(lines.length).toBeGreaterThan(5)
    expect(mismatches).toEqual([])
  })

  it('wraps on the same measure the glyphs add up to', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const document = await PDFDocument.create()
    const regular = await document.embedFont(StandardFonts.Helvetica)
    const contentWidth = 612 - 36 * 2
    const size = 11
    const text =
      'Led the migration of 40 services to Kubernetes with 99.9% uptime and no downtime at all, while cutting the infrastructure bill by a third and handing the runbook to the two teams that took it on'

    const fromTable = wrapWith((value) => helveticaWidth(value, size), text, contentWidth)
    const fromGlyphs = wrapWith(
      (value) =>
        [...value].reduce(
          (total, character) => total + regular.widthOfTextAtSize(character, size),
          0,
        ),
      text,
      contentWidth,
    )

    expect(fromTable.length).toBeGreaterThan(1)
    expect(fromTable).toEqual(fromGlyphs)
  })

  it('covers every character the exporter lets through', () => {
    const sample = 'Ada Lovelace — “engineer”, 99.9% • café naïve… † ‡ ‰ ™'

    expect(printable(sample)).toBe(sample)
  })

  it('measures an unknown character rather than assuming it is zero wide', () => {
    expect(helveticaWidth('🚀', 11)).toBeGreaterThan(0)
  })
})
