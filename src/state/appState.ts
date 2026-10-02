import type { AppState } from '@/types/analysis'
import type { Resume } from '@/types/resume'

export type AppAction =
  | { type: 'importResume'; file: File }
  | { type: 'importResumeText'; text: string }
  | { type: 'importResumeSucceeded'; resume: Resume; sourceKind: string; warnings?: string[] }
  | { type: 'importResumeFailed'; message: string }
  | { type: 'dismissImportError' }
  | { type: 'setResumeText'; text: string }
  | { type: 'setJobDescriptionText'; text: string }
  | { type: 'setJob'; job: AppState['job'] }
  | { type: 'setResume'; resume: AppState['resume'] }
  | { type: 'setAnalysis'; analysis: AppState['analysis'] }
  | { type: 'setTailoredResume'; tailoredResume: AppState['tailoredResume'] }
  | { type: 'updatePreferences'; preferences: Partial<AppState['preferences']> }
  | { type: 'reset' }

/** Import state lives alongside the resume so a failure never loses user input. */
export interface ResumeImport {
  status: 'idle' | 'reading' | 'parsing' | 'done' | 'error'
  error?: string
  warnings?: string[]
  sourceKind?: string
}

export interface AppStoreState extends AppState {
  resumeImport: ResumeImport
}

export const initialAppState: AppStoreState = {
  resume: null,
  job: null,
  jobDescriptionText: '',
  analysis: null,
  tailoredResume: null,
  preferences: {
    templateId: 'ats-classic',
    fontSizePt: 11,
    lineHeight: 1.45,
    marginIn: 0.75,
  },
  resumeImport: { status: 'idle' },
}

const idleImport: ResumeImport = { status: 'idle' }

export function appReducer(state: AppStoreState, action: AppAction): AppStoreState {
  switch (action.type) {
    case 'importResume':
      return { ...state, resumeImport: { status: 'reading' } }
    case 'importResumeText':
      return { ...state, resumeImport: { status: 'parsing' } }
    case 'importResumeSucceeded':
      return {
        ...state,
        resume: action.resume,
        resumeImport: {
          status: 'done',
          ...(action.warnings && action.warnings.length > 0
            ? { warnings: [...action.warnings] }
            : {}),
          sourceKind: action.sourceKind,
        },
      }
    case 'importResumeFailed':
      return { ...state, resumeImport: { status: 'error', error: action.message } }
    case 'dismissImportError':
      return { ...state, resumeImport: idleImport }
    case 'setResumeText':
      return { ...state, resume: null, resumeImport: idleImport }
    case 'setJobDescriptionText':
      return { ...state, jobDescriptionText: action.text }
    case 'setJob':
      return { ...state, job: action.job }
    case 'setResume':
      return { ...state, resume: action.resume }
    case 'setAnalysis':
      return { ...state, analysis: action.analysis }
    case 'setTailoredResume':
      return { ...state, tailoredResume: action.tailoredResume }
    case 'updatePreferences':
      return { ...state, preferences: { ...state.preferences, ...action.preferences } }
    case 'reset':
      return initialAppState
  }
}
