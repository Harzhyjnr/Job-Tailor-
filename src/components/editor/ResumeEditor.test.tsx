import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { ResumeEditor } from '@/components/editor/ResumeEditor'
import { ClassicTemplate } from '@/components/preview/ClassicTemplate'
import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import { tailorResumeAgainstJob } from '@/services/tailorEngine'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'
import type { TailoredResume } from '@/types/analysis'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)

/**
 * The store is the save. Mounting the editor and the preview against one piece of
 * state proves a keystroke reaches both without a save button.
 */
function Harness({ initial }: { initial?: TailoredResume }) {
  const [document, setDocument] = useState<TailoredResume>(
    initial ?? tailorResumeAgainstJob(resume, job),
  )

  return (
    <div>
      <ResumeEditor resume={document} job={job} onChange={setDocument} />
      <div data-testid="preview">
        <ClassicTemplate resume={document} />
      </div>
    </div>
  )
}

describe('ResumeEditor', () => {
  it('opens on the tailored copy', () => {
    render(<Harness />)

    expect(screen.getByLabelText('Summary')).toHaveValue(
      'Senior Backend Engineer at Meridian Payments. Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
    )
    expect(screen.getByText('Experience (2)')).toBeInTheDocument()
    expect(screen.getByText('Education (1)')).toBeInTheDocument()
  })

  it('updates the document and the preview as the user types', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)

    const summary = screen.getByLabelText('Summary')
    await user.clear(summary)
    await user.type(summary, 'Payment platform engineer.')

    expect(screen.getByLabelText('Summary')).toHaveValue('Payment platform engineer.')
    expect(screen.getByTestId('preview')).toHaveTextContent('Payment platform engineer.')
  })

  it('edits contact details without touching the rest of the document', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)

    await user.clear(screen.getByLabelText('Phone'))
    await user.type(screen.getByLabelText('Phone'), '+44 20 7000 0000')

    expect(screen.getByTestId('preview')).toHaveTextContent('+44 20 7000 0000')
    expect(screen.getByTestId('preview')).toHaveTextContent('Senior Backend Engineer')
  })

  it('edits a single bullet in place', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)

    const bullet = screen.getByLabelText('Outcomes 1, Senior Backend Engineer at Meridian Payments')
    await user.clear(bullet)
    await user.type(bullet, 'Rebuilt the ledger service.')

    expect(screen.getByTestId('preview')).toHaveTextContent('Rebuilt the ledger service.')
    expect(screen.getByTestId('preview')).toHaveTextContent('Designed REST APIs')
  })

  it('adds and removes a bullet without disturbing the others', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)

    const addButton = screen.getAllByRole('button', {
      name: 'Add outcome to Senior Backend Engineer at Meridian Payments',
    })[0] as HTMLElement
    await user.click(addButton)
    await user.type(
      screen.getByLabelText('Outcomes 2, Senior Backend Engineer at Meridian Payments'),
      'Cut spend by 12%.',
    )

    expect(screen.getByTestId('preview')).toHaveTextContent('Cut spend by 12%.')

    const removeButton = screen.getAllByRole('button', {
      name: 'Remove outcome 1 from Senior Backend Engineer at Meridian Payments',
    })[0] as HTMLElement
    await user.click(removeButton)

    expect(
      screen.getByLabelText('Outcomes 1, Senior Backend Engineer at Meridian Payments'),
    ).toHaveValue('Cut spend by 12%.')
    expect(
      screen.queryByLabelText('Outcomes 2, Senior Backend Engineer at Meridian Payments'),
    ).toBeNull()
    expect(screen.getByTestId('preview')).toHaveTextContent('Designed REST APIs')
  })

  it('reorders the skills list from one field', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)

    const skills = screen.getByLabelText('Skills')
    await user.clear(skills)
    await user.type(skills, 'Kubernetes, Terraform, Java')

    expect(screen.getByTestId('preview')).toHaveTextContent('Kubernetes, Terraform, Java')
  })

  it('recomputes the keyword readout as terms are added and removed', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)

    const before = screen.getByText(/posting terms are covered by the text above/).textContent
    const skills = screen.getByLabelText('Skills')

    await user.clear(skills)
    await user.type(skills, 'Kotlin')

    expect(screen.getByText(/posting terms are covered by the text above/).textContent).not.toBe(
      before,
    )
  })

  it('stops reporting a requirement as uncovered once the user writes it', async () => {
    const user = userEvent.setup({ delay: null })
    const tailored = tailorResumeAgainstJob(resume, job)
    let latest: TailoredResume | undefined

    function Tracked() {
      const [document, setDocument] = useState(tailored)
      return (
        <ResumeEditor
          resume={document}
          job={job}
          onChange={(next) => {
            latest = next
            setDocument(next)
          }}
        />
      )
    }

    render(<Tracked />)

    expect(tailored.uncoveredRequirements.some((item) => item.label === 'Kubernetes')).toBe(true)

    const skills = screen.getByLabelText('Skills')
    await user.clear(skills)
    await user.type(skills, 'Kubernetes, Java')

    expect(latest?.uncoveredRequirements.some((item) => item.label === 'Kubernetes')).toBe(false)
    expect(latest?.uncoveredRequirements.some((item) => item.label === 'Terraform')).toBe(true)
  })

  it('shows the sections it will not edit as read-only', () => {
    render(<Harness />)

    expect(screen.getByText('Read-only sections')).toBeInTheDocument()
    expect(screen.getByText('Certifications (1)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Certifications 1')).toBeNull()
  })

  it('renders without a job description', () => {
    render(<ResumeEditor resume={tailorResumeAgainstJob(resume, job)} onChange={() => undefined} />)

    expect(screen.getByLabelText('Summary')).toBeInTheDocument()
    expect(screen.queryByText(/posting terms are covered/)).toBeNull()
  })
})
