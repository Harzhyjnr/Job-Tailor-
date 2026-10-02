import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AppStateProvider } from '@/context/AppStateProvider'
import { ToastProvider } from '@/context/ToastContext'
import { ToastViewport } from '@/components/ui/Toast'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppState } from '@/hooks/useAppState'
import { Analysis, Editor, Preview, Tailor } from '@/pages/Analysis'
import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)

/** The export tests write a real PDF, which is slower than the default budget. */
const SLOW = 30_000

function Seed() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch({ type: 'importResumeSucceeded', resume, sourceKind: 'text' })
    dispatch({ type: 'setJob', job })
  }, [dispatch])

  return null
}

function StoredMatchScore() {
  const { state } = useAppState()

  return <p>stored score: {state.analysis?.matchScore ?? 'none'}</p>
}

function StoredTailoredSummary() {
  const { state } = useAppState()

  return <p>stored tailored: {state.tailoredResume?.summary ?? 'none'}</p>
}

function renderPage(ui: React.ReactNode, withInputs = true) {
  return render(
    <AppStateProvider>
      <ToastProvider>
        {withInputs ? <Seed /> : null}
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  )
}

function ToastProbe() {
  return <ToastViewport />
}

describe('Analysis page', () => {
  it('asks for both inputs before it can review anything', () => {
    renderPage(<Analysis />, false)

    expect(screen.getByText('Add a resume and a job description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tailor My Resume' })).toBeDisabled()
  })

  it('runs the review as soon as both inputs exist', () => {
    renderPage(<Analysis />)

    expect(screen.getByRole('heading', { name: 'Resume match' })).toBeInTheDocument()
    expect(screen.getByText('50% covered')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ATS readiness' })).toBeInTheDocument()
  })

  it('stores the analysis so the next stage can read it', () => {
    renderPage(
      <>
        <Analysis />
        <StoredMatchScore />
      </>,
    )

    expect(screen.getByText(/^stored score: \d+$/)).toBeInTheDocument()
    expect(screen.queryByText(/^stored score: none$/)).not.toBeInTheDocument()
  })

  it('hands the user on to tailoring', () => {
    const onTailor = vi.fn()
    renderPage(<Analysis onTailor={onTailor} />)

    screen.getByRole('button', { name: 'Tailor My Resume' }).click()

    expect(onTailor).toHaveBeenCalledOnce()
  })
})

describe('Tailor page', () => {
  it('waits for a resume and a job description before it can tailor', () => {
    renderPage(<Tailor />, false)

    expect(screen.getByText('Run the recruiter review first')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to editor' })).toBeDisabled()
  })

  it('shows the tailored copy beside the original and stores it', () => {
    renderPage(
      <>
        <Analysis />
        <Tailor />
        <StoredTailoredSummary />
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Tailored copy' })).toBeInTheDocument()
    expect(screen.getAllByText('Original').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(
        'Cutting month-end close time by 40%: led migration of the core ledger service to PostgreSQL.',
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Continue to editor' })).toBeEnabled()
    expect(screen.getByText(/^stored tailored: \S/)).toBeInTheDocument()
  })

  it('reports the requirements it left out', () => {
    renderPage(
      <>
        <Analysis />
        <Tailor />
      </>,
    )

    expect(screen.getByText(/^Left out on purpose \(\d+\)$/)).toBeInTheDocument()
  })
})

describe('Editor page', () => {
  it('will not open before there is a tailored copy to edit', () => {
    renderPage(<Editor />, false)

    expect(screen.getByText('Tailor your resume first')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to export' })).toBeDisabled()
  })

  it('opens the tailored copy with the live preview beside it', () => {
    renderPage(
      <>
        <Tailor />
        <Editor />
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Live Preview' })).toBeInTheDocument()
    expect(screen.getAllByTestId('ats-classic')).toHaveLength(1)
    expect(screen.getByLabelText('Summary')).toHaveValue(
      'Senior Backend Engineer at Meridian Payments. Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
    )
  })

  it('saves every edit into app state as it is typed', async () => {
    const user = userEvent.setup()
    renderPage(
      <>
        <Tailor />
        <Editor />
        <StoredTailoredSummary />
      </>,
    )

    const summary = screen.getByLabelText('Summary')
    await user.clear(summary)
    await user.type(summary, 'Payment platform engineer.')

    expect(screen.getByTestId('ats-classic')).toHaveTextContent('Payment platform engineer.')
    expect(screen.getByText('stored tailored: Payment platform engineer.')).toBeInTheDocument()
  })

  it('restores the tailored copy after a manual edit', async () => {
    const user = userEvent.setup()
    renderPage(
      <>
        <Tailor />
        <Editor />
        <StoredTailoredSummary />
      </>,
    )

    await user.clear(screen.getByLabelText('Summary'))
    await user.type(screen.getByLabelText('Summary'), 'Payment platform engineer.')
    await user.click(screen.getByRole('button', { name: 'Reset to tailored copy' }))

    expect(screen.getByLabelText('Summary')).toHaveValue(
      'Senior Backend Engineer at Meridian Payments. Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
    )
    expect(screen.getByText(/^stored tailored: Senior Backend Engineer/)).toBeInTheDocument()
  })

  it('switches the preview between page widths', async () => {
    const user = userEvent.setup()
    renderPage(
      <>
        <Tailor />
        <Editor />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Mobile view' }))

    expect(screen.getByRole('button', { name: 'Desktop view' })).toBeInTheDocument()
  })
})

describe('Preview page', () => {
  it('will not export a document that was never tailored', () => {
    renderPage(<Preview />, false)

    expect(screen.getByText('There is nothing to export yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull()
  })

  it('shows the document that will be written', () => {
    renderPage(
      <>
        <Tailor />
        <Editor />
        <Preview />
      </>,
    )

    expect(screen.getByRole('heading', { name: 'The file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
  })

  it('runs the pre-flight check against the text the user ended up with', async () => {
    const user = userEvent.setup()
    renderPage(
      <>
        <Tailor />
        <Editor />
        <Preview />
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Before you send it' })).toBeInTheDocument()
    expect(screen.getByText(/requirements are still not evidenced/)).toBeInTheDocument()

    const skills = screen.getByLabelText('Skills')
    await user.clear(skills)
    await user.type(skills, 'Kubernetes')

    expect(screen.queryByText(/still not evidenced: Kubernetes/)).toBeNull()
  })

  it('writes the file and says how many pages it took', { timeout: SLOW }, async () => {
    const user = userEvent.setup()
    const clicks: string[] = []
    const createObjectURL = vi.fn(() => 'blob:resume')
    const revokeObjectURL = vi.fn()

    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download)
    })

    renderPage(
      <>
        <Tailor />
        <Editor />
        <Preview />
        <ToastProbe />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Download PDF' }))

    expect(clicks).toEqual(['ada-lovelace-resume.pdf'])
    expect(revokeObjectURL).toHaveBeenCalled()
    // Two pages at the app's defaults: this resume does not fit on one page
    // inside 0.75in margins at 1.45 line height, and the count has to be reported
    // honestly rather than rounded down to look tidier.
    expect(screen.getByText('2 pages, text-based, written in your browser.')).toBeInTheDocument()

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it(
    'reports a failure instead of pretending the file was written',
    { timeout: SLOW },
    async () => {
      const user = userEvent.setup()
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
        throw new Error('denied')
      })

      renderPage(
        <>
          <Tailor />
          <Editor />
          <Preview />
          <ToastProbe />
        </>,
      )

      await user.click(screen.getByRole('button', { name: 'Download PDF' }))

      expect(
        screen.getByText('The PDF could not be produced from this document.'),
      ).toBeInTheDocument()

      vi.restoreAllMocks()
    },
  )

  it('copies the document as plain text for portals that ask for it', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    renderPage(
      <>
        <Tailor />
        <Editor />
        <Preview />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Copy as plain text' }))

    expect(writeText).toHaveBeenCalledOnce()
    expect(String(writeText.mock.calls[0]?.[0])).toContain('Ada Lovelace')
    expect(String(writeText.mock.calls[0]?.[0])).toContain('SUMMARY')

    vi.unstubAllGlobals()
  })
})
