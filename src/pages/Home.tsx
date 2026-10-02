import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const STEPS = [
  {
    title: 'Upload your resume',
    body: 'PDF, DOCX, or pasted text. Everything is read in your browser.',
  },
  {
    title: 'Add the job description',
    body: 'Paste the whole posting. We pull out requirements, skills and responsibilities.',
  },
  {
    title: 'Get a recruiter-style assessment',
    body: 'A senior recruiter scan of your original resume: matches, gaps, ATS issues.',
  },
  {
    title: 'Tailor your resume',
    body: 'Reorder and re-emphasise what you already did. Nothing gets invented.',
  },
  {
    title: 'Download your PDF',
    body: 'Edit, preview, then export a clean ATS-friendly file.',
  },
]

const GUARANTEES = [
  {
    title: 'No fabrication',
    body: 'The tailoring engine reorders and re-emphasises your own words. It never adds employers, titles, dates, metrics, certifications or skills you did not write.',
  },
  {
    title: 'No account',
    body: 'No sign-up, no email, no password. Open the app and start working.',
  },
  {
    title: 'No mandatory API',
    body: 'Analysis runs locally on deterministic rules. An AI provider is optional and never required.',
  },
]

export function Home({ onStart }: { onStart: () => void }) {
  return (
    <div id="top">
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">Job Tailor</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
            Tailor your resume to the job. Without losing your story.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">
            Get an honest recruiter-style review of your resume first, then tailor it to a specific
            posting — entirely inside your browser.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onStart}>
              Tailor My Resume
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => document.getElementById('how')?.scrollIntoView()}
            >
              See how it works
            </Button>
          </div>
          <p className="mt-6 max-w-xl rounded-card border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
            Your resume stays in your browser. Job Tailor does not require an account or database.
          </p>
        </div>
      </section>

      <section id="how" aria-labelledby="how-title" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="how-title" className="text-2xl font-semibold tracking-tight text-ink">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand"
                  >
                    {index + 1}
                  </span>
                  <p className="mt-3 font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="privacy"
        aria-labelledby="privacy-title"
        className="border-b border-border bg-surface-subtle"
      >
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="privacy-title" className="text-2xl font-semibold tracking-tight text-ink">
            Built to stay local
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {GUARANTEES.map((item) => (
              <Card key={item.title} className="h-full p-5">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Ready for your first review?
            </h2>
            <p className="mt-2 text-ink-muted">Start with your current resume, exactly as it is.</p>
          </div>
          <Button size="lg" onClick={onStart}>
            Tailor My Resume
          </Button>
        </div>
      </section>
    </div>
  )
}
