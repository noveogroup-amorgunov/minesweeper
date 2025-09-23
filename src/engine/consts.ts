export const FLAG_CODE = 10
export const FLAG_MINE_CODE = 9
export const HIDDEN_CODE = 12
export const HIDDEN_MINE_CODE = 11
export const EXPLODED_CODE = 13

export const FLAG_ENUMS = new Set([FLAG_CODE, FLAG_MINE_CODE])
export const HIDDEN_ENUMS = new Set([HIDDEN_CODE, HIDDEN_MINE_CODE])
export const MINE_ENUMS = new Set([HIDDEN_MINE_CODE, FLAG_MINE_CODE])
export const HINT_ENUMS = new Set(Array.from({ length: 9 }).keys())

// TODO: move to view layer
export const INITIAL_BOARD_WIDTH = 10
export const INITIAL_BOARD_HEIGHT = 10
export const INITIAL_MINES = 25
