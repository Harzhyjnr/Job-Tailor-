import { describe, expect, it } from 'vitest'

import {
  extractEmail,
  extractLinkedIn,
  extractLocation,
  extractPhone,
  hasMetric,
  isBullet,
  isHeadingLike,
  normalizeText,
  splitListItems,
  startsWithActionVerb,
  stripBullet,
  termKey,
  toLines,
  truncate,
} from '@/utils/text'

describe('normalizeText', () => {
  it('normalizes line endings and unicode bullets', () => {
    expect(normalizeText('a\r\nb')).toBe('a\nb')
    expect(normalizeText('• one\n• two')).toBe('- one\n- two')
  })

  it('strips zero-width characters and collapses blank runs', () => {
    expect(normalizeText('a\u200bb\n\n\n\n\nc')).toBe('ab\n\nc')
  })
})

describe('toLines', () => {
  it('trims and drops empty lines', () => {
    expect(toLines('  a  \n\n  b\n')).toEqual(['a', 'b'])
  })
})

describe('splitListItems', () => {
  it('splits on commas, semicolons and pipes', () => {
    expect(splitListItems('Java, Spring Boot; PostgreSQL | Docker')).toEqual([
      'Java',
      'Spring Boot',
      'PostgreSQL',
      'Docker',
    ])
  })

  it('removes bullet characters', () => {
    expect(splitListItems('- Java, Kotlin')).toEqual(['Java', 'Kotlin'])
    expect(splitListItems('• Java • Kotlin')).toEqual(['Java', 'Kotlin'])
  })

  it('keeps dashes that are part of a value rather than a separator', () => {
    expect(splitListItems('CI/CD - Jenkins')).toEqual(['CI/CD - Jenkins'])
  })
})

describe('isHeadingLike', () => {
  it('accepts title-case and all-caps headings', () => {
    expect(isHeadingLike('WORK EXPERIENCE')).toBe(true)
    expect(isHeadingLike('Professional Summary')).toBe(true)
    expect(isHeadingLike('Technical Skills & Tools')).toBe(true)
  })

  it('rejects sentences, bullets and long lines', () => {
    expect(isHeadingLike('This is a long sentence of text that goes on and on.')).toBe(false)
    expect(isHeadingLike('- Led migration of the ledger service')).toBe(false)
    expect(
      isHeadingLike('A very long line that definitely exceeds the sixty character limit'),
    ).toBe(false)
    expect(isHeadingLike('Would you like to apply?')).toBe(false)
  })
})

describe('bullets', () => {
  it('detects and strips bullet markers', () => {
    expect(isBullet('- item')).toBe(true)
    expect(isBullet('1. item')).toBe(true)
    expect(isBullet('• item')).toBe(true)
    expect(isBullet('plain text')).toBe(false)

    expect(stripBullet('- item')).toBe('item')
    expect(stripBullet('12. item')).toBe('item')
  })
})

describe('contact extraction', () => {
  it('reads an email address', () => {
    expect(extractEmail('write to Ada.Lovelace+work@example.co.uk now')).toBe(
      'Ada.Lovelace+work@example.co.uk',
    )
  })

  it('reads a phone number', () => {
    expect(extractPhone('+44 20 7946 0958')).toContain('7946')
  })

  it('ignores phone-shaped digits inside urls and date ranges', () => {
    expect(extractPhone('https://example.com/2020-2024-guide')).toBeUndefined()
  })

  it('reads a LinkedIn url', () => {
    expect(extractLinkedIn('see linkedin.com/in/ada-lovelace')).toContain('linkedin.com/in/')
  })

  it('infers a location from the header block', () => {
    const lines = ['Ada Lovelace', 'London, UK', '', 'EXPERIENCE']

    expect(extractLocation(lines)).toBe('London, UK')
  })

  it('finds a location packed onto the contact line', () => {
    const lines = ['Ada Lovelace', 'ada@example.com | +44 20 7946 0958 | London, UK']

    expect(extractLocation(lines)).toBe('London, UK')
  })
})

describe('bullet quality heuristics', () => {
  it('detects action verbs', () => {
    expect(startsWithActionVerb('Led migration of the ledger')).toBe(true)
    expect(startsWithActionVerb('Mentored four engineers')).toBe(true)
    expect(startsWithActionVerb('Responsible for reporting')).toBe(false)
  })

  it('detects metrics', () => {
    expect(hasMetric('cut close time by 40%')).toBe(true)
    expect(hasMetric('saved $1.2M annually')).toBe(true)
    expect(hasMetric('processed 4TB daily')).toBe(true)
    expect(hasMetric('Worked on reporting')).toBe(false)
  })
})

describe('termKey', () => {
  it('normalizes case and punctuation for comparison', () => {
    expect(termKey('Spring Boot!')).toBe('spring boot')
    expect(termKey('C++')).toBe('c++')
    expect(termKey('.NET')).toBe('.net')
  })
})

describe('truncate', () => {
  it('cuts on a word boundary', () => {
    expect(truncate('one two three four', 10)).toBe('one two…')
  })

  it('leaves short text alone', () => {
    expect(truncate('short', 10)).toBe('short')
  })
})
