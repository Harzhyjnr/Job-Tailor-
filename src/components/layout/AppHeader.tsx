import { Button } from '@/components/ui/Button'

export interface AppHeaderProps {
  onStart: () => void
  onOpenPrivacy: () => void
  stage?: React.ReactNode
}

export function AppHeader({ onStart, onOpenPrivacy, stage }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <a href="#top" className="text-base font-semibold tracking-tight text-ink">
          Job Tailor
        </a>
        {stage ? <div className="order-3 w-full lg:order-none lg:w-auto">{stage}</div> : null}
        <nav aria-label="Primary" className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenPrivacy}>
            Privacy
          </Button>
          <Button size="sm" onClick={onStart}>
            Tailor My Resume
          </Button>
        </nav>
      </div>
    </header>
  )
}
