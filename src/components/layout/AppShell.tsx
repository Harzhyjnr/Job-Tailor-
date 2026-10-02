import type { ReactNode } from 'react'

import { STAGES } from '@/constants/workflow'
import { cn } from '@/utils/cn'

export interface AppShellProps {
  /** Site header rendered above the skip link target. */
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}

export function AppShell({ header, footer, children, className }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to main content
      </a>
      {header}
      <main id="main" className={cn('flex-1', className)}>
        {children}
      </main>
      {footer}
    </div>
  )
}

export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn('py-14', className)}
    >
      <div className="mx-auto max-w-6xl px-4">
        <h2
          id={id ? `${id}-title` : undefined}
          className="text-2xl font-semibold tracking-tight text-ink"
        >
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-2xl text-ink-muted">{description}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}

export { STAGES }
