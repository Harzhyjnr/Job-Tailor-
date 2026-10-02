/** The workflow stages a user moves through, in order. */
export const STAGES = ['Resume', 'Job', 'Recruiter Review', 'Tailor', 'Editor', 'Export'] as const

export type Stage = (typeof STAGES)[number]

/** Human-readable labels for each workflow stage, keyed by the Stage union. */
export const STAGE_LABELS: Record<Stage, string> = {
  Resume: 'Upload your resume',
  Job: 'Paste the job description',
  'Recruiter Review': 'Senior Recruiter Review',
  Tailor: 'Tailor your resume',
  Editor: 'Resume Editor',
  Export: 'Preview and export',
}
