import type { RecruiterAnalysis, TailoredResume } from '@/types/analysis'
import type { JobDescription } from '@/types/job'
import type { Resume } from '@/types/resume'

/**
 * Every analysis and tailoring operation in the app goes through this interface so the
 * engine can run fully offline (LocalProvider) or be backed by a user-supplied
 * API key (BYOK providers) without touching UI code.
 *
 * Providers MUST obey the anti-fabrication contract: they may reorder, rephrase and
 * emphasise information present in `resume`, but may never introduce employers,
 * titles, dates, metrics, technologies, certifications or education that the source
 * resume does not contain.
 */
export interface AIProvider {
  readonly id: string
  readonly label: string
  /** False for providers that require a key or network access. */
  readonly isOffline: boolean

  analyzeResume(resume: Resume, job: JobDescription): Promise<RecruiterAnalysis>

  tailorResume(resume: Resume, job: JobDescription): Promise<TailoredResume>
}

export interface ProviderCredentials {
  apiKey?: string
  model?: string
  baseUrl?: string
}
