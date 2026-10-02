import { useMemo, useState } from 'react'

import { RecruiterReview } from '@/components/analysis/RecruiterReview'
import { ResumeEditor } from '@/components/editor/ResumeEditor'
import { ClassicTemplate } from '@/components/preview/ClassicTemplate'
import { TailorView } from '@/components/tailor/TailorView'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/States'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppState } from '@/hooks/useAppState'
import { useRecruiterAnalysis } from '@/hooks/useRecruiterAnalysis'
import { useTailoring } from '@/hooks/useTailoring'
import { useToast } from '@/hooks/useToast'
import { analyzeResumeAgainstJob } from '@/services/analysisEngine'
import { buildResumeDocument } from '@/services/resumeDocument'
import { FONT_NOTE, exportResumePdf, exportResumeText } from '@/services/resumePdf'
import { tailorResumeAgainstJob } from '@/services/tailorEngine'
import type { RecruiterAnalysis, UserPreferences } from '@/types/analysis'
import type { Resume } from '@/types/resume'

/**
 * Recruiter review stage. The analysis runs on every input change and is stored in
 * app state; the original resume is never modified here.
 */
export function Analysis({ onTailor }: { onTailor?: () => void }) {
  const { state } = useAppState()
  const { analysis, canAnalyze } = useRecruiterAnalysis()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Senior Recruiter Review</h1>
      <p className="mt-2 text-ink-muted">Your original resume, reviewed before anything changes.</p>

      {analysis ? (
        <div className="mt-6">
          <RecruiterReview analysis={analysis} job={state.job!} />
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          title={canAnalyze ? 'Analysis is unavailable' : 'Add a resume and a job description'}
          description={
            canAnalyze
              ? 'The review could not be produced from the text that was parsed.'
              : 'Paste a job description on the previous step. The review is built only from your resume and the posting.'
          }
        />
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onTailor} disabled={!analysis}>
          Tailor My Resume
        </Button>
      </div>
    </div>
  )
}

/**
 * Tailoring stage. The engine reuses the wording of the resume to reorder and
 * re-lead what is already there, and reports what it refused to invent.
 */
export function Tailor({ onContinue }: { onContinue?: () => void }) {
  const { state } = useAppState()
  const { tailoredResume, canTailor } = useTailoring()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Tailor My Resume</h1>
      <p className="mt-2 text-ink-muted">
        Rewrites only what your resume already supports. Nothing is invented.
      </p>

      {tailoredResume && state.resume ? (
        <div className="mt-6">
          <TailorView original={state.resume} tailored={tailoredResume} />
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          title={
            canTailor ? 'Add a resume and a job description' : 'Run the recruiter review first'
          }
          description={
            canTailor
              ? 'Tailoring needs both a resume and a job description.'
              : 'Tailoring rewrites the text the review already checked, so it runs after the recruiter review.'
          }
        />
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onContinue} disabled={!tailoredResume}>
          Continue to editor
        </Button>
      </div>
    </div>
  )
}

export function Editor({ onContinue }: { onContinue?: () => void }) {
  const { state } = useAppState()
  const dispatch = useAppDispatch()
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [resetNotice, setResetNotice] = useState(false)

  const tailored = state.tailoredResume

  const restoreTailoredCopy = () => {
    if (!state.resume || !state.job) {
      return
    }

    dispatch({
      type: 'setTailoredResume',
      tailoredResume: tailorResumeAgainstJob(state.resume, state.job),
    })
    setResetNotice(true)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Resume Editor</h1>
      <p className="mt-2 text-ink-muted">
        Edit on the left, preview on the right. Autosaves locally.
      </p>

      {tailored ? (
        <div
          className={
            previewWidth === 'desktop' ? 'mt-6 grid gap-6 lg:grid-cols-2' : 'mt-6 grid gap-6'
          }
        >
          <Card className="p-6">
            <CardHeader
              title="Content"
              description="Sections, bullets, dates and skills."
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={restoreTailoredCopy}
                  disabled={!state.resume || !state.job}
                >
                  Reset to tailored copy
                </Button>
              }
            />
            <CardBody>
              <ResumeEditor
                resume={tailored}
                job={state.job ?? undefined}
                onChange={(resume) =>
                  dispatch({ type: 'setTailoredResume', tailoredResume: resume })
                }
              />
              {resetNotice ? (
                <p className="mt-4 text-xs text-ink-subtle">
                  Restored the tailored copy. Anything you typed is gone.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card className="p-6">
            <CardHeader
              title="Live Preview"
              description="ATS Classic: single column, standard headings, no graphics."
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviewWidth(previewWidth === 'desktop' ? 'mobile' : 'desktop')}
                >
                  {previewWidth === 'desktop' ? 'Mobile view' : 'Desktop view'}
                </Button>
              }
            />
            <CardBody>
              <div
                className={
                  previewWidth === 'desktop'
                    ? 'mx-auto w-full max-w-[8.5in]'
                    : 'mx-auto w-full max-w-[3.75in]'
                }
              >
                <div className="overflow-x-auto rounded-card border border-border bg-white shadow-sm">
                  <ClassicTemplate resume={tailored} preferences={state.preferences} />
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-subtle">
                Saved as you type. Export in the next step uses this exact layout.
              </p>
            </CardBody>
          </Card>
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          title="Tailor your resume first"
          description="The editor opens the tailored copy. There is nothing to edit until the tailoring step has run."
        />
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onContinue} disabled={!tailored}>
          Continue to export
        </Button>
      </div>
    </div>
  )
}

export function Preview() {
  const { state } = useAppState()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [pageCount, setPageCount] = useState<number | undefined>(undefined)

  const document = state.tailoredResume
  const dispatch = useAppDispatch()
  const updatePreferences = (patch: Partial<UserPreferences>) =>
    dispatch({ type: 'updatePreferences', preferences: patch })
  const check = useMemo(
    () => (document && state.job ? analyzeResumeAgainstJob(document, state.job) : undefined),
    [document, state.job],
  )

  const download = async () => {
    if (!document) {
      return
    }

    setBusy(true)

    try {
      const result = await exportResumePdf(document, { preferences: state.preferences })
      const url = URL.createObjectURL(result.blob)
      const link = window.document.createElement('a')

      link.href = url
      link.download = result.fileName
      link.click()
      URL.revokeObjectURL(url)

      setPageCount(result.pageCount)
      toast.showToast({
        tone: 'success',
        title: `${result.fileName} downloaded`,
        description: `${result.pageCount} ${result.pageCount === 1 ? 'page' : 'pages'}, text-based, written in your browser.`,
      })
    } catch {
      toast.showToast({
        tone: 'danger',
        title: 'The PDF could not be produced from this document.',
      })
    } finally {
      setBusy(false)
    }
  }

  const copyText = async () => {
    if (!document) {
      return
    }

    try {
      await navigator.clipboard.writeText(exportResumeText(document))
      toast.showToast({
        tone: 'success',
        title: 'Plain text copied',
        description: 'Some portals ask for pasted text instead of a file.',
      })
    } catch {
      toast.showToast({
        tone: 'danger',
        title: 'The clipboard is not available in this browser.',
      })
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Preview and export</h1>
      <p className="mt-2 text-ink-muted">
        ATS Classic is the default template: single column, standard headings, no graphics.
      </p>

      {document ? (
        <div className="mt-6 flex flex-col gap-6">
          {check && document ? (
            <PreFlight analysis={check} wordCount={wordCountOf(document)} />
          ) : null}

          <Card className="p-6">
            <CardHeader
              title="The file"
              description="This is the document that gets written, laid out with the same fonts and the same margins."
              actions={
                pageCount ? <Badge tone="neutral">{pageCount} pages written</Badge> : undefined
              }
            />
            <CardBody>
              <div className="mx-auto w-full max-w-[8.5in] overflow-x-auto rounded-card border border-border bg-white shadow-sm">
                <div data-print-root>
                  <ClassicTemplate resume={document} preferences={state.preferences} />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <TextInput
                  label="Font size (pt)"
                  type="number"
                  min={8}
                  max={14}
                  step={0.5}
                  value={state.preferences.fontSizePt}
                  onChange={(event) =>
                    updatePreferences({ fontSizePt: Number(event.target.value) })
                  }
                />
                <TextInput
                  label="Line height"
                  type="number"
                  min={0.9}
                  max={2}
                  step={0.05}
                  value={state.preferences.lineHeight}
                  onChange={(event) =>
                    updatePreferences({ lineHeight: Number(event.target.value) })
                  }
                />
                <TextInput
                  label="Margin (in)"
                  type="number"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={state.preferences.marginIn}
                  onChange={(event) => updatePreferences({ marginIn: Number(event.target.value) })}
                />
              </div>

              <p className="mt-3 text-xs text-ink-subtle">{FONT_NOTE}</p>
            </CardBody>
            <CardFooter className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={copyText}>
                Copy as plain text
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
              <Button onClick={download} loading={busy}>
                Download PDF
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          title="There is nothing to export yet"
          description="Export works on the copy you edited. Tailor your resume and edit it first."
        />
      )}
    </div>
  )
}

/**
 * The last look before the file leaves the browser. It re-runs the review on the
 * document as it now stands, not on the document the analysis originally saw, so
 * an edit that broke something is caught here rather than by a recruiter.
 */
function PreFlight({ analysis, wordCount }: { analysis: RecruiterAnalysis; wordCount: number }) {
  const blocking = analysis.atsReview.issues.filter((issue) => issue.severity === 'high')
  const uncovered = analysis.jobMatch.missingRequirements

  return (
    <Card className="p-6">
      <CardHeader
        title="Before you send it"
        description="Checked against the text you ended up with, not the text you started with."
        actions={<Badge tone={blocking.length > 0 ? 'warning' : 'success'}>Pre-flight</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm text-ink-muted">
          <li>
            ATS readiness {analysis.atsReview.score} out of 100.{' '}
            {blocking.length > 0
              ? `${blocking.length} ${blocking.length === 1 ? 'issue' : 'issues'} will be seen by a parser: ${blocking
                  .map((issue) => issue.title)
                  .join(', ')}.`
              : 'Nothing here will trip a parser.'}
          </li>
          <li>
            {uncovered.length === 0
              ? 'Every requirement the posting lists is evidenced in the document.'
              : `${uncovered.length} ${uncovered.length === 1 ? 'requirement is' : 'requirements are'} still not evidenced: ${uncovered
                  .map((item) => item.label)
                  .slice(0, 8)
                  .join(
                    ', ',
                  )}${uncovered.length > 8 ? ', and others' : ''}. Export will not add them.`}
          </li>
          <li>
            {wordCount} {wordCount === 1 ? 'word' : 'words'} in the document.
          </li>
        </ul>

        {analysis.concerns.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink">Still worth a look</p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted">
              {analysis.concerns.slice(0, 4).map((concern) => (
                <li key={concern}>{concern}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

function wordCountOf(resume: Resume) {
  const text = buildResumeDocument(resume)
    .map((line) => line.text)
    .join(' ')

  return text.split(/\s+/).filter(Boolean).length
}
