import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecruiterReview } from '@/components/analysis/RecruiterReview'
import { analyzeResumeAgainstJob } from '@/services/analysisEngine'
import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)
const analysis = analyzeResumeAgainstJob(resume, job)

function renderReview() {
  return render(<RecruiterReview analysis={analysis} job={job} />)
}

describe('RecruiterReview', () => {
  it('shows the match score against the named role', () => {
    renderReview()

    expect(screen.getByRole('heading', { name: 'Resume match' })).toBeInTheDocument()
    expect(
      screen.getByText('Match with Senior Backend Engineer at Meridian Payments'),
    ).toBeInTheDocument()
    expect(screen.getByText('On-device analysis')).toBeInTheDocument()
  })

  it('states that the score is not a hiring prediction', () => {
    renderReview()

    expect(
      screen.getByText(/Internal comparison only\. Not a prediction of hiring outcome\./i),
    ).toBeInTheDocument()
  })

  it('breaks the score down into strong, partial and missing counts', () => {
    renderReview()

    expect(screen.getAllByText('Strong').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Partial').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
  })

  it('renders every review section', () => {
    renderReview()

    for (const heading of [
      'First impression',
      'Keyword coverage',
      'Job match',
      'Experience relevance',
      'Skills',
      'ATS readiness',
      'Achievement quality',
      'Concerns',
      'Recommendations',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('quotes the resume text that justifies a match', () => {
    renderReview()

    expect(
      screen.getAllByText(/Led migration of the core ledger service to PostgreSQL/).length,
    ).toBeGreaterThan(0)
  })

  it('refuses to imply evidence for a requirement that has none', () => {
    renderReview()

    expect(
      screen.getAllByText(
        'No evidence in your resume. Leave this out unless you can add a real example.',
      ),
    ).not.toHaveLength(0)
  })

  it('marks a near-equivalent as related rather than matched', () => {
    renderReview()

    expect(screen.getByText('Kotlin → Java')).toBeInTheDocument()
  })

  it('lists the ATS checks that passed as well as the issues', () => {
    renderReview()

    expect(screen.getByText('Checks passed')).toBeInTheDocument()
    expect(screen.getByText('Standard section headings were detected.')).toBeInTheDocument()
    expect(screen.getByText(/Terms from the posting are not in your resume/)).toBeInTheDocument()
  })

  it('keeps recommendations conditional', () => {
    renderReview()

    expect(
      screen.getAllByText(/Leave the rest out rather than listing them without proof\./).length,
    ).toBeGreaterThan(0)
  })
})
