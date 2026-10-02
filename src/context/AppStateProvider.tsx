import { useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'

import { AppStateContext } from '@/context/appStateContext'
import { appReducer, initialAppState } from '@/state/appState'

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState)

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
