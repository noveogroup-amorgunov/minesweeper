import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'

export function generateMines_arraySort(array: Uint8Array, minesNum: number): number {
  for (let i = 0; i < array.length; i++) {
    if (i < minesNum) {
      array[i] = HIDDEN_MINE_CODE
    }
    else {
      array[i] = HIDDEN_CODE
    }
  }

  array.sort(() => Math.random() - 0.5)

  // FIXME: return empty tile index
  return 0
}
