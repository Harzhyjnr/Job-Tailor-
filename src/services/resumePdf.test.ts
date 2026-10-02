import { describe, expect, it } from 'vitest'

import { parseResume } from '@/services/resumeParser'
import { buildResumeDocument, paginateDocument, resolveLayout } from '@/services/resumeDocument'
import {
  FONT_NOTE,
  PDF_FONT,
  exportResumePdf,
  exportResumeText,
  printable,
} from '@/services/resumePdf'
import fullResume from '@/test/fixtures/resume-full.txt?raw'

const { resume } = parseResume(fullResume)

/** Reading a PDF back is slower than writing one, so those tests get more room. */
const SLOW = 30000

interface Extracted {
  pageCount: number
  text: string
  baselines: number[]
}

/**
 * Reads the exported file back with the same library the app uses to read
 * uploaded PDFs, so these tests check the artifact rather than the intent: if the
 * text were rasterized or mis-encoded, nothing here would find it.
 *
 * It also reports where every glyph was actually drawn, which is the only way to
 * check the geometry: a page count alone cannot tell you that the last line is
 * sitting in the bottom margin.
 */
async function extract(bytes: Uint8Array): Promise<Extracted> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: false })
  const document = await loadingTask.promise
  const pages: string[] = []
  const baselines: number[] = []

  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index)
    const content = await page.getTextContent()

    for (const item of content.items) {
      if ('str' in item) {
        baselines.push(item.transform[5])
      }
    }

    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }

  return { pageCount: document.numPages, text: pages.join(' '), baselines }
}

describe('exportResumePdf', () => {
  it('produces a real, text-based PDF', async () => {
    const result = await exportResumePdf(resume)

    expect(result.blob.type).toBe('application/pdf')
    expect(result.blob.size).toBeGreaterThan(1000)

    const bytes = new Uint8Array(await result.blob.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('names the file after the applicant', async () => {
    const result = await exportResumePdf(resume)

    expect(result.fileName).toBe('ada-lovelace-resume.pdf')
  })

  it(
    'keeps the text selectable, in reading order, with the section headings',
    { timeout: SLOW },
    async () => {
      const result = await exportResumePdf(resume)
      const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))

      expect(extracted.pageCount).toBe(result.pageCount)
      expect(extracted.text).toContain('Ada Lovelace')
      expect(extracted.text).toContain('SUMMARY')
      expect(extracted.text).toContain('EXPERIENCE')
      expect(extracted.text).toContain('SKILLS')
      expect(extracted.text).toContain('Senior Backend Engineer | Meridian Payments')
      expect(extracted.text).toContain('Java, Spring Boot, PostgreSQL')
    },
  )

  it('writes bullets as bullets', { timeout: SLOW }, async () => {
    const result = await exportResumePdf(resume)
    const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))

    expect(extracted.text).toContain('• Led migration of the core ledger service to PostgreSQL')
  })

  it('writes the document from the edited text, not the original', async () => {
    const edited = { ...resume, summary: 'Payment platform engineer.' }
    const result = await exportResumePdf(edited)
    const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))

    expect(extracted.text).toContain('Payment platform engineer.')
  })

  it('adds a page rather than letting text run off the bottom', { timeout: SLOW }, async () => {
    const padded = {
      ...resume,
      summary: `${resume.summary} ${'Extra sentence that makes the document longer. '.repeat(60)}`,
    }
    const result = await exportResumePdf(padded)
    const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))

    expect(result.pageCount).toBeGreaterThan(1)
    expect(extracted.pageCount).toBe(result.pageCount)
    expect(extracted.text).toContain('Extra sentence that makes the document longer.')
  })

  it(
    'keeps every line inside the bottom margin, not just inside the page',
    { timeout: SLOW },
    async () => {
      const padded = {
        ...resume,
        summary: `${resume.summary} ${'Extra sentence that makes the document longer. '.repeat(60)}`,
      }
      const marginPt = 0.5 * 72
      const result = await exportResumePdf(padded)
      const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))

      expect(result.pageCount).toBeGreaterThan(1)
      // pdf.js reports baselines in PDF space, where y grows upward from the
      // bottom edge, so the lowest glyph is the smallest value.
      expect(Math.min(...extracted.baselines)).toBeGreaterThanOrEqual(marginPt)
    },
  )

  it('starts every page below the top margin', async () => {
    const padded = {
      ...resume,
      summary: `${resume.summary} ${'Extra sentence that makes the document longer. '.repeat(60)}`,
    }
    const result = await exportResumePdf(padded)
    const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))
    const marginPt = 0.5 * 72
    const topOfPage = 792 - marginPt

    expect(Math.max(...extracted.baselines)).toBeLessThanOrEqual(topOfPage)
  })

  it(
    'loses no text to the page break: every segment is drawn on exactly one page',
    { timeout: SLOW },
    async () => {
      const padded = {
        ...resume,
        summary: `${resume.summary} ${'Extra sentence that makes the document longer. '.repeat(60)}`,
      }
      const settings = resolveLayout({})
      const placed = paginateDocument(buildResumeDocument(padded), settings)
      const result = await exportResumePdf(padded)
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const document = await pdfjs.getDocument({
        data: new Uint8Array(await result.blob.arrayBuffer()),
        useSystemFonts: false,
      }).promise

      const drawn = placed.reduce((total, item) => total + item.segments.length, 0)

      expect(result.pageCount).toBe(document.numPages)

      // Each page's items must add up to the segments laid out on it, which is
      // only true if nothing was dropped at a break.
      let cursor = 0

      for (let index = 1; index <= document.numPages; index += 1) {
        const page = await document.getPage(index)
        const content = await page.getTextContent()
        const items = content.items.filter((item) => 'str' in item && item.str.trim().length > 0)
        const onPage = placed.filter((item) => item.pageIndex === index - 1)

        expect(items.length).toBe(onPage.reduce((total, item) => total + item.segments.length, 0))

        cursor += items.length
      }

      expect(cursor).toBe(drawn)
    },
  )

  it('honours the page setup the user chose', async () => {
    const small = await exportResumePdf(resume, {
      preferences: { fontSizePt: 8, marginIn: 1.5 },
    })
    const large = await exportResumePdf(resume, {
      preferences: { fontSizePt: 14, marginIn: 0.25 },
    })

    expect(large.pageCount).toBeGreaterThanOrEqual(small.pageCount)
  })

  it(
    'survives a resume full of characters the standard fonts cannot draw',
    { timeout: SLOW },
    async () => {
      const noisy = {
        ...resume,
        summary: 'Built systems 🚀 with Kafka → Spark, and shipped — fast.',
      }

      const result = await exportResumePdf(noisy)
      const extracted = await extract(new Uint8Array(await result.blob.arrayBuffer()))

      expect(extracted.text).toContain('Built systems')
      expect(extracted.text).toContain('with Kafka')
      expect(extracted.text).toContain('and shipped — fast.')
    },
  )
})

describe('printable', () => {
  it('keeps the characters a resume actually uses', () => {
    expect(printable('Ada — Lovelace, “quoted”, 40% • done')).toBe(
      'Ada — Lovelace, “quoted”, 40% • done',
    )
  })

  it('drops what the fonts cannot draw and keeps the sentence', () => {
    expect(printable('Kafka → Spark 🚀')).toBe('Kafka Spark')
  })

  it('collapses the whitespace a parser would choke on', () => {
    expect(printable('one   two\n\nthree')).toBe('one two three')
  })
})

describe('the font in the file', () => {
  it('is the standard face the preview is set in, not a near miss', () => {
    expect(PDF_FONT).toBe('Helvetica')
  })

  it('tells the user the two are the same face rather than implying a switch', () => {
    expect(FONT_NOTE).toContain('same widths')
    expect(FONT_NOTE).toContain('same places')
  })
})

describe('exportResumeText', () => {
  it('reads as the same document, for portals that want pasted text', () => {
    const text = exportResumeText(resume)

    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('SUMMARY')
    expect(text).toContain('• Designed REST APIs consumed by three client teams.')
    expect(text.split('\n').every((line) => line === line.trimEnd())).toBe(true)
    expect(text.split('\n').some((line) => line.startsWith('    '))).toBe(true)
  })
})
