import type { JobDescription } from './job'
import type { Resume } from './resume'

/**
 * Match strength for a single job requirement or keyword.
 * Ordered from strongest to weakest; `needs-clarification` is distinct from `missing`
 * because the evidence may exist but is not stated clearly enough for a recruiter.
 */
export type MatchStatus = 'strong' | 'partial' | 'missing' | 'needs-clarification'

export interface KeywordMatch {
  term: string
  status: MatchStatus
  /** Resume passages that justify the status. Empty when status is `missing`. */
  evidence: string[]
  /** True when the term is close to, but not identical to, something in the resume. */
  related: boolean
  /** The near-equivalent found in the resume, when `related` is true. */
  relatedTerm?: string
}

export interface KeywordCoverage {
  matched: KeywordMatch[]
  missing: KeywordMatch[]
  related: KeywordMatch[]
  /** Coverage ratio over job requirements, 0-100. */
  coverage: number
}

export interface RequirementMatch {
  label: string
  status: MatchStatus
  importance: 'required' | 'preferred'
  evidence: string[]
  note?: string
}

export interface ExperienceRelevance {
  experienceId: string
  company?: string
  title?: string
  /** 0-100 relevance to the target role. */
  score: number
  status: MatchStatus
  rationale: string
  matchedTerms: string[]
}

export interface AtsIssue {
  id: string
  category:
    | 'structure'
    | 'contact'
    | 'dates'
    | 'titles'
    | 'formatting'
    | 'keywords'
    | 'length'
    | 'readability'
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  suggestion: string
}

export interface AchievementQuality {
  total: number
  withActionVerb: number
  withOutcome: number
  withMetric: number
  responsibilitiesOnly: number
  score: number
  notes: string[]
}

export interface RecruiterAnalysis {
  /** 0-100 internal comparison only. Never presented as a hiring prediction. */
  matchScore: number
  overallAssessment: string
  firstImpression: {
    standsOut: string[]
    unclear: string[]
    strong: string[]
    hesitations: string[]
  }
  jobMatch: {
    strongMatches: RequirementMatch[]
    partialMatches: RequirementMatch[]
    missingRequirements: RequirementMatch[]
  }
  experienceRelevance: ExperienceRelevance[]
  skillsMatch: {
    matched: string[]
    missing: string[]
    extra: string[]
  }
  keywordCoverage: KeywordCoverage
  atsReview: {
    score: number
    passed: string[]
    issues: AtsIssue[]
  }
  achievementQuality: AchievementQuality
  concerns: string[]
  recommendations: string[]
  /** Which provider produced this analysis; useful when comparing local vs BYOK output. */
  provider: string
}

export interface TailoredResume extends Resume {
  /** Human-readable notes describing what the engine changed and why. */
  changeLog: TailoringChange[]
  /** Job requirements the resume still does not evidence. Surfaced for user follow-up. */
  uncoveredRequirements: RequirementMatch[]
}

export interface TailoringChange {
  section: string
  summary: string
  /** The exact source text reused from the original resume, when applicable. */
  sourceText?: string
}

export interface AppState {
  resume: Resume | null
  job: JobDescription | null
  jobDescriptionText: string
  analysis: RecruiterAnalysis | null
  tailoredResume: TailoredResume | null
  preferences: UserPreferences
}

export interface UserPreferences {
  templateId: string
  fontSizePt: number
  lineHeight: number
  marginIn: number
}
