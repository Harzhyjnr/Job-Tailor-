/** Normalized resume model shared by the parser, analyzer, tailoring engine and editor. */

export interface PersonalInfo {
  name?: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  portfolio?: string
}

export type EmploymentType =
  'full-time' | 'part-time' | 'contract' | 'internship' | 'volunteer' | 'other' | 'unknown'

export interface Experience {
  id: string
  company?: string
  title?: string
  location?: string
  employmentType: EmploymentType
  /** Human-readable date range exactly as written in the source, e.g. "Jan 2020 - Present". */
  dateRange?: string
  startDate?: string
  endDate?: string
  isCurrent: boolean
  /** Distinguishes responsibilities from outcomes; kept separate so neither is fabricated. */
  responsibilities: string[]
  achievements: string[]
  /** Raw block text from the source resume, never discarded. */
  rawText: string
}

export interface Education {
  id: string
  institution?: string
  degree?: string
  field?: string
  dateRange?: string
  details: string[]
  rawText: string
}

export interface Skill {
  id: string
  name: string
  category?: string
  /** Where the skill was found, e.g. "skills section", "experience bullet". */
  source: string
  /** Verbatim surrounding text, used to justify every claim in the UI. */
  evidence?: string
}

export interface Certification {
  id: string
  name: string
  issuer?: string
  date?: string
  credentialId?: string
  rawText: string
}

export interface Project {
  id: string
  name: string
  description?: string
  tech: string[]
  url?: string
  rawText: string
}

export interface Award {
  id: string
  title: string
  issuer?: string
  date?: string
  rawText: string
}

export interface Language {
  id: string
  name: string
  proficiency?: string
  rawText: string
}

export type ResumeSectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'projects'
  | 'awards'
  | 'languages'

export interface Resume {
  personalInfo: PersonalInfo
  summary?: string
  experience: Experience[]
  education: Education[]
  skills: Skill[]
  certifications: Certification[]
  projects: Project[]
  awards: Award[]
  languages: Language[]
  /** Sections the parser found, plus those it could not confidently detect. */
  detectedSections: ResumeSectionKey[]
  missingSections: ResumeSectionKey[]
  rawText: string
}
