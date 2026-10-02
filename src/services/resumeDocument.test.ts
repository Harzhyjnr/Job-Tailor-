import { describe, expect, it } from 'vitest'

import { BASE_FONT_PT, buildResumeDocument, metricsFor } from '@/services/resumeDocument'
import { parseResume } from '@/services/resumeParser'
import fullResume from '@/test/fixtures/resume-full.txt?raw'
import type { Resume } from '@/types/resume'

const { resume } = parseResume(fullResume)

const texts = (document: Resume) => buildResumeDocument(document).map((line) => line.text)

describe('buildResumeDocument', () => {
  it('produces the document in reading order', () => {
    const lines = texts(resume)

    expect(lines[0]).toBe('Ada Lovelace')
    expect(lines.indexOf('SUMMARY')).toBeLessThan(lines.indexOf('EXPERIENCE'))
    expect(lines.indexOf('EXPERIENCE')).toBeLessThan(lines.indexOf('EDUCATION'))
    expect(lines.indexOf('EDUCATION')).toBeLessThan(lines.indexOf('SKILLS'))
    expect(lines[lines.length - 1]).toContain('English (native)')
  })

  it('keeps achievements ahead of responsibilities inside a role', () => {
    const lines = texts(resume)
    const roleStart = lines.indexOf('Senior Backend Engineer | Meridian Payments')

    expect(lines[roleStart + 1]).toBe('Jan 2020 - Present')
    expect(lines[roleStart + 2]).toContain('Led migration')
    expect(lines[roleStart + 3]).toContain('Designed REST APIs')
  })

  it('marks a section heading so a renderer can keep it with its first line', () => {
    const heading = buildResumeDocument(resume).find((line) => line.text === 'EXPERIENCE')

    expect(heading?.rule).toBe(true)
    expect(heading?.keepWithNext).toBe(true)
  })

  it('leaves a gap between roles but not between the first role and the page', () => {
    const lines = buildResumeDocument(resume)
    const first = lines.find((line) => line.text === 'Senior Backend Engineer | Meridian Payments')
    const second = lines.find((line) => line.text === 'Backend Engineer | Northwind Systems')

    expect(first?.spaceBefore).toBe(0)
    expect(second?.spaceBefore).toBeGreaterThan(0)
  })

  it('scales every size with the user preference, keeping the relationships', () => {
    const normal = metricsFor('name')
    const large = metricsFor('name', 1.5)

    expect(normal.fontSize).toBeGreaterThan(normal.fontSize / 1.5)
    expect(large.fontSize / normal.fontSize).toBeCloseTo(1.5, 5)
    expect(metricsFor('body', 1).fontSize).toBe(BASE_FONT_PT)
  })

  it('never emits a blank line, so a renderer cannot draw one', () => {
    expect(texts(resume).every((line) => line.length > 0)).toBe(true)
  })

  it('drops sections that have nothing in them', () => {
    const sparse: Resume = { ...resume, summary: '', skills: [], awards: [] }

    expect(texts(sparse)).not.toContain('SUMMARY')
    expect(texts(sparse)).not.toContain('SKILLS')
    expect(texts(sparse)).not.toContain('AWARDS')
  })
})
