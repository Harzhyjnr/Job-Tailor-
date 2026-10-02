import { isHeadingLike } from '@/utils/text'

export type JobSectionKey =
  | 'summary'
  | 'responsibilities'
  | 'requirements'
  | 'preferred'
  | 'skills'
  | 'education'
  | 'certifications'
  | 'benefits'

export const JOB_SECTION_LABELS: Record<JobSectionKey, string> = {
  summary: 'Summary',
  responsibilities: 'Responsibilities',
  requirements: 'Requirements',
  preferred: 'Preferred',
  skills: 'Skills',
  education: 'Education',
  certifications: 'Certifications',
  benefits: 'Benefits',
}

/**
 * Heading synonyms found in job postings. Matching is done on the normalized
 * heading, so casing, punctuation and hyphenation do not matter.
 */
const JOB_SECTION_SYNONYMS: Record<JobSectionKey, string[]> = {
  summary: [
    'about the role',
    'about this role',
    'the role',
    'role overview',
    'position overview',
    'job overview',
    'job description',
    'overview',
    'the opportunity',
    'about the position',
    'about the job',
    'role summary',
    'summary',
  ],
  responsibilities: [
    'responsibilities',
    'key responsibilities',
    'your responsibilities',
    'main responsibilities',
    'duties',
    'key duties',
    'what you will do',
    'what youll do',
    'what you will be doing',
    'what youll be doing',
    'the day to day',
    'day to day',
    'day-to-day',
    'key tasks',
    'tasks',
    'your role',
    'in this role you will',
    'what the job involves',
  ],
  requirements: [
    'requirements',
    'requirement',
    'minimum requirements',
    'key requirements',
    'qualifications',
    'required qualifications',
    'minimum qualifications',
    'skills and experience',
    'required skills',
    'must have',
    'must haves',
    'must-haves',
    'what you will need',
    'what youll need',
    'what you need',
    'who you are',
    'about you',
    'your profile',
    'experience and qualifications',
    'essential skills',
    'essential criteria',
    'basic qualifications',
    'whom we are looking for',
  ],
  preferred: [
    'preferred',
    'preferred qualifications',
    'preferred skills',
    'preferred experience',
    'nice to have',
    'nice to haves',
    'nice-to-haves',
    'desirable',
    'desired',
    'bonus',
    'bonus points',
    'bonus qualifications',
    'additional qualifications',
    'highly desirable',
    'desired skills',
  ],
  skills: [
    'skills',
    'technical skills',
    'technologies',
    'tech stack',
    'tools',
    'technical requirements',
    'key skills',
    'core skills',
    'required technologies',
    'tools and technologies',
  ],
  education: [
    'education',
    'education and training',
    'academic requirements',
    'education requirements',
    'academic background',
    'education and experience',
  ],
  certifications: [
    'certifications',
    'certificates',
    'certification',
    'licenses',
    'licenses and certifications',
    'preferred certifications',
  ],
  benefits: [
    'benefits',
    'perks',
    'what we offer',
    'we offer',
    'why join us',
    'why join',
    'compensation',
    'salary',
    'about us',
    'about the company',
    'about the team',
    'our culture',
    'equal opportunity',
    'equal opportunities',
  ],
}

function headingKey(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[‐-―_/]/g, ' ')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const LOOKUP = new Map<string, JobSectionKey>()
for (const [key, synonyms] of Object.entries(JOB_SECTION_SYNONYMS) as [JobSectionKey, string[]][]) {
  for (const synonym of synonyms) {
    LOOKUP.set(headingKey(synonym), key)
  }
}

/**
 * Resolves a candidate heading line to a job section key, or undefined when the
 * line is not a known heading.
 *
 * Fuzzy (substring) matching is only attempted on lines that look like headings,
 * so a bullet such as "Gather requirements from stakeholders" is never mistaken
 * for a "Requirements" section.
 */
export function detectJobSection(line: string): JobSectionKey | undefined {
  const key = headingKey(line)
  if (!key) return undefined

  const exact = LOOKUP.get(key)
  if (exact) return exact

  if (!isHeadingLike(line)) return undefined

  for (const [synonymKey, sectionKey] of LOOKUP) {
    if (key.length <= 60 && key.split(' ').length <= 6 && key.includes(synonymKey)) {
      return sectionKey
    }
  }

  return undefined
}
