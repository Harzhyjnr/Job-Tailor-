import { createContext } from 'react'
import type { Dispatch } from 'react'

import type { AppStoreState } from '@/state/appState'
import type { AppAction } from '@/state/appState'

export interface AppStateApi {
  state: AppStoreState
  dispatch: Dispatch<AppAction>
}

export const AppStateContext = createContext<AppStateApi | null>(null)
