import type { RandomGenerator } from './types'
import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'

/**
 * cyrb128 hash function - generates 128-bit hash from string
 * Returns 4 32-bit numbers for use as PRNG seed
 */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let i = 0, k: number
    ; i < str.length
    ; i++) {
    k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}

/**
 * sfc32 PRNG - Small Fast Counter 32-bit
 * High quality PRNG with 128-bit internal state
 */
function sfc32(a: number, b: number, c: number, d: number): RandomGenerator {
  return function () {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

/**
 * Creates a deterministic random number generator from a seed string
 * Uses cyrb128 for hashing and sfc32 for PRNG
 * @param seed - Seed string (roomId or any string)
 * @returns Random number generator function that produces values in [0, 1)
 */
export function createSeededRandom(seed: string): RandomGenerator {
  const [a, b, c, d] = cyrb128(seed)
  return sfc32(a, b, c, d)
}

/**
 * Generate mines in the array using the provided random generator
 * Modifies the array in-place and returns the index of the last empty tile
 * @param array - Uint8Array to fill with mines
 * @param minesNum - Number of mines to generate
 * @param random - Random number generator (defaults to Math.random)
 * @returns Index of the last empty tile (for first move swap)
 */
export function generateMines(
  array: Uint8Array,
  minesNum: number,
  random: RandomGenerator = Math.random,
): number {
  let probability = minesNum / array.length
  let generatedMines = 0
  let emptyTileIndex = 0

  for (let i = 0; i < array.length; i++) {
    probability = (minesNum - generatedMines) / (array.length - i)

    if (generatedMines >= minesNum) {
      emptyTileIndex = i
      for (let j = i; j < array.length; j++) {
        array[j] = HIDDEN_CODE
      }
      break
    }

    const isMine = random() < probability

    if (isMine) {
      generatedMines += 1
      array[i] = HIDDEN_MINE_CODE
    }
    else {
      array[i] = HIDDEN_CODE
      emptyTileIndex = i
    }
  }

  if (minesNum > generatedMines) {
    for (let i = 0; i < array.length; i++) {
      if (array[i] === HIDDEN_MINE_CODE || i === emptyTileIndex) {
        continue
      }

      generatedMines += 1
      array[i] = HIDDEN_MINE_CODE

      if (minesNum === generatedMines) {
        break
      }
    }
  }

  return emptyTileIndex
}

/**
 * Wrapper for generating mines with Math.random
 * Convenience function for backward compatibility
 * @param array - Uint8Array to fill with mines
 * @param minesNum - Number of mines to generate
 * @returns Index of the last empty tile (for first move swap)
 */
export function generateMinesRandom(array: Uint8Array, minesNum: number): number {
  return generateMines(array, minesNum, Math.random)
}
