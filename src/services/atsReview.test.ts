import { describe, expect, it } from 'vitest'

import { analyzeResumeAgainstJob } from '@/services/analysisEngine'
import { runAtsReview } from '@/services/atsReview'
import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)

const HEADLESS_RESUME = [
  'I have been building things for a while and I am very hard working.',
  '★ I know Python and I have used Django and Flask a lot.',
  'I like long walks and green tea.',
].join('\n')

function issueFor(text: string, source = fullResume) {
  const { resume: parsed } = parseResume(source)
  const analysis = analyzeResumeAgainstJob(parsed, job)
  const { issues } = runAtsReview(parsed, job, analysis.keywordCoverage)
  const found = issues.find((issue) => issue.detail.includes(text) || issue.title.includes(text))

  if (!found) throw new Error(`No ATS issue mentioned "${text}"`)

  return found
}

describe('runAtsReview', () => {
  it('deducts a fixed weight per issue and never drops below zero', () => {
    const analysis = analyzeResumeAgainstJob(resume, job)
    const { score, issues } = runAtsReview(resume, job, analysis.keywordCoverage)
    const penalty: Record<string, number> = { high: 15, medium: 8, low: 3 }
    const expected = issues.reduce((total, issue) => total + penalty[issue.severity]!, 0)

    expect(score).toBe(100 - expected)
    expect(score).toBeLessThanOrEqual(100)

    const { resume: empty } = parseResume('')
    const emptyAnalysis = analyzeResumeAgainstJob(empty, job)
    const worst = runAtsReview(empty, job, emptyAnalysis.keywordCoverage)

    expect(worst.score).toBeLessThan(score)
    expect(worst.issues.filter((issue) => issue.severity === 'high').length).toBeGreaterThan(0)
  })

  it('treats a resume with no headings as a high severity structure problem', () => {
    const issue = issueFor('No section headings were detected', HEADLESS_RESUME)

    expect(issue.category).toBe('structure')
    expect(issue.severity).toBe('high')
  })

  it('asks for a name and an email when the header has neither', () => {
    const name = issueFor('No name was detected', HEADLESS_RESUME)
    const email = issueFor('No email address was detected', HEADLESS_RESUME)

    expect(name.severity).toBe('high')
    expect(email.severity).toBe('high')
  })

  it('flags decorative characters that some parsers cannot read', () => {
    const issue = issueFor('Decorative characters were detected', HEADLESS_RESUME)

    expect(issue.category).toBe('formatting')
    expect(issue.suggestion).toContain('Remove decorative symbols')
  })

  it('penalises a sparse resume less than a structural failure', () => {
    const analysis = analyzeResumeAgainstJob(resume, job)
    const healthy = runAtsReview(resume, job, analysis.keywordCoverage)

    const { resume: sparse } = parseResume(HEADLESS_RESUME)
    const sparseAnalysis = analyzeResumeAgainstJob(sparse, job)
    const broken = runAtsReview(sparse, job, sparseAnalysis.keywordCoverage)

    expect(broken.score).toBeLessThan(healthy.score)
    expect(broken.issues.filter((issue) => issue.severity === 'high').length).toBeGreaterThan(0)
  })

  it('never tells the user to claim a term they have not evidenced', () => {
    const { resume: sparse } = parseResume(HEADLESS_RESUME)
    const analysis = analyzeResumeAgainstJob(sparse, job)
    const { issues } = runAtsReview(sparse, job, analysis.keywordCoverage)
    const keywordIssue = issues.find((issue) => issue.category === 'keywords')

    expect(keywordIssue?.suggestion).toContain('Leave the rest out')
  })

  it('compares the requested seniority with the resume titles', () => {
    const midResume = fullResume.replaceAll('Senior Backend Engineer', 'Mid-level Backend Engineer')
    const issue = issueFor('seniority this posting asks for', midResume)

    expect(issue.category).toBe('titles')
    expect(issue.severity).toBe('medium')
    expect(issue.detail).toContain('mid')
    expect(issue.suggestion).toContain('Never change a job title you did not hold')
  })

  it('flags a senior posting when the resume states no level at all', () => {
    const unlevelled = fullResume.replaceAll('Senior Backend Engineer', 'Backend Engineer')
    const issue = issueFor('No seniority level is stated in your titles', unlevelled)

    expect(issue.severity).toBe('low')
  })

  it('flags roles with no date range', () => {
    const undatedResume = fullResume.replace('Jan 2020 - Present\n', '')
    const issue = issueFor('no readable date range', undatedResume)

    expect(issue.category).toBe('dates')
    expect(issue.severity).toBe('medium')
  })
})
