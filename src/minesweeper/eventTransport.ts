export const EVENTS = {
    INIT_BOARD: 'init_board',
};

export const initBoard = ({array, width, height, minesNum}: {array: Uint8Array, width: number, height: number, minesNum: number}) => ({
    type: EVENTS.INIT_BOARD,
    payload: {array, width, height, minesNum}
}) as const;
