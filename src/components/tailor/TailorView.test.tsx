import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TailorView } from '@/components/tailor/TailorView'
import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import { tailorResumeAgainstJob } from '@/services/tailorEngine'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)
const tailored = tailorResumeAgainstJob(resume, job)

function renderView() {
  return render(<TailorView original={resume} tailored={tailored} />)
}

describe('TailorView', () => {
  it('promises what the engine did not do', () => {
    renderView()

    expect(
      screen.getByText(
        'Every line below is reused from your resume. Nothing was added, and no claim was removed.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the original next to every rewrite', () => {
    renderView()

    expect(screen.getAllByText('Original').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tailored').length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        'Cutting month-end close time by 40%: led migration of the core ledger service to PostgreSQL.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
      ),
    ).toBeInTheDocument()
  })

  it('lists every change with the source text it reused', () => {
    renderView()

    expect(screen.getByText('Tailored copy')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Rewrote the summary from your current role and your strongest, most relevant evidence. Both parts are copied from the resume.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Reordered the skills list so the posting's own terms come first: PostgreSQL, Docker, Java, REST, AWS.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Led with the result instead of the task in 1 bullet at Senior Backend Engineer at Meridian Payments. Same words, result first.',
      ),
    ).toBeInTheDocument()
  })

  it('names the requirements it refused to invent', () => {
    renderView()

    expect(screen.getByText('Left out on purpose (7)')).toBeInTheDocument()
    expect(screen.getAllByText('Kotlin').length).toBeGreaterThan(0)
    expect(
      screen.getByText('You mention Java, which is related but not the same term.'),
    ).toBeInTheDocument()
  })

  it('tells the user to add a term only if they can back it up', () => {
    renderView()

    expect(screen.getByText(/Add them only if you can back them up\./)).toBeInTheDocument()
  })

  it('reports no changes when the engine had nothing to do', () => {
    const untouched = { ...tailored, changeLog: [] }
    render(<TailorView original={resume} tailored={untouched} />)

    expect(screen.getByText('0 changes')).toBeInTheDocument()
    expect(
      screen.getByText(/The resume already puts the most relevant evidence first/),
    ).toBeInTheDocument()
  })
})
