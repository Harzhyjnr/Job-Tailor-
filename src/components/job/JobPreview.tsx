import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { JOB_SECTION_LABELS } from '@/services/jobHeadings'
import type { JobSectionKey } from '@/services/jobHeadings'
import type { JobDescription, Requirement, Seniority } from '@/types/job'
import { truncate } from '@/utils/text'

const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
  executive: 'Executive',
  unknown: 'Not detected',
}

const CATEGORY_LABELS: Record<Requirement['category'], string> = {
  technical: 'Technical',
  soft: 'Soft skill',
  domain: 'Domain',
  experience: 'Experience',
  education: 'Education',
  certification: 'Certification',
  other: 'General',
}

/**
 * Read-only view of everything the job analyzer extracted. Undetected fields are
 * reported rather than hidden, and every requirement keeps its evidence so a user
 * can confirm it came from the posting.
 */
export function JobPreview({ job }: { job: JobDescription }) {
  const fields: { label: string; value?: string }[] = [
    { label: 'Job title', value: job.title },
    { label: 'Company', value: job.company },
    { label: 'Location', value: job.location },
    { label: 'Employment type', value: job.employmentType },
    {
      label: 'Seniority',
      value: job.seniority !== 'unknown' ? SENIORITY_LABELS[job.seniority] : undefined,
    },
    {
      label: 'Minimum experience',
      value: job.minYearsExperience !== undefined ? `${job.minYearsExperience}+ years` : undefined,
    },
    { label: 'Industry', value: job.industry },
    { label: 'Education', value: job.educationRequirement },
  ]

  const missing: JobSectionKey[] = []
  if (job.requirements.length === 0) missing.push('requirements')
  if (job.preferred.length === 0) missing.push('preferred')
  if (job.responsibilities.length === 0) missing.push('responsibilities')

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <CardHeader
          title="Job description read successfully"
          description="Everything below was read from the posting you pasted. Nothing was added or inferred."
          actions={<Badge tone="success">Parsed</Badge>}
        />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs tracking-wide text-ink-subtle uppercase">{field.label}</dt>
                <dd
                  className={
                    field.value ? 'mt-0.5 text-sm text-ink' : 'mt-0.5 text-sm text-ink-subtle'
                  }
                >
                  {field.value ? field.value : 'Not detected'}
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Requirements and responsibilities"
          description="Grouped by the section headings found in the posting."
        />
        <CardBody className="flex flex-col gap-5">
          {job.requirements.length === 0 &&
          job.preferred.length === 0 &&
          job.responsibilities.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No requirements, preferred qualifications or responsibilities sections were
              recognized. The raw text is still preserved and can be used for analysis.
            </p>
          ) : null}

          {job.requirements.length > 0 ? (
            <RequirementBlock
              title={`Requirements (${job.requirements.length})`}
              items={job.requirements}
            />
          ) : null}
          {job.preferred.length > 0 ? (
            <RequirementBlock
              title={`Preferred qualifications (${job.preferred.length})`}
              items={job.preferred}
              tone="info"
            />
          ) : null}
          {job.responsibilities.length > 0 ? <ResponsibilityBlock job={job} /> : null}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Skills and certifications"
          description="Terms matched from the whole posting."
        />
        <CardBody className="flex flex-col gap-5">
          <TermChips
            title={`Technical skills (${job.technicalSkills.length})`}
            tone="brand"
            terms={job.technicalSkills}
            fallback="No known technologies were detected."
          />
          <TermChips
            title={`Soft skills (${job.softSkills.length})`}
            tone="neutral"
            terms={job.softSkills}
            fallback="No soft skills were detected."
          />

          <section>
            <h3 className="text-sm font-semibold tracking-tight text-ink">
              Certifications ({job.certifications.length})
            </h3>
            {job.certifications.length > 0 ? (
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {job.certifications.map((certification, index) => (
                  <li key={`${certification}-${index}`} className="text-sm text-ink-muted">
                    {truncate(certification, 160)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-ink-subtle">No certifications were mentioned.</p>
            )}
          </section>

          {missing.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink">Could not confidently detect:</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {missing.map((key) => (
                  <li key={key}>
                    <Badge tone="neutral">{JOB_SECTION_LABELS[key]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}

function RequirementBlock({
  title,
  items,
  tone = 'warning',
}: {
  title: string
  items: Requirement[]
  tone?: 'warning' | 'info'
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      <ul className="mt-1.5 flex flex-col gap-2">
        {items.map((requirement) => (
          <li key={requirement.id} className="border-l-2 border-border pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{requirement.label}</span>
              <Badge tone={tone}>{CATEGORY_LABELS[requirement.category]}</Badge>
              {requirement.minYears !== undefined ? (
                <Badge tone="neutral">{requirement.minYears}+ yrs</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{truncate(requirement.evidence, 200)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ResponsibilityBlock({ job }: { job: JobDescription }) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">
        Responsibilities ({job.responsibilities.length})
      </h3>
      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
        {job.responsibilities.map((responsibility) => (
          <li key={responsibility.id} className="text-sm text-ink-muted">
            {truncate(responsibility.text, 240)}
          </li>
        ))}
      </ul>
    </section>
  )
}

function TermChips({
  title,
  terms,
  tone,
  fallback,
}: {
  title: string
  terms: string[]
  tone: 'brand' | 'neutral'
  fallback: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      {terms.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <li key={term}>
              <Badge tone={tone}>{term}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-ink-subtle">{fallback}</p>
      )}
    </section>
  )
}
