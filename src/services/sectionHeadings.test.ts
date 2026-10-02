import { describe, expect, it } from 'vitest'

import { detectSection, looksLikeName } from '@/services/sectionHeadings'

describe('detectSection', () => {
  it('matches canonical headings', () => {
    expect(detectSection('Experience')).toBe('experience')
    expect(detectSection('Education')).toBe('education')
    expect(detectSection('Skills')).toBe('skills')
  })

  it('matches all-caps and mixed-case headings', () => {
    expect(detectSection('WORK EXPERIENCE')).toBe('experience')
    expect(detectSection('Professional Summary')).toBe('summary')
    expect(detectSection('professional summary')).toBe('summary')
  })

  it('matches alternate wording', () => {
    expect(detectSection('Profile')).toBe('summary')
    expect(detectSection('Employment History')).toBe('experience')
    expect(detectSection('Core Competencies')).toBe('skills')
    expect(detectSection('Certifications')).toBe('certifications')
    expect(detectSection('Honors')).toBe('awards')
    expect(detectSection('Languages')).toBe('languages')
    expect(detectSection('Selected Projects')).toBe('projects')
  })

  it('matches compound headings that contain a known term', () => {
    expect(detectSection('Technical Skills & Tools')).toBe('skills')
    expect(detectSection('Education and Qualifications')).toBe('education')
  })

  it('ignores separators and punctuation', () => {
    expect(detectSection('WORK-EXPERIENCE')).toBe('experience')
    expect(detectSection('Work Experience')).toBe('experience')
    expect(detectSection('SKILLS / TOOLS')).toBe('skills')
  })

  it('returns undefined for non-headings', () => {
    expect(
      detectSection('Led the migration of the core ledger service to PostgreSQL'),
    ).toBeUndefined()
    expect(detectSection('')).toBeUndefined()
  })
})

describe('looksLikeName', () => {
  it('accepts a first-line person name', () => {
    expect(looksLikeName('Ada Lovelace', true)).toBe(true)
    expect(looksLikeName('Grace Okafor', true)).toBe(true)
    expect(looksLikeName('Alan Mathison Turing', true)).toBe(true)
  })

  it('rejects titles and role names', () => {
    expect(looksLikeName('Senior Software Engineer', true)).toBe(false)
    expect(looksLikeName('Resume', true)).toBe(false)
  })

  it('rejects lines that are not first', () => {
    expect(looksLikeName('Ada Lovelace', false)).toBe(false)
  })

  it('rejects lines with contact details or digits', () => {
    expect(looksLikeName('Ada Lovelace ada@example.com', true)).toBe(false)
    expect(looksLikeName('Engineer 2019', true)).toBe(false)
  })
})
