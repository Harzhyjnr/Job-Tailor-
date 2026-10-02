import { yearsBetween } from '@/services/dates'
import type { TermMatchResult } from '@/services/keywordMatch'
import type { ExperienceRelevance, MatchStatus } from '@/types/analysis'
import type { Resume } from '@/types/resume'
import { hasMetric, truncate } from '@/utils/text'

/** A role needs at least this many matched terms before it counts as a strong match. */
const STRONG_TERM_COUNT = 3
const STRONG_SCORE = 25

export interface ExperienceYears {
  /** Sum of the years stated by each role, or undefined when no dates were read. */
  years?: number
  /** True when at least one role has no readable start date. */
  incomplete: boolean
}

/**
 * Adds up the years stated in the resume. Roles are summed rather than merged,
 * so an overlapping date range can overstate the total; the UI labels the figure
 * as approximate and the engine only compares it with the posting's minimum.
 */
export function totalYearsExperience(resume: Resume): ExperienceYears {
  let total = 0
  let incomplete = false
  let read = 0

  for (const experience of resume.experience) {
    const years = yearsBetween(experience.startDate, experience.endDate)
    if (years === undefined) {
      incomplete = true
      continue
    }
    total += years
    read += 1
  }

  return {
    ...(read > 0 ? { years: Math.round(total) } : {}),
    incomplete,
  }
}

/**
 * Scores every role against the terms the posting asks for.
 *
 * The score is the share of job terms that appear in that role, so a role can
 * only be scored against what the posting actually named. Roles are returned
 * most relevant first; the original order is kept for equal scores.
 */
export function scoreExperienceRelevance(
  resume: Resume,
  matches: TermMatchResult[],
): ExperienceRelevance[] {
  const total = matches.length

  const scored = resume.experience.map((experience, index) => {
    const matchedTerms = matches
      .filter(
        (match) =>
          match.status !== 'missing' &&
          match.hits.some((hit) => hit.experienceId === experience.id),
      )
      .map((match) => match.term)

    const score = total === 0 ? 0 : Math.round((matchedTerms.length / total) * 100)

    const status: MatchStatus =
      matchedTerms.length >= STRONG_TERM_COUNT && score >= STRONG_SCORE
        ? 'strong'
        : matchedTerms.length > 0
          ? 'partial'
          : 'missing'

    const years = yearsBetween(experience.startDate, experience.endDate)
    const label =
      [experience.title, experience.company].filter(Boolean).join(' at ') || 'Untitled role'

    const rationale =
      matchedTerms.length === 0
        ? `No terms from the job description appear in ${label}.`
        : `Matches ${matchedTerms.length} of ${total} job terms in ${label}: ${matchedTerms.join(', ')}.` +
          (years !== undefined ? ` About ${years} years in this role.` : '')

    return {
      experienceId: experience.id,
      ...(experience.company ? { company: experience.company } : {}),
      ...(experience.title ? { title: experience.title } : {}),
      score,
      status,
      rationale,
      matchedTerms,
      index,
    }
  })

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ index: _index, ...relevance }) => relevance)
}

/** Verbatim bullets that carry a measurable result; the strongest first-impression material. */
export function standoutPassages(resume: Resume, limit: number): string[] {
  const bullets = resume.experience
    .flatMap((experience) => [...experience.achievements, ...experience.responsibilities])
    .filter((bullet) => hasMetric(bullet))

  return bullets.slice(0, limit).map((bullet) => truncate(bullet, 160))
}
