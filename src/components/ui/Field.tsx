import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

const controlBase =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-muted ' +
  'disabled:text-ink-subtle aria-[invalid=true]:border-danger'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  /** Keeps the label available to screen readers without showing it. */
  labelHidden?: boolean
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode
}

function FieldShell({ label, hint, error, required, labelHidden, children }: FieldShellProps) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const hintId = `${baseId}-hint`
  const errorId = `${baseId}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn('text-sm font-medium text-ink', labelHidden && 'sr-only')}
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ inputId, describedBy })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string
  labelHidden?: boolean
}

export function TextInput({
  label,
  hint,
  error,
  required,
  labelHidden,
  className,
  ...rest
}: TextInputProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelHidden={labelHidden}
    >
      {({ inputId, describedBy }) => (
        <input
          {...rest}
          id={inputId}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(controlBase, className)}
        />
      )}
    </FieldShell>
  )
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: ReactNode
  error?: string
  labelHidden?: boolean
}

export function TextArea({
  label,
  hint,
  error,
  required,
  labelHidden,
  className,
  ...rest
}: TextAreaProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      labelHidden={labelHidden}
    >
      {({ inputId, describedBy }) => (
        <textarea
          {...rest}
          id={inputId}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(controlBase, 'resize-y leading-relaxed', className)}
        />
      )}
    </FieldShell>
  )
}
