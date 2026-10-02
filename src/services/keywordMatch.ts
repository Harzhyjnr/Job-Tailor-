import type { ResumePassage } from '@/services/resumeIndex'
import { containsTerm } from '@/services/techTerms'
import type { KeywordCoverage, MatchStatus } from '@/types/analysis'
import type { JobDescription } from '@/types/job'
import { hasMetric, normalizeWhitespace, termKey, tokenize, truncate } from '@/utils/text'

/**
 * Curated near-equivalents. Used only to tell the user "you mention something
 * close to this" — never to award a match, because the posting asked for a
 * specific term.
 */
const RELATED_TERMS: Record<string, string[]> = {
  Java: ['Kotlin', 'Scala', 'Spring Boot'],
  Kotlin: ['Java', 'Spring Boot'],
  JavaScript: ['TypeScript', 'Node.js'],
  TypeScript: ['JavaScript'],
  'Node.js': ['JavaScript', 'TypeScript'],
  PostgreSQL: ['MySQL', 'SQL'],
  MySQL: ['PostgreSQL', 'SQL'],
  SQL: ['PostgreSQL', 'MySQL'],
  NoSQL: ['MongoDB', 'Redis', 'Elasticsearch'],
  Kubernetes: ['Docker', 'Terraform'],
  Docker: ['Kubernetes', 'Terraform'],
  AWS: ['Azure', 'GCP', 'Terraform'],
  Azure: ['AWS', 'GCP'],
  GCP: ['AWS', 'Azure'],
  Kafka: ['RabbitMQ', 'Kafka Streams'],
  RabbitMQ: ['Kafka'],
  GraphQL: ['REST', 'gRPC'],
  REST: ['GraphQL', 'gRPC'],
  gRPC: ['REST', 'GraphQL'],
  'CI/CD': ['Jenkins', 'GitHub Actions', 'Git'],
  'Spring Boot': ['Spring', 'Java'],
  React: ['JavaScript', 'Angular', 'Vue'],
  Terraform: ['AWS', 'Kubernetes'],
  Prometheus: ['Datadog', 'Grafana'],
  Grafana: ['Prometheus', 'Datadog'],
  Elasticsearch: ['MongoDB', 'Redis'],
  'Machine Learning': ['Python', 'TensorFlow', 'PyTorch'],
}

const RELATED_LOOKUP = (() => {
  const lookup = new Map<string, Set<string>>()
  const display = new Map<string, string>()

  const link = (from: string, to: string) => {
    const set = lookup.get(from) ?? new Set<string>()
    set.add(to)
    lookup.set(from, set)
  }

  for (const [term, related] of Object.entries(RELATED_TERMS)) {
    display.set(termKey(term), term)
    for (const other of related) {
      const key = termKey(term)
      const otherKey = termKey(other)
      display.set(otherKey, display.get(otherKey) ?? other)
      link(key, otherKey)
      link(otherKey, key)
    }
  }

  return { lookup, display }
})()

export interface JobTerm {
  term: string
  importance: 'required' | 'preferred'
  /** Stated minimum years of experience on the same requirement, when present. */
  minYears?: number
}

export interface TermMatchResult {
  term: string
  status: MatchStatus
  evidence: string[]
  related: boolean
  /** The resume passage that justified a non-missing status, when there is one. */
  hits: ResumePassage[]
  /** Near-equivalent actually found in the resume, when `related` is true. */
  relatedTerm?: string
}

const EVIDENCE_LIMIT = 3
const PHRASE_WORD_LIMIT = 6
const STRONG_OVERLAP = 0.6

const PHRASE_STOPWORDS = new Set([
  'and',
  'or',
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'from',
  'with',
  'by',
  'as',
  'is',
  'are',
  'be',
  'been',
  'that',
  'this',
  'you',
  'your',
  'we',
  'our',
  'will',
  'would',
  'can',
  'able',
  'across',
  'using',
  'use',
  'used',
  'have',
  'has',
  'must',
  'should',
  'related',
  'equivalent',
  'field',
  'work',
  'working',
  'role',
  'years',
  'year',
  'experience',
  'strong',
  'good',
  'excellent',
  'proven',
  'solid',
  'plus',
  'preferred',
  'required',
  'minimum',
  'least',
  'knowledge',
  'familiarity',
  'exposure',
  'desirable',
  'nice',
  'have',
])

/** Long requirements read as statements rather than terms, so they are matched as phrases. */
function isPhrase(term: string): boolean {
  return term.split(/\s+/).length > PHRASE_WORD_LIMIT
}

function evidenceFrom(hits: ResumePassage[]): string[] {
  const seen = new Set<string>()
  const evidence: string[] = []

  for (const hit of hits) {
    if (evidence.length >= EVIDENCE_LIMIT) break
    const text = truncate(hit.text, 160)
    if (seen.has(text)) continue
    seen.add(text)
    evidence.push(text)
  }

  return evidence
}

/** Unique job terms, strongest importance first, so coverage is not double counted. */
export function collectJobTerms(job: JobDescription): JobTerm[] {
  const terms: JobTerm[] = []
  const seen = new Map<string, number>()

  const add = (term: JobTerm) => {
    const key = termKey(term.term)
    if (!key) return

    const existing = seen.get(key)
    if (existing !== undefined) {
      if (term.importance === 'required') terms[existing]!.importance = 'required'
      const current = terms[existing]!
      if (term.minYears !== undefined && current.minYears === undefined) {
        current.minYears = term.minYears
      }
      return
    }

    seen.set(key, terms.length)
    terms.push(term)
  }

  for (const requirement of job.requirements) {
    add({
      term: requirement.label,
      importance: 'required',
      ...(requirement.minYears !== undefined ? { minYears: requirement.minYears } : {}),
    })
  }
  for (const requirement of job.preferred) {
    add({ term: requirement.label, importance: 'preferred' })
  }

  return terms
}

export function collectTargetTerms(job: JobDescription): string[] {
  return collectJobTerms(job).map((entry) => entry.term)
}

function matchPhrase(term: string, passages: ResumePassage[]): TermMatchResult {
  const phrase = normalizeWhitespace(term).toLowerCase()

  const exact = passages.filter((passage) =>
    normalizeWhitespace(passage.text).toLowerCase().includes(phrase),
  )
  if (exact.length > 0) {
    return { term, status: 'strong', evidence: evidenceFrom(exact), related: false, hits: exact }
  }

  const tokens = tokenize(term).filter((token) => !PHRASE_STOPWORDS.has(token) && token.length > 2)
  if (tokens.length === 0) {
    return { term, status: 'missing', evidence: [], related: false, hits: [] }
  }

  let best: { passage: ResumePassage; overlap: number } | undefined
  for (const passage of passages) {
    const words = new Set(tokenize(passage.text))
    const overlap = tokens.filter((token) => words.has(token)).length / tokens.length
    if (overlap <= 0) continue
    if (!best || overlap > best.overlap) best = { passage, overlap }
  }

  if (!best) {
    return { term, status: 'missing', evidence: [], related: false, hits: [] }
  }

  const status: MatchStatus = best.overlap >= STRONG_OVERLAP ? 'partial' : 'needs-clarification'
  return {
    term,
    status,
    evidence: [truncate(best.passage.text, 160)],
    related: false,
    hits: [best.passage],
  }
}

function findRelatedPassage(
  term: string,
  passages: ResumePassage[],
): { passage: ResumePassage; relatedTerm: string } | undefined {
  const related = RELATED_LOOKUP.lookup.get(termKey(term))
  if (!related) return undefined

  for (const candidate of related) {
    for (const passage of passages) {
      if (containsTerm(passage.text, candidate)) {
        return {
          passage,
          relatedTerm: RELATED_LOOKUP.display.get(candidate) ?? candidate,
        }
      }
    }
  }

  return undefined
}

/**
 * Grades one job term against the resume.
 *
 * A term named in a skills list is `strong`, the same term buried in a bullet is
 * `partial`, a term that only appears in a summary, education line or award is
 * `needs-clarification`, and a term that never appears is `missing`.
 */
export function matchTerm(term: string, passages: ResumePassage[]): TermMatchResult {
  if (isPhrase(term)) return matchPhrase(term, passages)

  const hits = passages.filter((passage) => containsTerm(passage.text, term))

  const skillHits = hits.filter((passage) => passage.kind === 'skill')
  const bodyHits = hits.filter(
    (passage) => passage.kind === 'bullet' || passage.kind === 'project' || passage.kind === 'role',
  )
  const contextHits = hits.filter(
    (passage) =>
      passage.kind !== 'skill' &&
      passage.kind !== 'bullet' &&
      passage.kind !== 'project' &&
      passage.kind !== 'role',
  )

  if (skillHits.length > 0) {
    return {
      term,
      status: 'strong',
      evidence: evidenceFrom([...skillHits, ...bodyHits]),
      related: false,
      hits,
    }
  }

  if (bodyHits.some((passage) => hasMetric(passage.text))) {
    return { term, status: 'strong', evidence: evidenceFrom(bodyHits), related: false, hits }
  }

  if (bodyHits.length > 0) {
    return { term, status: 'partial', evidence: evidenceFrom(bodyHits), related: false, hits }
  }

  if (contextHits.length > 0) {
    return {
      term,
      status: 'needs-clarification',
      evidence: evidenceFrom(contextHits),
      related: false,
      hits,
    }
  }

  const related = findRelatedPassage(term, passages)
  if (related) {
    return {
      term,
      status: 'missing',
      evidence: [truncate(related.passage.text, 160)],
      related: true,
      hits: [],
      relatedTerm: related.relatedTerm,
    }
  }

  return { term, status: 'missing', evidence: [], related: false, hits: [] }
}

export interface KeywordAnalysis {
  coverage: KeywordCoverage
  /** One result per collected term, in the same order. */
  matches: TermMatchResult[]
  terms: JobTerm[]
}

export function analyzeKeywords(job: JobDescription, passages: ResumePassage[]): KeywordAnalysis {
  const terms = collectJobTerms(job)
  const matches = terms.map((entry) => matchTerm(entry.term, passages))

  const matched = matches.filter((match) => match.status !== 'missing')
  const related = matches.filter((match) => match.status === 'missing' && match.related)
  const missing = matches.filter((match) => match.status === 'missing' && !match.related)
  const coverage = terms.length === 0 ? 0 : Math.round((matched.length / terms.length) * 100)

  return { coverage: { matched, missing, related, coverage }, matches, terms }
}
