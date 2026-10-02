import { useCallback } from 'react'

import { useAppDispatch } from '@/hooks/useAppDispatch'
import { parseResume } from '@/services/resumeParser'
import { ExtractionError, extractFromFile, extractFromText } from '@/services/resumeExtractor'

/**
 * Drives resume import: extract text from a File or pasted text, parse it into
 * the normalized Resume model, and push the result into the store. Failures are
 * converted to a user-facing message and never propagate.
 */
export function useResumeImport() {
  const dispatch = useAppDispatch()

  const importFile = useCallback(
    async (file: File) => {
      dispatch({ type: 'importResume', file })

      try {
        const extracted = await extractFromFile(file)
        const { resume, warnings } = parseResume(extracted.text)

        dispatch({
          type: 'importResumeSucceeded',
          resume,
          sourceKind: extracted.kind,
          warnings: [...extracted.warnings, ...warnings],
        })
      } catch (cause) {
        dispatch({
          type: 'importResumeFailed',
          message:
            cause instanceof ExtractionError
              ? cause.userMessage
              : "We couldn't read that file. Try uploading another PDF/DOCX or paste your resume manually.",
        })
      }
    },
    [dispatch],
  )

  const importText = useCallback(
    async (text: string) => {
      dispatch({ type: 'importResumeText', text })

      try {
        const extracted = await extractFromText(text)
        const { resume, warnings } = parseResume(extracted.text)

        dispatch({
          type: 'importResumeSucceeded',
          resume,
          sourceKind: extracted.kind,
          warnings,
        })
      } catch (cause) {
        dispatch({
          type: 'importResumeFailed',
          message:
            cause instanceof ExtractionError
              ? cause.userMessage
              : 'We could not read that resume. Please paste it again.',
        })
      }
    },
    [dispatch],
  )

  return { importFile, importText }
}
