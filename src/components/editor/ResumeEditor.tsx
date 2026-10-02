import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextArea, TextInput } from '@/components/ui/Field'
import { analyzeResumeAgainstJob } from '@/services/analysisEngine'
import type { TailoredResume } from '@/types/analysis'
import type { JobDescription } from '@/types/job'
import type { Education, Experience, Resume, ResumeSectionKey, Skill } from '@/types/resume'

export interface ResumeEditorProps {
  resume: TailoredResume
  job?: JobDescription
  onChange: (resume: TailoredResume) => void
}

/**
 * Edits the tailored copy. Every keystroke produces a new document and hands it to
 * `onChange`, so whatever holds the state also holds the save: there is no draft to
 * lose and no save button that can be forgotten. Values are stored exactly as typed —
 * the editor never rewrites a user's words.
 *
 * Two things are recomputed on every change so the document never carries a stale
 * claim: the keyword readout, which uses the same matcher as the review, and
 * `uncoveredRequirements`, so a term the user adds on purpose stops being reported
 * as missing and a term they delete starts being reported again. The engine's
 * change log is left alone: it is the record of what the engine did, not a claim
 * about the current text.
 */
export function ResumeEditor({ resume, job, onChange }: ResumeEditorProps) {
  const analysis = useMemo(
    () => (job ? analyzeResumeAgainstJob(resume, job) : undefined),
    [job, resume],
  )

  const emit = (patch: Partial<Resume>) => {
    onChange({
      ...resume,
      ...patch,
      uncoveredRequirements: analysis
        ? analysis.jobMatch.missingRequirements
        : resume.uncoveredRequirements,
    })
  }

  const update = (patch: Partial<Resume>) => emit(patch)
  const updateContact = (key: keyof Resume['personalInfo'], value: string) =>
    emit({ personalInfo: { ...resume.personalInfo, [key]: value || undefined } })

  const readOnlySections = (
    [
      ['certifications', resume.certifications.length],
      ['projects', resume.projects.length],
      ['awards', resume.awards.length],
      ['languages', resume.languages.length],
    ] as [ResumeSectionKey, number][]
  ).filter(([, count]) => count > 0)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Contact"
          description="Exactly as it should read at the top of the page."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Name"
            value={resume.personalInfo.name ?? ''}
            onChange={(event) => updateContact('name', event.target.value)}
          />
          <TextInput
            label="Location"
            value={resume.personalInfo.location ?? ''}
            onChange={(event) => updateContact('location', event.target.value)}
          />
          <TextInput
            label="Email"
            type="email"
            value={resume.personalInfo.email ?? ''}
            onChange={(event) => updateContact('email', event.target.value)}
          />
          <TextInput
            label="Phone"
            type="tel"
            value={resume.personalInfo.phone ?? ''}
            onChange={(event) => updateContact('phone', event.target.value)}
          />
          <TextInput
            label="LinkedIn"
            value={resume.personalInfo.linkedin ?? ''}
            onChange={(event) => updateContact('linkedin', event.target.value)}
          />
          <TextInput
            label="Portfolio"
            value={resume.personalInfo.portfolio ?? ''}
            onChange={(event) => updateContact('portfolio', event.target.value)}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Summary"
          description="The tailored opening. It was assembled from your own lines, so edit it in your own voice."
        />
        <TextArea
          label="Summary"
          rows={4}
          value={resume.summary ?? ''}
          onChange={(event) => update({ summary: event.target.value || undefined })}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title={`Experience (${resume.experience.length})`}
          description="Reorder by editing the text; the preview on the right follows every change."
        />
        {resume.experience.map((experience, index) => (
          <ExperienceEditor
            key={experience.id}
            experience={experience}
            onChange={(updated) => {
              const next = [...resume.experience]
              next[index] = updated
              update({ experience: next })
            }}
          />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title={`Education (${resume.education.length})`}
          description="Left as parsed unless you change it."
        />
        {resume.education.map((education, index) => (
          <EducationEditor
            key={education.id}
            education={education}
            onChange={(updated) => {
              const next = [...resume.education]
              next[index] = updated
              update({ education: next })
            }}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Skills"
          description="Comma separated, in the order you want them to print."
        />
        <SkillsField skills={resume.skills} onChange={(skills) => emit({ skills })} />
      </section>

      {readOnlySections.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading
            title="Read-only sections"
            description="These sections were not part of the tailored copy, so they print exactly as they were parsed."
          />
          <ul className="flex flex-wrap gap-1.5">
            {readOnlySections.map(([key, count]) => (
              <li key={key}>
                <Badge tone="neutral">
                  {READ_ONLY_LABELS[key]} ({count})
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis ? (
        <p className="text-xs text-ink-subtle">
          {analysis.keywordCoverage.matched.length} of{' '}
          {analysis.keywordCoverage.matched.length +
            analysis.keywordCoverage.missing.length +
            analysis.keywordCoverage.related.length}{' '}
          posting terms are covered by the text above.
        </p>
      ) : null}
    </div>
  )
}

const READ_ONLY_LABELS: Record<string, string> = {
  certifications: 'Certifications',
  projects: 'Projects',
  awards: 'Awards',
  languages: 'Languages',
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      <p className="text-xs text-ink-subtle">{description}</p>
    </div>
  )
}

function ExperienceEditor({
  experience,
  onChange,
}: {
  experience: Experience
  onChange: (experience: Experience) => void
}) {
  const patch = (changes: Partial<Experience>) => onChange({ ...experience, ...changes })
  const roleName =
    [experience.title, experience.company].filter(Boolean).join(' at ') || 'Untitled role'

  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-medium text-ink-subtle">{roleName}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Title"
          value={experience.title ?? ''}
          onChange={(event) => patch({ title: event.target.value || undefined })}
        />
        <TextInput
          label="Company"
          value={experience.company ?? ''}
          onChange={(event) => patch({ company: event.target.value || undefined })}
        />
        <TextInput
          label="Dates"
          hint="Written as you want it read, e.g. Jan 2022 - Present"
          value={experience.dateRange ?? ''}
          onChange={(event) => patch({ dateRange: event.target.value || undefined })}
        />
        <TextInput
          label="Location"
          value={experience.location ?? ''}
          onChange={(event) => patch({ location: event.target.value || undefined })}
        />
      </div>

      <BulletEditor
        title="Outcomes"
        singular="outcome"
        context={roleName}
        description="What changed because you were there."
        items={experience.achievements}
        onChange={(achievements) => patch({ achievements })}
      />
      <BulletEditor
        title="Responsibilities"
        singular="responsibility"
        context={roleName}
        description="What you were responsible for."
        items={experience.responsibilities}
        onChange={(responsibilities) => patch({ responsibilities })}
      />
    </fieldset>
  )
}

function EducationEditor({
  education,
  onChange,
}: {
  education: Education
  onChange: (education: Education) => void
}) {
  const patch = (changes: Partial<Education>) => onChange({ ...education, ...changes })

  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-medium text-ink-subtle">
        {[education.degree, education.institution].filter(Boolean).join(' — ') || 'Unnamed entry'}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Degree"
          value={education.degree ?? ''}
          onChange={(event) => patch({ degree: event.target.value || undefined })}
        />
        <TextInput
          label="Field"
          value={education.field ?? ''}
          onChange={(event) => patch({ field: event.target.value || undefined })}
        />
        <TextInput
          label="Institution"
          value={education.institution ?? ''}
          onChange={(event) => patch({ institution: event.target.value || undefined })}
        />
        <TextInput
          label="Dates"
          value={education.dateRange ?? ''}
          onChange={(event) => patch({ dateRange: event.target.value || undefined })}
        />
      </div>
      <BulletEditor
        title="Details"
        singular="detail"
        context={
          [education.degree, education.institution].filter(Boolean).join(' at ') || 'Education'
        }
        description="Coursework, thesis or honours, if you listed them."
        items={education.details}
        onChange={(details) => patch({ details })}
      />
    </fieldset>
  )
}

function BulletEditor({
  title,
  singular,
  context,
  description,
  items,
  onChange,
}: {
  title: string
  singular: string
  /** Qualifies every label, so two roles never share an accessible name. */
  context: string
  description: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div>
        <p className="text-xs font-medium text-ink">
          {title} <span className="font-normal text-ink-subtle">({items.length})</span>
        </p>
        <p className="text-xs text-ink-subtle">{description}</p>
      </div>

      {items.map((item, index) => (
        <div key={`${title}-${index}`} className="flex items-start gap-2">
          <TextArea
            label={`${title} ${index + 1}, ${context}`}
            labelHidden
            rows={2}
            value={item}
            onChange={(event) => {
              const next = [...items]
              next[index] = event.target.value
              onChange(next)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 shrink-0"
            onClick={() => onChange(items.filter((_, position) => position !== index))}
          >
            Remove{' '}
            <span className="sr-only">
              {singular} {index + 1} from {context}
            </span>
          </Button>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, ''])}
        >
          Add {singular} <span className="sr-only">to {context}</span>
        </Button>
      </div>
    </div>
  )
}

/**
 * The skills field is the one place where a string is turned back into a list, so
 * the raw text is held here and the input is driven from it. Re-serializing the
 * parsed list on every keystroke would eat the separator the moment it was typed.
 * The field re-syncs whenever the stored skills change from outside, which is what
 * "reset to tailored copy" does.
 */
function SkillsField({
  skills,
  onChange,
}: {
  skills: Skill[]
  onChange: (skills: Skill[]) => void
}) {
  const serialized = skills.map((skill) => skill.name).join(', ')
  const [text, setText] = useState(serialized)
  const [syncedFrom, setSyncedFrom] = useState(serialized)

  if (serialized !== syncedFrom) {
    setSyncedFrom(serialized)
    setText(serialized)
  }

  return (
    <TextInput
      label="Skills"
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        onChange(parseSkills(event.target.value, skills))
      }}
    />
  )
}

function parseSkills(value: string, previous: Skill[]): Skill[] {
  const byName = new Map(previous.map((skill) => [skill.name.toLowerCase(), skill]))

  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => {
      const existing = byName.get(name.toLowerCase())
      if (existing) {
        return { ...existing, name }
      }

      return { id: `skill-${index + 1}`, name, source: 'edited in editor' }
    })
}
