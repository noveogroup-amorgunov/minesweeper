import { HIDDEN_CODE, HIDDEN_MINE_CODE } from './consts'

export function generateMines(array: Uint8Array, minesNum: number): number {
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

    const isMine = Math.random() < probability

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
