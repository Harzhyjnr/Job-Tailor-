import { analyzeResumeAgainstJob } from '@/services/analysisEngine'
import { containsTerm } from '@/services/techTerms'
import { RESUME_SECTION_LABELS } from '@/services/sectionHeadings'
import type { TailoredResume, TailoringChange } from '@/types/analysis'
import type { JobDescription } from '@/types/job'
import type { Experience, Resume, Skill } from '@/types/resume'
import { hasMetric, isActionVerb, looksLikeOutcome, termKey, tokenize } from '@/utils/text'

/**
 * Deterministic tailoring.
 *
 * The engine may reorder, re-case and re-split text that is already in the
 * resume. It may never add a word that the resume does not already contain, drop
 * a claim, or introduce an employer, title, date, metric, technology or
 * credential. Anything the resume cannot support is reported as uncovered
 * instead of being written in.
 */

/** A comma followed by a lowercase word starts a clause; "London, UK" does not. */
const CLAUSE_BREAK = /,\s+(?=[a-z])/
const LONG_BULLET = 260

/**
 * The only words the engine is allowed to introduce. Punctuation is free; these
 * are the connective words used to stitch existing text together. Everything
 * else in the tailored resume has to appear in the original.
 */
export const ALLOWED_NEW_WORDS: ReadonlySet<string> = new Set(['at'])

function sectionLabel(key: keyof typeof RESUME_SECTION_LABELS): string {
  return RESUME_SECTION_LABELS[key]
}

function singleTokenTerms(job: JobDescription): string[] {
  const terms = [...job.technicalSkills, ...job.softSkills]
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && tokenize(term).length === 1)

  return Array.from(new Map(terms.map((term) => [termKey(term), term])).values())
}

function countHits(text: string, terms: string[]): number {
  return terms.reduce((total, term) => (containsTerm(text, term) ? total + 1 : total), 0)
}

/**
 * Moves a trailing result clause to the front, e.g.
 * "Led migration of the ledger to PostgreSQL, cutting close time by 40%."
 * becomes "Cutting close time by 40%: led migration of the ledger to PostgreSQL."
 *
 * Only the clause order and the case of the demoted verb change. Nothing is
 * added, and the rewrite is refused whenever the tail is not clearly a result.
 */
export function leadWithResult(bullet: string): string | undefined {
  const text = bullet.trim()
  if (text.length > LONG_BULLET) return undefined

  const parts = text.split(CLAUSE_BREAK)
  if (parts.length < 2) return undefined

  const head = parts[0]!.trim()
  const tail = parts.slice(1).join(', ').trim()
  if (!head || !tail) return undefined

  const headWords = head.split(' ')
  const headVerb = headWords[0] ?? ''
  if (!isActionVerb(headVerb)) return undefined

  const tailWords = tail.split(' ')
  const tailIsResult =
    hasMetric(tail) || (looksLikeOutcome(tail) && isActionVerb(tailWords[0] ?? ''))
  if (!tailIsResult) return undefined

  if (hasMetric(head)) return undefined

  const demoted = [headVerb.toLowerCase(), ...headWords.slice(1)].join(' ')
  const lead = `${tailWords[0]!.charAt(0).toUpperCase()}${tailWords[0]!.slice(1)} ${tailWords
    .slice(1)
    .join(' ')}`
    .replace(/[.;,]+$/, '')
    .trim()

  return `${lead}: ${demoted}.`
}

function withPeriod(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`
}

function orderBullets(bullets: string[], terms: string[]): { bullets: string[]; moved: boolean } {
  if (bullets.length < 2) return { bullets: [...bullets], moved: false }

  const decorated = bullets.map((bullet, index) => ({
    bullet,
    index,
    hits: countHits(bullet, terms),
  }))

  const sorted = [...decorated].sort((a, b) =>
    b.hits === a.hits ? a.index - b.index : b.hits - a.hits,
  )

  return {
    bullets: sorted.map((entry) => entry.bullet),
    moved: sorted.some((e, i) => e.index !== i),
  }
}

function tailorExperience(
  resume: Resume,
  terms: string[],
  changeLog: TailoringChange[],
): Experience[] {
  return resume.experience.map((experience) => {
    const achievements = orderBullets(experience.achievements, terms)
    const responsibilities = orderBullets(experience.responsibilities, terms)

    const rewrittenAchievements = achievements.bullets.map(
      (bullet) => leadWithResult(bullet) ?? bullet,
    )
    const rewrittenResponsibilities = responsibilities.bullets.map(
      (bullet) => leadWithResult(bullet) ?? bullet,
    )

    const role = [experience.title, experience.company].filter(Boolean).join(' at ') || 'Role'

    if (achievements.moved || responsibilities.moved) {
      changeLog.push({
        section: sectionLabel('experience'),
        summary: `Moved the bullets that answer the posting to the top of ${role}.`,
        sourceText: experience.rawText,
      })
    }

    const rewrites = [
      ...rewrittenAchievements
        .map((bullet, index) => ({ bullet, source: achievements.bullets[index] }))
        .filter(({ bullet, source }) => bullet !== source),
      ...rewrittenResponsibilities
        .map((bullet, index) => ({ bullet, source: responsibilities.bullets[index] }))
        .filter(({ bullet, source }) => bullet !== source),
    ]

    if (rewrites.length > 0) {
      changeLog.push({
        section: sectionLabel('experience'),
        summary: `Led with the result instead of the task in ${rewrites.length} bullet${
          rewrites.length === 1 ? '' : 's'
        } at ${role}. Same words, result first.`,
        sourceText: rewrites[0]?.source,
      })
    }

    return {
      ...experience,
      achievements: rewrittenAchievements,
      responsibilities: rewrittenResponsibilities,
    }
  })
}

function tailorSkills(resume: Resume, job: JobDescription, changeLog: TailoringChange[]): Skill[] {
  if (resume.skills.length < 2) return [...resume.skills]

  const posting = [...job.technicalSkills, ...job.softSkills]
  const rank = new Map<string, number>()
  posting.forEach((term, index) => {
    const key = termKey(term)
    if (!rank.has(key)) rank.set(key, index)
  })

  const sorted = [...resume.skills].sort((a, b) => {
    const left = rank.get(termKey(a.name)) ?? Number.MAX_SAFE_INTEGER
    const right = rank.get(termKey(b.name)) ?? Number.MAX_SAFE_INTEGER
    return left - right
  })

  if (sorted.every((skill, index) => skill.id === resume.skills[index]?.id)) {
    return sorted
  }

  const kept = sorted.filter((skill) => rank.has(termKey(skill.name))).map((skill) => skill.name)
  changeLog.push({
    section: sectionLabel('skills'),
    summary:
      kept.length > 0
        ? `Reordered the skills list so the posting's own terms come first: ${kept.join(', ')}.`
        : 'Reordered the skills list to match the order the posting reads in.',
    sourceText: resume.skills[0]?.evidence,
  })

  return sorted
}

function bestEvidenceBullet(resume: Resume, terms: string[]): string | undefined {
  const bullets = resume.experience.flatMap((experience) => [
    ...experience.achievements,
    ...experience.responsibilities,
  ])

  const ranked = bullets
    .map((bullet, index) => ({
      bullet,
      index,
      hits: countHits(bullet, terms),
      metric: hasMetric(bullet) ? 1 : 0,
    }))
    .sort((a, b) => b.hits - a.hits || b.metric - a.metric || a.index - b.index)

  const best = ranked[0]
  if (!best || best.hits === 0) return undefined

  return best.bullet
}

function tailorSummary(
  resume: Resume,
  terms: string[],
  changeLog: TailoringChange[],
): string | undefined {
  const latest = resume.experience[0]
  const role = [latest?.title, latest?.company].filter(Boolean).join(' at ')
  const evidence = bestEvidenceBullet(resume, terms)

  if (!role || !evidence) return undefined

  const summary = `${withPeriod(role)} ${withPeriod(evidence)}`
  if (summary === resume.summary) return undefined

  changeLog.push({
    section: sectionLabel('summary'),
    summary:
      'Rewrote the summary from your current role and your strongest, most relevant evidence. Both parts are copied from the resume.',
    sourceText: evidence,
  })

  return summary
}

/**
 * Produces the tailored copy for a posting.
 *
 * The result is a normal resume plus a change log and the requirements that stay
 * out of it. Every tailored string is a reuse of the original wording, which the
 * test suite verifies word by word.
 */
export function tailorResumeAgainstJob(resume: Resume, job: JobDescription): TailoredResume {
  const analysis = analyzeResumeAgainstJob(resume, job)
  const terms = singleTokenTerms(job)
  const changeLog: TailoringChange[] = []

  const experience = tailorExperience(resume, terms, changeLog)
  const skills = tailorSkills(resume, job, changeLog)
  const summary = tailorSummary(resume, terms, changeLog) ?? resume.summary

  return {
    ...resume,
    summary,
    experience,
    skills,
    changeLog,
    uncoveredRequirements: analysis.jobMatch.missingRequirements,
  }
}
