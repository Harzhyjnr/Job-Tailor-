import { describe, expect, it } from 'vitest'

import { appReducer, initialAppState } from '@/state/appState'
import type { AppStoreState } from '@/state/appState'
import type { JobDescription } from '@/types/job'
import type { Resume } from '@/types/resume'

const job: JobDescription = {
  seniority: 'mid',
  requirements: [],
  preferred: [],
  responsibilities: [],
  certifications: [],
  technicalSkills: [],
  softSkills: [],
  rawText: 'Backend engineer',
}

const resume: Resume = {
  personalInfo: { name: 'Ada Lovelace' },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
  awards: [],
  languages: [],
  detectedSections: ['experience'],
  missingSections: ['education'],
  rawText: 'Ada Lovelace',
}

describe('appReducer defaults', () => {
  it('starts with the ATS Classic single-column default', () => {
    expect(initialAppState.preferences.templateId).toBe('ats-classic')
    expect(initialAppState.resume).toBeNull()
    expect(initialAppState.jobDescriptionText).toBe('')
    expect(initialAppState.resumeImport.status).toBe('idle')
  })
})

describe('resume import', () => {
  it('marks the file as being read', () => {
    const next = appReducer(initialAppState, {
      type: 'importResume',
      file: new File(['x'], 'resume.pdf'),
    })

    expect(next.resumeImport.status).toBe('reading')
  })

  it('marks pasted text as being parsed', () => {
    const next = appReducer(initialAppState, { type: 'importResumeText', text: 'Ada' })

    expect(next.resumeImport.status).toBe('parsing')
  })

  it('stores the parsed resume with its source kind and warnings', () => {
    const next = appReducer(initialAppState, {
      type: 'importResumeSucceeded',
      resume,
      sourceKind: 'docx',
      warnings: ['Some headings were not recognized.'],
    })

    expect(next.resume).toBe(resume)
    expect(next.resumeImport.status).toBe('done')
    expect(next.resumeImport.sourceKind).toBe('docx')
    expect(next.resumeImport.warnings).toEqual(['Some headings were not recognized.'])
  })

  it('omits warnings when none were reported', () => {
    const next = appReducer(initialAppState, {
      type: 'importResumeSucceeded',
      resume,
      sourceKind: 'text',
    })

    expect(next.resumeImport.warnings).toBeUndefined()
  })

  it('keeps the user-facing message on failure', () => {
    const next = appReducer(initialAppState, {
      type: 'importResumeFailed',
      message: 'We could not read that file.',
    })

    expect(next.resumeImport.status).toBe('error')
    expect(next.resumeImport.error).toBe('We could not read that file.')
  })

  it('clears an error when dismissed', () => {
    const failed = appReducer(initialAppState, {
      type: 'importResumeFailed',
      message: 'We could not read that file.',
    })

    expect(appReducer(failed, { type: 'dismissImportError' }).resumeImport.status).toBe('idle')
  })

  it('drops the previous resume when the import fails', () => {
    const withResume: AppStoreState = {
      ...initialAppState,
      resume,
      resumeImport: { status: 'done' },
    }

    const next = appReducer(withResume, {
      type: 'importResumeFailed',
      message: 'We could not read that file.',
    })

    expect(next.resumeImport.status).toBe('error')
  })
})

describe('other actions', () => {
  it('stores the job description text', () => {
    const next = appReducer(initialAppState, {
      type: 'setJobDescriptionText',
      text: 'Backend engineer',
    })

    expect(next.jobDescriptionText).toBe('Backend engineer')
  })

  it('clears a stale resume when the resume text is replaced', () => {
    const withResume: AppStoreState = { ...initialAppState, resume }

    const next = appReducer(withResume, { type: 'setResumeText', text: 'new' })

    expect(next.resume).toBeNull()
    expect(next.resumeImport.status).toBe('idle')
  })

  it('stores the analyzed job and analysis', () => {
    const withJob = appReducer(initialAppState, { type: 'setJob', job })
    expect(withJob.job).toBe(job)

    const withAnalysis = appReducer(withJob, { type: 'setAnalysis', analysis: null })
    expect(withAnalysis.analysis).toBeNull()
    expect(withAnalysis.job).toBe(job)
  })

  it('merges preference updates without dropping other fields', () => {
    const next = appReducer(initialAppState, {
      type: 'updatePreferences',
      preferences: { fontSizePt: 12 },
    })

    expect(next.preferences.fontSizePt).toBe(12)
    expect(next.preferences.templateId).toBe('ats-classic')
    expect(next.preferences.marginIn).toBe(initialAppState.preferences.marginIn)
  })

  it('resets to the initial state', () => {
    const dirty: AppStoreState = {
      ...initialAppState,
      resume,
      jobDescriptionText: 'text',
      job,
      resumeImport: { status: 'error', error: 'boom' },
      preferences: { ...initialAppState.preferences, templateId: 'minimal' },
    }

    expect(appReducer(dirty, { type: 'reset' })).toEqual(initialAppState)
  })
})
