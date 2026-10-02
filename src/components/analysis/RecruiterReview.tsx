import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { AtsIssue, MatchStatus, RecruiterAnalysis, RequirementMatch } from '@/types/analysis'
import type { JobDescription } from '@/types/job'
import { truncate } from '@/utils/text'

const STATUS_LABELS: Record<MatchStatus, string> = {
  strong: 'Strong',
  partial: 'Partial',
  'needs-clarification': 'Needs detail',
  missing: 'Missing',
}

const STATUS_TONES: Record<MatchStatus, BadgeTone> = {
  strong: 'success',
  partial: 'warning',
  'needs-clarification': 'info',
  missing: 'danger',
}

const SEVERITY_TONES: Record<AtsIssue['severity'], BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

const SEVERITY_LABELS: Record<AtsIssue['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const CATEGORY_LABELS: Record<AtsIssue['category'], string> = {
  structure: 'Structure',
  contact: 'Contact details',
  dates: 'Dates',
  titles: 'Titles',
  formatting: 'Formatting',
  keywords: 'Keywords',
  length: 'Length',
  readability: 'Readability',
}

/**
 * The recruiter review. Every line here is traceable to text in the resume or the
 * posting: matched terms carry the evidence that justified them, and anything the
 * engine could not confirm is shown as missing rather than assumed.
 */
export function RecruiterReview({
  analysis,
  job,
}: {
  analysis: RecruiterAnalysis
  job: JobDescription
}) {
  const { jobMatch, keywordCoverage, achievementQuality, atsReview, firstImpression } = analysis
  const roleLabel = [job.title, job.company].filter(Boolean).join(' at ') || 'the pasted posting'

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <CardHeader
          title="Resume match"
          description="Internal comparison only. Not a prediction of hiring outcome."
          actions={
            <Badge tone="neutral">
              {analysis.provider === 'local' ? 'On-device analysis' : analysis.provider}
            </Badge>
          }
        />
        <CardBody className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <ProgressBar value={analysis.matchScore} label={`Match with ${roleLabel}`} showValue />
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Strong" value={jobMatch.strongMatches.length} />
              <Stat label="Partial" value={jobMatch.partialMatches.length} />
              <Stat label="Missing" value={jobMatch.missingRequirements.length} />
            </div>
          </div>
          <p className="text-sm text-ink-muted">{analysis.overallAssessment}</p>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="First impression"
          description="What a recruiter sees in about fifteen seconds, drawn only from your resume."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <ImpressionColumn
            title="Stands out"
            items={firstImpression.standsOut}
            empty="No metric-backed result was found in your resume."
            tone="success"
            marker="Strong"
          />
          <ImpressionColumn
            title="Reads as strong"
            items={firstImpression.strong}
            empty="No requirement is clearly evidenced yet."
            tone="success"
            marker="Strong"
          />
          <ImpressionColumn
            title="Unclear"
            items={firstImpression.unclear}
            empty="Nothing in your resume reads as unclear."
            tone="info"
            marker="Check"
          />
          <ImpressionColumn
            title="Causes hesitation"
            items={firstImpression.hesitations}
            empty="Nothing obvious to hesitate over."
            tone="warning"
            marker="Check"
          />
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Keyword coverage"
          description="Terms read from the posting, checked against your resume."
          actions={<Badge tone="brand">{keywordCoverage.coverage}% covered</Badge>}
        />
        <CardBody className="flex flex-col gap-5">
          <ProgressBar value={keywordCoverage.coverage} label="Requirement coverage" showValue />
          <div className="grid gap-4 sm:grid-cols-3">
            <CoverageGroup
              title="Found"
              tone="success"
              terms={keywordCoverage.matched.map((match) => match.term)}
              empty="No posting term appears in your resume."
            />
            <CoverageGroup
              title="Related only"
              tone="info"
              terms={keywordCoverage.related.map(
                (match) => `${match.term} → ${match.relatedTerm ?? 'related term'}`,
              )}
              empty="No near-equivalents were needed."
            />
            <CoverageGroup
              title="Not found"
              tone="danger"
              terms={keywordCoverage.missing.map((match) => match.term)}
              empty="Every term read from the posting appears in your resume."
            />
          </div>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Job match"
          description="Each requirement, with the evidence behind its status."
        />
        <CardBody className="flex flex-col gap-5">
          <MatchGroup
            title={`Strongly evidenced (${jobMatch.strongMatches.length})`}
            items={jobMatch.strongMatches}
            empty="Nothing is strongly evidenced yet."
          />
          <MatchGroup
            title={`Partly evidenced (${jobMatch.partialMatches.length})`}
            items={jobMatch.partialMatches}
            empty="Nothing is half-evidenced."
          />
          <MatchGroup
            title={`No evidence (${jobMatch.missingRequirements.length})`}
            items={jobMatch.missingRequirements}
            empty="Nothing in the posting is unaddressed."
          />
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Experience relevance"
          description="How much of the posting each of your roles already covers."
        />
        <CardBody>
          {analysis.experienceRelevance.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              No experience entries were found, so role relevance could not be scored.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {analysis.experienceRelevance.map((entry) => (
                <li key={entry.experienceId} className="border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {[entry.title, entry.company].filter(Boolean).join(' · ') || 'Experience'}
                    </span>
                    <Badge tone={STATUS_TONES[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
                    <Badge tone="neutral">{entry.score}% relevant</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{entry.rationale}</p>
                  {entry.matchedTerms.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.matchedTerms.map((term) => (
                        <li key={term}>
                          <Badge tone="neutral">{term}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Skills"
          description="Compared between your skills section and the whole posting."
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <CoverageGroup
            title="Matched"
            tone="success"
            terms={analysis.skillsMatch.matched}
            empty="No posting skill is named in your skills section."
          />
          <CoverageGroup
            title="Missing"
            tone="danger"
            terms={analysis.skillsMatch.missing}
            empty="Every posting skill is in your skills section."
          />
          <CoverageGroup
            title="Yours only"
            tone="neutral"
            terms={analysis.skillsMatch.extra}
            empty="Your skills section adds nothing the posting does not mention."
          />
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="ATS readiness"
          description="The checks an applicant tracking system cares about, and what passed."
          actions={<Badge tone="brand">{atsReview.score}/100</Badge>}
        />
        <CardBody className="flex flex-col gap-5">
          <ProgressBar value={atsReview.score} label="ATS readiness" showValue />
          {atsReview.passed.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold tracking-tight text-ink">Checks passed</h3>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
                {atsReview.passed.map((item) => (
                  <li key={item} className="text-sm text-ink-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {atsReview.issues.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold tracking-tight text-ink">
                Issues ({atsReview.issues.length})
              </h3>
              <ul className="mt-1.5 flex flex-col gap-3">
                {atsReview.issues.map((issue) => (
                  <li key={issue.id} className="border-l-2 border-border pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{issue.title}</span>
                      <Badge tone={SEVERITY_TONES[issue.severity]}>
                        {SEVERITY_LABELS[issue.severity]}
                      </Badge>
                      <Badge tone="neutral">{CATEGORY_LABELS[issue.category]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{issue.detail}</p>
                    <p className="mt-1 text-sm text-ink-subtle">{issue.suggestion}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Achievement quality"
          description="Whether your bullets state what you did and what came of it."
        />
        <CardBody className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
            <Stat label="Bullets" value={achievementQuality.total} />
            <Stat label="Action verb" value={achievementQuality.withActionVerb} />
            <Stat label="Outcome" value={achievementQuality.withOutcome} />
            <Stat label="Metric" value={achievementQuality.withMetric} />
            <Stat label="Score" value={achievementQuality.score} suffix="%" />
          </div>
          {achievementQuality.notes.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {achievementQuality.notes.map((note) => (
                <li key={note} className="text-sm text-ink-muted">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Concerns"
          description="Everything a skeptical recruiter could stop on. Nothing is hidden."
        />
        <CardBody>
          {analysis.concerns.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-4">
              {analysis.concerns.map((concern) => (
                <li key={concern} className="text-sm text-ink-muted">
                  {concern}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">
              No concerns were found from the text that was parsed.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Recommendations"
          description="Each one is optional and only applies if it is true for you."
        />
        <CardBody>
          {analysis.recommendations.length > 0 ? (
            <ol className="flex list-decimal flex-col gap-1.5 pl-4">
              {analysis.recommendations.map((recommendation) => (
                <li key={recommendation} className="text-sm text-ink-muted">
                  {recommendation}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-subtle">No changes were recommended.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface-subtle px-3 py-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">
        {value}
        {suffix ? <span className="text-base text-ink-subtle">{suffix}</span> : null}
      </p>
      <p className="mt-0.5 text-xs tracking-wide text-ink-subtle uppercase">{label}</p>
    </div>
  )
}

function ImpressionColumn({
  title,
  items,
  empty,
  tone,
  marker,
}: {
  title: string
  items: string[]
  empty: string
  tone: BadgeTone
  marker: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">
        {title} ({items.length})
      </h3>
      {items.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-ink-muted">
              <Badge tone={tone} className="mt-0.5 shrink-0">
                {marker}
              </Badge>
              <span className="min-w-0">{truncate(item, 220)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-ink-subtle">{empty}</p>
      )}
    </section>
  )
}

function CoverageGroup({
  title,
  terms,
  tone,
  empty,
}: {
  title: string
  terms: string[]
  tone: BadgeTone
  empty: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">
        {title} ({terms.length})
      </h3>
      {terms.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <li key={term}>
              <Badge tone={tone}>{term}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-ink-subtle">{empty}</p>
      )}
    </section>
  )
}

function MatchGroup({
  title,
  items,
  empty,
}: {
  title: string
  items: RequirementMatch[]
  empty: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-2">
          {items.map((item) => (
            <li key={`${item.label}-${item.importance}`} className="border-l-2 border-border pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{item.label}</span>
                <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                <Badge tone="neutral">
                  {item.importance === 'required' ? 'Required' : 'Preferred'}
                </Badge>
              </div>
              {item.note ? <p className="mt-1 text-sm text-ink-muted">{item.note}</p> : null}
              {item.evidence.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {item.evidence.map((evidence) => (
                    <li
                      key={evidence}
                      className="border-l border-border pl-2 text-sm text-ink-subtle italic"
                    >
                      “{truncate(evidence, 200)}”
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-ink-subtle">
                  No evidence in your resume. Leave this out unless you can add a real example.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-ink-subtle">{empty}</p>
      )}
    </section>
  )
}
