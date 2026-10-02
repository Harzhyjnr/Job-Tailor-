# Job Tailor

Job Tailor is a browser-only resume tailoring tool. It reads your resume, compares it
against a job description and helps you produce a tailored version you can export.

Everything runs locally in the browser. There is no server, no database and no account,
and your resume is never uploaded.

## Status

- **Phase 1 — Complete:** landing page, workflow shell, six-stage indicator, privacy
  modal, toasts, loading/error/empty states, accessible form controls and a reducer-based
  application store.
- **Phase 2 — Complete:** resume import from PDF, DOCX or pasted text, in-browser text
  extraction (`pdfjs-dist` and `mammoth`), a normalized resume parser that never invents
  facts, and a preview of everything that was read.
- **Phase 3 — Complete:** job description import and parsing. The pasted posting is split
  into its header (title, company, location, employment type), requirements, preferred
  qualifications, responsibilities, certifications and skills, with seniority, industry
  and minimum years of experience inferred only when the posting states them.
- **Phase 4 — Complete:** the recruiter review. A deterministic, on-device engine compares
  the resume with the posting and produces a match score, a 15-second first impression,
  requirement and keyword matches with quoted evidence, experience relevance, an ATS
  readiness check, achievement quality, concerns and conditional recommendations. It runs
  entirely in the browser with no AI call, and every claim is backed by text that exists in
  the resume or the posting.
- **Phase 5 — Complete:** tailoring. A deterministic engine reuses the wording of the resume to
  rewrite the summary, move the bullets that cover the posting to the top of each role, lead a
  bullet with a result the resume already states, and reorder the skills list to match the
  posting. It cannot add a word the resume does not contain, and the test suite enforces that
  rule mechanically. Requirements the resume cannot evidence are reported and left out.
- **Phase 6 — Complete:** editing. The editor opens the tailored copy, autosaves into app state
  as you type, and re-runs the same keyword matcher and missing-requirement checks on every
  change, so a term you add on purpose stops being reported as missing and a term you delete
  starts being reported again. A live ATS Classic preview sits beside the form, and one button
  resets the document back to the engineered copy.
- **Phase 7 — Complete:** export. The tailored document is previewed, printed or downloaded, and
  the preview, the print output and the PDF are three renderers of one shared document model,
  so none of them can drift from the others. The PDF is written in the browser with `pdf-lib`
  using the standard fonts and real font metrics: selectable, searchable, text-based, and never
  an image. A pre-flight check re-runs the review against the text the user actually ended up
  with, so the ATS score, the parser issues, the requirements still unevidenced and the word
  count are all reported before the file is offered rather than assumed.
- **Later phases — planned:** none. Every phase above is complete.

## How the review is scored

- Requirements are the individual requirement labels read from the posting, deduplicated so
  a term is never counted twice. Related near-equivalents (Kafka against RabbitMQ, say) are
  reported separately and never counted as a match.
- A term named in a skills list is strong evidence, the same term inside a bullet is
  partial, and a term that only appears in a summary, education line or certification needs
  to be stated more clearly.
- The headline score is an internal comparison weighted towards keyword coverage (45%),
  skills (20%), experience relevance (15%), achievement quality (10%) and ATS readiness
  (10%). It is not a prediction of hiring outcome, and the UI says so.
- Recommendations never tell you to add a term you have not evidenced. They are written as
  conditions, and anything the resume does not support stays in the "no evidence" bucket.

## How the tailored copy is produced

Tailoring runs on the same deterministic, on-device engine as the review. It is allowed to
reorder text, re-case it and move a clause within a sentence, and the only word it may
introduce is the connective "at". It never deletes a claim and never writes a metric,
employer, title, date or technology that the resume does not already contain.

Every change is listed in a change log with the source text it reused, and the original is
shown next to the rewrite. Requirements with no evidence are listed as "left out on purpose"
rather than being filled in, so the user can add them only if they can back them up.

## How the editor saves

There is no save button because there is nothing to save: every keystroke produces a new
document in app state, which is what the preview and the export step read. The values are
stored exactly as typed, so the editor never rewrites a user's words, and the untidy parts of
the document — certifications, projects, awards and languages — are shown as parsed and marked
read-only rather than half-edited.

The ATS Classic template is the single renderer used by both the on-screen preview and the
export step, with the page geometry expressed in inches and taken from the user's
preferences, so the preview is the file rather than an approximation of it.

## How the PDF is written

The preview, the print output and the downloaded PDF are three renderers of one document
model, `buildResumeDocument`, which returns a flat list of laid-out lines. Nothing about the
layout is decided twice, so the three cannot drift apart.

The PDF itself is written with `pdf-lib` in the browser, with the standard PDF fonts and
real font metrics rather than estimates, which is what keeps the text selectable, searchable
and metric-compatible with the on-screen preview. Nothing is rasterized into an image, and no
part of the resume is sent anywhere to produce it. A character the standard fonts cannot draw —
an emoji, an arrow — is dropped and the sentence around it is kept, rather than failing the
export.

One face, on purpose: Arial on screen, Helvetica in the file. Helvetica is the standard PDF
face a browser can match character-for-character in width, so the lines break in the same
places in both. Offering Calibri or Times would mean shipping a font binary and quietly
changing the face in the file, so the preference is not offered. Font size, line height and
margins are adjustable in the export step, and all three are honoured by both renderers.

Before the file is offered, a pre-flight check re-runs the review against the text the user
actually ended up with: the ATS score, the issues a parser will see, the requirements that are
still not evidenced, and the word count. Export never fills a gap; it reports it.

## Supported imports

- PDF and DOCX files up to 5 MB.
- Pasted plain text, which is always available as a fallback for scanned PDFs.
- Job descriptions, pasted as plain text.

Parsing preserves the original `rawText`, leaves uncertain fields unset and reports the
sections it could not confidently detect instead of guessing.

## Scripts

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
npm run verify   # format check, lint, type-check, tests and build
```

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4 and Vitest with Testing Library. The only runtime
dependencies are `mammoth` for DOCX text, `pdfjs-dist` for reading uploaded PDFs, and
`pdf-lib` for writing the exported file.

## Project layout

```
src/
  components/   UI primitives, layout, resume and job previews, recruiter review, tailor view,
                resume editor and the ATS Classic template
  context/      Toast and application-state providers
  hooks/        State, resume-import, recruiter-analysis and tailoring hooks
  pages/        Home and workflow stages
  services/     Resume and job extraction, parsing, headings, date handling, the
                analysis engine, the tailoring engine, the shared document model, the
                PDF writer and their keyword, ATS and achievement checks
  state/        Reducer, actions and initial state
  test/         Fixtures, setup and in-memory PDF/DOCX builders
  types/        Resume, job and analysis models
  utils/        Text helpers
```
