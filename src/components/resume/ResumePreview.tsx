import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { RESUME_SECTION_LABELS } from '@/services/sectionHeadings'
import { normalizeWhitespace, truncate } from '@/utils/text'
import type { Resume, ResumeSectionKey } from '@/types/resume'

const CONTACT_FIELDS: { key: keyof Resume['personalInfo']; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'portfolio', label: 'Portfolio' },
]

/**
 * Read-only view of everything the parser extracted. Every field is labelled
 * with where it came from so a user can tell a confident read from a guess, and
 * undetectable sections are reported rather than hidden.
 */
export function ResumePreview({ resume }: { resume: Resume }) {
  const hasExperience = resume.experience.length > 0
  const hasEducation = resume.education.length > 0
  const hasSkills = resume.skills.length > 0

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <CardHeader
          title="Resume successfully imported"
          description="Everything below was read from the file you provided. Nothing was added or inferred."
          actions={<Badge tone="success">Parsed</Badge>}
        />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {CONTACT_FIELDS.map((field) => {
              const value = resume.personalInfo[field.key]
              return (
                <div key={field.label}>
                  <dt className="text-xs tracking-wide text-ink-subtle uppercase">{field.label}</dt>
                  <dd
                    className={value ? 'mt-0.5 text-sm text-ink' : 'mt-0.5 text-sm text-ink-subtle'}
                  >
                    {value ? value : 'Not detected'}
                  </dd>
                </div>
              )
            })}
          </dl>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Sections detected"
          description="Sections are confirmed when at least one entry was read from them."
        />
        <CardBody className="flex flex-col gap-4">
          <SectionStatusList
            detected={resume.detectedSections}
            missing={resume.missingSections}
            populated={[
              ...(resume.experience.length > 0 ? (['experience'] as ResumeSectionKey[]) : []),
              ...(resume.education.length > 0 ? (['education'] as ResumeSectionKey[]) : []),
              ...(resume.skills.length > 0 ? (['skills'] as ResumeSectionKey[]) : []),
            ]}
          />

          {resume.detectedSections.includes('summary') ? (
            <SummaryBlock summary={resume.summary} />
          ) : null}
          {hasExperience ? <ExperienceBlock resume={resume} /> : null}
          {hasEducation ? <EducationBlock resume={resume} /> : null}
          {hasSkills ? <SkillsBlock resume={resume} /> : null}
          {resume.certifications.length > 0 ? <CertificationsBlock resume={resume} /> : null}
          {resume.projects.length > 0 ? <ProjectsBlock resume={resume} /> : null}
          {resume.awards.length > 0 ? <AwardsBlock resume={resume} /> : null}
          {resume.languages.length > 0 ? <LanguagesBlock resume={resume} /> : null}
        </CardBody>
      </Card>
    </div>
  )
}

function SectionStatusList({
  detected,
  missing,
  populated,
}: {
  detected: ResumeSectionKey[]
  missing: ResumeSectionKey[]
  populated: ResumeSectionKey[]
}) {
  if (detected.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No section headings were recognized. Paste your resume with headings such as Experience,
        Education and Skills, or continue anyway — analysis works on the raw text.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {detected.map((key) => (
          <li key={key}>
            <Badge tone={populated.includes(key) ? 'success' : 'warning'}>
              <span aria-hidden="true">{populated.includes(key) ? '✓' : '!'}</span>
              {RESUME_SECTION_LABELS[key]}
              <span className="sr-only">
                {populated.includes(key) ? ' detected with entries' : ' detected but empty'}
              </span>
            </Badge>
          </li>
        ))}
      </ul>

      {missing.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-ink">Could not confidently detect:</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {missing.map((key) => (
              <li key={key}>
                <Badge tone="neutral">{RESUME_SECTION_LABELS[key]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SummaryBlock({ summary }: { summary?: string }) {
  if (!summary) {
    return (
      <FieldBlock title="Summary">
        <p className="text-sm text-ink-subtle">
          A summary heading was found but no text followed it.
        </p>
      </FieldBlock>
    )
  }

  return (
    <FieldBlock title="Summary">
      <p className="text-sm text-ink-muted">{truncate(summary, 400)}</p>
    </FieldBlock>
  )
}

function ExperienceBlock({ resume }: { resume: Resume }) {
  return (
    <FieldBlock title={`Experience (${resume.experience.length})`}>
      <ul className="flex flex-col gap-4">
        {resume.experience.map((experience) => (
          <li key={experience.id} className="border-l-2 border-border pl-3">
            <p className="text-sm font-medium text-ink">
              {[experience.title, experience.company].filter(Boolean).join(' at ') ||
                'Untitled role'}
            </p>
            <p className="text-xs text-ink-subtle">
              {[
                experience.dateRange,
                experience.location,
                experience.employmentType !== 'unknown' ? experience.employmentType : undefined,
              ]
                .filter(Boolean)
                .join(' · ') || 'No dates detected'}
            </p>
            <BulletPreview
              achievements={experience.achievements}
              responsibilities={experience.responsibilities}
            />
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function BulletPreview({
  achievements,
  responsibilities,
}: {
  achievements: string[]
  responsibilities: string[]
}) {
  if (achievements.length === 0 && responsibilities.length === 0) {
    return <p className="mt-1 text-sm text-ink-subtle">No bullet points detected.</p>
  }

  return (
    <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
      {[...achievements, ...responsibilities].map((bullet, index) => (
        <li key={`${bullet}-${index}`} className="text-sm text-ink-muted">
          {truncate(bullet, 200)}
        </li>
      ))}
    </ul>
  )
}

function EducationBlock({ resume }: { resume: Resume }) {
  return (
    <FieldBlock title={`Education (${resume.education.length})`}>
      <ul className="flex flex-col gap-3">
        {resume.education.map((education) => (
          <li key={education.id}>
            <p className="text-sm font-medium text-ink">
              {[education.degree, education.institution].filter(Boolean).join(' — ') ||
                'Unnamed entry'}
            </p>
            {education.dateRange ? (
              <p className="text-xs text-ink-subtle">{education.dateRange}</p>
            ) : null}
            {education.details.length > 0 ? (
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
                {education.details.map((detail, index) => (
                  <li key={`${detail}-${index}`} className="text-sm text-ink-muted">
                    {truncate(detail, 160)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function SkillsBlock({ resume }: { resume: Resume }) {
  const fromSection = resume.skills.filter((skill) => skill.source === 'skills section')
  const fromExperience = resume.skills.filter((skill) => skill.source !== 'skills section')

  return (
    <FieldBlock title={`Skills (${resume.skills.length})`}>
      {fromSection.length > 0 ? (
        <div>
          <p className="text-xs tracking-wide text-ink-subtle uppercase">From skills section</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {fromSection.map((skill) => (
              <li key={skill.id}>
                <Badge tone="brand">{skill.name}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fromExperience.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs tracking-wide text-ink-subtle uppercase">
            Mentioned in experience ({fromExperience.length})
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {fromExperience.slice(0, 24).map((skill) => (
              <li key={skill.id}>
                <Badge tone="neutral" title={skill.evidence}>
                  {skill.name}
                </Badge>
              </li>
            ))}
          </ul>
          {fromExperience.length > 24 ? (
            <p className="mt-1.5 text-xs text-ink-subtle">
              and {fromExperience.length - 24} more detected in bullets
            </p>
          ) : null}
        </div>
      ) : null}
    </FieldBlock>
  )
}

function CertificationsBlock({ resume }: { resume: Resume }) {
  return (
    <FieldBlock title={`Certifications (${resume.certifications.length})`}>
      <ul className="flex flex-col gap-1.5">
        {resume.certifications.map((certification) => (
          <li key={certification.id} className="text-sm text-ink-muted">
            <span className="text-ink">{certification.name}</span>
            {certification.issuer ? ` · ${certification.issuer}` : ''}
            {certification.date ? ` · ${certification.date}` : ''}
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function ProjectsBlock({ resume }: { resume: Resume }) {
  return (
    <FieldBlock title={`Projects (${resume.projects.length})`}>
      <ul className="flex flex-col gap-2">
        {resume.projects.map((project) => (
          <li key={project.id}>
            <p className="text-sm font-medium text-ink">{project.name}</p>
            {project.description ? (
              <p className="text-sm text-ink-muted">{truncate(project.description, 200)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function AwardsBlock({ resume }: { resume: Resume }) {
  return (
    <FieldBlock title={`Awards (${resume.awards.length})`}>
      <ul className="flex flex-col gap-1.5">
        {resume.awards.map((award) => (
          <li key={award.id} className="text-sm text-ink-muted">
            <span className="text-ink">{award.title}</span>
            {award.issuer ? ` · ${award.issuer}` : ''}
            {award.date ? ` · ${award.date}` : ''}
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function LanguagesBlock({ resume }: { resume: Resume }) {
  return (
    <FieldBlock title={`Languages (${resume.languages.length})`}>
      <ul className="flex flex-wrap gap-1.5">
        {resume.languages.map((language) => (
          <li key={language.id}>
            <Badge tone="neutral">
              {language.name}
              {language.proficiency ? `: ${normalizeWhitespace(language.proficiency)}` : ''}
            </Badge>
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function FieldBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  )
}
