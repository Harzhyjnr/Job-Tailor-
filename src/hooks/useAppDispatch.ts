import { useContext } from 'react'

import { AppStateContext } from '@/context/appStateContext'

export function useAppDispatch() {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppDispatch must be used within an AppStateProvider')
  return context.dispatch
}
