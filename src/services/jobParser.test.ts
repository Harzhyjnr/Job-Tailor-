import { describe, expect, it } from 'vitest'

import { parseJobDescription } from '@/services/jobParser'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'

describe('parseJobDescription', () => {
  it('always preserves the original text', () => {
    const { job } = parseJobDescription(fullJob)

    expect(job.rawText).toContain('Meridian Payments')
    expect(job.rawText).toContain('Bachelor')
  })

  describe('header', () => {
    it('reads the title, company, location and employment type', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.title).toBe('Senior Backend Engineer')
      expect(job.company).toBe('Meridian Payments')
      expect(job.location).toContain('London')
      expect(job.employmentType).toBe('Full-time')
    })

    it('reads a title written as "Role at Company"', () => {
      const { job } = parseJobDescription(
        [
          'Backend Engineer at Acme Corp',
          'Remote',
          '',
          'Requirements',
          '- 3+ years with Python',
        ].join('\n'),
      )

      expect(job.title).toBe('Backend Engineer')
      expect(job.company).toBe('Acme Corp')
      expect(job.location).toBe('Remote')
      expect(job.minYearsExperience).toBe(3)
    })

    it('reads explicitly labelled fields', () => {
      const { job } = parseJobDescription(
        [
          'Company: Northwind',
          'Location: Berlin, Germany',
          'Employment type: Contract',
          '',
          'Requirements',
          '- Experience with Go',
        ].join('\n'),
      )

      expect(job.company).toBe('Northwind')
      expect(job.location).toBe('Berlin, Germany')
      expect(job.employmentType).toBe('Contract')
      expect(job.title).toBeUndefined()
    })
  })

  describe('inferences', () => {
    it('reads seniority, industry and minimum experience', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.seniority).toBe('senior')
      expect(job.industry).toBe('Fintech')
      expect(job.minYearsExperience).toBe(5)
    })

    it('leaves seniority unknown when nothing states it', () => {
      const { job } = parseJobDescription('Accountant\n\nRequirements\n- Experience with Excel')

      expect(job.seniority).toBe('unknown')
    })
  })

  describe('requirements', () => {
    it('separates required and preferred requirements', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.requirements.length).toBeGreaterThan(0)
      expect(job.requirements.every((item) => item.importance === 'required')).toBe(true)
      expect(job.preferred.every((item) => item.importance === 'preferred')).toBe(true)
    })

    it('lists required technologies as individual terms', () => {
      const { job } = parseJobDescription(fullJob)
      const labels = job.requirements.map((item) => item.label)

      expect(labels).toContain('PostgreSQL')
      expect(labels).toContain('Docker')
      expect(labels).toContain('Kubernetes')
      expect(labels).not.toContain('Spring')
    })

    it('classifies education, experience and soft requirements', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.requirements.some((item) => item.category === 'education')).toBe(true)
      expect(job.requirements.some((item) => item.category === 'soft')).toBe(true)
      expect(job.requirements.some((item) => item.category === 'experience')).toBe(true)
    })

    it('keeps the verbatim phrase as evidence', () => {
      const { job } = parseJobDescription(fullJob)
      const postgres = job.requirements.find((item) => item.label === 'PostgreSQL')

      expect(postgres?.evidence).toContain('PostgreSQL')
      expect(postgres?.evidence.length).toBeGreaterThan(0)
    })

    it('captures the stated years on a requirement', () => {
      const { job } = parseJobDescription(fullJob)
      const java = job.requirements.find((item) => item.label === 'Java')

      expect(java?.minYears).toBe(5)
    })

    it('reads the education requirement', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.educationRequirement).toContain('degree')
    })

    it('collects certifications', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.certifications.join(' ')).toContain('AWS')
    })
  })

  describe('responsibilities', () => {
    it('reads responsibilities as verbatim statements', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.responsibilities.length).toBeGreaterThanOrEqual(3)
      expect(job.responsibilities.map((item) => item.text).join(' ')).toContain('Mentor engineers')
    })

    it('links related terms found in a responsibility', () => {
      const { job } = parseJobDescription(fullJob)
      const observability = job.responsibilities.find((item) => item.text.includes('observability'))

      expect(observability?.relatedTerms).toEqual(expect.arrayContaining(['Prometheus', 'Grafana']))
    })
  })

  describe('skills', () => {
    it('detects technical and soft skills across the posting', () => {
      const { job } = parseJobDescription(fullJob)

      expect(job.technicalSkills).toEqual(expect.arrayContaining(['Java', 'Kotlin', 'PostgreSQL']))
      expect(job.softSkills).toEqual(expect.arrayContaining(['communication', 'collaboration']))
    })
  })

  describe('missing sections', () => {
    it('warns when no sections were recognized and still reads the terms', () => {
      const { job, warnings } = parseJobDescription(
        'We are hiring a passionate engineer.\n- Build things with Python and Docker',
      )

      expect(warnings.length).toBeGreaterThan(0)
      expect(job.requirements).toEqual([])
      expect(job.responsibilities).toEqual([])
      expect(job.title).toBeUndefined()
      expect(job.technicalSkills).toEqual(expect.arrayContaining(['Python', 'Docker']))
    })
  })

  it('never introduces terms that the posting does not contain', () => {
    const { job } = parseJobDescription(fullJob)
    const source = job.rawText.toLowerCase()

    for (const requirement of [...job.requirements, ...job.preferred]) {
      expect(source).toContain(requirement.label.toLowerCase())
    }
    for (const skill of [...job.technicalSkills, ...job.softSkills]) {
      expect(source).toContain(skill.toLowerCase())
    }
  })
})
