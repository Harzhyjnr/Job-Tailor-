import { useEffect, useMemo } from 'react'

import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppState } from '@/hooks/useAppState'
import { tailorResumeAgainstJob } from '@/services/tailorEngine'

/**
 * Builds the tailored copy from the current resume and job description.
 *
 * The engine is synchronous and only reuses existing wording, so the result is
 * memoized on the two inputs and mirrored into the store where the editor and
 * the export stage read it.
 */
export function useTailoring() {
  const { state } = useAppState()
  const dispatch = useAppDispatch()
  const { resume, job } = state

  const tailoredResume = useMemo(
    () => (resume && job ? tailorResumeAgainstJob(resume, job) : null),
    [resume, job],
  )

  useEffect(() => {
    dispatch({ type: 'setTailoredResume', tailoredResume })
  }, [tailoredResume, dispatch])

  return { tailoredResume, canTailor: resume !== null && job !== null }
}
