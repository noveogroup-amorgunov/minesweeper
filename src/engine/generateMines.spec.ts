import { describe, expect, it } from 'vitest'
import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'
import {
  createSeededRandom,
  generateMines,
  generateMinesRandom,
} from './generateMines'

describe('createSeededRandom', () => {
  it('should produce deterministic values for the same seed', () => {
    const random1 = createSeededRandom('test-seed-123')
    const random2 = createSeededRandom('test-seed-123')

    const values1 = Array.from({ length: 100 }, () => random1())
    const values2 = Array.from({ length: 100 }, () => random2())

    expect(values1).toEqual(values2)
  })

  it('should produce different values for different seeds', () => {
    const random1 = createSeededRandom('seed-A')
    const random2 = createSeededRandom('seed-B')

    const values1 = Array.from({ length: 10 }, () => random1())
    const values2 = Array.from({ length: 10 }, () => random2())

    // Values should be different (with very high probability)
    expect(values1).not.toEqual(values2)
  })

  it('should produce values in range [0, 1)', () => {
    const random = createSeededRandom('range-test')

    for (let i = 0; i < 1000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('should have uniform distribution (bucket test)', () => {
    const random = createSeededRandom('distribution-test')
    const buckets: number[] = Array.from({ length: 10 }).fill(0) as number[]
    const totalSamples = 10000

    for (let i = 0; i < totalSamples; i++) {
      const value = random()
      const bucketIndex = Math.floor(value * 10)
      buckets[Math.min(bucketIndex, 9)]++
    }

    // Expected samples per bucket: 1000
    // Allow ±20% deviation (800-1200)
    const expectedPerBucket = totalSamples / 10
    const tolerance = expectedPerBucket * 0.2

    for (const count of buckets) {
      expect(count).toBeGreaterThanOrEqual(expectedPerBucket - tolerance)
      expect(count).toBeLessThanOrEqual(expectedPerBucket + tolerance)
    }
  })

  it('should have average value close to 0.5', () => {
    const random = createSeededRandom('average-test')
    const totalSamples = 100000
    let sum = 0

    for (let i = 0; i < totalSamples; i++) {
      sum += random()
    }

    const average = sum / totalSamples
    // Average should be within 1% of 0.5
    expect(average).toBeGreaterThan(0.49)
    expect(average).toBeLessThan(0.51)
  })

  it('should handle various seed formats', () => {
    const seeds = [
      'simple',
      'with-dashes',
      'with_underscores',
      '123numeric',
      'UPPERCASE',
      'MixedCase123',
      'very-long-seed-string-with-many-characters',
      '🎮unicode',
    ]

    for (const seed of seeds) {
      const random = createSeededRandom(seed)
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('generateMines', () => {
  it('should use Math.random by default', () => {
    const array = new Uint8Array(100)
    const emptyTileIndex = generateMines(array, 10)

    expect(emptyTileIndex).toBeGreaterThanOrEqual(0)
    expect(emptyTileIndex).toBeLessThan(100)

    const mineCount = array.filter(tile => tile === HIDDEN_MINE_CODE).length
    expect(mineCount).toBe(10)
  })

  it('should accept custom random generator', () => {
    const array = new Uint8Array(100)
    const customRandom = createSeededRandom('custom-random-test')

    const emptyTileIndex = generateMines(array, 10, customRandom)

    expect(emptyTileIndex).toBeGreaterThanOrEqual(0)
    expect(emptyTileIndex).toBeLessThan(100)

    const mineCount = array.filter(tile => tile === HIDDEN_MINE_CODE).length
    expect(mineCount).toBe(10)
  })

  it('should return correct emptyTileIndex', () => {
    const array = new Uint8Array(10)
    const emptyTileIndex = generateMines(
      array,
      5,
      createSeededRandom('empty-tile-test'),
    )

    // The returned index should point to an empty tile
    expect(array[emptyTileIndex]).toBe(HIDDEN_CODE)
  })

  it('should generate identical fields with identical seeded random', () => {
    const array1 = new Uint8Array(100)
    const array2 = new Uint8Array(100)
    const seed = 'identical-seed-test'

    generateMines(array1, 20, createSeededRandom(seed))
    generateMines(array2, 20, createSeededRandom(seed))

    expect(array1).toEqual(array2)
  })

  it('should generate different fields with different seeds', () => {
    const array1 = new Uint8Array(100)
    const array2 = new Uint8Array(100)

    generateMines(array1, 20, createSeededRandom('seed-one'))
    generateMines(array2, 20, createSeededRandom('seed-two'))

    // Fields should be different (with high probability)
    let differences = 0
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) {
        differences++
      }
    }

    // Expect at least 20% difference
    expect(differences / array1.length).toBeGreaterThan(0.2)
  })

  it('should modify array in-place', () => {
    const array = new Uint8Array(50)
    const originalArray = new Uint8Array(array)

    generateMines(array, 10, createSeededRandom('inplace-test'))

    // Array should be modified
    expect(array).not.toEqual(originalArray)
  })

  it('should handle edge case: 0 mines', () => {
    const array = new Uint8Array(10)
    const emptyTileIndex = generateMines(
      array,
      0,
      createSeededRandom('zero-mines'),
    )

    const mineCount = array.filter(tile => tile === HIDDEN_MINE_CODE).length
    expect(mineCount).toBe(0)
    expect(array.every(tile => tile === HIDDEN_CODE)).toBe(true)
    // When no mines, first index is returned as emptyTileIndex
    expect(emptyTileIndex).toBe(0)
  })

  it('should handle edge case: all mines except one', () => {
    const array = new Uint8Array(10)
    const emptyTileIndex = generateMines(
      array,
      9,
      createSeededRandom('almost-all-mines'),
    )

    const mineCount = array.filter(tile => tile === HIDDEN_MINE_CODE).length
    expect(mineCount).toBe(9)
    expect(emptyTileIndex).toBeGreaterThanOrEqual(0)
    expect(emptyTileIndex).toBeLessThan(10)
    expect(array[emptyTileIndex]).toBe(HIDDEN_CODE)
  })
})

describe('generateMinesRandom', () => {
  it('should work without third parameter', () => {
    const array = new Uint8Array(100)
    const emptyTileIndex = generateMinesRandom(array, 15)

    expect(emptyTileIndex).toBeGreaterThanOrEqual(0)
    expect(emptyTileIndex).toBeLessThan(100)

    const mineCount = array.filter(tile => tile === HIDDEN_MINE_CODE).length
    expect(mineCount).toBe(15)
  })

  it('should return correct emptyTileIndex', () => {
    const array = new Uint8Array(20)
    const emptyTileIndex = generateMinesRandom(array, 10)

    expect(array[emptyTileIndex]).toBe(HIDDEN_CODE)
  })
})
