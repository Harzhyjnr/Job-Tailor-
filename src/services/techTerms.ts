/**
 * Shared vocabulary for matching skills in free text.
 *
 * Both the resume parser and the job analyzer run the same matchers so that a
 * term read from a resume can be compared, character for character, with the
 * same term read from a job description.
 */

export const KNOWN_TECH_TERMS = [
  'Java',
  'JavaScript',
  'TypeScript',
  'Python',
  'C#',
  'C++',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'React',
  'Angular',
  'Vue',
  'Next.js',
  'Node.js',
  'Spring Boot',
  'Spring',
  'Django',
  'Flask',
  'Rails',
  '.NET',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'Kafka',
  'RabbitMQ',
  'Docker',
  'Kubernetes',
  'Terraform',
  'AWS',
  'Azure',
  'GCP',
  'GraphQL',
  'REST',
  'gRPC',
  'CI/CD',
  'Git',
  'Linux',
  'SQL',
  'NoSQL',
  'Kafka Streams',
  'Datadog',
  'Grafana',
  'Prometheus',
  'Jenkins',
  'GitHub Actions',
  'Figma',
  'Scrum',
  'Agile',
]

export const SOFT_SKILL_TERMS = [
  'communication',
  'written communication',
  'verbal communication',
  'collaboration',
  'cross-functional collaboration',
  'teamwork',
  'team player',
  'leadership',
  'mentoring',
  'mentorship',
  'coaching',
  'ownership',
  'problem solving',
  'problem-solving',
  'critical thinking',
  'analytical',
  'analytical skills',
  'attention to detail',
  'detail-oriented',
  'time management',
  'prioritization',
  'adaptability',
  'interpersonal skills',
  'stakeholder management',
  'stakeholder communication',
  'presentation skills',
  'negotiation',
  'organizational skills',
  'self-motivated',
  'proactive',
  'independent',
  'creative',
  'curious',
]

function escapeTerm(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when `term` appears in `text` as a whole word or whole identifier, so
 * "Java" is not found inside "JavaScript" and "SQL" is not found inside
 * "PostgreSQL".
 */
export function containsTerm(text: string, term: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9+#])${escapeTerm(term)}([^A-Za-z0-9+#.]|$)`, 'i').test(text)
}

/**
 * Finds which of `terms` appear in `text`.
 *
 * Longer names wins: "Spring Boot" is reported and the "Spring" it contains is
 * dropped, otherwise a single mention would produce two overlapping skills.
 */
export function findKnownTerms(text: string, terms: string[]): string[] {
  const matches = terms.filter((term) => containsTerm(text, term))

  const longestFirst = [...matches].sort((a, b) => b.length - a.length)

  return longestFirst.filter(
    (term, index) =>
      !longestFirst.slice(0, index).some((kept) => kept.toLowerCase().includes(term.toLowerCase())),
  )
}

export function extractSkillCandidates(text: string): string[] {
  return findKnownTerms(text, KNOWN_TECH_TERMS)
}

export function extractSoftSkills(text: string): string[] {
  return findKnownTerms(text, SOFT_SKILL_TERMS)
}
