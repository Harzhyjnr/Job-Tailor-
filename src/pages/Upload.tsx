import { useState } from 'react'
import type { ChangeEvent } from 'react'

import { JobPreview } from '@/components/job/JobPreview'
import { ResumePreview } from '@/components/resume/ResumePreview'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { TextArea } from '@/components/ui/Field'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useAppState } from '@/hooks/useAppState'
import { useResumeImport } from '@/hooks/useResumeImport'
import { parseJobDescription } from '@/services/jobParser'

export interface UploadProps {
  onContinue: () => void
}

type ImportMode = 'upload' | 'paste'

export function Upload({ onContinue }: UploadProps) {
  const [mode, setMode] = useState<ImportMode>('upload')
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const { state } = useAppState()
  const { importFile, importText } = useResumeImport()

  const { resume, resumeImport } = state
  const {
    status: importStatus,
    error: importError,
    warnings: importWarnings,
    sourceKind,
  } = resumeImport

  const isBusy = importStatus === 'reading' || importStatus === 'parsing'

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    await importFile(file)
  }

  async function onPaste() {
    await importText(pasteText)
  }

  if (isBusy) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LoadingState
          label={importStatus === 'reading' ? 'Reading your file…' : 'Reading your resume…'}
          description="Text extraction runs in your browser. Nothing is uploaded."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Upload your resume</h1>
        <p className="mt-2 text-ink-muted">
          Upload your current resume, or paste it as plain text. Nothing leaves your browser.
        </p>
      </div>

      {importStatus === 'error' && importError ? <ErrorState title={importError} /> : null}

      {importStatus === 'done' && resume ? (
        <>
          {importWarnings && importWarnings.length > 0 ? (
            <div
              role="status"
              className="rounded-card border border-warning/30 bg-warning-subtle px-5 py-4"
            >
              <p className="text-sm font-semibold text-warning">Read with some gaps</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-ink-muted">
                {importWarnings.slice(0, 4).map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <ResumePreview resume={resume} />

          {sourceKind ? (
            <p className="text-xs text-ink-subtle">Imported from {sourceKind.toUpperCase()}.</p>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={onContinue}>Continue</Button>
          </div>
        </>
      ) : (
        <Card className="p-6">
          <div role="tablist" aria-label="Resume import method" className="flex gap-2">
            <Button
              role="tab"
              aria-selected={mode === 'upload'}
              variant={mode === 'upload' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('upload')}
            >
              Upload file
            </Button>
            <Button
              role="tab"
              aria-selected={mode === 'paste'}
              variant={mode === 'paste' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('paste')}
            >
              Paste text
            </Button>
          </div>

          <CardBody>
            {mode === 'upload' ? (
              <div className="flex flex-col gap-3">
                <label
                  htmlFor="resume-file"
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-10 text-center hover:border-brand"
                >
                  <span className="text-sm font-medium text-ink">Choose a PDF or DOCX file</span>
                  <input
                    id="resume-file"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={onFileChange}
                    className="sr-only"
                  />
                </label>
                <p className="text-sm text-ink-subtle">
                  PDF and DOCX, maximum 5 MB. Scanned PDFs without selectable text cannot be read —
                  paste the text instead.
                </p>
                {fileName && importStatus !== 'error' ? (
                  <p className="text-sm text-ink-subtle">Last file: {fileName}</p>
                ) : null}
              </div>
            ) : (
              <TextArea
                label="Paste your resume"
                rows={14}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder="Paste the full text of your resume here."
                hint="Include headings like Experience, Education and Skills so they can be detected."
              />
            )}
          </CardBody>

          <div className="mt-6 flex justify-end">
            {mode === 'paste' ? (
              <Button disabled={pasteText.trim().length === 0} onClick={onPaste}>
                Import resume
              </Button>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  )
}

export function JobInput({ onContinue }: { onContinue: () => void }) {
  const { state, dispatch } = useAppState()
  const { jobDescriptionText, job } = state
  const [text, setText] = useState(jobDescriptionText)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(job === null)

  function onAnalyze() {
    const { job: parsed, warnings: parseWarnings } = parseJobDescription(text)
    dispatch({ type: 'setJobDescriptionText', text })
    dispatch({ type: 'setJob', job: parsed })
    setWarnings(parseWarnings)
    setIsEditing(false)
  }

  if (!isEditing && job) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Job description</h1>
          <p className="mt-2 text-ink-muted">
            Review what was read from the posting before comparing it with your resume.
          </p>
        </div>

        {warnings.length > 0 ? (
          <div
            role="status"
            className="rounded-card border border-warning/30 bg-warning-subtle px-5 py-4"
          >
            <p className="text-sm font-semibold text-warning">Read with some gaps</p>
            <ul className="mt-1 list-disc pl-4 text-sm text-ink-muted">
              {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <JobPreview job={job} />

        <div className="flex justify-between gap-3">
          <Button variant="secondary" onClick={() => setIsEditing(true)}>
            Edit description
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Paste the job description</h1>
      <p className="mt-2 text-ink-muted">
        Paste the entire posting. Requirements, skills and responsibilities are separated
        automatically in your browser.
      </p>

      <Card className="mt-6 p-6">
        <CardHeader
          title="Job Description"
          description="Include the title, company and all sections so they can be detected."
        />
        <CardBody>
          <TextArea
            label="Job description"
            rows={16}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              'Job title\nCompany\nLocation\nRequirements\nResponsibilities\nPreferred qualifications'
            }
            hint="Headings such as Requirements, Responsibilities and Preferred qualifications are detected automatically."
          />
        </CardBody>
        <div className="mt-6 flex justify-end">
          <Button disabled={text.trim().length === 0} onClick={onAnalyze}>
            Analyze Job
          </Button>
        </div>
      </Card>
    </div>
  )
}
