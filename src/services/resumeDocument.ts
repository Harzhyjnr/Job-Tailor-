import { HELVETICA_CHARSET, helveticaWidth } from '@/services/helveticaWidths'
import { RESUME_SECTION_LABELS } from '@/services/sectionHeadings'
import type { Resume } from '@/types/resume'
import type { UserPreferences } from '@/types/analysis'

/**
 * The resume as a flat list of laid-out lines.
 *
 * The on-screen preview and the exported PDF are two renderers of this one model,
 * not two implementations of the layout. Anything that changes the document — a
 * heading, a join, a bullet — changes both at once, which is the only way the
 * preview can honestly be called a preview of the file.
 *
 * Sizes are in points and are all relative to `BASE_FONT_PT`, so a user who asks
 * for 13pt gets a document that is uniformly larger rather than one that breaks.
 */
export const BASE_FONT_PT = 11
export const LETTER_WIDTH_PT = 612
export const LETTER_HEIGHT_PT = 792

export type LineStyle = 'name' | 'contact' | 'section' | 'entry' | 'meta' | 'body' | 'bullet'

export interface DocumentLine {
  text: string
  style: LineStyle
  /** Extra space above the line, in points. */
  spaceBefore: number
  /** Extra space below the line, in points. */
  spaceAfter: number
  /** Indent from the left margin, in points. */
  indent: number
  /** Draws a hairline under the line, used for section headings. */
  rule: boolean
  /**
   * Keeps the line on the same page as the one after it, so a section heading is
   * never the last thing on a page.
   */
  keepWithNext: boolean
}

export interface LineMetrics {
  fontSize: number
  lineHeight: number
  bold: boolean
}

const METRICS: Record<LineStyle, LineMetrics> = {
  name: { fontSize: 15, lineHeight: 1.2, bold: true },
  contact: { fontSize: 10, lineHeight: 1.3, bold: false },
  section: { fontSize: 11, lineHeight: 1.2, bold: true },
  entry: { fontSize: 11, lineHeight: 1.25, bold: true },
  meta: { fontSize: 10, lineHeight: 1.3, bold: false },
  body: { fontSize: 11, lineHeight: 1.25, bold: false },
  bullet: { fontSize: 11, lineHeight: 1.25, bold: false },
}

export function metricsFor(style: LineStyle, scale = 1): LineMetrics {
  const base = METRICS[style]

  return {
    fontSize: round(base.fontSize * scale),
    lineHeight: base.lineHeight,
    bold: base.bold,
  }
}

export interface LayoutSettings {
  lineHeight: number
  marginPt: number
  scale: number
}

/**
 * The geometry a page is laid out with, taken from the user's preferences and
 * clamped to something readable. Both renderers go through here, so the preview
 * and the file cannot end up with different page setups.
 */
export function resolveLayout(preferences?: Partial<UserPreferences>): LayoutSettings {
  const fontSizePt = finite(preferences?.fontSizePt, BASE_FONT_PT)
  const lineHeight = finite(preferences?.lineHeight, 1.25)
  const marginIn = finite(preferences?.marginIn, 0.5)

  return {
    lineHeight: clamp(lineHeight, 0.9, 2),
    marginPt: clamp(marginIn, 0.25, 1.5) * 72,
    scale: clamp(fontSizePt, 8, 14) / BASE_FONT_PT,
  }
}

/** A line that has been measured, broken into the segments that will be drawn. */
export interface PlacedLine {
  line: DocumentLine
  segments: string[]
  fontSize: number
  bold: boolean
  indentPt: number
  /** Height of one segment, in points. */
  lineBoxPt: number
  spaceBeforePt: number
  spaceAfterPt: number
  /** Distance from the top of the page to the top of this line, in points. */
  topPt: number
  pageIndex: number
  /** True when this line is the first thing on its page. */
  startsPage: boolean
}

export interface PlacedPage {
  index: number
  lines: PlacedLine[]
  /** Distance from the bottom of the page to the last line, in points. */
  remainingPt: number
}

/**
 * Breaks the document into the pages it will actually occupy.
 *
 * This is where the page boundaries are decided, once, for everything: the PDF
 * writer draws the pages returned here, and the preview marks the same breaks, so
 * the break the user sees on screen is the break in the file.
 *
 * Line breaking uses the advance widths of the standard Helvetica faces, which are
 * the same widths Arial has, so a line that fits here fits on the page.
 */
export function paginateDocument(lines: DocumentLine[], settings: LayoutSettings): PlacedLine[] {
  const { lineHeight, marginPt, scale } = settings
  const contentWidth = LETTER_WIDTH_PT - marginPt * 2
  const bottomPt = LETTER_HEIGHT_PT - marginPt
  const placed: PlacedLine[] = []

  let pageIndex = 0
  let cursor = marginPt

  lines.forEach((line, index) => {
    const metrics = metricsFor(line.style, scale)
    const indentPt = line.indent * scale
    const lineBoxPt = metrics.fontSize * metrics.lineHeight * lineHeight
    const spaceBeforePt = line.spaceBefore * scale
    const content = printable(line.style === 'bullet' ? `• ${line.text}` : line.text)
    const segments = wrapToWidth(content, contentWidth - indentPt, metrics)
    const needed = spaceBeforePt + segments.length * lineBoxPt

    const isHeading = line.keepWithNext || line.rule
    const follow = lines[index + 1]

    // A line that does not fit moves to the next page whole; nothing is split
    // across a break, so no reader ever finds half a bullet.
    if (cursor + needed > bottomPt && placed.length > 0) {
      pageIndex += 1
      cursor = marginPt
    }

    // A heading that only just fits is still an orphan waiting to happen, so it
    // moves down with the first line of its section. Only worth doing when the
    // heading is not already at the top of a page.
    if (isHeading && follow && cursor > marginPt) {
      const followMetrics = metricsFor(follow.style, scale)
      const followSegments = wrapToWidth(
        printable(follow.style === 'bullet' ? `• ${follow.text}` : follow.text),
        contentWidth - follow.indent * scale,
        followMetrics,
      )
      const followNeeded =
        follow.spaceBefore * scale +
        followSegments.length * followMetrics.fontSize * followMetrics.lineHeight * lineHeight

      if (cursor + needed + followNeeded > bottomPt) {
        pageIndex += 1
        cursor = marginPt
      }
    }

    const topPt = cursor + spaceBeforePt
    const startsPage = placed.at(-1)?.pageIndex !== pageIndex

    placed.push({
      line,
      segments,
      fontSize: metrics.fontSize,
      bold: metrics.bold,
      indentPt,
      lineBoxPt,
      spaceBeforePt,
      spaceAfterPt: line.spaceAfter * scale,
      topPt,
      pageIndex,
      startsPage,
    })

    cursor = topPt + segments.length * lineBoxPt + line.spaceAfter * scale
  })

  return placed
}

/** Groups placed lines into the pages they were laid out on. */
export function groupIntoPages(placed: PlacedLine[], settings: LayoutSettings): PlacedPage[] {
  const pages: PlacedPage[] = []

  placed.forEach((item) => {
    const page = pages[item.pageIndex]

    if (!page) {
      pages[item.pageIndex] = {
        index: item.pageIndex,
        lines: [item],
        remainingPt: LETTER_HEIGHT_PT - settings.marginPt - item.topPt,
      }

      return
    }

    page.lines.push(item)
    page.remainingPt = LETTER_HEIGHT_PT - settings.marginPt - item.topPt
  })

  return pages.filter(Boolean)
}

/**
 * WinAnsi, the encoding the standard PDF fonts use, covers Latin-1 and the
 * typographic punctuation block, but not arrows, emoji, or the C1 control range.
 * Rather than failing the export, an unrepresentable character is dropped and the
 * words around it are kept, so the sentence still reads.
 *
 * This runs before the text is measured, not after, because the line the reader
 * sees is the line that was measured: filtering at either end of the layout would
 * let the preview and the file disagree about where a line ends.
 */
export function printable(value: string) {
  return [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0

      return code === 9 || code === 10 || ENCODABLE.has(character)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

const ENCODABLE = new Set(HELVETICA_CHARSET)

export function pageCountOf(lines: DocumentLine[], settings: LayoutSettings) {
  return (paginateDocument(lines, settings).at(-1)?.pageIndex ?? 0) + 1
}

/** Breaks text on spaces so that every segment fits the given width. */
function wrapToWidth(text: string, maxWidth: number, metrics: LineMetrics) {
  if (maxWidth <= 0) {
    return [text]
  }

  const words = text.split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return ['']
  }

  const segments: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (!current || helveticaWidth(candidate, metrics.fontSize, metrics.bold) <= maxWidth) {
      current = candidate

      continue
    }

    segments.push(current)
    current = word
  }

  segments.push(current)

  return segments
}

export function buildResumeDocument(resume: Resume): DocumentLine[] {
  const lines: DocumentLine[] = []

  const push = (
    text: string,
    style: LineStyle,
    options: Partial<Omit<DocumentLine, 'text' | 'style'>> = {},
  ) => {
    const value = text.trim()

    if (!value) {
      return
    }

    lines.push({
      text: value,
      style,
      spaceBefore: 0,
      spaceAfter: 0,
      indent: 0,
      rule: false,
      keepWithNext: false,
      ...options,
    })
  }

  const heading = (title: string) =>
    push(title.toUpperCase(), 'section', {
      spaceBefore: 10,
      spaceAfter: 4,
      rule: true,
      keepWithNext: true,
    })

  const bullets = (items: string[], indent = 14) => {
    items.forEach((item) => push(item, 'bullet', { indent, spaceAfter: 1 }))
  }

  if (resume.personalInfo.name) {
    push(resume.personalInfo.name, 'name', { spaceAfter: 2 })
  }

  const contact = joinUnique([
    resume.personalInfo.location,
    resume.personalInfo.phone,
    resume.personalInfo.email,
    resume.personalInfo.linkedin,
    resume.personalInfo.portfolio,
  ])
  if (contact) {
    push(contact, 'contact', { spaceAfter: 2 })
  }

  if (resume.summary) {
    heading(RESUME_SECTION_LABELS.summary)
    push(resume.summary, 'body')
  }

  if (resume.experience.length > 0) {
    heading(RESUME_SECTION_LABELS.experience)
    resume.experience.forEach((experience, index) => {
      push(joinParts([experience.title, experience.company]), 'entry', {
        spaceBefore: index > 0 ? 6 : 0,
        spaceAfter: 1,
        keepWithNext: true,
      })
      push(
        joinParts([
          experience.dateRange,
          experience.location,
          experience.employmentType !== 'unknown' ? humanize(experience.employmentType) : undefined,
        ]),
        'meta',
        { spaceAfter: 1 },
      )
      bullets([...experience.achievements, ...experience.responsibilities])
    })
  }

  if (resume.education.length > 0) {
    heading(RESUME_SECTION_LABELS.education)
    resume.education.forEach((education) => {
      push(joinParts([education.degree, education.field, education.institution]), 'entry', {
        spaceAfter: 1,
        keepWithNext: true,
      })
      if (education.dateRange) {
        push(education.dateRange, 'meta', { spaceAfter: 1 })
      }
      bullets(education.details)
    })
  }

  if (resume.skills.length > 0) {
    heading(RESUME_SECTION_LABELS.skills)
    push(resume.skills.map((skill) => skill.name).join(', '), 'body')
  }

  if (resume.certifications.length > 0) {
    heading(RESUME_SECTION_LABELS.certifications)
    bullets(
      resume.certifications.map((certification) =>
        joinUnique([certification.name, certification.issuer, certification.date]),
      ),
    )
  }

  if (resume.projects.length > 0) {
    heading(RESUME_SECTION_LABELS.projects)
    resume.projects.forEach((project) => {
      push(joinUnique([project.name, project.tech.join(', ') || undefined]), 'entry', {
        spaceAfter: 1,
        keepWithNext: true,
      })
      if (project.description && project.description !== project.name) {
        push(project.description, 'body')
      }
      if (project.url && !project.name.includes(project.url)) {
        push(project.url, 'meta')
      }
    })
  }

  if (resume.awards.length > 0) {
    heading(RESUME_SECTION_LABELS.awards)
    bullets(resume.awards.map((award) => joinUnique([award.title, award.issuer, award.date])))
  }

  if (resume.languages.length > 0) {
    heading(RESUME_SECTION_LABELS.languages)
    push(resume.languages.map(formatLanguage).join(', '), 'body')
  }

  return lines
}

function joinParts(parts: (string | undefined)[]) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' | ')
}

/**
 * Joins the parts of one line, skipping any part the earlier ones already spell
 * out. The parser stores a whole certification line in `name` more often than not,
 * and repeating the issuer and date would read as a mistake on the page.
 */
function joinUnique(parts: (string | undefined)[]) {
  const kept: string[] = []

  for (const part of parts) {
    const value = part?.trim()
    if (!value) {
      continue
    }

    const repeated = kept.some(
      (existing) =>
        existing.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(existing.toLowerCase()),
    )

    if (!repeated) {
      kept.push(value)
    }
  }

  return kept.join(' | ')
}

function formatLanguage(language: Resume['languages'][number]) {
  const proficiency = language.proficiency?.replace(/[()]/g, '').trim()
  return proficiency ? `${language.name} (${proficiency})` : language.name
}

function humanize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * An absent, malformed or non-numeric preference falls back to the default rather
 * than to the edge of the allowed range: a blank number field in the export form
 * should leave the document alone, not silently shrink it to 8pt.
 */
function finite(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
