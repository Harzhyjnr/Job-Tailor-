import { describe, expect, it } from 'vitest'

import { detectJobSection } from '@/services/jobHeadings'

describe('detectJobSection', () => {
  it('recognizes common section headings', () => {
    expect(detectJobSection('Responsibilities')).toBe('responsibilities')
    expect(detectJobSection('What you will do')).toBe('responsibilities')
    expect(detectJobSection('Key Responsibilities')).toBe('responsibilities')
    expect(detectJobSection('Requirements')).toBe('requirements')
    expect(detectJobSection("What you'll need")).toBe('requirements')
    expect(detectJobSection('Preferred qualifications')).toBe('preferred')
    expect(detectJobSection('Nice to haves')).toBe('preferred')
    expect(detectJobSection('About the role')).toBe('summary')
    expect(detectJobSection('Benefits')).toBe('benefits')
  })

  it('does not treat a requirement or responsibility sentence as a heading', () => {
    expect(detectJobSection('Gather requirements from stakeholders')).toBeUndefined()
    expect(detectJobSection('Experience with Docker and Kubernetes')).toBeUndefined()
    expect(detectJobSection('Mentor engineers and lead code reviews')).toBeUndefined()
  })

  it('normalizes casing, punctuation and hyphenation', () => {
    expect(detectJobSection('PREFERRED SKILLS')).toBe('preferred')
    expect(detectJobSection('Responsibilities:')).toBe('responsibilities')
  })
})
