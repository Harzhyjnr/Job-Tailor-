import { useContext } from 'react'

import { ToastContext } from '@/context/toastStore'
import type { ToastApi } from '@/context/toastStore'

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
