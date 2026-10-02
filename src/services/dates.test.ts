import { describe, expect, it } from 'vitest'

import { isDateOnlyLine, parseDateRange, yearsBetween } from '@/services/dates'

describe('parseDateRange', () => {
  it('parses a month-year range ending in the present', () => {
    const result = parseDateRange('Senior Engineer, Acme    Jan 2020 - Present')

    expect(result).toEqual({
      raw: 'Jan 2020 - Present',
      startDate: 'jan 2020',
      endDate: undefined,
      isCurrent: true,
    })
  })

  it('parses a closed range', () => {
    const result = parseDateRange('Mar 2017 – Dec 2019')

    expect(result?.startDate).toBe('mar 2017')
    expect(result?.endDate).toBe('dec 2019')
    expect(result?.isCurrent).toBe(false)
  })

  it('parses year-only ranges', () => {
    const result = parseDateRange('2019 - 2021')

    expect(result?.startDate).toBe('2019')
    expect(result?.endDate).toBe('2021')
  })

  it('parses numeric month/year ranges', () => {
    const result = parseDateRange('03/2019 to 07/2021')

    expect(result?.startDate).toBe('03 2019')
    expect(result?.endDate).toBe('07 2021')
  })

  it('parses abbreviated "to" and "until" separators', () => {
    expect(parseDateRange('Jun 2018 until Current')?.isCurrent).toBe(true)
    expect(parseDateRange('June 2018 to Sep 2020')?.endDate).toBe('sep 2020')
  })

  it('returns undefined when there is no date at all', () => {
    expect(parseDateRange('Led the migration of the ledger service')).toBeUndefined()
  })
})

describe('isDateOnlyLine', () => {
  it('detects lines that are only a date range', () => {
    expect(isDateOnlyLine('Jan 2020 - Present')).toBe(true)
    expect(isDateOnlyLine('(2019 - 2021)')).toBe(true)
  })

  it('rejects lines with other content', () => {
    expect(isDateOnlyLine('Engineer, Acme | Jan 2020 - Present')).toBe(false)
  })
})

describe('yearsBetween', () => {
  it('computes a duration in years', () => {
    expect(yearsBetween('jan 2020', 'jan 2024')).toBe(4)
    expect(yearsBetween('jan 2020', 'jul 2021')).toBeCloseTo(1.5)
  })

  it('returns undefined without a start date', () => {
    expect(yearsBetween(undefined, 'jan 2024')).toBeUndefined()
  })
})
