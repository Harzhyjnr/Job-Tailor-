import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Client-side text extraction for the three supported resume inputs.
 *
 * Everything here runs in the browser. The file is read with the File API, never
 * uploaded, and libraries are imported dynamically so a user who only pastes
 * text never downloads the PDF or DOCX parsers.
 */

export type SourceKind = 'pdf' | 'docx' | 'text'

export interface ExtractedDocument {
  text: string
  kind: SourceKind
  /** Number of pages for PDFs; undefined for other kinds. */
  pageCount?: number
  /** Non-fatal problems worth surfacing, e.g. a PDF that yielded no text. */
  warnings: string[]
}

export class ExtractionError extends Error {
  readonly userMessage: string
  override readonly cause?: unknown

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage)
    this.name = 'ExtractionError'
    this.userMessage = userMessage
    this.cause = cause
  }
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024

const ACCEPTED_KINDS: SourceKind[] = ['pdf', 'docx']

export function detectSourceKind(file: File): SourceKind | undefined {
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }

  return undefined
}

/** Validates type and size before any parsing work starts. */
export function validateResumeFile(file: File): SourceKind {
  const kind = detectSourceKind(file)
  if (!kind || !ACCEPTED_KINDS.includes(kind)) {
    throw new ExtractionError('That file type is not supported. Upload a PDF or DOCX file.')
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionError(
      'That file is larger than 5 MB. Try a smaller file or paste your resume.',
    )
  }

  if (file.size === 0) {
    throw new ExtractionError('That file is empty. Try a different file or paste your resume.')
  }

  return kind
}

export async function extractFromFile(file: File): Promise<ExtractedDocument> {
  const kind = validateResumeFile(file)
  return kind === 'pdf' ? extractPdf(file) : extractDocx(file)
}

export async function extractFromText(input: string): Promise<ExtractedDocument> {
  const text = input.trim()
  if (text.length === 0) {
    throw new ExtractionError('Please paste your resume before continuing.')
  }

  return { text, kind: 'text', warnings: [] }
}

/**
 * PDF text extraction via pdf.js. Layout mode is enabled so multi-column
 * resumes keep a usable reading order.
 */
async function extractPdf(file: File): Promise<ExtractedDocument> {
  let pdfjs: typeof import('pdfjs-dist')
  let bytes: ArrayBuffer

  try {
    ;[pdfjs, bytes] = await Promise.all([import('pdfjs-dist'), file.arrayBuffer()])
  } catch (cause) {
    throw new ExtractionError(
      "We couldn't read that PDF. Try uploading another file or paste your resume manually.",
      cause,
    )
  }

  // pdf.js parses on a worker thread; Vite resolves the worker URL at build
  // time. Environments without a real Worker (jsdom tests) must be left alone:
  // pdf.js then runs its bundled worker in-process, which is what its own
  // default `workerSrc` already points at.
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  }

  const warnings: string[] = []
  let task: ReturnType<typeof pdfjs.getDocument>
  let document: import('pdfjs-dist').PDFDocumentProxy

  try {
    task = pdfjs.getDocument({ data: bytes })
    document = await task.promise
  } catch (cause) {
    if (isPasswordProtected(cause)) {
      throw new ExtractionError(
        'That PDF is password protected. Remove the password and try again, or paste your resume.',
        cause,
      )
    }
    throw new ExtractionError(
      "We couldn't extract enough text from this file. Try uploading another PDF/DOCX or paste your resume manually.",
      cause,
    )
  }

  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(reconstructPage(content.items))
    page.cleanup()
  }

  // The loading task owns the worker; destroying it releases the worker thread.
  await task.destroy()

  const pageCount = document.numPages
  const text = pages.join('\n\n').trim()

  if (text.replace(/\s/g, '').length < 40) {
    throw new ExtractionError(
      "We couldn't extract enough text from this file. The PDF may be a scan rather than selectable text. Try uploading another PDF/DOCX or paste your resume manually.",
    )
  }

  if (text.includes('\u0000')) {
    warnings.push('Some characters could not be read from the PDF and may appear as blanks.')
  }

  return { text, kind: 'pdf', pageCount, warnings }
}

/**
 * Rebuilds reading order from positioned text items. pdf.js emits items in
 * draw order, which for two-column resumes interleaves the columns, so items are
 * grouped into visual lines by their vertical coordinate before being joined.
 */
function reconstructPage(items: unknown[]): string {
  interface Positioned {
    str: string
    x: number
    y: number
  }

  const positioned: Positioned[] = []

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const candidate = item as {
      str?: unknown
      transform?: unknown
      width?: unknown
      hasEOL?: unknown
    }

    if (typeof candidate.str !== 'string' || !Array.isArray(candidate.transform)) continue

    const transform = candidate.transform as number[]
    positioned.push({
      str: candidate.str,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
    })
  }

  if (positioned.length === 0) return ''

  const tolerance = 2.5
  const lines: { y: number; parts: Positioned[] }[] = []

  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance)
    if (line) {
      line.parts.push(item)
    } else {
      lines.push({ y: item.y, parts: [item] })
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

function isPasswordProtected(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'name' in cause &&
    (cause as { name: string }).name === 'PasswordException'
  )
}

/** DOCX text extraction via mammoth. HTML output is discarded; only text is used. */
async function extractDocx(file: File): Promise<ExtractedDocument> {
  let arrayBuffer: ArrayBuffer

  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (cause) {
    throw new ExtractionError(
      "We couldn't read that DOCX file. Try uploading another file or paste your resume manually.",
      cause,
    )
  }

  let mammoth: typeof import('mammoth')
  try {
    mammoth = await import('mammoth')
  } catch (cause) {
    throw new ExtractionError(
      "We couldn't read that DOCX file. Try uploading another file or paste your resume manually.",
      cause,
    )
  }

  try {
    // extractRawText returns the document body as plain text with no HTML, so
    // nothing from the file is ever interpreted as markup.
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.trim()

    if (text.replace(/\s/g, '').length < 40) {
      throw new ExtractionError(
        "We couldn't extract enough text from this file. Try uploading another PDF/DOCX or paste your resume manually.",
      )
    }

    return {
      text,
      kind: 'docx',
      warnings: result.messages.map((message: { message: string }) => message.message),
    }
  } catch (cause) {
    if (cause instanceof ExtractionError) throw cause
    throw new ExtractionError(
      "We couldn't extract enough text from this file. The file may be corrupt or password protected. Try uploading another PDF/DOCX or paste your resume manually.",
      cause,
    )
  }
}
