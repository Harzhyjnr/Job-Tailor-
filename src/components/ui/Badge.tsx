import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted ring-border-strong',
  brand: 'bg-brand-subtle text-brand ring-brand/20',
  success: 'bg-success-subtle text-success ring-success/20',
  warning: 'bg-warning-subtle text-warning ring-warning/20',
  danger: 'bg-danger-subtle text-danger ring-danger/20',
  info: 'bg-info-subtle text-info ring-info/20',
}

/**
 * Tone is paired with text, never used as the only signal, so status stays
 * readable without colour perception.
 */
export function Badge({
  tone = 'neutral',
  icon,
  title,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: ReactNode
  /** Native tooltip, used to surface the evidence behind a detected skill. */
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
