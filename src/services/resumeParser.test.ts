import { describe, expect, it } from 'vitest'

import { parseResume } from '@/services/resumeParser'
import fullResume from '@/test/fixtures/resume-full.txt?raw'
import alternateHeadings from '@/test/fixtures/resume-alternate-headings.txt?raw'
import noHeadings from '@/test/fixtures/resume-no-headings.txt?raw'
import compoundHeadings from '@/test/fixtures/resume-compound-headings.txt?raw'

describe('parseResume', () => {
  it('always preserves the original text', () => {
    const { resume } = parseResume(fullResume)

    expect(resume.rawText).toContain('Ada Lovelace')
    expect(resume.rawText).toContain('Engineering Excellence Award')
  })

  describe('personal info', () => {
    it('reads name, contact details and links from the header block', () => {
      const { resume } = parseResume(fullResume)
      const info = resume.personalInfo

      expect(info.name).toBe('Ada Lovelace')
      expect(info.email).toBe('ada.lovelace@example.com')
      expect(info.phone).toContain('7946')
      expect(info.location).toContain('London')
      expect(info.linkedin).toContain('linkedin.com/in/adalovelace')
    })

    it('leaves fields undefined rather than guessing', () => {
      const { resume } = parseResume('Some text with no contact information at all.')
      const info = resume.personalInfo

      expect(info.name).toBeUndefined()
      expect(info.email).toBeUndefined()
      expect(info.phone).toBeUndefined()
      expect(info.location).toBeUndefined()
    })

    it('does not read a phone number out of a date range', () => {
      const { resume } = parseResume(
        ['Jane Doe', 'jane@example.com', '', 'EXPERIENCE', 'Engineer, Acme | 2019 - 2021'].join(
          '\n',
        ),
      )

      expect(resume.personalInfo.phone).toBeUndefined()
    })
  })

  describe('sections', () => {
    it('detects every section present in the source', () => {
      const { resume } = parseResume(fullResume)

      expect(resume.detectedSections).toEqual(
        expect.arrayContaining([
          'summary',
          'experience',
          'education',
          'skills',
          'certifications',
          'projects',
          'awards',
          'languages',
        ]),
      )
    })

    it('reports sections it could not find instead of inventing them', () => {
      const { resume } = parseResume(fullResume)

      expect(resume.missingSections).toEqual([])
      expect(resume.projects.length).toBeGreaterThan(0)
    })

    it('reports nothing detected when the text has no headings', () => {
      const { resume } = parseResume(noHeadings)

      expect(resume.detectedSections).toEqual([])
      expect(resume.missingSections).toHaveLength(8)
      expect(resume.experience).toEqual([])
    })

    it('resolves alternate and compound heading formats', () => {
      const alternate = parseResume(alternateHeadings).resume
      expect(alternate.detectedSections).toEqual(
        expect.arrayContaining(['summary', 'experience', 'education', 'skills']),
      )

      const compound = parseResume(compoundHeadings).resume
      expect(compound.detectedSections).toEqual(
        expect.arrayContaining(['summary', 'experience', 'skills']),
      )
    })

    it('parses an empty input without throwing', () => {
      const { resume, warnings } = parseResume('')

      expect(resume.rawText).toBe('')
      expect(resume.experience).toEqual([])
      expect(warnings.length).toBeGreaterThan(0)
    })
  })

  describe('experience', () => {
    it('splits multiple roles with titles, companies and dates', () => {
      const { resume } = parseResume(fullResume)

      expect(resume.experience).toHaveLength(2)

      const [first, second] = resume.experience
      expect(first!.title).toBe('Senior Backend Engineer')
      expect(first!.company).toBe('Meridian Payments')
      expect(first!.startDate).toBe('jan 2020')
      expect(first!.isCurrent).toBe(true)
      expect(first!.endDate).toBeUndefined()

      expect(second!.title).toBe('Backend Engineer')
      expect(second!.company).toBe('Northwind Systems')
      expect(second!.isCurrent).toBe(false)
    })

    it('keeps responsibilities and achievements separate', () => {
      const { resume } = parseResume(fullResume)
      const [first] = resume.experience

      expect(first!.achievements).toEqual(
        expect.arrayContaining([expect.stringContaining('cutting month-end close time by 40%')]),
      )
      expect(first!.responsibilities).toEqual(
        expect.arrayContaining([expect.stringContaining('Designed REST APIs')]),
      )
    })

    it('keeps every bullet in rawText', () => {
      const { resume } = parseResume(fullResume)
      const [first] = resume.experience

      expect(first!.rawText).toContain('Mentored four engineers')
      expect(first!.rawText).toContain('Mentored four engineers')
      expect([...first!.achievements, ...first!.responsibilities].join(' ')).toContain(
        'Mentored four engineers',
      )
    })

    it('warns when an Experience section yields no entries', () => {
      const { warnings } = parseResume('EXPERIENCE\n\n\n')

      expect(warnings.some((warning) => /Experience section/i.test(warning))).toBe(true)
    })

    it('reads an inline date range on the header line', () => {
      const { resume } = parseResume(
        [
          'Dana Scott',
          'dana@example.com',
          '',
          'EXPERIENCE',
          'Data Engineer | Lumen Analytics (2019 - Present)',
          '- Built Airflow pipelines.',
        ].join('\n'),
      )

      expect(resume.experience).toHaveLength(1)
      expect(resume.experience[0]!.company).toBe('Lumen Analytics')
      expect(resume.experience[0]!.isCurrent).toBe(true)
    })
  })

  describe('education', () => {
    it('reads degree, institution and date range', () => {
      const { resume } = parseResume(fullResume)
      const [education] = resume.education

      expect(education!.degree).toBeTruthy()
      expect(education!.institution).toContain('University of London')
      expect(education!.dateRange).toContain('2013')
    })
  })

  describe('skills', () => {
    it('reads the skills section and splits on separators', () => {
      const { resume } = parseResume(fullResume)
      const names = resume.skills
        .filter((skill) => skill.source === 'skills section')
        .map((skill) => skill.name)

      expect(names).toEqual(
        expect.arrayContaining(['Java', 'Spring Boot', 'PostgreSQL', 'REST APIs', 'Docker']),
      )
    })

    it('captures skills mentioned only inside experience bullets', () => {
      const { resume } = parseResume(fullResume)
      const fromBullets = resume.skills.filter((skill) => skill.source === 'experience bullet')
      const names = fromBullets.map((skill) => skill.name)

      // "REST" and "GitHub Actions" appear only inside bullets, never in the
      // Skills section, so the keyword view can still report them.
      expect(names).toEqual(expect.arrayContaining(['REST', 'GitHub Actions']))
      expect(names).not.toContain('Java')
      for (const skill of fromBullets) {
        expect(skill.evidence).toBeTruthy()
      }
    })

    it('keeps the longer of two overlapping technology names', () => {
      const { resume } = parseResume(fullResume)
      const names = resume.skills.map((skill) => skill.name)

      // "Spring Boot services" must not also be reported as "Spring".
      expect(names.filter((name) => name === 'Spring Boot')).toHaveLength(1)
      expect(names).not.toContain('Spring')
    })

    it('does not duplicate a skill across both sources', () => {
      const { resume } = parseResume(fullResume)
      const names = resume.skills.map((skill) => skill.name.toLowerCase())

      expect(new Set(names).size).toBe(names.length)
    })
  })

  describe('other sections', () => {
    it('reads certifications with issuer and date', () => {
      const { resume } = parseResume(fullResume)
      const [certification] = resume.certifications

      expect(certification!.name).toContain('AWS Certified Solutions Architect')
      expect(certification!.issuer).toContain('Amazon Web Services')
      expect(certification!.date).toBe('2022')
    })

    it('reads projects with tech and links', () => {
      const { resume } = parseResume(fullResume)
      const [project] = resume.projects

      expect(project!.name).toContain('Ledger Reconciler')
      expect(project!.tech.length).toBeGreaterThan(0)
    })

    it('reads awards', () => {
      const { resume } = parseResume(fullResume)

      expect(resume.awards[0]!.title).toContain('Engineering Excellence Award')
      expect(resume.awards[0]!.date).toBe('2023')
    })

    it('reads languages with proficiency', () => {
      const { resume } = parseResume(fullResume)
      const names = resume.languages.map((language) => language.name)

      expect(names).toEqual(expect.arrayContaining(['English', 'French']))
      expect(
        resume.languages.find((language) => language.name === 'French')!.proficiency,
      ).toContain('professional')
    })
  })

  describe('anti-fabrication guarantees', () => {
    it('never introduces employers or skills that the source does not contain', () => {
      const { resume } = parseResume(alternateHeadings)
      const source = alternateHeadings.toLowerCase()

      for (const experience of resume.experience) {
        for (const value of [experience.title, experience.company]) {
          if (!value) continue
          expect(source).toContain(value.toLowerCase())
        }
      }

      for (const skill of resume.skills) {
        expect(source).toContain(skill.name.toLowerCase())
      }
    })

    it('leaves empty arrays for sections that were never present', () => {
      const { resume } = parseResume(alternateHeadings)

      expect(resume.certifications).toEqual([])
      expect(resume.projects).toEqual([])
      expect(resume.awards).toEqual([])
      expect(resume.languages).toEqual([])
      expect(resume.missingSections).toEqual(
        expect.arrayContaining(['certifications', 'projects', 'awards', 'languages']),
      )
    })
  })
})
