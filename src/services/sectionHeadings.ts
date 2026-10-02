import type { ResumeSectionKey } from '@/types/resume'

/**
 * Heading synonyms per section. Matching is done on the normalized heading with
 * separators removed, so "WORK EXPERIENCE", "Work Experience" and
 * "work-experience" all resolve to the same key.
 */
const SECTION_SYNONYMS: Record<ResumeSectionKey, string[]> = {
  summary: [
    'summary',
    'professional summary',
    'profile',
    'professional profile',
    'about me',
    'objective',
    'career objective',
    'overview',
    'personal statement',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'employment',
    'employment history',
    'work history',
    'career history',
    'relevant experience',
    'professional background',
    'positions',
    'roles',
  ],
  education: [
    'education',
    'academic background',
    'academic qualifications',
    'qualifications',
    'education and qualifications',
    'educational background',
    'academics',
    'education background',
  ],
  skills: [
    'skills',
    'technical skills',
    'core skills',
    'core competencies',
    'competencies',
    'technical competencies',
    'key skills',
    'areas of expertise',
    'expertise',
    'technologies',
    'technical proficiencies',
    'it skills',
    'skills and competencies',
  ],
  certifications: [
    'certifications',
    'certificates',
    'licenses and certifications',
    'licenses',
    'accreditations',
    'professional certifications',
    'courses',
    'training',
  ],
  projects: [
    'projects',
    'personal projects',
    'key projects',
    'selected projects',
    'portfolio',
    'side projects',
    'project experience',
  ],
  awards: [
    'awards',
    'honors',
    'honours',
    'achievements and awards',
    'recognitions',
    'accomplishments',
    'awards and honors',
    'awards and achievements',
  ],
  languages: ['languages', 'language skills', 'spoken languages', 'language proficiency'],
}

function headingKey(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[‐-―_/]/g, ' ')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const LOOKUP = new Map<string, ResumeSectionKey>()
for (const [key, synonyms] of Object.entries(SECTION_SYNONYMS) as [ResumeSectionKey, string[]][]) {
  for (const synonym of synonyms) {
    LOOKUP.set(headingKey(synonym), key)
  }
}

export const ALL_SECTION_KEYS = Object.keys(SECTION_SYNONYMS) as ResumeSectionKey[]

/** Human-readable section names, shared by the parser report and the ATS review. */
export const RESUME_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  certifications: 'Certifications',
  projects: 'Projects',
  awards: 'Awards',
  languages: 'Languages',
}

/**
 * Resolves a candidate heading line to a section key, or undefined when the
 * line is not a known heading. Also matches compound headings such as
 * "Experience" or "Certifications" appearing inside a longer line only when the
 * line is short enough to be a heading rather than a bullet.
 */
export function detectSection(headingLine: string): ResumeSectionKey | undefined {
  const key = headingKey(headingLine)
  if (!key) return undefined

  const exact = LOOKUP.get(key)
  if (exact) return exact

  // "Technical Skills & Tools" / "Skills, Tools and Frameworks"
  for (const [synonymKey, sectionKey] of LOOKUP) {
    if (key.length <= 60 && key.split(' ').length <= 6 && key.includes(synonymKey)) {
      return sectionKey
    }
  }

  return undefined
}

/** Aliases used to detect a person's name in the header block. */
const NAME_STOP_WORDS = new Set([
  'resume',
  'cv',
  'curriculum',
  'vitae',
  'profile',
  'summary',
  'objective',
  'engineer',
  'developer',
  'manager',
  'designer',
  'analyst',
  'consultant',
  'specialist',
  'director',
  'senior',
  'junior',
  'lead',
  'the',
  'and',
  'for',
  'to',
])

export function looksLikeName(line: string, isFirstLine: boolean): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 60) return false
  if (!isFirstLine) return false
  if (/[@]/.test(trimmed)) return false
  if (/\d/.test(trimmed)) return false

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 4) return false
  if (!/^[A-Z][a-zA-Z'’.-]*(\s+[A-Z][a-zA-Z'’.-]*)+$/.test(trimmed)) return false
  if (words.some((word) => NAME_STOP_WORDS.has(word.toLowerCase().replace(/[^\w]/g, '')))) {
    return false
  }

  return true
}
