import { describe, expect, it } from 'vitest'

import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import { ALLOWED_NEW_WORDS, leadWithResult, tailorResumeAgainstJob } from '@/services/tailorEngine'
import { containsTerm } from '@/services/techTerms'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'
import { tokenize } from '@/utils/text'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)
const tailored = tailorResumeAgainstJob(resume, job)

/** Token shape without attached punctuation, so "Payments." compares equal to "Payments". */
function words(text: string): string[] {
  return tokenize(text).map((token) => token.replace(/^[.]+|[.]+$/g, ''))
}

function vocabulary(text: string): Set<string> {
  return new Set(words(text))
}

function tailoredFields(): string[] {
  return [
    ...(tailored.summary ? [tailored.summary] : []),
    ...tailored.experience.flatMap((experience) => [
      ...experience.achievements,
      ...experience.responsibilities,
      experience.title ?? '',
      experience.company ?? '',
    ]),
    ...tailored.skills.map((skill) => skill.name),
  ]
}

describe('leadWithResult', () => {
  it('moves a measured result to the front of the bullet', () => {
    expect(
      leadWithResult(
        'Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
      ),
    ).toBe(
      'Cutting month-end close time by 40%: led migration of the core ledger service to PostgreSQL.',
    )
  })

  it('moves an outcome clause when it opens with a verb', () => {
    expect(
      leadWithResult(
        'Introduced CI/CD with GitHub Actions, reducing release time from days to hours.',
      ),
    ).toBe('Reducing release time from days to hours: introduced CI/CD with GitHub Actions.')
  })

  it('leaves a bullet alone when it already leads with the number', () => {
    expect(
      leadWithResult('Reduced month-end close time by 40% by moving the ledger to PostgreSQL.'),
    ).toBeUndefined()
  })

  it('leaves a bullet alone when the tail states no result', () => {
    expect(
      leadWithResult('Migrated the ledger service, PostgreSQL, in three increments.'),
    ).toBeUndefined()
  })

  it('never demotes a word that is not a verb, so acronyms keep their case', () => {
    expect(
      leadWithResult('AWS migration of the ledger, cutting latency by 30% in the EU region.'),
    ).toBeUndefined()
  })

  it('does not treat a place name as a clause break', () => {
    expect(
      leadWithResult('Built Spring Boot services handling 2M requests per day.'),
    ).toBeUndefined()
  })
})

describe('tailorResumeAgainstJob', () => {
  it('reuses the resume wording and introduces no new word', () => {
    const original = vocabulary(resume.rawText)

    for (const field of tailoredFields()) {
      for (const token of words(field)) {
        if (ALLOWED_NEW_WORDS.has(token)) continue
        expect(original.has(token), `"${token}" in: ${field}`).toBe(true)
      }
    }
  })

  it('limits itself to the documented connective words', () => {
    expect([...ALLOWED_NEW_WORDS]).toEqual(['at'])
  })

  it('keeps every bullet, so no claim is dropped', () => {
    const before = resume.experience.reduce(
      (total, experience) =>
        total + experience.achievements.length + experience.responsibilities.length,
      0,
    )
    const after = tailored.experience.reduce(
      (total, experience) =>
        total + experience.achievements.length + experience.responsibilities.length,
      0,
    )

    expect(after).toBe(before)
  })

  it('keeps the same employers, titles and dates', () => {
    expect(tailored.experience.map((experience) => experience.id)).toEqual(
      resume.experience.map((experience) => experience.id),
    )
    for (const [index, experience] of tailored.experience.entries()) {
      expect(experience.title).toBe(resume.experience[index]?.title)
      expect(experience.company).toBe(resume.experience[index]?.company)
      expect(experience.dateRange).toBe(resume.experience[index]?.dateRange)
    }
  })

  it('builds the summary from the current role and the strongest evidence', () => {
    expect(tailored.summary).toBe(
      'Senior Backend Engineer at Meridian Payments. Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
    )
  })

  it('leads the relevant bullet with its result, using the same words', () => {
    expect(tailored.experience[1]?.achievements).toEqual([
      'Reducing release time from days to hours: introduced CI/CD with GitHub Actions.',
    ])
  })

  it('puts the posting terms first in the skills list', () => {
    const names = tailored.skills.map((skill) => skill.name)

    expect(names.slice(0, 4)).toEqual(['PostgreSQL', 'Docker', 'Java', 'REST'])
    expect(names).toHaveLength(resume.skills.length)
  })

  it('reports every change with the text it reused', () => {
    expect(tailored.changeLog.length).toBeGreaterThan(0)

    for (const change of tailored.changeLog) {
      expect(change.section).not.toBe('')
      expect(change.summary.length).toBeGreaterThan(0)
      if (change.sourceText) {
        expect(resume.rawText).toContain(change.sourceText)
      }
    }
  })

  it('leaves the uncovered requirements out of the tailored text entirely', () => {
    expect(tailored.uncoveredRequirements.length).toBeGreaterThan(0)

    const text = tailoredFields().join('\n')
    for (const requirement of tailored.uncoveredRequirements) {
      expect(containsTerm(text, requirement.label)).toBe(false)
    }
  })

  it('moves the bullet that covers the posting to the top of the role', () => {
    const reordered = fullResume.replace(
      '- Designed REST APIs consumed by three client teams.\n- Mentored four engineers and ran weekly design reviews.',
      '- Mentored four engineers and ran weekly design reviews.\n- Designed REST APIs consumed by three client teams.',
    )

    const { resume: parsed } = parseResume(reordered)
    const result = tailorResumeAgainstJob(parsed, job)

    expect(result.experience[0]?.responsibilities).toEqual([
      'Designed REST APIs consumed by three client teams.',
      'Mentored four engineers and ran weekly design reviews.',
    ])
    expect(
      result.changeLog.some((change) =>
        change.summary.startsWith('Moved the bullets that answer the posting'),
      ),
    ).toBe(true)
  })

  it('is deterministic', () => {
    const again = tailorResumeAgainstJob(resume, job)

    expect(again).toEqual(tailored)
  })

  it('changes nothing when the resume already leads with its results', () => {
    const alreadyTight = fullResume
      .replace(
        'Led migration of the core ledger service to PostgreSQL, cutting month-end close time by 40%.',
        'Cut month-end close time by 40% by migrating the core ledger to PostgreSQL.',
      )
      .replace(
        'Introduced CI/CD with GitHub Actions, reducing release time from days to hours.',
        'Cut release time from days to hours by introducing CI/CD with GitHub Actions.',
      )

    const { resume: parsed } = parseResume(alreadyTight)
    const result = tailorResumeAgainstJob(parsed, job)

    expect(result.experience[0]?.achievements).toEqual(parsed.experience[0]?.achievements)
    expect(result.experience[1]?.achievements).toEqual(parsed.experience[1]?.achievements)
  })

  it('produces nothing to change when the resume is empty', () => {
    const { resume: empty } = parseResume('')
    const result = tailorResumeAgainstJob(empty, job)

    expect(result.changeLog).toEqual([])
    expect(result.summary).toBeUndefined()
  })
})
