import { seniorityFromText } from '@/services/jobParser'
import { RESUME_SECTION_LABELS } from '@/services/sectionHeadings'
import type { AtsIssue, KeywordCoverage } from '@/types/analysis'
import type { JobDescription, Seniority } from '@/types/job'
import type { Resume } from '@/types/resume'
import { startsWithActionVerb, tokenize } from '@/utils/text'

const PENALTY: Record<AtsIssue['severity'], number> = { high: 15, medium: 8, low: 3 }
const SHORT_RESUME_WORDS = 250
const LONG_RESUME_WORDS = 1400
const LONG_BULLET_CHARS = 280
const DECORATIVE_CHARACTERS = /\p{Extended_Pictographic}|[★☆■□▲▼]/u
const MISSING_TERM_SAMPLE = 6

const SENIORITY_ORDER: Seniority[] = [
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
  'executive',
]

export interface AtsReviewResult {
  score: number
  passed: string[]
  issues: AtsIssue[]
}

function makeIssue(
  id: string,
  category: AtsIssue['category'],
  severity: AtsIssue['severity'],
  title: string,
  detail: string,
  suggestion: string,
): AtsIssue {
  return { id, category, severity, title, detail, suggestion }
}

function topSeniority(resume: Resume): Seniority | undefined {
  let best: Seniority | undefined

  for (const experience of resume.experience) {
    const level = experience.title ? seniorityFromText(experience.title.toLowerCase()) : undefined
    if (!level) continue
    if (!best || SENIORITY_ORDER.indexOf(level) > SENIORITY_ORDER.indexOf(best)) best = level
  }

  return best
}

function jobLabel(job: JobDescription): string {
  if (job.title && job.company) return `${job.title} at ${job.company}`
  return job.title ?? job.company ?? 'this role'
}

/**
 * Runs the checks an applicant tracking system cares about.
 *
 * Every check reports either a pass or an issue built only from what the parser
 * actually read. Nothing here asks the user to invent content: the keyword check
 * explicitly tells them to leave out terms they cannot evidence.
 */
export function runAtsReview(
  resume: Resume,
  job: JobDescription,
  coverage: KeywordCoverage,
): AtsReviewResult {
  const passed: string[] = []
  const issues: AtsIssue[] = []
  const add = (issue: AtsIssue) => issues.push(issue)

  const bullets = resume.experience.flatMap((experience) => [
    ...experience.achievements,
    ...experience.responsibilities,
  ])

  // Structure
  if (resume.detectedSections.length === 0) {
    add(
      makeIssue(
        'structure',
        'structure',
        'high',
        'No section headings were detected',
        'The resume has no recognizable headings, so an ATS has nothing to file your content under.',
        'Add standard headings such as Experience, Education and Skills.',
      ),
    )
  } else if (resume.missingSections.length > 0) {
    const labels = resume.missingSections.map((key) => RESUME_SECTION_LABELS[key])
    add(
      makeIssue(
        'structure',
        'structure',
        resume.missingSections.includes('experience') ? 'high' : 'medium',
        'Some standard sections were not found',
        `These headings were not detected: ${labels.join(', ')}.`,
        `Add the missing headings using the wording an ATS looks for: ${labels.join(', ')}.`,
      ),
    )
  } else {
    passed.push('Standard section headings were detected.')
  }

  // Contact details
  const info = resume.personalInfo
  if (!info.name) {
    add(
      makeIssue(
        'contact-name',
        'contact',
        'high',
        'No name was detected',
        'The resume has no name in a position a recruiter would read first.',
        'Put your full name at the top of the resume.',
      ),
    )
  }
  if (!info.email) {
    add(
      makeIssue(
        'contact-email',
        'contact',
        'high',
        'No email address was detected',
        'No email address was found in the header block.',
        'Add a professional email address near your name.',
      ),
    )
  }
  if (!info.phone) {
    add(
      makeIssue(
        'contact-phone',
        'contact',
        'medium',
        'No phone number was detected',
        'No phone number was found in the header block.',
        'Add a phone number in a plain, internationally readable format.',
      ),
    )
  }
  if (!info.location) {
    add(
      makeIssue(
        'contact-location',
        'contact',
        'low',
        'No location was detected',
        'No city or region was found in the header block.',
        'Add your city and country or region, which many recruiters filter on.',
      ),
    )
  }
  if (info.name && info.email && info.phone && info.location) {
    passed.push('Name, email, phone number and location are all present.')
  }

  // Dates
  const rolesWithoutDates = resume.experience.filter((experience) => !experience.dateRange)
  if (rolesWithoutDates.length > 0) {
    add(
      makeIssue(
        'dates',
        'dates',
        'medium',
        'Some roles have no date range',
        `${rolesWithoutDates.length} of ${resume.experience.length} roles have no readable date range.`,
        'Add a start and end date to every role, using "Present" for your current one.',
      ),
    )
  } else if (resume.experience.length > 0) {
    passed.push('Every role has a date range.')
  }

  const educationWithoutDates = resume.education.filter((education) => !education.dateRange)
  if (educationWithoutDates.length > 0) {
    add(
      makeIssue(
        'education-dates',
        'dates',
        'low',
        'Some education entries have no date range',
        `${educationWithoutDates.length} of ${resume.education.length} education entries have no date range.`,
        'Add graduation years so the timeline reads correctly.',
      ),
    )
  }

  // Titles and seniority
  const rolesWithoutTitles = resume.experience.filter((experience) => !experience.title)
  if (rolesWithoutTitles.length > 0) {
    add(
      makeIssue(
        'titles',
        'titles',
        'low',
        'Some roles have no title',
        `${rolesWithoutTitles.length} of ${resume.experience.length} roles have no job title.`,
        'Add the title you held, even if it was the same as the company name.',
      ),
    )
  }

  const resumeSeniority = topSeniority(resume)
  if (job.seniority !== 'unknown' && resume.experience.length > 0) {
    if (!resumeSeniority) {
      add(
        makeIssue(
          'titles-seniority-unstated',
          'titles',
          'low',
          'No seniority level is stated in your titles',
          `${jobLabel(job)} reads as ${job.seniority}, and none of your titles state a level.`,
          'Describe the scope you actually had in your summary. Never change a job title you did not hold.',
        ),
      )
    } else if (SENIORITY_ORDER.indexOf(resumeSeniority) < SENIORITY_ORDER.indexOf(job.seniority)) {
      add(
        makeIssue(
          'titles-seniority',
          'titles',
          'medium',
          'Your titles do not show the seniority this posting asks for',
          `${jobLabel(job)} reads as ${job.seniority}, while the most senior title in your resume reads as ${resumeSeniority}.`,
          'Describe the scope you actually had in your summary. Never change a job title you did not hold.',
        ),
      )
    }
  }

  if (rolesWithoutTitles.length === 0 && resume.experience.length > 0) {
    passed.push('Every role has a title.')
  }

  // Formatting
  const longBullets = bullets.filter((bullet) => bullet.length > LONG_BULLET_CHARS)
  if (longBullets.length > 0) {
    add(
      makeIssue(
        'formatting-long-bullets',
        'formatting',
        'low',
        'Some bullet points are very long',
        `${longBullets.length} bullet points run past ${LONG_BULLET_CHARS} characters.`,
        'Split long bullets in two, or cut the detail that does not change the outcome.',
      ),
    )
  }

  if (DECORATIVE_CHARACTERS.test(resume.rawText)) {
    add(
      makeIssue(
        'formatting-decorative',
        'formatting',
        'low',
        'Decorative characters were detected',
        'The text contains symbols such as stars, triangles or emoji.',
        'Remove decorative symbols; some ATS parsers read them as unreadable characters.',
      ),
    )
  }

  if (longBullets.length === 0 && !DECORATIVE_CHARACTERS.test(resume.rawText)) {
    passed.push('No formatting features that confuse ATS parsers were detected.')
  }

  // Keywords
  if (coverage.missing.length > 0) {
    add(
      makeIssue(
        'keywords',
        'keywords',
        'medium',
        'Terms from the posting are not in your resume',
        `These terms do not appear anywhere in your resume: ${coverage.missing
          .slice(0, MISSING_TERM_SAMPLE)
          .map((match) => match.term)
          .join(', ')}.`,
        'Add only the terms you can evidence with a concrete example. Leave the rest out rather than listing them without proof.',
      ),
    )
  } else if (coverage.related.length > 0) {
    add(
      makeIssue(
        'keywords-related',
        'keywords',
        'low',
        'Only near-equivalents were found for some terms',
        `These terms appear only as something close: ${coverage.related
          .slice(0, MISSING_TERM_SAMPLE)
          .map((match) => `${match.term} (you mention ${match.relatedTerm ?? 'a related term'})`)
          .join(', ')}.`,
        'If you genuinely use the exact technology, name it. Otherwise leave the near-equivalent as it is.',
      ),
    )
  } else if (coverage.matched.length > 0) {
    passed.push('Every term read from the posting appears in your resume.')
  }

  // Length
  const wordCount = tokenize(resume.rawText).length
  if (wordCount < SHORT_RESUME_WORDS) {
    add(
      makeIssue(
        'length-short',
        'length',
        'low',
        'Your resume is very short',
        `The resume contains about ${wordCount} words.`,
        'Short resumes give an ATS little to index. Add the detail you left out, without inflating it.',
      ),
    )
  } else if (wordCount > LONG_RESUME_WORDS) {
    add(
      makeIssue(
        'length-long',
        'length',
        'low',
        'Your resume is long',
        `The resume contains about ${wordCount} words.`,
        'Cut the oldest or least relevant detail so the strongest material fits the first page.',
      ),
    )
  } else {
    passed.push(
      `Resume length looks normal for a single role application (about ${wordCount} words).`,
    )
  }

  // Readability
  const noActionVerb = bullets.filter((bullet) => !startsWithActionVerb(bullet))
  if (bullets.length > 0 && noActionVerb.length > 0) {
    add(
      makeIssue(
        'readability',
        'readability',
        'low',
        'Some bullets do not start with a verb',
        `${noActionVerb.length} of ${bullets.length} bullet points do not begin with an action verb.`,
        'Rewrite the weakest bullets to start with a verb and state the result you produced.',
      ),
    )
  } else if (bullets.length > 0) {
    passed.push('Every bullet point starts with an action verb.')
  }

  const score = Math.max(
    0,
    Math.min(100, 100 - issues.reduce((total, issue) => total + PENALTY[issue.severity], 0)),
  )

  return { score, passed, issues }
}
