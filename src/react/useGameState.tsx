// import { create } from 'zustand'

import type { GameEngine } from '../engine/GameEngine'
import { useCallback, useSyncExternalStore } from 'react'
import { GAME_ENGINE_EVENTS } from '../engine/GameEngine'
import { useGameEngine } from './context'

// const useBearStore = create(set => ({
//   bears: 0,
//   increasePopulation: () => set(state => ({ bears: state.bears + 1 })),
//   removeAllBears: () => set({ bears: 0 }),
// }))

// function BearCounter() {
//   const bears = useBearStore(state => state.bears)
//   return <h1>{bears}</h1>
// }

// function subscribe(callback: () => void) {
//   console.log('subscribe:::', callback)
//   // gameEngine.onUpdate = callback
//   gameEngine.eventEmitter.on(GAME_ENGINE_EVENTS.UPDATE, callback)

//   return () => {
//     console.log('unsubscribe:::')
//     // gameEngine.onUpdate = () => {}
//     gameEngine.eventEmitter.off(GAME_ENGINE_EVENTS.UPDATE, callback)
//   }
// }

function createSubscribe(gameEngine: GameEngine) {
  return (callback: () => void) => {
    gameEngine.on(GAME_ENGINE_EVENTS.UPDATE, callback)

    return () => {
      gameEngine.off(GAME_ENGINE_EVENTS.UPDATE, callback)
    }
  }
}

// let prevSnapshot: ReturnType<typeof gameEngine.getGameState> | null = null

// function getSnapshot(): ReturnType<typeof gameEngine.getGameState> {
//   if (JSON.stringify(gameEngine.getGameState()) !== JSON.stringify(prevSnapshot)) {
//     prevSnapshot = gameEngine.getGameState()
//   }

//   return prevSnapshot as ReturnType<typeof gameEngine.getGameState>
// }

type GameState = ReturnType<typeof GameEngine.prototype.getGameState>

type Selector<T> = (state: GameState) => T

function createGetSnapshot<T>(selector: Selector<T>, gameEngine: GameEngine): () => T {
  let prevSnapshot: T | null = null // ReturnType<typeof gameEngine.getGameState> | null = null

  return () => {
    const currentSnapshot = selector(gameEngine.getGameState())

    if (JSON.stringify(currentSnapshot) !== JSON.stringify(prevSnapshot)) {
      prevSnapshot = currentSnapshot
    }

    // return prevSnapshot as ReturnType<typeof gameEngine.getGameState>
    return prevSnapshot as any // ReturnType<typeof gameEngine.getGameState>
  }
}

export function useGameState<T>(selector: Selector<T>): T {
  const gameEngine = useGameEngine()

  const subscribe = useCallback(createSubscribe(gameEngine), [gameEngine])
  const getSnapshot = useCallback(createGetSnapshot(selector, gameEngine), [selector, gameEngine])
  const gameState = useSyncExternalStore(subscribe, getSnapshot)

  return gameState
}
