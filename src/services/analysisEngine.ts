import { assessAchievementQuality } from '@/services/achievementQuality'
import { runAtsReview } from '@/services/atsReview'
import {
  scoreExperienceRelevance,
  standoutPassages,
  totalYearsExperience,
} from '@/services/experienceRelevance'
import type { KeywordAnalysis, TermMatchResult } from '@/services/keywordMatch'
import { analyzeKeywords } from '@/services/keywordMatch'
import type { ResumePassage } from '@/services/resumeIndex'
import { buildResumeIndex } from '@/services/resumeIndex'
import type { AtsIssue, RecruiterAnalysis, RequirementMatch } from '@/types/analysis'
import type { JobDescription } from '@/types/job'
import type { Resume } from '@/types/resume'
import { termKey } from '@/utils/text'

/** Weights for the headline score. Keyword coverage dominates because it is the part an ATS reads first. */
const WEIGHTS = {
  coverage: 0.45,
  skills: 0.2,
  experience: 0.15,
  achievements: 0.1,
  ats: 0.1,
}

const MAX_LIST = 6
const STANDOUT_LIMIT = 3
const STRONG_SAMPLE = 5
const SAMPLE = 3
const DISCLAIMER = 'This is an internal comparison only, not a prediction of hiring outcome.'
/** Project tech lists sometimes pick up a repository link; that is not a skill. */
const LOOKS_LIKE_LINK = /(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.)/i

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = termKey(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function listed(values: string[]): string {
  if (values.length === 1) return values[0]!
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`
}

function skillPairMatches(resumeSkill: string, jobSkill: string): boolean {
  const left = termKey(resumeSkill).split(' ')
  const right = termKey(jobSkill).split(' ')
  if (left.some((token) => token === right.join(' '))) return true
  return left.some((token) => token.length > 2 && right.includes(token))
}

interface JobMatchBuckets {
  strongMatches: RequirementMatch[]
  partialMatches: RequirementMatch[]
  missingRequirements: RequirementMatch[]
}

function buildNote(
  match: TermMatchResult,
  analysis: KeywordAnalysis,
  years: { years?: number; incomplete: boolean },
): string | undefined {
  if (match.status === 'needs-clarification') {
    return 'The evidence exists, but it is not stated clearly enough for a recruiter to find it.'
  }

  if (match.related) {
    return `You mention ${match.relatedTerm ?? 'a related term'}, which is related but not the same term.`
  }

  const term = analysis.terms.find((entry) => entry.term === match.term)
  if (term?.minYears !== undefined) {
    if (years.years !== undefined && years.years < term.minYears) {
      return `The posting asks for ${term.minYears}+ years; your dates add up to about ${years.years} years.`
    }
    if (years.years === undefined) {
      return `The posting asks for ${term.minYears}+ years; your dates could not be added up.`
    }
  }

  if (term?.importance === 'preferred') return 'Preferred only, not required.'

  return undefined
}

function buildJobMatch(
  analysis: KeywordAnalysis,
  years: { years?: number; incomplete: boolean },
): JobMatchBuckets {
  const buckets: JobMatchBuckets = {
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
  }

  analysis.matches.forEach((match, index) => {
    const importance = analysis.terms[index]?.importance ?? 'required'
    const note = buildNote(match, analysis, years)

    const item: RequirementMatch = {
      label: match.term,
      status: match.status,
      importance,
      evidence: [...match.evidence],
      ...(note ? { note } : {}),
    }

    if (match.status === 'strong') buckets.strongMatches.push(item)
    else if (match.status === 'missing') buckets.missingRequirements.push(item)
    else buckets.partialMatches.push(item)
  })

  return buckets
}

function buildSkillsMatch(
  job: JobDescription,
  passages: ResumePassage[],
): { matched: string[]; missing: string[]; extra: string[] } {
  const jobSkills = dedupe([...job.technicalSkills, ...job.softSkills])
  const resumeSkills = dedupe(
    passages
      .filter((passage) => passage.kind === 'skill')
      .map((passage) => passage.text)
      .filter((text) => !LOOKS_LIKE_LINK.test(text)),
  )

  const matched: string[] = []
  const missing: string[] = []
  for (const jobSkill of jobSkills) {
    const present = resumeSkills.some((resumeSkill) => skillPairMatches(resumeSkill, jobSkill))
    if (present) matched.push(jobSkill)
    else missing.push(jobSkill)
  }

  const extra = resumeSkills.filter(
    (resumeSkill) => !jobSkills.some((jobSkill) => skillPairMatches(resumeSkill, jobSkill)),
  )

  return { matched, missing, extra }
}

function describeMatch(match: TermMatchResult): string {
  const inSkills = match.hits.some((hit) => hit.kind === 'skill')
  return inSkills
    ? `${match.term} is named in your skills.`
    : `${match.term} appears in your experience.`
}

function buildFirstImpression(
  resume: Resume,
  analysis: KeywordAnalysis,
  atsIssues: AtsIssue[],
  achievement: RecruiterAnalysis['achievementQuality'],
) {
  const standsOut = standoutPassages(resume, STANDOUT_LIMIT)
  const topAward = resume.awards[0]
  if (topAward) {
    standsOut.push([topAward.title, topAward.issuer].filter(Boolean).join(' · '))
  }

  const strong = analysis.matches
    .filter((match) => match.status === 'strong')
    .slice(0, STRONG_SAMPLE)
    .map(describeMatch)

  const unclear = [
    ...analysis.matches
      .filter((match) => match.status === 'needs-clarification')
      .map((match) => `${match.term} is implied but never stated in skills or bullets.`),
    ...atsIssues
      .filter((issue) => issue.category === 'contact' || issue.category === 'dates')
      .map((issue) => `${issue.title}.`),
  ]

  const hesitations = [
    ...analysis.coverage.missing
      .slice(0, SAMPLE)
      .map((match) => `The posting asks for ${match.term}, and it is not in your resume.`),
    ...(achievement.responsibilitiesOnly > 0
      ? [
          `${achievement.responsibilitiesOnly} of ${achievement.total} bullets describe duties without a result.`,
        ]
      : []),
  ]

  return { standsOut, unclear, strong, hesitations }
}

function buildConcerns(
  analysis: KeywordAnalysis,
  atsIssues: AtsIssue[],
  achievement: RecruiterAnalysis['achievementQuality'],
  job: JobDescription,
  years: { years?: number; incomplete: boolean },
): string[] {
  const requiredMissing = analysis.matches
    .filter(
      (match, index) =>
        match.status === 'missing' && analysis.terms[index]?.importance === 'required',
    )
    .map((match) => match.term)

  const concerns: string[] = []

  if (requiredMissing.length > 0) {
    concerns.push(
      `Required terms with no evidence in your resume: ${listed(requiredMissing.slice(0, SAMPLE))}.`,
    )
  }
  if (job.minYearsExperience !== undefined && years.years !== undefined) {
    if (years.years < job.minYearsExperience) {
      concerns.push(
        `The posting asks for ${job.minYearsExperience}+ years; your dates add up to about ${years.years} years.`,
      )
    }
  }
  for (const issue of atsIssues.filter((entry) => entry.severity === 'high')) {
    concerns.push(issue.title)
  }
  for (const issue of atsIssues
    .filter((entry) => entry.severity === 'medium' && entry.category !== 'keywords')
    .slice(0, 2)) {
    concerns.push(issue.title)
  }
  if (achievement.responsibilitiesOnly > 0) {
    concerns.push(
      `${achievement.responsibilitiesOnly} of ${achievement.total} bullets state a duty with no result.`,
    )
  }

  return concerns.slice(0, MAX_LIST)
}

function buildRecommendations(
  analysis: KeywordAnalysis,
  atsIssues: AtsIssue[],
  achievement: RecruiterAnalysis['achievementQuality'],
): string[] {
  const recommendations: string[] = []
  const keywordIssue = atsIssues.find((issue) => issue.category === 'keywords')

  for (const issue of [...atsIssues].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  )) {
    if (issue.category === 'keywords') {
      recommendations.push(issue.suggestion)
      continue
    }
    recommendations.push(`${issue.title}: ${issue.suggestion}`)
  }

  if (!keywordIssue && analysis.coverage.missing.length > 0) {
    const sample = analysis.coverage.missing.slice(0, SAMPLE).map((match) => match.term)
    recommendations.push(
      `If you genuinely have experience with ${listed(sample)}, add it with a concrete example. Leave out anything you cannot evidence.`,
    )
  }

  if (analysis.coverage.related.length > 0) {
    const match = analysis.coverage.related[0]!
    recommendations.push(
      `The posting names ${match.term} and your resume only shows ${match.relatedTerm ?? 'something related'}. Use the exact name if that is the technology you use.`,
    )
  }

  if (achievement.responsibilitiesOnly > 0) {
    recommendations.push(
      `Rewrite ${achievement.responsibilitiesOnly} duty-only bullets so each one states the result, and add a number where one is true.`,
    )
  }

  return dedupe(recommendations).slice(0, MAX_LIST)
}

function severityRank(severity: AtsIssue['severity']): number {
  if (severity === 'high') return 0
  if (severity === 'medium') return 1
  return 2
}

function buildAssessment(analysis: KeywordAnalysis, atsScore: number): string {
  if (analysis.terms.length === 0) {
    return `No requirements could be read from the job description, so coverage was not calculated. ${DISCLAIMER}`
  }

  return `Your resume matches ${analysis.coverage.matched.length} of ${analysis.terms.length} terms read from the posting (${analysis.coverage.coverage}% coverage) and scores ${atsScore}/100 for ATS readiness. ${DISCLAIMER}`
}

/**
 * Compares a resume with a job description and produces the recruiter review.
 *
 * The engine runs entirely on the parsed models, is deterministic, and obeys the
 * project's anti-fabrication contract: every match, score and note is derived
 * from text that exists in one of the two inputs, and anything the posting did
 * not state is left out rather than filled in.
 */
export function analyzeResumeAgainstJob(resume: Resume, job: JobDescription): RecruiterAnalysis {
  const passages = buildResumeIndex(resume)
  const analysis = analyzeKeywords(job, passages)
  const achievement = assessAchievementQuality(resume)
  const ats = runAtsReview(resume, job, analysis.coverage)
  const relevance = scoreExperienceRelevance(resume, analysis.matches)
  const years = totalYearsExperience(resume)
  const jobMatch = buildJobMatch(analysis, years)
  const skillsMatch = buildSkillsMatch(job, passages)

  const skillsTotal = skillsMatch.matched.length + skillsMatch.missing.length
  const skillsScore =
    skillsTotal === 0 ? 0 : Math.round((skillsMatch.matched.length / skillsTotal) * 100)
  const experienceScore =
    relevance.length === 0
      ? 0
      : Math.round(relevance.reduce((total, entry) => total + entry.score, 0) / relevance.length)

  const matchScore = clamp(
    WEIGHTS.coverage * analysis.coverage.coverage +
      WEIGHTS.skills * skillsScore +
      WEIGHTS.experience * experienceScore +
      WEIGHTS.achievements * achievement.score +
      WEIGHTS.ats * ats.score,
  )

  return {
    matchScore,
    overallAssessment: buildAssessment(analysis, ats.score),
    firstImpression: buildFirstImpression(resume, analysis, ats.issues, achievement),
    jobMatch,
    experienceRelevance: relevance,
    skillsMatch,
    keywordCoverage: analysis.coverage,
    atsReview: ats,
    achievementQuality: achievement,
    concerns: buildConcerns(analysis, ats.issues, achievement, job, years),
    recommendations: buildRecommendations(analysis, ats.issues, achievement),
    provider: 'local',
  }
}
