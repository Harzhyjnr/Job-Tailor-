/** Date-range parsing for employment, education and project entries. */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const MONTH_PATTERN = `(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`

const PRESENT_PATTERN = '(?:present|current|now|today|ongoing|date)'

const SEPARATOR = `\\s*(?:-|–|—|to|until|through|thru)\\s*`

/** e.g. "Jan 2020 - Present", "03/2019 to 07/2021", "2019 – 2021". */
const RANGE_PATTERN = new RegExp(
  `(${MONTH_PATTERN}\\.?\\s*'?(?:19|20)\\d{2}|'?(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[/.](?:19|20)?\\d{2})` +
    `${SEPARATOR}` +
    `(${PRESENT_PATTERN}\\.?|'?(?:19|20)\\d{2}|${MONTH_PATTERN}\\.?\\s*'?(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[/.](?:19|20)?\\d{2})`,
  'i',
)

const SINGLE_YEAR_PATTERN = /'?(19|20)\d{2}/

export interface DateRange {
  /** Original text as written, e.g. "Jan 2020 - Present". */
  raw: string
  startDate?: string
  endDate?: string
  isCurrent: boolean
}

function normalizeDate(value: string): string {
  const cleaned = value.replace(/\./g, '').trim()

  const monthYear = cleaned.match(new RegExp(`^(${MONTH_PATTERN})\\s*'?((?:19|20)\\d{2})$`, 'i'))
  if (monthYear) {
    return `${monthYear[1]!.toLowerCase()} ${monthYear[2]}`
  }

  const monthDayYear = cleaned.match(
    new RegExp(`^(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*'?((?:19|20)\\d{2})$`, 'i'),
  )
  if (monthDayYear) {
    return `${monthDayYear[1]!.toLowerCase()} ${monthDayYear[3]}`
  }

  const numeric = cleaned.match(/^(\d{1,2})[/.](\d{2}|\d{4})$/)
  if (numeric) {
    const year = numeric[2]!.length === 2 ? `20${numeric[2]}` : numeric[2]
    return `${monthIndex(numeric[1]!)} ${year}`
  }

  const year = cleaned.match(/^'?((?:19|20)\d{2})$/)
  if (year) return year[1]!

  return cleaned
}

function monthIndex(month: string): string {
  const index = MONTHS.indexOf(month.toLowerCase().slice(0, 3))
  return index === -1 ? month : String(index + 1).padStart(2, '0')
}

/**
 * Parses a date range. Returns undefined when the text contains no
 * year-bearing date at all, so callers can leave the field unset rather than
 * store a guess.
 */
export function parseDateRange(text: string): DateRange | undefined {
  const rangeMatch = text.match(RANGE_PATTERN)
  if (rangeMatch) {
    const end = rangeMatch[2]!
    const isCurrent = new RegExp(`^${PRESENT_PATTERN}\\.?$`, 'i').test(end)
    return {
      raw: rangeMatch[0],
      startDate: normalizeDate(rangeMatch[1]!),
      endDate: isCurrent ? undefined : normalizeDate(end),
      isCurrent,
    }
  }

  const single = text.match(new RegExp(`\\b${MONTH_PATTERN}\\.?\\s*'?(?:19|20)\\d{2}\\b`, 'i'))
  const fallback =
    single?.[0] ??
    (SINGLE_YEAR_PATTERN.test(text) ? text.match(SINGLE_YEAR_PATTERN)![0] : undefined)

  if (!fallback) return undefined

  return { raw: fallback, startDate: normalizeDate(fallback), isCurrent: false }
}

/** Lines that are almost entirely a date range, e.g. "Jan 2020 – Present". */
export function isDateOnlyLine(line: string): boolean {
  const withoutRange = line.replace(RANGE_PATTERN, '').replace(/[()|]/g, '').trim()
  return withoutRange.length === 0 && RANGE_PATTERN.test(line)
}

/** Fractional years from a start to an end date; used for duration labels. */
export function yearsBetween(
  startDate: string | undefined,
  endDate: string | undefined,
): number | undefined {
  if (!startDate) return undefined

  const start = parsePartialDate(startDate)
  if (!start) return undefined

  const today = new Date()
  const parsedEnd = endDate
    ? parsePartialDate(endDate)
    : { year: today.getFullYear(), month: today.getMonth() }
  if (!parsedEnd) return undefined

  const months = (parsedEnd.year - start.year) * 12 + (parsedEnd.month - start.month)
  if (months < 0) return undefined

  return Math.round((months / 12) * 10) / 10
}

function parsePartialDate(value: string): { year: number; month: number } | undefined {
  const named = value.match(new RegExp(`^(${MONTH_PATTERN})\\s+'?((?:19|20)\\d{2})$`, 'i'))
  if (named) {
    return { month: MONTHS.indexOf(named[1]!.toLowerCase().slice(0, 3)), year: Number(named[2]) }
  }

  const numeric = value.match(/^(\d{1,2})[/.](\d{2}|\d{4})$/)
  if (numeric) {
    const year = numeric[2]!.length === 2 ? 2000 + Number(numeric[2]) : Number(numeric[2])
    return { month: Number(numeric[1]) - 1, year }
  }

  const year = value.match(/^'?((?:19|20)\d{2})$/)
  if (year) return { month: 0, year: Number(year[1]) }

  return undefined
}
