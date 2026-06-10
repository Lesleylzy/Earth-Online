'use client'
import { createContext, useContext } from 'react'

export interface PublicTask {
  id: string
  content_en: string
  content_cn: string
  category: string
}

export interface CustomTask {
  id: string
  content: string
}

export interface GameState {
  lang: string
  setLang: (l: string) => void
  screen: string
  setScreen: (s: string) => void
  customMode: boolean
  setCustomMode: (v: boolean) => void

  // Auth
  user: { id: string; email: string; username: string } | null
  setUser: (u: { id: string; email: string; username: string } | null) => void

  // Public tasks from DB
  publicTasks: PublicTask[]
  setPublicTasks: (t: PublicTask[]) => void

  // Custom tasks
  customTasks: CustomTask[]
  setCustomTasks: (t: CustomTask[]) => void

  // Completions (store task IDs)
  completedPublic: string[]
  setCompletedPublic: (c: string[]) => void
  completedCustom: string[]
  setCompletedCustom: (c: string[]) => void

  // Skips (store task IDs)
  skippedPublic: string[]
  setSkippedPublic: (s: string[]) => void
  skippedCustom: string[]
  setSkippedCustom: (s: string[]) => void

  // Current task ID
  currentTaskId: string | null
  setCurrentTaskId: (id: string | null) => void

  hasPlayed: boolean
  setHasPlayed: (v: boolean) => void
}

export const GameContext = createContext<GameState | null>(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
