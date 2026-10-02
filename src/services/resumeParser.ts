import { ALL_SECTION_KEYS, detectSection, looksLikeName } from '@/services/sectionHeadings'
import { isDateOnlyLine, parseDateRange } from '@/services/dates'
import { extractSkillCandidates } from '@/services/techTerms'
import type {
  Award,
  Certification,
  Education,
  Experience,
  Language,
  PersonalInfo,
  Project,
  Resume,
  ResumeSectionKey,
  Skill,
} from '@/types/resume'
import {
  PATTERNS,
  extractEmail,
  extractLinkedIn,
  extractLocation,
  extractPhone,
  isBullet,
  isHeadingLike,
  looksLikeOutcome,
  normalizeText,
  splitListItems,
  stripBullet,
  toLines,
  truncate,
} from '@/utils/text'

/** Stable, readable ids so UI keys and evidence references survive re-parses. */
function makeId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`
}

interface SectionBlock {
  key: ResumeSectionKey
  lines: string[]
}

export interface ParseResult {
  resume: Resume
  /** Sections present in the text that produced no structured entries. */
  warnings: string[]
}

/**
 * Parses raw resume text into the normalized Resume model.
 *
 * Rules that shape this parser:
 * - The original text is always preserved on `rawText` and on every entry.
 * - Nothing is inferred that is not present in the text. A field stays undefined
 *   when it cannot be read with confidence.
 * - A section that is absent produces an empty array and is reported in
 *   `missingSections`, never faked with placeholder content.
 */
export function parseResume(rawInput: string): ParseResult {
  const rawText = normalizeText(rawInput)
  const lines = toLines(rawText)
  const warnings: string[] = []

  if (lines.length === 0) {
    return {
      resume: emptyResume(rawText),
      warnings: ['No readable text was found in the resume.'],
    }
  }

  const { headerLines, blocks, detected } = segment(rawText)

  const resume: Resume = {
    ...emptyResume(rawText),
    personalInfo: parsePersonalInfo(headerLines),
    detectedSections: detected,
    missingSections: ALL_SECTION_KEYS.filter((key) => !detected.includes(key)),
  }

  resume.summary = parseSummary(blocks)
  resume.experience = parseExperience(blocks, warnings)
  resume.education = parseEducation(blocks)
  resume.skills = parseSkills(blocks, resume)
  resume.certifications = parseCertifications(blocks)
  resume.projects = parseProjects(blocks)
  resume.awards = parseAwards(blocks)
  resume.languages = parseLanguages(blocks)

  if (resume.experience.length === 0 && detected.includes('experience')) {
    warnings.push('An Experience section was found but no entries could be read from it.')
  }

  return { resume, warnings }
}

function emptyResume(rawText: string): Resume {
  return {
    personalInfo: {},
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    awards: [],
    languages: [],
    detectedSections: [],
    missingSections: [...ALL_SECTION_KEYS],
    rawText,
  }
}

/**
 * Splits the text into a header block plus one block per detected section.
 *
 * Blank lines are kept inside section blocks because they are the only reliable
 * boundary between two roles or degrees in a single-column resume.
 */
function segment(rawText: string): {
  headerLines: string[]
  blocks: SectionBlock[]
  detected: ResumeSectionKey[]
} {
  const lines = normalizeText(rawText).split('\n')
  const blocks: SectionBlock[] = []
  const detected: ResumeSectionKey[] = []
  const headerLines: string[] = []

  let current: SectionBlock | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    const section =
      trimmed.length > 0 && isHeadingLike(trimmed) ? detectSection(trimmed) : undefined

    if (section) {
      // A section cannot legitimately appear twice; the first block wins and the
      // remainder is appended to it.
      if (current && current.key === section) {
        current.lines.push(line)
        continue
      }

      if (current) blocks.push(current)
      current = { key: section, lines: [] }
      if (!detected.includes(section)) detected.push(section)
      continue
    }

    if (current) {
      current.lines.push(line)
    } else if (line.trim().length > 0) {
      headerLines.push(line)
    }
  }

  if (current) blocks.push(current)

  return { headerLines, blocks, detected }
}

function parsePersonalInfo(headerLines: string[]): PersonalInfo {
  const headerText = headerLines.join('\n')
  const email = extractEmail(headerText)
  const phone = extractPhone(headerText)
  const linkedin = extractLinkedIn(headerText)
  const links = headerText.match(new RegExp(PATTERNS.url.source, 'gi')) ?? []

  const location = extractLocation(headerLines)

  const name = headerLines.find((line, index) => looksLikeName(line, index === 0))

  const portfolio = links
    .map((link) => link.replace(/[.,;]$/, ''))
    .find((link) => !link.toLowerCase().includes('linkedin.com'))

  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(location ? { location } : {}),
    ...(linkedin ? { linkedin } : {}),
    ...(portfolio ? { portfolio } : {}),
  }
}

function parseSummary(blocks: SectionBlock[]): string | undefined {
  const summary = blocks.find((block) => block.key === 'summary')
  if (!summary || summary.lines.length === 0) return undefined

  const text = summary.lines.map((line) => stripBullet(line)).join(' ')
  return text.length > 0 ? text : undefined
}

function parseExperience(blocks: SectionBlock[], warnings: string[]): Experience[] {
  const block = blocks.find((entry) => entry.key === 'experience')
  if (!block) return []

  const groups = groupEntries(block.lines)
  const entries: Experience[] = []

  for (const [index, group] of groups.entries()) {
    const entry: Experience = {
      id: makeId('exp', index),
      employmentType: 'unknown',
      isCurrent: false,
      responsibilities: [],
      achievements: [],
      rawText: group.join('\n'),
    }

    const headerLines = group.filter((line) => isBullet(line) === false).slice(0, 3)
    const bulletLines = group.filter((line) => isBullet(line))
    const payloadLines =
      bulletLines.length > 0 ? bulletLines : group.filter((line) => line !== headerLines[0])

    for (const line of headerLines) {
      // A single line can carry both the role and its dates, as in
      // "Data Engineer | Acme (2019 - Present)", so both are read independently.
      if (entry.dateRange === undefined) {
        const dates = parseDateRange(line)
        if (dates) {
          entry.dateRange = dates.raw
          entry.startDate = dates.startDate
          entry.endDate = dates.endDate
          entry.isCurrent = dates.isCurrent
        }
      }

      if (!entry.title && !entry.company) {
        const roles = parseTitleAndCompany(line)
        if (roles.title) entry.title = roles.title
        if (roles.company) entry.company = roles.company
        if (roles.location) entry.location = roles.location
      }
    }

    const type = detectEmploymentType(group)
    if (type) entry.employmentType = type

    for (const line of payloadLines) {
      const text = stripBullet(line)
      if (!text) continue
      // Responsibilities and outcomes stay separate so the tailoring engine can
      // reorder them without implying either one is the other.
      if (looksLikeOutcome(text)) {
        entry.achievements.push(text)
      } else {
        entry.responsibilities.push(text)
      }
    }

    entries.push(entry)
  }

  if (entries.length === 0 && block.lines.length > 0) {
    warnings.push('The Experience section could not be split into individual roles.')
  }

  return entries
}

const ROLE_SEPARATOR = /\s+(?:\||@|·|•|\u2013|\u2014|at|@)\s+|\s*[,\u2013\u2014]\s+/

function parseTitleAndCompany(line: string): {
  title?: string
  company?: string
  location?: string
} {
  const cleaned = line.replace(/\s+/g, ' ').trim()
  if (!cleaned || isDateOnlyLine(cleaned)) return {}

  // "Data Engineer | Acme (2019 - Present)" carries dates, not a location; both
  // are stripped from the name text but only a real location is reported.
  const trailingParen = cleaned.match(/\s*(?:\(|\[)([^)\]]{2,40})[)\]]\s*$/)
  const parenValue = trailingParen?.[1]?.trim()
  const isDateParen = parenValue !== undefined && parseDateRange(parenValue) !== undefined
  const location = parenValue !== undefined && !isDateParen ? parenValue : undefined

  const withoutLocation =
    parenValue !== undefined ? cleaned.replace(/\s*(?:\(|\[)[^)\]]{2,40}[)\]]\s*$/, '') : cleaned
  const parts = withoutLocation
    .split(ROLE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    const [first, second] = parts as [string, string]
    // "Senior Engineer, Acme" reads more naturally as title-then-company, and
    // "Acme, Senior Engineer" is rarer in practice, so first wins as the title.
    return {
      title: first,
      company: second,
      ...(location ? { location } : {}),
    }
  }

  const single = parts[0]
  if (!single) return {}

  const atSign = single.match(/^(.*?)\s+@\s+(.*)$/)
  if (atSign) {
    return {
      title: atSign[1]!.trim(),
      company: atSign[2]!.trim(),
      ...(location ? { location } : {}),
    }
  }

  return { title: single, ...(location ? { location } : {}) }
}

function detectEmploymentType(lines: string[]): Experience['employmentType'] | undefined {
  const text = lines.join(' ').toLowerCase()

  if (/\b(intern|internship|summer analyst|co-op)\b/.test(text)) return 'internship'
  if (/\b(part[- ]time)\b/.test(text)) return 'part-time'
  if (/\b(contract|contractor|freelance)\b/.test(text)) return 'contract'
  if (/\b(volunteer|volunteered)\b/.test(text)) return 'volunteer'
  if (/\b(full[- ]time|permanent)\b/.test(text)) return 'full-time'

  return undefined
}

/**
 * Splits a section into entries.
 *
 * Blank lines are the primary boundary because that is how single-column
 * resumes separate two roles. Some layouts remove them, so a standalone
 * date-only line also starts a new entry, as does a header-shaped line that
 * follows a bullet block.
 */
function groupEntries(lines: string[]): string[][] {
  const paragraphs: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (current.length > 0) paragraphs.push(current)
      current = []
      continue
    }
    current.push(line)
  }
  if (current.length > 0) paragraphs.push(current)

  const groups: string[][] = []

  for (const paragraph of paragraphs) {
    let entry: string[] = []

    for (const line of paragraph) {
      // A date line closes the previous role, but only once that role looks
      // complete: a title followed by its own dates must not split in two.
      const startsNewEntry =
        isDateOnlyLine(line) &&
        (entry.some((value) => isBullet(value)) ||
          entry.some((value) => parseDateRange(value) !== undefined))

      if (startsNewEntry) {
        groups.push(entry)
        entry = [line]
        continue
      }

      entry.push(line)

      const previousHasBullets = entry.slice(0, -1).some((value) => isBullet(value))
      if (
        previousHasBullets &&
        !isBullet(line) &&
        !isDateOnlyLine(line) &&
        looksLikeHeaderLine(line)
      ) {
        groups.push(entry)
        entry = []
      }
    }

    if (entry.length > 0) groups.push(entry)
  }

  return groups.filter((group) => group.some((line) => stripBullet(line).length > 0))
}

function looksLikeHeaderLine(line: string): boolean {
  const hasDates = parseDateRange(line) !== undefined
  const separatorCount = (line.match(/[|,\u2013\u2014]|\s+at\s+|\s+-\s+/g) ?? []).length
  return hasDates || separatorCount > 0
}

/**
 * Degree markers, longest spellings first so "BSc" is preferred over "BS" and a
 * bare "B" is never matched inside an unrelated word.
 */
const DEGREE_MARKER =
  /\b(?:b\.?sc|b\.?tech|b\.?s\.?c?\.?|b\.?a\.?|b\.?eng|m\.?sc|m\.?tech|m\.?s\.?c?\.?|m\.?a\.?|m\.?eng|mba|ph\.?d|bachelor(?:'s)?|master(?:'s)?|doctorate|associate(?:'s)?|diploma|certificate|foundation|higher national)\b[^,\n]*/i

function parseEducation(blocks: SectionBlock[]): Education[] {
  const block = blocks.find((entry) => entry.key === 'education')
  if (!block) return []

  return groupEntries(block.lines).map((group, index) => {
    const text = group.map(stripBullet).join('\n')
    const dates = parseDateRange(text)

    const degreeMatch = text.match(DEGREE_MARKER)
    const institutionMatch = text.match(
      /\b(university|college|institute|school|academy|polytechnic)\b[^,\n]*/i,
    )

    return {
      id: makeId('edu', index),
      ...(degreeMatch ? { degree: truncate(degreeMatch[0].trim(), 80) } : {}),
      ...(institutionMatch ? { institution: truncate(institutionMatch[0].trim(), 80) } : {}),
      ...(dates ? { dateRange: dates.raw } : {}),
      details: group
        .filter((line) => isBullet(line))
        .map(stripBullet)
        .filter(Boolean),
      rawText: group.join('\n'),
    }
  })
}

function parseSkills(blocks: SectionBlock[], resume: Resume): Skill[] {
  const block = blocks.find((entry) => entry.key === 'skills')
  const skills: Skill[] = []

  if (block) {
    for (const line of block.lines) {
      const items = splitListItems(line)
      for (const item of items) {
        if (item.length > 60) continue
        skills.push({
          id: makeId('skill', skills.length),
          name: item,
          source: 'skills section',
          evidence: truncate(stripBullet(line), 120),
        })
      }
    }
  }

  // A named skill can also appear inside a bullet; capturing it here keeps the
  // keyword coverage view honest without inventing a category.
  for (const experience of resume.experience) {
    for (const bullet of [...experience.responsibilities, ...experience.achievements]) {
      for (const term of extractSkillCandidates(bullet)) {
        if (skills.some((skill) => skill.name.toLowerCase() === term.toLowerCase())) continue
        skills.push({
          id: makeId('skill', skills.length),
          name: term,
          source: 'experience bullet',
          evidence: truncate(bullet, 120),
        })
      }
    }
  }

  return skills
}

function parseCertifications(blocks: SectionBlock[]): Certification[] {
  const block = blocks.find((entry) => entry.key === 'certifications')
  if (!block) return []

  return groupEntries(block.lines).map((group, index) => {
    const name = stripBullet(group[0] ?? '')
    const text = group.join('\n')
    const issuerMatch = text.match(/\b(by|issued by|from)\s+([^\n,;]+)/i)
    const dateMatch = text.match(/\b((?:19|20)\d{2})\b/)
    const credentialMatch = text.match(
      /\b(?:id|certificate\s*(?:id|no|number))\s*[:#]?\s*([A-Za-z0-9-]+)/i,
    )

    return {
      id: makeId('cert', index),
      name: truncate(name, 100),
      ...(issuerMatch ? { issuer: truncate(issuerMatch[2]!.trim(), 80) } : {}),
      ...(dateMatch ? { date: dateMatch[0] } : {}),
      ...(credentialMatch ? { credentialId: credentialMatch[1] } : {}),
      rawText: group.join('\n'),
    }
  })
}

function parseProjects(blocks: SectionBlock[]): Project[] {
  const block = blocks.find((entry) => entry.key === 'projects')
  if (!block) return []

  return groupEntries(block.lines).map((group, index) => {
    const text = group.join('\n')
    // Compact project lines pack everything onto one row:
    // "Ledger Reconciler | Java, PostgreSQL, Docker | github.com/ada/ledger".
    const [headline = '', ...segments] = group[0]!.split('|').map((part) => part.trim())
    const name = stripBullet(headline)

    let url: string | undefined
    const tech: string[] = []

    for (const segment of segments) {
      if (PATTERNS.url.test(segment) || PATTERNS.linkedin.test(segment)) {
        url ??= segment
        continue
      }
      tech.push(...splitListItems(segment))
    }

    const descriptionLines = group.slice(1).map(stripBullet).filter(Boolean)
    const description = [stripBullet(headline), ...descriptionLines]
      .filter((value) => value.length > 0 && !PATTERNS.url.test(value))
      .join(' ')
      .trim()

    return {
      id: makeId('proj', index),
      name: truncate(name, 100),
      ...(description.length > 0 ? { description: truncate(description, 200) } : {}),
      tech: tech.filter((item) => item.length > 0 && item.length <= 40),
      ...(url ? { url } : {}),
      rawText: text,
    }
  })
}

function parseAwards(blocks: SectionBlock[]): Award[] {
  const block = blocks.find((entry) => entry.key === 'awards')
  if (!block) return []

  return groupEntries(block.lines).map((group, index) => {
    const title = stripBullet(group[0] ?? '')
    const text = group.join('\n')
    const issuerMatch = text.match(/\b(by|from)\s+([^\n,;]+)/i)
    const dateMatch = text.match(/\b((?:19|20)\d{2})\b/)

    return {
      id: makeId('award', index),
      title: truncate(title, 100),
      ...(issuerMatch ? { issuer: truncate(issuerMatch[2]!.trim(), 80) } : {}),
      ...(dateMatch ? { date: dateMatch[0] } : {}),
      rawText: group.join('\n'),
    }
  })
}

const LANGUAGE_NAMES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Russian',
  'Ukrainian',
  'Hindi',
  'Mandarin',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Turkish',
  'Swedish',
  'Danish',
  'Finnish',
  'Norwegian',
  'Czech',
  'Greek',
  'Hebrew',
]

function parseLanguages(blocks: SectionBlock[]): Language[] {
  const block = blocks.find((entry) => entry.key === 'languages')
  if (!block) return []

  const items = block.lines.flatMap((line) => splitListItems(line))
  const languages: Language[] = []

  for (const item of items) {
    const name = LANGUAGE_NAMES.find((candidate) =>
      item.toLowerCase().includes(candidate.toLowerCase()),
    )
    if (!name) continue

    const proficiency = item
      .replace(new RegExp(name, 'i'), '')
      .replace(/[-–—:]/g, ' ')
      .trim()

    languages.push({
      id: makeId('lang', languages.length),
      name,
      ...(proficiency ? { proficiency: truncate(proficiency, 40) } : {}),
      rawText: item,
    })
  }

  return languages
}
