export type GameState = 'PLAYING' | 'WIN' | 'DEAD';

export type TileValue =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13;

export type Tiles = Array<{value: TileValue; index: number}>;
