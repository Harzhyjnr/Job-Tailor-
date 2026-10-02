/** Normalized job description model produced by the job analyzer. */

export type Seniority =
  'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'executive' | 'unknown'

export type RequirementImportance = 'required' | 'preferred' | 'responsibility'

export interface Requirement {
  id: string
  /** Canonical skill/term name, e.g. "PostgreSQL". */
  label: string
  importance: RequirementImportance
  category: 'technical' | 'soft' | 'domain' | 'experience' | 'education' | 'certification' | 'other'
  /** Verbatim phrase from the job description. */
  evidence: string
  /** Minimum years of experience when the posting states one, else undefined. */
  minYears?: number
}

export interface Responsibility {
  id: string
  text: string
  /** Skills referenced by this responsibility, used for keyword coverage. */
  relatedTerms: string[]
}

export interface JobDescription {
  title?: string
  company?: string
  location?: string
  employmentType?: string
  seniority: Seniority
  industry?: string
  minYearsExperience?: number
  educationRequirement?: string
  requirements: Requirement[]
  preferred: Requirement[]
  responsibilities: Responsibility[]
  certifications: string[]
  technicalSkills: string[]
  softSkills: string[]
  rawText: string
}
