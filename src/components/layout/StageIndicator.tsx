import { STAGES } from '@/constants/workflow'
import type { Stage } from '@/constants/workflow'
import { cn } from '@/utils/cn'

export interface StageIndicatorProps {
  current: Stage
  className?: string
}

/**
 * Progress is conveyed by position in the list plus explicit "Step X of Y"
 * text, so it never depends on colour alone.
 */
export function StageIndicator({ current, className }: StageIndicatorProps) {
  const currentIndex = STAGES.indexOf(current)

  return (
    <nav aria-label="Workflow progress" className={cn('w-full', className)}>
      <p className="sr-only">
        Step {currentIndex + 1} of {STAGES.length}: {current}
      </p>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {STAGES.map((stage, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li key={stage} className="flex items-center gap-2">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2 py-0.5',
                  isCurrent && 'bg-brand-subtle font-semibold text-brand',
                  !isCurrent && !isComplete && 'text-ink-subtle',
                  isComplete && 'text-ink-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold',
                    isCurrent && 'border-brand bg-brand text-white',
                    isComplete && 'border-success bg-success-subtle text-success',
                    !isCurrent && !isComplete && 'border-border-strong text-ink-subtle',
                  )}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
                {stage}
                {isComplete ? <span className="sr-only"> (completed)</span> : null}
              </span>
              {index < STAGES.length - 1 ? (
                <span aria-hidden="true" className="text-border-strong">
                  /
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
