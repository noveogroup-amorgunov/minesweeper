import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'

export function generateMines_fisherYatesShuffle(array: Uint8Array, minesNum: number): number {
  for (let i = 0; i < array.length; i++) {
    if (i < minesNum) {
      array[i] = HIDDEN_MINE_CODE
    }
    else {
      array[i] = HIDDEN_CODE
    }
  }

  for (let i = 0; i < array.length; i++) {
    const j = (Math.random() * (i + 1)) | 0

    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  // FIXME: return empty tile index
  return 0
}
