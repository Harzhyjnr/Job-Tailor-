import { useEffect, useMemo } from 'react'

import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppState } from '@/hooks/useAppState'
import { analyzeResumeAgainstJob } from '@/services/analysisEngine'

/**
 * Produces the recruiter review for the current resume and job description.
 *
 * The engine is synchronous and deterministic, so the result is memoized on the
 * two inputs and mirrored into the store, where the tailoring and export stages
 * read it.
 */
export function useRecruiterAnalysis() {
  const { state } = useAppState()
  const dispatch = useAppDispatch()
  const { resume, job } = state

  const analysis = useMemo(
    () => (resume && job ? analyzeResumeAgainstJob(resume, job) : null),
    [resume, job],
  )

  useEffect(() => {
    dispatch({ type: 'setAnalysis', analysis })
  }, [analysis, dispatch])

  return { analysis, canAnalyze: resume !== null && job !== null }
}
