import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/context/ToastContext'
import { ToastViewport } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'

function Trigger() {
  const { showToast } = useToast()
  return (
    <Button onClick={() => showToast({ tone: 'success', title: 'Resume successfully imported' })}>
      Show toast
    </Button>
  )
}

function renderWithToasts() {
  return render(
    <ToastProvider>
      <Trigger />
      <ToastViewport />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  it('shows nothing before a toast is requested', () => {
    renderWithToasts()
    expect(screen.queryByRole('button', { name: 'Dismiss notification' })).not.toBeInTheDocument()
  })

  it('announces a new toast politely', async () => {
    const user = userEvent.setup()
    renderWithToasts()

    await user.click(screen.getByRole('button', { name: 'Show toast' }))

    expect(screen.getByText('Resume successfully imported')).toBeInTheDocument()
    expect(screen.getByText('Success:')).toBeInTheDocument()
  })

  it('dismisses a toast on request', async () => {
    const user = userEvent.setup()
    renderWithToasts()

    await user.click(screen.getByRole('button', { name: 'Show toast' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))

    expect(screen.queryByText('Resume successfully imported')).not.toBeInTheDocument()
  })

  it('throws a helpful error when used outside the provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Trigger />)).toThrow(/must be used within a ToastProvider/)

    error.mockRestore()
  })
})
