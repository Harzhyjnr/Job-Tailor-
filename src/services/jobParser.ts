import { detectJobSection } from '@/services/jobHeadings'
import type { JobSectionKey } from '@/services/jobHeadings'
import { extractSkillCandidates, extractSoftSkills } from '@/services/techTerms'
import type { JobDescription, Requirement, Responsibility, Seniority } from '@/types/job'
import {
  isBullet,
  isHeadingLike,
  normalizeText,
  normalizeWhitespace,
  stripBullet,
  toLines,
  truncate,
} from '@/utils/text'

function makeId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`
}

export interface ParseJobResult {
  job: JobDescription
  /** Human-readable notes about sections that could not be read confidently. */
  warnings: string[]
}

interface JobBlock {
  key: JobSectionKey
  lines: string[]
}

/**
 * Parses a pasted job description into the normalized JobDescription model.
 *
 * The same anti-fabrication rule as the resume parser applies: every requirement
 * keeps the verbatim phrase it came from, and anything that cannot be read with
 * confidence stays undefined rather than being guessed.
 */
export function parseJobDescription(rawInput: string): ParseJobResult {
  const rawText = normalizeText(rawInput)
  const lines = toLines(rawText)
  const warnings: string[] = []

  const { header, blocks } = splitSections(lines)
  const headerFields = parseHeader(header)

  const itemsBySection = collectSectionItems(blocks)
  const required = buildRequirements(itemsBySection.get('requirements') ?? [], 'required', 'req', 0)
  const preferred = buildRequirements(
    itemsBySection.get('preferred') ?? [],
    'preferred',
    'pref',
    required.length,
  )
  const responsibilities = buildResponsibilities(itemsBySection.get('responsibilities') ?? [])

  const certifications = collectCertifications(itemsBySection)
  const educationRequirement = deriveEducation(itemsBySection.get('education') ?? [], required)
  const minYearsExperience = maxMinYears([...required, ...preferred])
  const seniority = detectSeniority(headerFields.title, rawText, minYearsExperience)
  const industry = detectIndustry(rawText)

  const job: JobDescription = {
    ...(headerFields.title ? { title: headerFields.title } : {}),
    ...(headerFields.company ? { company: headerFields.company } : {}),
    ...(headerFields.location ? { location: headerFields.location } : {}),
    ...(headerFields.employmentType ? { employmentType: headerFields.employmentType } : {}),
    seniority,
    ...(industry ? { industry } : {}),
    ...(minYearsExperience !== undefined ? { minYearsExperience } : {}),
    ...(educationRequirement ? { educationRequirement } : {}),
    requirements: required,
    preferred,
    responsibilities,
    certifications,
    technicalSkills: extractSkillCandidates(rawText),
    softSkills: extractSoftSkills(rawText),
    rawText,
  }

  if (blocks.length === 0) {
    warnings.push(
      'No standard job sections were recognized. Add headings such as Requirements, Responsibilities and Preferred qualifications so they can be separated.',
    )
  } else if (required.length === 0) {
    warnings.push(
      'No requirements section was found, so required skills are not listed individually.',
    )
  }

  return { job, warnings }
}

function isHeadingCandidate(line: string): boolean {
  if (isBullet(line)) return false
  if (line.length > 60) return false
  if (/[.?!]$/.test(line)) return false
  if (line.split(/\s+/).length > 7) return false
  return true
}

function splitSections(lines: string[]): { header: string[]; blocks: JobBlock[] } {
  const header: string[] = []
  const blocks: JobBlock[] = []
  let current: JobBlock | null = null

  for (const line of lines) {
    const key = isHeadingCandidate(line) ? detectJobSection(line) : undefined
    if (key) {
      current = { key, lines: [] }
      blocks.push(current)
      continue
    }

    if (current) current.lines.push(line)
    else header.push(line)
  }

  return { header, blocks }
}

function collectSectionItems(blocks: JobBlock[]): Map<JobSectionKey, string[]> {
  const items = new Map<JobSectionKey, string[]>()

  for (const block of blocks) {
    const existing = items.get(block.key) ?? []
    items.set(block.key, [...existing, ...collectItems(block.lines)])
  }

  return items
}

/**
 * Turns the lines under a heading into individual entries. Bullets are always
 * entries; a plain line is only kept when it is short enough to be a statement
 * rather than a wrapped paragraph.
 */
function collectItems(lines: string[]): string[] {
  const items: string[] = []

  for (const line of lines) {
    if (isBullet(line)) {
      const item = stripBullet(line)
      if (item) items.push(item)
      continue
    }

    if (line.length > 200) continue
    // A short, title-cased line with no sentence punctuation is a sub-heading
    // such as "Core Requirements", not a requirement itself.
    if (isHeadingLike(line) && !/[.?!]$/.test(line)) continue
    items.push(line)
  }

  return items
}

const COMPANY_SUFFIX =
  /\b(?:inc|llc|ltd|limited|corp|corporation|gmbh|plc|co|company|labs|group|holdings|technologies|systems|solutions|software|payments|bank|health|media|partners|consulting)\b/i

const EMPLOYMENT_TYPE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'Internship', re: /\bintern(?:ship)?\b/i },
  { label: 'Full-time', re: /\bfull[\s-]?time\b/i },
  { label: 'Part-time', re: /\bpart[\s-]?time\b/i },
  { label: 'Contract', re: /\b(?:contract|contractor|fixed[\s-]?term)\b/i },
  { label: 'Temporary', re: /\btemporary\b/i },
  { label: 'Freelance', re: /\bfreelance\b/i },
]

const LABELS: { name: 'Company' | 'Location' | 'Employment type'; re: RegExp }[] = [
  { name: 'Company', re: /^(?:company|employer|organization|organisation)\s*[:–—-]\s*(.+)$/i },
  { name: 'Location', re: /^(?:location|based in)\s*[:–—-]\s*(.+)$/i },
  { name: 'Employment type', re: /^(?:employment type|job type|contract type)\s*[:–—-]\s*(.+)$/i },
]

interface HeaderFields {
  title?: string
  company?: string
  location?: string
  employmentType?: string
}

function cleanValue(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[\s,;:–—-]+/, '')
    .replace(/[\s,;:]+$/, '')
}

function matchEmploymentType(line: string): string | undefined {
  for (const { label, re } of EMPLOYMENT_TYPE_PATTERNS) {
    if (re.test(line)) return label
  }
  return undefined
}

function matchLabel(
  line: string,
): { name: 'Company' | 'Location' | 'Employment type'; value: string } | undefined {
  for (const label of LABELS) {
    const match = line.match(label.re)
    if (match) return { name: label.name, value: match[1] ?? '' }
  }
  return undefined
}

function splitHeaderParts(line: string): string[] {
  return line
    .split(/\s+[—–|·]\s+|\s+-\s+/)
    .map((part) => cleanValue(part))
    .filter((part) => part.length > 0)
}

function looksLikeLocation(part: string): boolean {
  const value = cleanValue(part)
  if (!value || value.length > 60) return false
  if (value.split(/\s+/).length > 6) return false
  if (matchEmploymentType(value)) return false
  if (/^(?:remote|hybrid|on[\s-]?site)$/i.test(value)) return true
  if (/\((?:remote|hybrid|on[\s-]?site)\)/i.test(value)) return true
  if (/^[A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)*,\s*[\p{L}.'\s-]+$/u.test(value)) return true
  return false
}

function findLocationIndex(parts: string[]): number {
  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const part = parts[index]
    if (part && looksLikeLocation(part)) return index
  }
  return -1
}

function findCompanyIndex(parts: string[]): number {
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index]
    if (part && COMPANY_SUFFIX.test(part)) return index
  }
  return -1
}

function parseHeader(header: string[]): HeaderFields {
  const fields: HeaderFields = {}
  const pending: string[] = []

  for (const line of header) {
    const labelled = matchLabel(line)
    if (labelled) {
      if (labelled.name === 'Company') fields.company ??= cleanValue(labelled.value)
      else if (labelled.name === 'Location') fields.location ??= cleanValue(labelled.value)
      else fields.employmentType ??= cleanValue(labelled.value)
      continue
    }

    const type = matchEmploymentType(line)
    if (type && line.split(/\s+/).length <= 6 && !fields.employmentType) {
      fields.employmentType = type
      continue
    }

    pending.push(line)
  }

  const titleIndex = pending.findIndex(
    (line) => !isBullet(line) && line.length <= 80 && !/[.!?]$/.test(line),
  )
  if (titleIndex >= 0) {
    const titleLine = pending.splice(titleIndex, 1)[0] ?? ''
    const atMatch = titleLine.match(/^(.+?)\s+(?:at|@)\s+(.+)$/)
    if (atMatch) {
      fields.title = cleanValue(atMatch[1] ?? '')
      fields.company ??= cleanValue(atMatch[2] ?? '')
    } else {
      const parts = splitHeaderParts(titleLine)
      if (parts.length >= 2) {
        fields.title = cleanValue(parts[0] ?? '')
        const locationIndex = findLocationIndex(parts)
        if (locationIndex > 0) fields.location ??= cleanValue(parts[locationIndex] ?? '')
        if (!fields.company) {
          const companyIndex = findCompanyIndex(parts)
          if (companyIndex > 0) fields.company = cleanValue(parts[companyIndex] ?? '')
          else if (locationIndex > 1) {
            fields.company = cleanValue(parts.slice(1, locationIndex).join(', '))
          }
        }
      } else {
        fields.title = cleanValue(titleLine)
      }
    }
  }

  for (const line of pending) {
    const parts = splitHeaderParts(line)
    const candidates = parts.length > 1 ? parts : [line]

    for (const part of candidates) {
      if (!fields.company && COMPANY_SUFFIX.test(part) && !looksLikeLocation(part)) {
        fields.company = cleanValue(part)
        continue
      }
      if (!fields.location && looksLikeLocation(part)) {
        fields.location = cleanValue(part)
      }
    }
  }

  return fields
}

const EDUCATION_PATTERN =
  /\b(?:degree|bachelor(?:'s)?|master(?:'s)?|phd|doctorate|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|university|college)\b/i
const CERTIFICATION_PATTERN = /\b(?:certif(?:ied|ication|icate)|license|licence|accredit)/i

function classifyRequirement(text: string): Requirement['category'] {
  if (EDUCATION_PATTERN.test(text)) return 'education'
  if (CERTIFICATION_PATTERN.test(text)) return 'certification'
  if (extractMinYears(text) !== undefined || /\bexperience\b/i.test(text)) return 'experience'
  if (detectIndustry(text)) return 'domain'
  return 'other'
}

function buildRequirements(
  items: string[],
  importance: 'required' | 'preferred',
  prefix: string,
  startIndex: number,
): Requirement[] {
  const requirements: Requirement[] = []
  const seen = new Map<string, Requirement>()

  const push = (
    label: string,
    category: Requirement['category'],
    evidence: string,
    minYears: number | undefined,
  ) => {
    const cleanLabel = cleanValue(label)
    if (!cleanLabel) return

    const key = cleanLabel.toLowerCase()
    const existing = seen.get(key)
    if (existing) {
      if (
        minYears !== undefined &&
        (existing.minYears === undefined || minYears > existing.minYears)
      ) {
        existing.minYears = minYears
      }
      return
    }

    const requirement: Requirement = {
      id: makeId(prefix, startIndex + requirements.length),
      label: cleanLabel,
      importance,
      category,
      evidence: truncate(evidence, 200),
      ...(minYears !== undefined ? { minYears } : {}),
    }
    seen.set(key, requirement)
    requirements.push(requirement)
  }

  for (const item of items) {
    const text = normalizeWhitespace(item)
    if (!text) continue

    const evidence = truncate(text, 200)
    const minYears = extractMinYears(text)
    const skills = extractSkillCandidates(text)

    if (skills.length > 0) {
      for (const skill of skills) push(skill, 'technical', evidence, minYears)
      continue
    }

    const softSkills = extractSoftSkills(text)
    if (softSkills.length > 0) {
      for (const skill of softSkills) push(skill, 'soft', evidence, minYears)
      continue
    }

    push(truncate(text, 120), classifyRequirement(text), evidence, minYears)
  }

  return requirements
}

function buildResponsibilities(items: string[]): Responsibility[] {
  return items
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 0)
    .map((text, index) => {
      const trimmed = truncate(text, 240)
      return {
        id: makeId('resp', index),
        text: trimmed,
        relatedTerms: [...extractSkillCandidates(trimmed), ...extractSoftSkills(trimmed)],
      }
    })
}

function collectCertifications(itemsBySection: Map<JobSectionKey, string[]>): string[] {
  const certifications: string[] = []
  const add = (value: string) => {
    const clean = truncate(normalizeWhitespace(value), 120)
    if (!clean) return
    if (certifications.some((existing) => existing.toLowerCase() === clean.toLowerCase())) return
    certifications.push(clean)
  }

  for (const item of itemsBySection.get('certifications') ?? []) add(item)
  for (const key of ['requirements', 'preferred'] as JobSectionKey[]) {
    for (const item of itemsBySection.get(key) ?? []) {
      if (CERTIFICATION_PATTERN.test(item)) add(item)
    }
  }

  return certifications
}

function deriveEducation(
  educationItems: string[],
  requirements: Requirement[],
): string | undefined {
  const fromSection = educationItems.map((item) => normalizeWhitespace(item)).find(Boolean)
  if (fromSection) return truncate(fromSection, 200)

  const fromRequirement = requirements.find((requirement) => requirement.category === 'education')
  return fromRequirement ? truncate(fromRequirement.evidence, 200) : undefined
}

function maxMinYears(requirements: Requirement[]): number | undefined {
  const values = requirements
    .map((requirement) => requirement.minYears)
    .filter((value): value is number => value !== undefined)

  if (values.length === 0) return undefined
  return Math.max(...values)
}

export function extractMinYears(text: string): number | undefined {
  const range = text.match(/\b(\d{1,2})\s*(?:\+|plus)?\s*(?:to|-|–|—)\s*(\d{1,2})\s+years?\b/i)
  if (range) return clampYears(Number(range[1]))

  const plus = text.match(/\b(\d{1,2})\s*\+\s*years?\b/i)
  if (plus) return clampYears(Number(plus[1]))

  const atLeast = text.match(/\b(?:at least|minimum(?: of)?|min\.?)\s*(\d{1,2})\s+years?\b/i)
  if (atLeast) return clampYears(Number(atLeast[1]))

  const plain = text.match(/\b(\d{1,2})\s+years?\b/i)
  if (plain) return clampYears(Number(plain[1]))

  return undefined
}

function clampYears(value: number): number | undefined {
  return value >= 1 && value <= 30 ? value : undefined
}

const INDUSTRIES: { name: string; re: RegExp }[] = [
  { name: 'Fintech', re: /\b(?:fintech|financial services?|payments?|banking|bank)\b/i },
  { name: 'Healthcare', re: /\b(?:healthcare|health care|medical|healthtech|pharma)\b/i },
  { name: 'E-commerce', re: /\b(?:e-?commerce|retail|marketplace)\b/i },
  { name: 'SaaS', re: /\b(?:saas|software as a service)\b/i },
  { name: 'Insurance', re: /\binsurance\b/i },
  { name: 'Logistics', re: /\b(?:logistics|supply chain|shipping|delivery)\b/i },
  { name: 'Gaming', re: /\b(?:gaming|video games?|game studio)\b/i },
  { name: 'Media', re: /\b(?:media|entertainment|streaming|publishing)\b/i },
  { name: 'Education', re: /\b(?:edtech|education technology|e-?learning)\b/i },
  { name: 'Cybersecurity', re: /\b(?:cybersecurity|cyber security|infosec)\b/i },
  { name: 'Telecommunications', re: /\b(?:telecom|telecommunications)\b/i },
  { name: 'Travel', re: /\b(?:travel|hospitality)\b/i },
]

function detectIndustry(text: string): string | undefined {
  for (const industry of INDUSTRIES) {
    if (industry.re.test(text)) return industry.name
  }
  return undefined
}

/** Reads a seniority level from a title or a short body of text. */
export function seniorityFromText(text: string): Seniority | undefined {
  if (/\b(?:chief|cto|ceo|coo|cfo|cio|vp|vice president|director|head of)\b/.test(text)) {
    return 'executive'
  }
  if (/\b(?:principal|staff engineer|staff software|distinguished)\b/.test(text)) {
    return 'principal'
  }
  if (
    /\b(?:tech lead|team lead|engineering lead|lead engineer|lead developer|lead analyst|engineering manager|manager)\b/.test(
      text,
    )
  ) {
    return 'lead'
  }
  if (/\b(?:senior|sr\.?)\b/.test(text)) return 'senior'
  if (/\b(?:junior|jr\.?|entry[\s-]?level|graduate|associate)\b/.test(text)) return 'junior'
  if (/\b(?:intern|internship)\b/.test(text)) return 'intern'
  if (/\bmid[\s-]?level\b/.test(text)) return 'mid'
  return undefined
}

/**
 * Seniority is read from the title first. Only when no title was detected does
 * the body text act as a fallback, so a verb like "lead code reviews" in a
 * responsibility is not mistaken for a lead role.
 */
function detectSeniority(
  title: string | undefined,
  text: string,
  minYears: number | undefined,
): Seniority {
  const fromTitle = title ? seniorityFromText(title.toLowerCase()) : undefined
  if (fromTitle) return fromTitle

  const fromText = seniorityFromText(truncate(text, 300).toLowerCase())
  if (fromText) return fromText

  if (minYears !== undefined) return minYears >= 5 ? 'senior' : 'mid'
  return 'unknown'
}
