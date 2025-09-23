import type { GameEngine } from '../engine/GameEngine'
import { useCallback, useSyncExternalStore } from 'react'
import { useGameEngine } from './gameContext'

function createSubscribe(gameEngine: GameEngine) {
  return (callback: () => void) => {
    const unsubscribe = gameEngine.subscribe(callback)

    return () => {
      unsubscribe()
    }
  }
}

type GameState = ReturnType<typeof GameEngine.prototype.getGameState>

type Selector<T> = (state: GameState) => T

function createGetSnapshot<T>(selector: Selector<T>, gameEngine: GameEngine): () => T {
  let prevSnapshot: T | null = null

  return () => {
    const currentSnapshot = selector(gameEngine.getGameState())

    if (JSON.stringify(currentSnapshot) !== JSON.stringify(prevSnapshot)) {
      prevSnapshot = currentSnapshot
    }

    return prevSnapshot as T
  }
}

export function useGameState<T>(selector: Selector<T>): T {
  const gameEngine = useGameEngine()

  const subscribe = useCallback(createSubscribe(gameEngine), [gameEngine])
  const getSnapshot = useCallback(createGetSnapshot(selector, gameEngine), [selector, gameEngine])
  const gameState = useSyncExternalStore(subscribe, getSnapshot)

  return gameState
}
