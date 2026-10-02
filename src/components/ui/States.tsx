import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface-subtle px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-ink-subtle">{icon}</div> : null}
      <p className="text-base font-medium text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-subtle">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

/**
 * Errors are assertive so screen readers announce them immediately, and every
 * error state pairs the message with a recovery action where one exists.
 */
export function ErrorState({
  title,
  description,
  actionLabel,
  onRetry,
  className,
}: {
  title: string
  description?: ReactNode
  actionLabel?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-card border border-danger/30 bg-danger-subtle px-5 py-4',
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-danger">{title}</p>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actionLabel && onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function LoadingState({
  label,
  description,
  className,
}: {
  label: string
  description?: ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-border bg-surface-subtle px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent"
      />
      <p className="text-sm font-medium text-ink">{label}</p>
      {description ? <p className="max-w-md text-sm text-ink-subtle">{description}</p> : null}
    </div>
  )
}
