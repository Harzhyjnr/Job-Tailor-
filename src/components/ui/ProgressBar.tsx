import { cn } from '@/utils/cn'

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  className,
}: {
  /** Current value. Clamped to 0-100 so an out-of-range score cannot overflow the track. */
  value: number
  max?: number
  label: string
  showValue?: boolean
  className?: string
}) {
  const clamped = Math.min(Math.max((value / (max || 1)) * 100, 0), 100)

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        {showValue ? (
          <span className="text-sm tabular-nums text-ink-muted">{Math.round(clamped)}%</span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
