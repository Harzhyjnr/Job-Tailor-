import { createContext } from 'react'
import type { Dispatch } from 'react'

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface Toast {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

export type ToastAction = { type: 'add'; toast: Toast } | { type: 'dismiss'; id: string }

export interface ToastApi {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export type ToastDispatch = Dispatch<ToastAction>

export function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'add':
      return [...state, action.toast]
    case 'dismiss':
      return state.filter((toast) => toast.id !== action.id)
  }
}
