import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'

const toneStyles = {
  neutral: 'border-border-strong bg-surface text-ink',
  success: 'border-success/30 bg-success-subtle text-ink',
  warning: 'border-warning/30 bg-warning-subtle text-ink',
  danger: 'border-danger/30 bg-danger-subtle text-ink',
} as const

const toneLabels = {
  neutral: 'Notice',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
} as const

export function ToastViewport() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto w-full max-w-sm rounded-card border px-4 py-3 shadow-lg',
            toneStyles[toast.tone],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="sr-only">{toneLabels[toast.tone]}: </span>
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-0.5 text-sm text-ink-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded px-1 text-sm text-ink-subtle hover:text-ink"
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">Dismiss notification</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
