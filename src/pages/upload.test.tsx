import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppStateProvider } from '@/context/AppStateProvider'
import { JobInput, Upload } from '@/pages/Upload'
import { buildDocx } from '@/test/fixtures/binary'

function renderUpload(props: Partial<React.ComponentProps<typeof Upload>> = {}) {
  return render(
    <AppStateProvider>
      <Upload onContinue={() => {}} {...props} />
    </AppStateProvider>,
  )
}

function docxFile(lines: string[], name = 'resume.docx'): File {
  const bytes = buildDocx(lines)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new File([buffer as ArrayBuffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

const RESUME_LINES = [
  'Ada Lovelace',
  'ada.lovelace@example.com',
  'London, UK',
  '',
  'EXPERIENCE',
  'Senior Backend Engineer, Meridian Payments',
  'Jan 2020 - Present',
  '- Led migration of the core ledger service to PostgreSQL.',
  '',
  'SKILLS',
  'Java, Spring Boot, PostgreSQL',
]

describe('Upload', () => {
  it('shows the import screen before any file is chosen', () => {
    renderUpload()

    expect(screen.getByRole('heading', { name: 'Upload your resume' })).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a PDF or DOCX file')).toBeInTheDocument()
    expect(screen.queryByText('Resume successfully imported')).not.toBeInTheDocument()
  })

  it('imports a DOCX and shows the extracted resume', async () => {
    const user = userEvent.setup()
    renderUpload()

    await user.upload(screen.getByLabelText('Choose a PDF or DOCX file'), docxFile(RESUME_LINES))

    expect(await screen.findByText('Resume successfully imported')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada.lovelace@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Meridian Payments/)).toBeInTheDocument()
    expect(screen.getByText('Java')).toBeInTheDocument()
  })

  it('lists detected sections and reports the ones it could not confirm', async () => {
    const user = userEvent.setup()
    renderUpload()

    await user.upload(screen.getByLabelText('Choose a PDF or DOCX file'), docxFile(RESUME_LINES))

    await screen.findByText('Sections detected')

    expect(screen.getByText('Experience')).toBeInTheDocument()
    expect(screen.getByText('Could not confidently detect:')).toBeInTheDocument()
    expect(screen.getByText('Awards')).toBeInTheDocument()
  })

  it('parses pasted text', async () => {
    const user = userEvent.setup()
    renderUpload()

    await user.click(screen.getByRole('tab', { name: 'Paste text' }))
    await user.click(screen.getByLabelText('Paste your resume'))
    await user.paste(RESUME_LINES.join('\n'))
    await user.click(screen.getByRole('button', { name: 'Import resume' }))

    expect(await screen.findByText('Resume successfully imported')).toBeInTheDocument()
  })

  it('shows a recoverable error for an unsupported file type', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderUpload()

    await user.upload(
      screen.getByLabelText('Choose a PDF or DOCX file'),
      new File(['text'], 'resume.txt', { type: 'text/plain' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file type is not supported. Upload a PDF or DOCX file.',
    )
    expect(screen.getByLabelText('Choose a PDF or DOCX file')).toBeInTheDocument()
  })

  it('shows the paste fallback message for a scanned pdf with no text', async () => {
    const user = userEvent.setup()
    renderUpload()

    const bytes = buildDocx([])
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

    await user.upload(
      screen.getByLabelText('Choose a PDF or DOCX file'),
      new File([buffer as ArrayBuffer], 'scan.pdf', { type: 'application/pdf' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't extract enough text/i)
    expect(screen.getByRole('tab', { name: 'Paste text' })).toBeInTheDocument()
  })

  it('lets the user continue once the resume is imported', async () => {
    const user = userEvent.setup()
    renderUpload({ onContinue: () => {} })

    await user.upload(screen.getByLabelText('Choose a PDF or DOCX file'), docxFile(RESUME_LINES))

    const continueButton = await screen.findByRole('button', { name: 'Continue' })
    expect(continueButton).toBeEnabled()
  })

  it('disables paste import when the textarea is empty', async () => {
    const user = userEvent.setup()
    renderUpload()

    await user.click(screen.getByRole('tab', { name: 'Paste text' }))

    expect(screen.getByRole('button', { name: 'Import resume' })).toBeDisabled()
  })
})

describe('JobInput', () => {
  function renderJobInput(props: Partial<React.ComponentProps<typeof JobInput>> = {}) {
    return render(
      <AppStateProvider>
        <JobInput onContinue={() => {}} {...props} />
      </AppStateProvider>,
    )
  }

  it('requires text before the job can be analyzed', async () => {
    const user = userEvent.setup()
    renderJobInput()

    expect(screen.getByRole('button', { name: 'Analyze Job' })).toBeDisabled()

    await user.click(screen.getByLabelText('Job description'))
    await user.paste('Senior Backend Engineer')

    expect(screen.getByRole('button', { name: 'Analyze Job' })).toBeEnabled()
  })

  it('parses the posting and previews the detected sections', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    renderJobInput({ onContinue })

    await user.click(screen.getByLabelText('Job description'))
    await user.paste(
      [
        'Senior Backend Engineer',
        'Meridian Payments — London, UK',
        'Full-time',
        '',
        'Requirements',
        '- 5+ years of experience with Java',
        '- Experience with PostgreSQL',
        '',
        'Preferred qualifications',
        '- Experience with Kafka',
      ].join('\n'),
    )
    await user.click(screen.getByRole('button', { name: 'Analyze Job' }))

    expect(await screen.findByText('Job description read successfully')).toBeInTheDocument()
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText('Requirements (2)')).toBeInTheDocument()
    expect(screen.getByText('Preferred qualifications (1)')).toBeInTheDocument()
    expect(screen.getAllByText('Java').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('lets the user go back and edit the description', async () => {
    const user = userEvent.setup()
    renderJobInput()

    await user.click(screen.getByLabelText('Job description'))
    await user.paste('Backend Engineer\n\nRequirements\n- Experience with Go')
    await user.click(screen.getByRole('button', { name: 'Analyze Job' }))
    await screen.findByText('Job description read successfully')

    await user.click(screen.getByRole('button', { name: 'Edit description' }))

    expect(screen.getByLabelText('Job description')).toBeInTheDocument()
  })
})
