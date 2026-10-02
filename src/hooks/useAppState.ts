import { useContext } from 'react'

import { AppStateContext } from '@/context/appStateContext'
import type { AppStateApi } from '@/context/appStateContext'

export function useAppState(): AppStateApi {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used within an AppStateProvider')
  return context
}
