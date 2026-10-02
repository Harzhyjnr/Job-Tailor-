import { describe, expect, it } from 'vitest'

import { analyzeResumeAgainstJob } from '@/services/analysisEngine'
import { parseJobDescription } from '@/services/jobParser'
import { parseResume } from '@/services/resumeParser'
import fullJob from '@/test/fixtures/job-description-full.txt?raw'
import fullResume from '@/test/fixtures/resume-full.txt?raw'

const { resume } = parseResume(fullResume)
const { job } = parseJobDescription(fullJob)
const analysis = analyzeResumeAgainstJob(resume, job)

function matchFor(term: string) {
  const found = analysis.keywordCoverage.matched.find((match) => match.term === term)
  if (found) return found

  const related = analysis.keywordCoverage.related.find((match) => match.term === term)
  if (related) return related

  const missing = analysis.keywordCoverage.missing.find((match) => match.term === term)
  if (missing) return missing

  throw new Error(`The posting term "${term}" was not collected`)
}

const UNRELATED_RESUME = [
  'Grace Hopper',
  'grace.hopper@example.com | +1 202 555 0143 | Arlington, VA',
  '',
  'PROFESSIONAL SUMMARY',
  'Frontend engineer focused on accessible design systems in React and TypeScript.',
  '',
  'WORK EXPERIENCE',
  '',
  'Frontend Engineer, Bright Labs',
  'Jun 2019 - Present',
  '- Rebuilt the checkout flow in React, lifting conversion by 12%.',
  '- Shipped a TypeScript component library used by eight product teams.',
  '',
  'EDUCATION',
  'BA Mathematics, Georgetown University',
  '2011 - 2015',
  '',
  'SKILLS',
  'React, TypeScript, CSS, Figma',
].join('\n')

describe('analyzeResumeAgainstJob', () => {
  it('reports the provider and never presents the score as a hiring prediction', () => {
    expect(analysis.provider).toBe('local')
    expect(analysis.overallAssessment).toContain('not a prediction of hiring outcome')
    expect(analysis.matchScore).toBeGreaterThanOrEqual(0)
    expect(analysis.matchScore).toBeLessThanOrEqual(100)
  })

  describe('keyword matching', () => {
    it('treats a term named in the skills section as strong evidence', () => {
      const match = matchFor('Java')

      expect(match.status).toBe('strong')
      expect(match.evidence).toContain('Java')
    })

    it('treats a term that never appears as missing with no evidence', () => {
      const match = matchFor('communication')

      expect(match.status).toBe('missing')
      expect(match.evidence).toEqual([])
    })

    it('reports a near-equivalent separately instead of awarding the match', () => {
      const kotlin = matchFor('Kotlin')

      expect(kotlin.status).toBe('missing')
      expect(kotlin.related).toBe(true)
      expect(kotlin.relatedTerm).toBe('Java')
      expect(analysis.keywordCoverage.related.map((match) => match.term)).toContain('Kotlin')
      expect(analysis.keywordCoverage.missing.map((match) => match.term)).not.toContain('Kotlin')
    })

    it('asks for clarification when the evidence exists but is not stated clearly', () => {
      const match = matchFor("Bachelor's degree in Computer Science or a related field")

      expect(match.status).toBe('needs-clarification')
      expect(match.evidence.length).toBeGreaterThan(0)
    })

    it('quotes only text that exists in the resume', () => {
      const evidence = [
        ...analysis.keywordCoverage.matched.flatMap((match) => match.evidence),
        ...analysis.keywordCoverage.related.flatMap((match) => match.evidence),
        ...analysis.firstImpression.standsOut,
      ]

      expect(evidence.length).toBeGreaterThan(0)
      for (const quote of evidence) {
        expect(resume.rawText).toContain(quote.trim())
      }
    })
  })

  describe('coverage', () => {
    it('counts every collected term once and excludes related terms from the missing list', () => {
      const total =
        analysis.keywordCoverage.matched.length +
        analysis.keywordCoverage.missing.length +
        analysis.keywordCoverage.related.length

      expect(total).toBe(14)
      expect(analysis.keywordCoverage.coverage).toBe(50)
      expect(analysis.keywordCoverage.matched).toHaveLength(7)
      expect(analysis.keywordCoverage.related).toHaveLength(4)
      expect(analysis.keywordCoverage.missing).toHaveLength(3)
    })

    it('labels preferred requirements as preferred', () => {
      const kafka = analysis.jobMatch.missingRequirements.find((item) => item.label === 'Kafka')

      expect(kafka?.importance).toBe('preferred')
      expect(kafka?.note).toBe('Preferred only, not required.')
    })

    it('splits the requirements into strong, partial and missing groups', () => {
      expect(analysis.jobMatch.strongMatches.map((item) => item.label).sort()).toEqual([
        'AWS',
        'Docker',
        'Java',
        'PostgreSQL',
        'REST',
      ])
      expect(analysis.jobMatch.partialMatches.map((item) => item.label)).toEqual([
        '5+ years of professional backend engineering experience',
        "Bachelor's degree in Computer Science or a related field",
      ])
      expect(analysis.jobMatch.missingRequirements.length).toBe(7)
    })
  })

  describe('experience relevance', () => {
    it('ranks the most relevant role first and explains every score', () => {
      const [first, second] = analysis.experienceRelevance

      expect(first?.title).toBe('Senior Backend Engineer')
      expect(first?.score).toBeGreaterThan(second!.score)
      expect(first?.rationale).toMatch(/Matches \d+ of 14 job terms/)
      expect(second?.rationale).toContain('No terms from the job description appear')
    })
  })

  describe('ats review', () => {
    it('passes the checks a well formed resume already satisfies', () => {
      expect(analysis.atsReview.passed).toContain('Standard section headings were detected.')
      expect(analysis.atsReview.passed).toContain(
        'Name, email, phone number and location are all present.',
      )
      expect(analysis.atsReview.passed).toContain('Every role has a date range.')
    })

    it('flags the posting terms the resume does not carry, without telling the user to add them', () => {
      const keywordIssue = analysis.atsReview.issues.find((issue) => issue.id === 'keywords')

      expect(keywordIssue?.severity).toBe('medium')
      expect(keywordIssue?.detail).toContain('communication')
      expect(keywordIssue?.suggestion).toContain('Leave the rest out')
    })

    it('keeps the score inside 0-100', () => {
      expect(analysis.atsReview.score).toBeGreaterThanOrEqual(0)
      expect(analysis.atsReview.score).toBeLessThanOrEqual(100)
    })
  })

  describe('achievement quality', () => {
    it('counts how many bullets state a verb, an outcome and a number', () => {
      expect(analysis.achievementQuality.total).toBe(5)
      expect(analysis.achievementQuality.withActionVerb).toBe(5)
      expect(analysis.achievementQuality.withMetric).toBe(2)
      expect(analysis.achievementQuality.responsibilitiesOnly).toBe(2)
      expect(analysis.achievementQuality.score).toBeGreaterThan(0)
    })
  })

  describe('skills', () => {
    it('separates posting skills, absent skills and resume-only skills', () => {
      expect(analysis.skillsMatch.matched).toEqual(
        expect.arrayContaining(['Java', 'PostgreSQL', 'Docker', 'AWS']),
      )
      expect(analysis.skillsMatch.missing).toEqual(
        expect.arrayContaining(['Kubernetes', 'Kafka', 'Kotlin']),
      )
      expect(analysis.skillsMatch.extra).toEqual(expect.arrayContaining(['Spring Boot', 'Git']))
    })
  })

  describe('narrative', () => {
    it('surfaces unevidenced required terms as concerns', () => {
      expect(analysis.concerns[0]).toContain('Required terms with no evidence')
    })

    it('only recommends changes that stay inside what the resume supports', () => {
      expect(analysis.recommendations.length).toBeGreaterThan(0)
      for (const recommendation of analysis.recommendations) {
        expect(recommendation.length).toBeGreaterThan(0)
      }
      expect(analysis.recommendations.join(' ')).toContain('evidence')
    })
  })

  it('scores a resume written for a different role lower than the matched one', () => {
    const { resume: other } = parseResume(UNRELATED_RESUME)
    const otherAnalysis = analyzeResumeAgainstJob(other, job)

    expect(otherAnalysis.matchScore).toBeLessThan(analysis.matchScore)
    expect(otherAnalysis.keywordCoverage.coverage).toBeLessThan(analysis.keywordCoverage.coverage)
    expect(otherAnalysis.jobMatch.strongMatches.length).toBeLessThan(
      analysis.jobMatch.strongMatches.length,
    )
  })

  it('says so instead of scoring when no requirements could be read', () => {
    const { job: emptyJob } = parseJobDescription('We are hiring. Great people wanted.')
    const empty = analyzeResumeAgainstJob(resume, emptyJob)

    expect(empty.keywordCoverage.coverage).toBe(0)
    expect(empty.jobMatch.strongMatches).toEqual([])
    expect(empty.overallAssessment).toContain('could be read')
    expect(empty.matchScore).toBeGreaterThanOrEqual(0)
  })
})
