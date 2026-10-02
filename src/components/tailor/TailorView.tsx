import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import type { TailoredResume } from '@/types/analysis'
import type { Experience, Resume } from '@/types/resume'

/**
 * Before and after view of the tailored copy.
 *
 * The original is always shown next to the rewrite, because the guarantee the
 * user is owed is that the tailored text came from the resume they already have.
 */
export function TailorView({ original, tailored }: { original: Resume; tailored: TailoredResume }) {
  const changeCount = tailored.changeLog.length
  const uncovered = tailored.uncoveredRequirements

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <CardHeader
          title="Tailored copy"
          description="Every line below is reused from your resume. Nothing was added, and no claim was removed."
          actions={
            <Badge tone={changeCount > 0 ? 'success' : 'neutral'}>
              {changeCount} change{changeCount === 1 ? '' : 's'}
            </Badge>
          }
        />
        <CardBody>
          {changeCount === 0 ? (
            <p className="text-sm text-ink-subtle">
              No change was needed. The resume already puts the most relevant evidence first for
              this posting.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tailored.changeLog.map((change, index) => (
                <li key={`${change.section}-${index}`} className="border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{change.section}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{change.summary}</p>
                  {change.sourceText ? (
                    <p className="mt-1 border-l border-border pl-2 text-sm text-ink-subtle italic">
                      “{change.sourceText}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Summary"
          description="Your current role, then your strongest evidence."
        />
        <CardBody className="flex flex-col gap-3">
          <Compare
            label="Original"
            value={original.summary ?? 'No summary was detected.'}
            changed={false}
          />
          <Compare
            label="Tailored"
            value={tailored.summary ?? 'No summary was detected.'}
            changed={Boolean(original.summary && tailored.summary !== original.summary)}
          />
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Experience"
          description="Bullets are reordered by how much of the posting they cover, and a result is moved to the front of a bullet where the resume already states one."
        />
        <CardBody className="flex flex-col gap-5">
          {tailored.experience.map((experience, index) => (
            <ExperienceDiff
              key={experience.id}
              before={original.experience[index]}
              after={experience}
            />
          ))}
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Skills"
          description="Reordered so the posting's own terms are read first. Nothing was added."
        />
        <CardBody className="flex flex-col gap-3">
          <Compare
            label="Original"
            value={original.skills.map((skill) => skill.name).join(', ')}
            changed={false}
          />
          <Compare
            label="Tailored"
            value={tailored.skills.map((skill) => skill.name).join(', ')}
            changed={
              original.skills.map((skill) => skill.name).join(', ') !==
              tailored.skills.map((skill) => skill.name).join(', ')
            }
          />
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader
          title={`Left out on purpose (${uncovered.length})`}
          description="The posting asks for these and your resume does not evidence them, so nothing was written in. Add them only if you can back them up."
        />
        <CardBody>
          {uncovered.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {uncovered.map((requirement) => (
                <li key={requirement.label} className="border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{requirement.label}</span>
                    <Badge tone="neutral">
                      {requirement.importance === 'required' ? 'Required' : 'Preferred'}
                    </Badge>
                  </div>
                  {requirement.note ? (
                    <p className="mt-1 text-sm text-ink-muted">{requirement.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">
              Every term read from the posting is already evidenced somewhere in your resume.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function Compare({ label, value, changed }: { label: string; value: string; changed: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tracking-wide text-ink-subtle uppercase">{label}</span>
        {changed ? <Badge tone="success">Changed</Badge> : null}
      </div>
      <p
        className={
          changed
            ? 'mt-1 rounded-card bg-success-subtle px-3 py-2 text-sm text-ink'
            : 'mt-1 text-sm text-ink-muted'
        }
      >
        {value}
      </p>
    </div>
  )
}

function ExperienceDiff({ before, after }: { before?: Experience; after: Experience }) {
  const role = [after.title, after.company].filter(Boolean).join(' at ') || 'Experience'
  const beforeBullets = before ? [...before.achievements, ...before.responsibilities] : []
  const afterBullets = [...after.achievements, ...after.responsibilities]
  const changed = beforeBullets.join(' | ') !== afterBullets.join(' | ')

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{role}</h3>
        {changed ? <Badge tone="success">Changed</Badge> : null}
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs tracking-wide text-ink-subtle uppercase">Original</span>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
            {beforeBullets.map((bullet, index) => (
              <li key={`${bullet}-${index}`} className="text-sm text-ink-muted">
                {bullet}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-xs tracking-wide text-ink-subtle uppercase">Tailored</span>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
            {afterBullets.map((bullet, index) => (
              <li
                key={`${bullet}-${index}`}
                className={
                  bullet !== beforeBullets[index]
                    ? 'text-sm font-medium text-ink'
                    : 'text-sm text-ink-muted'
                }
              >
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
