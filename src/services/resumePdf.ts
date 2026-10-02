import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import {
  LETTER_HEIGHT_PT,
  LETTER_WIDTH_PT,
  buildResumeDocument,
  groupIntoPages,
  paginateDocument,
  printable,
  resolveLayout,
} from '@/services/resumeDocument'
import type { Resume } from '@/types/resume'
import type { UserPreferences } from '@/types/analysis'

/**
 * Exports the resume as a real, text-based PDF, entirely in the browser.
 *
 * Two rules decide everything here. First, the text is drawn with the standard PDF
 * fonts, so it stays selectable and searchable — the entire point of an ATS
 * template — and nothing is rasterized into an image. Second, line breaks are
 * measured with the font's own metrics rather than estimated, because Helvetica
 * and Arial are metric-compatible: the text breaks where the on-screen preview
 * breaks, and the page fills the way the preview fills.
 */
export interface PdfOptions {
  fileName?: string
  preferences?: Partial<UserPreferences>
}

export interface PdfResult {
  blob: Blob
  fileName: string
  pageCount: number
}

const INK = rgb(0.07, 0.07, 0.07)

export async function exportResumePdf(
  resume: Resume,
  options: PdfOptions = {},
): Promise<PdfResult> {
  const settings = resolveLayout(options.preferences)
  const lines = buildResumeDocument(resume)

  // The page breaks are decided by `paginateDocument`, which the preview also
  // uses, so the break the user sees on screen is the break in the file.
  const placed = paginateDocument(lines, settings)

  const document = await PDFDocument.create()
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  }

  const pages = groupIntoPages(placed, settings).map(() =>
    document.addPage([LETTER_WIDTH_PT, LETTER_HEIGHT_PT]),
  )

  placed.forEach((item) => {
    const page = pages[item.pageIndex]!

    if (!page) {
      return
    }

    const font = item.bold ? fonts.bold : fonts.regular

    item.segments.forEach((segment, position) => {
      const baseline =
        LETTER_HEIGHT_PT - item.topPt - item.lineBoxPt * 0.8 - position * item.lineBoxPt

      page.drawText(segment, {
        x: settings.marginPt + item.indentPt,
        y: baseline,
        size: item.fontSize,
        font,
        color: INK,
      })
    })

    if (item.line.rule) {
      const ruleY = LETTER_HEIGHT_PT - item.topPt - item.segments.length * item.lineBoxPt - 1.5

      page.drawLine({
        start: { x: settings.marginPt, y: ruleY },
        end: { x: LETTER_WIDTH_PT - settings.marginPt, y: ruleY },
        thickness: 0.75,
        color: INK,
      })
    }
  })

  document.setTitle(resume.personalInfo.name ? `${resume.personalInfo.name} resume` : 'Resume')
  document.setCreator('Job Tailor')
  document.setProducer('Job Tailor')

  const fileName = options.fileName ?? fileNameFor(resume)
  const bytes = await document.save()

  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    fileName,
    pageCount: pages.length,
  }
}

/**
 * The only font the file can use without embedding a font binary is one of the
 * standard PDF faces, and Helvetica is the one a browser can match exactly in
 * terms of advance widths. The preview is therefore always set in Arial, and this
 * is the honest description of the relationship between what is shown and what is
 * written.
 */
export const PDF_FONT = 'Helvetica'
export const FONT_NOTE =
  'The preview and the file are both set in Arial, and the file writes Helvetica, which is the standard PDF face with the same widths. The lines break in the same places in both.'

/**
 * The character filter lives in the document model, because it has to run before
 * the text is measured. It is re-exported here since it is part of what this module
 * promises about the exported file: `exportResumeText` applies the same filter, so
 * the PDF and the plain-text copy can never disagree about what the document says.
 */
export { printable } from '@/services/resumeDocument'

/** The same document as plain text, for a copy-to-clipboard fallback. */
export function exportResumeText(resume: Resume) {
  return buildResumeDocument(resume)
    .map((line) => {
      const content = line.style === 'bullet' ? `• ${line.text}` : line.text
      return `${' '.repeat(Math.round(line.indent / 4))}${printable(content)}`
    })
    .filter((line) => line.trim().length > 0)
    .join('\n')
}

export function fileNameFor(resume: Resume) {
  const base = (resume.personalInfo.name ?? 'resume')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `${base || 'resume'}-resume.pdf`
}
