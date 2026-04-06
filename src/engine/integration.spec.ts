import { describe, expect, it, vi } from 'vitest'
import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'
import { createSeededRandom, generateMines } from './generateMines'

// Mock crypto.getRandomValues
const mockRandomValues = vi.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return array
})

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockRandomValues,
  },
  writable: true,
  configurable: true,
})

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage = vi.fn()
  terminate = vi.fn()
}

Object.defineProperty(globalThis, 'Worker', {
  value: MockWorker,
  writable: true,
  configurable: true,
})

describe('integration: Deterministic generation', () => {
  it('should generate identical fields with the same seed', () => {
    const seed = 'multiplayer-room-123'
    const array1 = new Uint8Array(100)
    const array2 = new Uint8Array(100)

    generateMines(array1, 20, createSeededRandom(seed))
    generateMines(array2, 20, createSeededRandom(seed))

    // Arrays should be identical
    expect(array1).toEqual(array2)

    // Verify mines are in the same positions
    const mines1: number[] = []
    const mines2: number[] = []

    for (let i = 0; i < array1.length; i++) {
      if (array1[i] === HIDDEN_MINE_CODE)
        mines1.push(i)
      if (array2[i] === HIDDEN_MINE_CODE)
        mines2.push(i)
    }

    expect(mines1).toEqual(mines2)
    expect(mines1.length).toBe(20)
  })

  it('should generate different fields with different seeds', () => {
    const array1 = new Uint8Array(100)
    const array2 = new Uint8Array(100)

    generateMines(array1, 20, createSeededRandom('seed-alpha'))
    generateMines(array2, 20, createSeededRandom('seed-beta'))

    // Calculate difference percentage
    let differences = 0
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i])
        differences++
    }

    const differenceRatio = differences / array1.length

    // Fields should differ by at least 20%
    expect(differenceRatio).toBeGreaterThan(0.2)
  })

  it('should maintain determinism across multiple calls', () => {
    const seed = 'determinism-test'
    const results: Uint8Array[] = []

    // Generate 5 fields with the same seed
    for (let i = 0; i < 5; i++) {
      const array = new Uint8Array(50)
      generateMines(array, 10, createSeededRandom(seed))
      results.push(new Uint8Array(array))
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0])
    }
  })
})

describe('integration: Random vs Seeded mode', () => {
  it('should use Math.random in default mode', () => {
    const array1 = new Uint8Array(50)
    const array2 = new Uint8Array(50)

    // Generate without explicit random (should use Math.random)
    generateMines(array1, 10)
    generateMines(array2, 10)

    // Two random generations should be different (with very high probability)
    let differences = 0
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i])
        differences++
    }

    // Random fields should differ by at least 10%
    expect(differences / array1.length).toBeGreaterThan(0.1)
  })

  it('should allow mixing random and seeded in same session', () => {
    const seed = 'mixed-mode-test'

    // Generate with random
    const randomArray = new Uint8Array(50)
    generateMines(randomArray, 10)

    // Generate with seed
    const seededArray = new Uint8Array(50)
    generateMines(seededArray, 10, createSeededRandom(seed))

    // Both should have correct number of mines
    const randomMines = randomArray.filter(t => t === HIDDEN_MINE_CODE).length
    const seededMines = seededArray.filter(t => t === HIDDEN_MINE_CODE).length

    expect(randomMines).toBe(10)
    expect(seededMines).toBe(10)

    // Regenerate with same seed should produce identical result
    const seededArray2 = new Uint8Array(50)
    generateMines(seededArray2, 10, createSeededRandom(seed))

    expect(seededArray).toEqual(seededArray2)
  })
})

describe('integration: Field statistics', () => {
  it('should generate correct number of mines for various configurations', () => {
    const configs = [
      { size: 10, mines: 1 },
      { size: 50, mines: 10 },
      { size: 100, mines: 20 },
      { size: 200, mines: 50 },
    ]

    for (const { size, mines } of configs) {
      const array = new Uint8Array(size)
      generateMines(array, mines, createSeededRandom(`stats-test-${size}-${mines}`))

      const mineCount = array.filter(t => t === HIDDEN_MINE_CODE).length
      expect(mineCount).toBe(mines)
    }
  })

  it('should maintain correct ratio of mines to empty tiles', () => {
    const size = 1000
    const mineRatio = 0.2 // 20% mines
    const mines = Math.floor(size * mineRatio)

    const array = new Uint8Array(size)
    generateMines(array, mines, createSeededRandom('ratio-test'))

    const mineCount = array.filter(t => t === HIDDEN_MINE_CODE).length
    const emptyCount = array.filter(t => t === HIDDEN_CODE).length

    expect(mineCount).toBe(mines)
    expect(emptyCount).toBe(size - mines)
    expect(mineCount / size).toBeCloseTo(mineRatio, 1)
  })
})

describe('integration: Seed variety', () => {
  it('should handle various seed formats correctly', () => {
    const seeds = [
      'simple',
      'with-dashes-and-123',
      'UPPERCASE',
      'MixedCaseWithNumbers123',
      'a',
      'very-long-seed-with-many-characters-in-it',
    ]

    for (const seed of seeds) {
      const array = new Uint8Array(50)

      // Should not throw
      expect(() => {
        generateMines(array, 10, createSeededRandom(seed))
      }).not.toThrow()

      // Should generate correct number of mines
      const mineCount = array.filter(t => t === HIDDEN_MINE_CODE).length
      expect(mineCount).toBe(10)
    }
  })

  it('should produce different distributions for different seeds', () => {
    const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    const distributions = new Map<string, Uint8Array>()

    for (const seed of seeds) {
      const array = new Uint8Array(100)
      generateMines(array, 20, createSeededRandom(seed))
      distributions.set(seed, new Uint8Array(array))
    }

    // Compare each pair of seeds
    const seedArray = Array.from(distributions.keys())
    for (let i = 0; i < seedArray.length; i++) {
      for (let j = i + 1; j < seedArray.length; j++) {
        const arr1 = distributions.get(seedArray[i])!
        const arr2 = distributions.get(seedArray[j])!

        // Fields should be different
        let differences = 0
        for (let k = 0; k < arr1.length; k++) {
          if (arr1[k] !== arr2[k])
            differences++
        }

        expect(differences).toBeGreaterThan(0)
      }
    }
  })
})
