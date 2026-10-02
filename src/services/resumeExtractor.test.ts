import { describe, expect, it } from 'vitest'

import {
  ExtractionError,
  detectSourceKind,
  extractFromFile,
  extractFromText,
  validateResumeFile,
} from '@/services/resumeExtractor'
import { buildDocx, buildPdf } from '@/test/fixtures/binary'

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new File([buffer as ArrayBuffer], name, { type })
}

const RESUME_LINES = [
  'Ada Lovelace',
  'ada.lovelace@example.com',
  'London, UK',
  '',
  'EXPERIENCE',
  'Senior Backend Engineer, Meridian Payments',
  'Jan 2020 - Present',
  '- Led migration of the core ledger service to PostgreSQL.',
  '',
  'SKILLS',
  'Java, Spring Boot, PostgreSQL',
]

describe('detectSourceKind', () => {
  it('detects pdf and docx by extension', () => {
    expect(detectSourceKind(new File(['x'], 'resume.pdf'))).toBe('pdf')
    expect(detectSourceKind(new File(['x'], 'resume.DOCX'))).toBe('docx')
  })

  it('detects pdf and docx by mime type', () => {
    expect(detectSourceKind(new File(['x'], 'resume', { type: 'application/pdf' }))).toBe('pdf')
    expect(
      detectSourceKind(
        new File(['x'], 'resume', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ),
    ).toBe('docx')
  })

  it('returns undefined for unsupported files', () => {
    expect(detectSourceKind(new File(['x'], 'resume.txt'))).toBeUndefined()
    expect(detectSourceKind(new File(['x'], 'resume.pages'))).toBeUndefined()
  })
})

describe('validateResumeFile', () => {
  it('rejects unsupported types', () => {
    expect(() => validateResumeFile(new File(['x'], 'resume.txt'))).toThrow(ExtractionError)
  })

  it('rejects files over the size limit', () => {
    const large = new File([new Uint8Array(6 * 1024 * 1024)], 'resume.pdf', {
      type: 'application/pdf',
    })

    expect(() => validateResumeFile(large)).toThrow(/larger than 5 MB/)
  })

  it('rejects empty files', () => {
    expect(() => validateResumeFile(new File([], 'resume.pdf'))).toThrow(/empty/)
  })
})

describe('extractFromText', () => {
  it('returns trimmed text', async () => {
    const result = await extractFromText('  Ada Lovelace\n\nEngineer  ')

    expect(result.kind).toBe('text')
    expect(result.text).toBe('Ada Lovelace\n\nEngineer')
  })

  it('rejects empty input', async () => {
    await expect(extractFromText('   ')).rejects.toThrow(/paste your resume/i)
  })
})

describe('extractFromFile with PDF', () => {
  it('extracts selectable text from a real PDF', async () => {
    const file = fileFrom(buildPdf(RESUME_LINES), 'resume.pdf', 'application/pdf')
    const result = await extractFromFile(file)

    expect(result.kind).toBe('pdf')
    expect(result.pageCount).toBe(1)
    expect(result.text).toContain('Ada Lovelace')
    expect(result.text).toContain('EXPERIENCE')
    expect(result.text).toContain('Senior Backend Engineer, Meridian Payments')
    expect(result.text).toContain('PostgreSQL')
  })

  it('preserves line order so sections stay separate', async () => {
    const file = fileFrom(buildPdf(RESUME_LINES), 'resume.pdf', 'application/pdf')
    const result = await extractFromFile(file)

    expect(result.text.indexOf('EXPERIENCE')).toBeLessThan(result.text.indexOf('SKILLS'))
  })

  it('reports a helpful message when the PDF yields no text', async () => {
    const file = fileFrom(buildPdf(['']), 'blank.pdf', 'application/pdf')

    await expect(extractFromFile(file)).rejects.toThrow(/couldn't extract enough text/i)
  })

  it('reports a helpful message for a corrupt PDF', async () => {
    const file = fileFrom(
      new TextEncoder().encode('not a pdf at all'),
      'bad.pdf',
      'application/pdf',
    )

    await expect(extractFromFile(file)).rejects.toThrow(/couldn't extract enough text|password/i)
  })
})

describe('extractFromFile with DOCX', () => {
  it('extracts text from a real DOCX', async () => {
    const file = fileFrom(
      buildDocx(RESUME_LINES),
      'resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const result = await extractFromFile(file)

    expect(result.kind).toBe('docx')
    expect(result.text).toContain('Ada Lovelace')
    expect(result.text).toContain('EXPERIENCE')
    expect(result.text).toContain('Java, Spring Boot, PostgreSQL')
  })

  it('reports a helpful message for a corrupt DOCX', async () => {
    const file = fileFrom(new TextEncoder().encode('not a docx'), 'bad.docx', '')

    await expect(extractFromFile(file)).rejects.toThrow(/couldn't extract enough text|corrupt/i)
  })

  it('reports a helpful message for an empty DOCX', async () => {
    const file = fileFrom(buildDocx([]), 'empty.docx', '')

    await expect(extractFromFile(file)).rejects.toThrow(/couldn't extract enough text/i)
  })
})
