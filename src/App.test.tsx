import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from '@/App'

describe('App', () => {
  it('renders the landing page hero', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: 'Tailor your resume to the job. Without losing your story.',
        level: 1,
      }),
    ).toBeInTheDocument()
  })

  it('states the privacy promise on the landing page', () => {
    render(<App />)

    expect(
      screen.getByText(
        'Your resume stays in your browser. Job Tailor does not require an account or database.',
      ),
    ).toBeInTheDocument()
  })

  it('lists the five workflow steps', () => {
    render(<App />)

    const steps = screen.getAllByRole('listitem')
    expect(steps.length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText('Upload your resume')).toBeInTheDocument()
    expect(screen.getByText('Download your PDF')).toBeInTheDocument()
  })

  it('opens the privacy modal from the header and closes it again', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Privacy' }))

    const dialog = screen.getByRole('dialog', { name: 'Privacy' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/not uploaded to a Job Tailor server/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Privacy' })).not.toBeInTheDocument()
  })

  it('navigates into the workspace from the primary CTA', async () => {
    const user = userEvent.setup()
    render(<App />)

    const primaryCta = screen.getAllByRole('button', { name: 'Tailor My Resume' })[0]!
    await user.click(primaryCta)

    expect(screen.getByRole('navigation', { name: 'Workflow progress' })).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a PDF or DOCX file')).toBeInTheDocument()
  })
})
