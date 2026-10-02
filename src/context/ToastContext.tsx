import { useCallback, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'

import { ToastContext, toastReducer } from '@/context/toastStore'
import type { Toast } from '@/context/toastStore'

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'dismiss', id })
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      toastCounter += 1
      const id = `toast-${toastCounter}`
      dispatch({ type: 'add', toast: { ...toast, id } })

      if (typeof window !== 'undefined') {
        window.setTimeout(() => dispatch({ type: 'dismiss', id }), 5000)
      }

      return id
    },
    [dispatch],
  )

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}
