import type { Resume } from '@/types/resume'

/**
 * A single verifiable passage of resume text, with the place it came from.
 *
 * The analysis engine never reasons about a claim it cannot point at, so every
 * match it reports is backed by one of these passages.
 */
export type PassageKind =
  | 'skill'
  | 'bullet'
  | 'role'
  | 'summary'
  | 'education'
  | 'project'
  | 'certification'
  | 'award'
  | 'language'

export interface ResumePassage {
  /** Verbatim text from the resume. */
  text: string
  /** Where it came from, e.g. "skills section" or "Senior Backend Engineer at Meridian Payments". */
  source: string
  kind: PassageKind
  /** Present for passages taken from an experience entry. */
  experienceId?: string
}

/**
 * Flattens a resume into passages, keeping the distinction between a keyword
 * stated in a skills list and the same keyword buried in a bullet. The engine
 * treats the first as strong evidence and the second as partial.
 */
export function buildResumeIndex(resume: Resume): ResumePassage[] {
  const passages: ResumePassage[] = []

  for (const skill of resume.skills) {
    passages.push({ text: skill.name, source: skill.source, kind: 'skill' })
  }

  for (const experience of resume.experience) {
    const parts = [experience.title, experience.company].filter(Boolean)
    const label = parts.join(' at ') || 'Experience'

    if (parts.length > 0) {
      passages.push({
        text: parts.join(', '),
        source: label,
        kind: 'role',
        experienceId: experience.id,
      })
    }

    for (const bullet of [...experience.achievements, ...experience.responsibilities]) {
      passages.push({ text: bullet, source: label, kind: 'bullet', experienceId: experience.id })
    }
  }

  if (resume.summary) {
    passages.push({ text: resume.summary, source: 'Summary', kind: 'summary' })
  }

  for (const education of resume.education) {
    const label = education.institution ?? 'Education'

    if (education.rawText) {
      passages.push({ text: education.rawText, source: label, kind: 'education' })
    } else {
      const heading = [education.degree, education.field, education.institution]
        .filter(Boolean)
        .join(', ')

      if (heading) passages.push({ text: heading, source: label, kind: 'education' })
    }

    for (const detail of education.details) {
      passages.push({ text: detail, source: label, kind: 'education' })
    }
  }

  for (const project of resume.projects) {
    const label = `Project: ${project.name}`
    for (const tech of project.tech) {
      passages.push({ text: tech, source: label, kind: 'skill' })
    }
    const body = project.rawText ?? project.description
    if (body) {
      passages.push({ text: body, source: label, kind: 'project' })
    }
  }

  for (const certification of resume.certifications) {
    passages.push({
      text: certification.rawText ?? certification.name,
      source: certification.name,
      kind: 'certification',
    })
  }

  for (const award of resume.awards) {
    passages.push({
      text: award.rawText ?? [award.title, award.issuer].filter(Boolean).join(', '),
      source: award.title ?? 'Award',
      kind: 'award',
    })
  }

  for (const language of resume.languages) {
    passages.push({
      text: language.rawText ?? language.name,
      source: language.name,
      kind: 'language',
    })
  }

  return passages.filter((passage) => passage.text.trim().length > 0)
}
