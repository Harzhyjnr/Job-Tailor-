import type { AchievementQuality } from '@/types/analysis'
import type { Resume } from '@/types/resume'
import { hasMetric, looksLikeOutcome, startsWithActionVerb } from '@/utils/text'

const ACTION_WEIGHT = 0.35
const OUTCOME_WEIGHT = 0.35
const METRIC_WEIGHT = 0.3

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : count / total
}

/**
 * Grades the bullet points themselves.
 *
 * Three independent questions are answered, because they are answered
 * differently by real resumes: does the bullet start with a verb, does it state
 * a result, and does it include a number. A bullet that answers none of them is
 * counted as a duty, not as an achievement.
 */
export function assessAchievementQuality(resume: Resume): AchievementQuality {
  const bullets = resume.experience.flatMap((experience) => [
    ...experience.achievements,
    ...experience.responsibilities,
  ])

  const total = bullets.length
  const withActionVerb = bullets.filter((bullet) => startsWithActionVerb(bullet)).length
  const withOutcome = bullets.filter((bullet) => looksLikeOutcome(bullet)).length
  const withMetric = bullets.filter((bullet) => hasMetric(bullet)).length
  const responsibilitiesOnly = bullets.filter(
    (bullet) => !looksLikeOutcome(bullet) && !hasMetric(bullet),
  ).length

  const score =
    total === 0
      ? 0
      : clamp(
          100 *
            (ACTION_WEIGHT * rate(withActionVerb, total) +
              OUTCOME_WEIGHT * rate(withOutcome, total) +
              METRIC_WEIGHT * rate(withMetric, total)),
        )

  const notes: string[] = []

  if (total === 0) {
    notes.push('No bullet points were detected in the experience section.')
  } else {
    notes.push(`${withMetric} of ${total} bullets include a measurable result.`)
    if (responsibilitiesOnly > 0) {
      notes.push(
        `${responsibilitiesOnly} of ${total} bullets describe duties without a stated result.`,
      )
    }
    const withoutActionVerb = total - withActionVerb
    if (withoutActionVerb > 0) {
      notes.push(`${withoutActionVerb} of ${total} bullets do not start with an action verb.`)
    }
  }

  return {
    total,
    withActionVerb,
    withOutcome,
    withMetric,
    responsibilitiesOnly,
    score,
    notes,
  }
}
