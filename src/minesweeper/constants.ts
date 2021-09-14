export const TILE_SIZE = 30; // px

export const FLAG_ENUM = 10;
export const FLAG_MINE_ENUM = 9;
export const HIDDEN_ENUM = 12;
export const HIDDEN_MINE_ENUM = 11;
export const EXPLODED_ENUM = 13;

export const FLAG_ENUMS = new Set([FLAG_ENUM, FLAG_MINE_ENUM]);
export const HIDDEN_ENUMS = new Set([HIDDEN_ENUM, HIDDEN_MINE_ENUM]);
export const MINE_ENUMS = new Set([HIDDEN_MINE_ENUM, FLAG_MINE_ENUM]);
export const HINT_ENUMS = new Set(Array.from(Array(9).keys()));
