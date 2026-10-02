import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ClassicTemplate } from '@/components/preview/ClassicTemplate'
import { buildResumeDocument, paginateDocument, resolveLayout } from '@/services/resumeDocument'
import { exportResumePdf } from '@/services/resumePdf'
import { parseResume } from '@/services/resumeParser'
import { tailorResumeAgainstJob } from '@/services/tailorEngine'
import { parseJobDescription } from '@/services/jobParser'
import fullResume from '@/test/fixtures/resume-full.txt?raw'
import type { Resume } from '@/types/resume'

const { resume } = parseResume(fullResume)

/** Long enough to cross a page boundary, at a page setup a real user would pick. */
const AIRY = { lineHeight: 1.45, marginIn: 0.75 }

const longResume: Resume = {
  ...resume,
  summary: `${resume.summary} ${'Extra sentence that makes the document longer. '.repeat(60)}`,
}

function printedLines(page: HTMLElement) {
  return Array.from(page.querySelectorAll('p')).map((node) => node.textContent ?? '')
}

describe('ClassicTemplate', () => {
  it('prints the name, contact line and the standard headings in order', () => {
    render(<ClassicTemplate resume={resume} />)

    const page = screen.getByTestId('ats-classic')

    expect(page).toHaveTextContent('Ada Lovelace')
    expect(page).toHaveTextContent('ada.lovelace@example.com')
    expect(printedLines(page)).toEqual([
      'Ada Lovelace',
      expect.stringContaining('London, UK'),
      'SUMMARY',
      'Backend engineer with 8 years building payment services in Java and PostgreSQL.',
      'EXPERIENCE',
      'Senior Backend Engineer | Meridian Payments',
      'Jan 2020 - Present',
      '• Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
      '• Designed REST APIs consumed by three client teams.',
      '• Mentored four engineers and ran weekly design reviews.',
      'Backend Engineer | Northwind Systems',
      'Mar 2017 - Dec 2019',
      '• Introduced CI/CD with GitHub Actions, reducing release time from days to hours.',
      '• Built Spring Boot services handling 2M requests per day.',
      'EDUCATION',
      'BSc Computer Science | University of London',
      '2013 - 2016',
      'SKILLS',
      'Java, Spring Boot, PostgreSQL, REST APIs, Docker, Git, CI/CD, AWS, REST, GitHub Actions',
      'CERTIFICATIONS',
      '• AWS Certified Solutions Architect - Associate, issued by Amazon Web Services, 2022',
      'PROJECTS',
      'Ledger Reconciler | Java, PostgreSQL, Docker, github.com/adalovelace/ledger',
      'AWARDS',
      '• Engineering Excellence Award, Meridian Payments, 2023',
      'LANGUAGES',
      'English (native), French (professional)',
    ])
  })

  it('leads each role with the title and company, and prints the dates', () => {
    render(<ClassicTemplate resume={resume} />)

    expect(screen.getByTestId('ats-classic')).toHaveTextContent(
      'Senior Backend Engineer | Meridian Payments',
    )
    expect(screen.getByTestId('ats-classic')).toHaveTextContent('Jan 2020 - Present')
  })

  it('does not print the same fact twice on one line', () => {
    render(<ClassicTemplate resume={resume} />)

    const text = screen.getByTestId('ats-classic').textContent ?? ''
    const awardLine = text.slice(text.indexOf('Engineering Excellence Award'))
    const languageLine = text.slice(text.indexOf('English'))

    expect(awardLine.match(/2023/g)).toHaveLength(1)
    expect(languageLine).toContain('English (native)')
    expect(text).toContain('AWS Certified Solutions Architect')
    expect(text).not.toMatch(/Architect.*2022 \| Amazon Web Services \| 2022/)
  })

  it('omits empty sections instead of printing an empty heading', () => {
    render(<ClassicTemplate resume={{ ...resume, awards: [], projects: [] }} />)

    const lines = printedLines(screen.getByTestId('ats-classic'))

    expect(lines).not.toContain('AWARDS')
    expect(lines).not.toContain('PROJECTS')
    expect(lines).toContain('LANGUAGES')
  })

  it('applies the page setup from the user preferences', () => {
    render(
      <ClassicTemplate
        resume={resume}
        preferences={{ fontSizePt: 12, lineHeight: 1.4, marginIn: 1 }}
      />,
    )

    const page = screen.getByTestId('ats-classic')

    expect(page.style.fontSize).toBe('12pt')
    expect(page.style.lineHeight).toBe('1.4')
    expect(page.style.padding).toBe('1in')
  })

  it('is always set in Arial, because that is the face the file can match', () => {
    render(<ClassicTemplate resume={resume} preferences={{ fontSizePt: 40 }} />)

    expect(screen.getByTestId('ats-classic').style.fontFamily).toBe('Arial, Helvetica, sans-serif')
  })

  it('clamps an impossible page setup instead of rendering an unreadable page', () => {
    render(<ClassicTemplate resume={resume} preferences={{ fontSizePt: 40, marginIn: 6 }} />)

    const page = screen.getByTestId('ats-classic')

    expect(page.style.fontSize).toBe('14pt')
    expect(page.style.padding).toBe('1.5in')
  })

  it('shows no page break when the document is one page', () => {
    render(<ClassicTemplate resume={resume} />)

    expect(screen.queryAllByTestId('page-break')).toHaveLength(0)
  })

  it('marks where each new page starts, before the line that starts it', () => {
    render(<ClassicTemplate resume={longResume} preferences={AIRY} />)

    const breaks = screen.getAllByTestId('page-break')

    expect(breaks.length).toBeGreaterThan(0)
    expect(breaks[0]).toHaveAccessibleName('Page 2 starts here')
    expect(breaks[0]).toHaveTextContent('Page 2')

    const nextLine = breaks[0]?.nextElementSibling?.textContent ?? ''
    const placed = paginateDocument(buildResumeDocument(longResume), resolveLayout(AIRY))
    const firstOnPageTwo = placed.find((item) => item.pageIndex === 1)

    expect(nextLine).toContain(firstOnPageTwo?.line.text ?? 'nothing')
  })

  it(
    'marks exactly as many breaks as the exported file has pages',
    { timeout: 30_000 },
    async () => {
      render(<ClassicTemplate resume={longResume} preferences={AIRY} />)

      const shown = screen.getAllByTestId('page-break').length + 1
      const exported = await exportResumePdf(longResume, { preferences: AIRY })

      expect(shown).toBe(exported.pageCount)
    },
  )

  it('hides the markers when printing, since the paper has real page breaks', () => {
    render(<ClassicTemplate resume={longResume} preferences={AIRY} />)

    expect(screen.getAllByTestId('page-break')[0]).toHaveClass('print:hidden')
  })

  it('renders the tailored copy rather than the original', () => {
    const { job } = parseJobDescription('PostgreSQL engineer wanted. Docker and AWS required.')
    const tailored = tailorResumeAgainstJob(resume, job)

    render(<ClassicTemplate resume={tailored} />)

    expect(screen.getByTestId('ats-classic')).toHaveTextContent(tailored.summary!)
  })

  it('has no tables, images or links that an applicant-tracking system would skip', () => {
    const { container } = render(<ClassicTemplate resume={resume} />)

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })
})
