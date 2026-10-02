import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { TextArea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'

describe('Button', () => {
  it('calls the click handler', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Tailor My Resume</Button>)

    await user.click(screen.getByRole('button', { name: 'Tailor My Resume' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disables interaction while loading', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button loading onClick={onClick}>
        Analyzing
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Analyzing' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Card', () => {
  it('renders header, body and footer content', () => {
    render(
      <Card>
        <CardHeader title="Resume Match" description="Internal comparison only" />
        <CardBody>Body content</CardBody>
        <CardFooter>Footer content</CardFooter>
      </Card>,
    )

    expect(screen.getByRole('heading', { name: 'Resume Match' })).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('associates the label with the input', async () => {
    const user = userEvent.setup()
    render(<TextInput label="Full name" />)

    const input = screen.getByLabelText('Full name')
    await user.type(input, 'Ada Lovelace')
    expect(input).toHaveValue('Ada Lovelace')
  })

  it('links hint and error text to the control', () => {
    const { rerender } = render(
      <TextArea label="Job description" hint="Paste the entire posting." />,
    )

    expect(screen.getByLabelText('Job description')).toHaveAccessibleDescription(
      'Paste the entire posting.',
    )

    rerender(<TextArea label="Job description" error="Please provide the job description." />)

    const field = screen.getByLabelText('Job description')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Please provide the job description.')
  })
})

describe('ProgressBar', () => {
  it('exposes value semantics to assistive technology', () => {
    render(<ProgressBar value={78} label="Resume match" showValue />)

    const bar = screen.getByRole('progressbar', { name: 'Resume match' })
    expect(bar).toHaveAttribute('aria-valuenow', '78')
    expect(screen.getByText('78%')).toBeInTheDocument()
  })

  it('clamps out-of-range values', () => {
    render(<ProgressBar value={140} label="Resume match" showValue />)

    expect(screen.getByRole('progressbar', { name: 'Resume match' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })
})

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} title="Privacy" onClose={vi.fn()}>
        Body
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes dialog semantics and closes on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open title="Privacy" onClose={onClose}>
        Body
      </Modal>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Privacy' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves focus into the dialog when it opens', () => {
    render(
      <Modal open title="Privacy" onClose={vi.fn()}>
        Body
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Privacy' })).toHaveFocus()
  })
})

describe('States', () => {
  it('announces errors assertively and offers a retry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <ErrorState
        title="We couldn't extract enough text from this file."
        actionLabel="Try again"
        onRetry={onRetry}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't extract enough text from this file.")

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('marks loading state as a polite live region', () => {
    render(<LoadingState label="Analyzing your resume" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Analyzing your resume')
  })

  it('renders an empty state with a title', () => {
    render(<EmptyState title="Nothing here yet" description="Paste a job description to begin." />)

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.getByText('Paste a job description to begin.')).toBeInTheDocument()
  })
})
