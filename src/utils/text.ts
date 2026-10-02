import { detectSection } from '@/services/sectionHeadings'

/** Text helpers shared by the parser, the job analyzer and the tailoring engine. */

/** Collapses runs of whitespace (including non-breaking spaces) into single spaces. */
export function normalizeWhitespace(value: string): string {
  return value
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes line endings, strips zero-width characters, removes trailing
 * whitespace and drops runs of more than two blank lines. Bullets are
 * normalized to "- " so PDFs and DOCX exports agree on list syntax.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/[\u2022\u25cf\u25aa\u2027\u2043\u2219]/g, '-')
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function toLines(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** Splits a line on the separators resumes commonly use for inline lists. */
export function splitListItems(line: string): string[] {
  return line
    .split(/\s*(?:,|;|\||\u2022|\u00b7|•|·)\s*/)
    .map((item) => normalizeWhitespace(item.replace(/^[-–—]\s*/, '')))
    .filter((item) => item.length > 0)
}

/**
 * Heuristic heading test: short, title-ish, no trailing period, no sentence
 * punctuation. Deliberately conservative so bullet text is never mistaken for a
 * section heading.
 */
export function isHeadingLike(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 60) return false
  if (/[,;!?]$/.test(trimmed)) return false
  if (/[.]{2,}/.test(trimmed)) return false
  if (/^\d+\s*$/.test(trimmed)) return false

  const words = trimmed.split(/\s+/)
  if (words.length > 6) return false

  const capitalized = words.filter((word) => /^[A-Z]/.test(word)).length
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)

  return isAllCaps || capitalized >= Math.ceil(words.length * 0.6)
}

/** Bullet detection covering "-", "*", digits and the bullet glyphs PDF/DOCX produce. */
const BULLET_PREFIX = /^\s*(?:[-*\u2013\u2022\u00b7\u25aa]|\d{1,2}[.)])\s+/

export function stripBullet(line: string): string {
  return line.replace(BULLET_PREFIX, '').trim()
}

export function isBullet(line: string): boolean {
  return BULLET_PREFIX.test(line)
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s,;)]+/i
const LINKEDIN_PATTERN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s,;)]+/i

export const PATTERNS = {
  email: EMAIL_PATTERN,
  url: URL_PATTERN,
  linkedin: LINKEDIN_PATTERN,
} as const

export function extractEmail(text: string): string | undefined {
  return text.match(EMAIL_PATTERN)?.[0]
}

/** Candidate runs that look like they could be a phone number. */
const PHONE_CANDIDATE = /(?:\+?\d[\d\s().-]{5,}\d)/g

/**
 * Returns the first credible phone number in the text.
 *
 * International formatting varies too much for one regular expression to be
 * reliable, so candidates are found loosely and then validated on digit count.
 * Date ranges and URL paths are rejected so "2019 - 2021" is never read as a
 * phone number.
 */
export function extractPhone(text: string): string | undefined {
  for (const line of toLines(text)) {
    if (URL_PATTERN.test(line) || LINKEDIN_PATTERN.test(line)) continue

    for (const candidate of line.match(PHONE_CANDIDATE) ?? []) {
      const digits = candidate.replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15) continue
      // A bare year range reads as 8 digits but contains no phone structure.
      if (/^\d{4}\s*[-–—to]+\s*\d{4}$/i.test(candidate.trim())) continue

      return candidate.trim()
    }
  }

  return undefined
}

export function extractLinks(text: string): string[] {
  const matches = text.match(new RegExp(URL_PATTERN.source, 'gi')) ?? []
  return Array.from(new Set(matches.map((link) => link.replace(/[.,;]$/, ''))))
}

export function extractLinkedIn(text: string): string | undefined {
  return text.match(LINKEDIN_PATTERN)?.[0]
}

/**
 * Location is inferred from the contact block: a line that is neither a
 * heading, a link nor contact-detail shaped, and contains a comma or is a short
 * place-like phrase.
 */
/**
 * Location is inferred from the contact block, where it is often packed onto the
 * same line as the email and phone number: "ada@example.com | +44 20 7946 0958
 * | London, UK". Each separator-delimited segment is considered separately.
 */
export function extractLocation(lines: string[]): string | undefined {
  // Commas are never separators here: "London, UK" is a single location.
  const segments = lines.flatMap((line) =>
    line
      .split(/\s*[|•\u2022\u00b7]\s*/)
      .map((part) => normalizeWhitespace(part))
      .filter((part) => part.length > 0),
  )

  for (const segment of segments) {
    if (detectSection(segment) !== undefined) continue
    if (extractEmail(segment) !== undefined) continue
    if (extractPhone(segment) !== undefined) continue
    if (PATTERNS.url.test(segment) || PATTERNS.linkedin.test(segment)) continue
    if (/^\+?\d/.test(segment)) continue
    if (isBullet(segment)) continue
    if (segment.split(/\s+/).length > 5) continue
    if (!/[A-Za-z]{3}/.test(segment)) continue

    const hasComma = segment.includes(',')
    if (!hasComma && !/^[\p{Lu}][\p{L}'.\- ]*$/u.test(segment)) continue
    if (!hasComma && isHeadingLike(segment)) continue

    return segment.replace(/[,;]+$/, '')
  }

  return undefined
}

const ACTION_VERBS = new Set([
  'achieved',
  'architected',
  'automated',
  'built',
  'collaborated',
  'conducted',
  'created',
  'cut',
  'delivered',
  'designed',
  'developed',
  'drove',
  'eliminated',
  'enabled',
  'established',
  'executed',
  'expanded',
  'generated',
  'grew',
  'implemented',
  'improved',
  'increased',
  'introduced',
  'launched',
  'led',
  'maintained',
  'managed',
  'mentored',
  'migrated',
  'optimized',
  'orchestrated',
  'owned',
  'performed',
  'pioneered',
  'planned',
  'produced',
  'reduced',
  'refactored',
  'resolved',
  'restructured',
  'revamped',
  'scaled',
  'shipped',
  'simplified',
  'spearheaded',
  'standardized',
  'streamlined',
  'supported',
  'trained',
  'transformed',
  'upgraded',
  'wrote',
  'architected',
  'benchmarked',
  'consolidated',
  'containerized',
  'debugged',
  'deployed',
  'diagnosed',
  'documented',
  'expedited',
  'hardened',
  'identified',
  'instrumented',
  'integrated',
  'investigated',
  'mapped',
  'measured',
  'modernized',
  'monitored',
  'negotiated',
  'operated',
  'prioritized',
  'published',
  'replaced',
  'retired',
  'rewrote',
  'secured',
  'stabilized',
  'tested',
  'traced',
  'tuned',
  'unified',
  'validated',
  'visualized',
  'accelerated',
  'cutting',
  'reducing',
  'improving',
  'growing',
  'saving',
  'delivering',
  'achieving',
  'maintaining',
  'managing',
  'leading',
  'building',
  'developing',
  'designing',
  'creating',
  'scaling',
  'mentoring',
  'supporting',
  'owning',
  'driving',
  'launching',
  'spearheading',
  'implementing',
  'automating',
  'handling',
])

export function isActionVerb(word: string): boolean {
  return ACTION_VERBS.has(word.toLowerCase().replace(/[^a-z]/g, ''))
}

export function startsWithActionVerb(text: string): boolean {
  const first = stripBullet(text).split(/\s+/)[0]
  if (!first) return false
  return isActionVerb(first)
}

/**
 * Quantitative signal: currency, percentages, magnitudes (2M, 4TB) or any
 * multi-digit count. Used to judge whether a bullet states a measurable result.
 */
const METRIC_PATTERN =
  /(?:[$€£]\s?\d[\d,.]*|\b\d+(?:[.,]\d+)?\s?%|\b\d[\d,.]*\s?(?:k|m|bn|b|tb|gb|mb|kb)\b|\b\d{2,}\b)/i

export function hasMetric(text: string): boolean {
  return METRIC_PATTERN.test(text)
}

/**
 * Outcome verbs in both past and present participle form: resumes state results
 * with either ("cut close time" and "cutting close time" are equally common).
 * A bullet that matches is describing a result rather than a duty.
 */
const OUTCOME_PATTERN =
  /\b(increas\w+|reduc\w+|cut\w*|cutting|improv\w+|grew|grow\w+|sav\w+|generat\w+|deliver\w+|achiev\w+|result\w*|led to|led |spearhead\w*|boost\w+|accelerat\w+|decreas\w+|optimi[sz]\w+|halv\w+|lower\w+|rais\w+|doubl\w+|tripl\w+|shrink\w+|trim\w+|streamlin\w+|elimin\w+|resolv\w+|prevent\w+|avoid\w+|consolidat\w+|moderni[sz]\w+|automat\w+|speed\w*)\b/i

export function looksLikeOutcome(text: string): boolean {
  return OUTCOME_PATTERN.test(text)
}

/** Lowercase alphanumeric key used for case-insensitive keyword comparisons. */
export function termKey(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 1)
}

/** Truncates on a word boundary for preview snippets. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}
