import type { GameEngine } from '../engine/GameEngine'
import { createContext, useContext } from 'react'

const GameEngineContext = createContext<GameEngine | null>(null)

export function GameEngineProvider({ children, gameEngine }: { children: React.ReactNode, gameEngine: GameEngine }) {
  return <GameEngineContext.Provider value={gameEngine}>{children}</GameEngineContext.Provider>
}

export function useGameEngine(): GameEngine {
  const context = useContext(GameEngineContext)

  if (!context) {
    throw new Error('useGameEngine must be used within a GameEngineProvider')
  }

  return context
}
