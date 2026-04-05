import type { GameEngine } from '../engine/GameEngine'
import { useCallback, useEffect, useRef } from 'react'

interface UseAutoSaveOptions {
  onSave?: () => void
}

/**
 * Hook to handle auto-save on tab close/visibility change
 */
export function useAutoSave(gameEngine: GameEngine, options: UseAutoSaveOptions = {}) {
  const { onSave } = options
  const gameEngineRef = useRef(gameEngine)

  // Keep ref up to date
  useEffect(() => {
    gameEngineRef.current = gameEngine
  }, [gameEngine])

  const triggerAutoSave = useCallback(async () => {
    const state = gameEngineRef.current.getGameState()
    if (state.gameStatus === 'PLAYING') {
      try {
        await gameEngineRef.current.save()
        onSave?.()
      }
      catch {
        // Silent fail - don't block tab close
      }
    }
  }, [onSave])

  useEffect(() => {
    // Handle beforeunload event
    const handleBeforeUnload = () => {
      const state = gameEngineRef.current.getGameState()
      if (state.gameStatus === 'PLAYING') {
        // We can't use async here, so we trigger it but may lose data
        // The visibilitychange event is more reliable
        gameEngineRef.current.save().catch(() => {
          // Silent fail
        })
      }
    }

    // Handle visibility change (more reliable than beforeunload)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const state = gameEngineRef.current.getGameState()
        if (state.gameStatus === 'PLAYING') {
          gameEngineRef.current.save().catch(() => {
            // Silent fail
          })
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return { triggerAutoSave }
}
