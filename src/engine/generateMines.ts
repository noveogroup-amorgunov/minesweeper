import type { RandomGenerator } from './types'
import { createSeededRandom } from '../utils/hashFunctions'
import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'

export { createSeededRandom }

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
