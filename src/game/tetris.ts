export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Cell = PieceType | null;
export type Board = Cell[][];
export type Shape = number[][];
export type Status = 'playing' | 'paused' | 'over';

export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const SHAPES: Record<PieceType, Shape> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

export interface Piece {
  type: PieceType;
  shape: Shape;
  x: number;
  y: number;
}

export interface GameState {
  board: Board;
  current: Piece;
  next: PieceType;
  bag: PieceType[];
  score: number;
  lines: number;
  level: number;
  status: Status;
}

export type Action =
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'SOFT_DROP' }
  | { type: 'HARD_DROP' }
  | { type: 'ROTATE' }
  | { type: 'TICK' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'RESTART' };

export type Rng = () => number;

/** Points awarded for clearing 0..4 lines at once (multiplied by level). */
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const LINES_PER_LEVEL = 10;

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null));
}

export function rotateClockwise(shape: Shape): Shape {
  const size = shape.length;
  return shape[0].map((_, col) => Array.from({ length: size }, (_, row) => shape[size - 1 - row][col]));
}

export function collides(board: Board, shape: Shape, x: number, y: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const bx = x + c;
      const by = y + r;
      if (bx < 0 || bx >= BOARD_WIDTH || by >= BOARD_HEIGHT) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

export function spawnPiece(type: PieceType): Piece {
  const shape = SHAPES[type];
  // Skip leading empty rows so the piece appears at the very top of the board.
  const firstFilledRow = shape.findIndex((row) => row.some(Boolean));
  return {
    type,
    shape,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: -firstFilledRow,
  };
}

function shuffledBag(rng: Rng): PieceType[] {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** Draws the next piece type from a "7-bag" randomizer. */
function draw(bag: PieceType[], rng: Rng): { type: PieceType; bag: PieceType[] } {
  const source = bag.length > 0 ? bag : shuffledBag(rng);
  return { type: source[0], bag: source.slice(1) };
}

export function createGame(rng: Rng = Math.random): GameState {
  const first = draw([], rng);
  const second = draw(first.bag, rng);
  return {
    board: createEmptyBoard(),
    current: spawnPiece(first.type),
    next: second.type,
    bag: second.bag,
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
  };
}

export function mergePiece(board: Board, piece: Piece): Board {
  const result = board.map((row) => [...row]);
  piece.shape.forEach((row, r) =>
    row.forEach((filled, c) => {
      const by = piece.y + r;
      if (filled && by >= 0 && by < BOARD_HEIGHT) result[by][piece.x + c] = piece.type;
    }),
  );
  return result;
}

export function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = BOARD_HEIGHT - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array<Cell>(BOARD_WIDTH).fill(null));
  return { board: [...empty, ...remaining], cleared };
}

/** Lowest y the current piece can reach by dropping straight down. */
export function dropY(board: Board, piece: Piece): number {
  let y = piece.y;
  while (!collides(board, piece.shape, piece.x, y + 1)) y++;
  return y;
}

/** Milliseconds between gravity ticks for a given level. */
export function tickInterval(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 85);
}

function tryMove(state: GameState, dx: number, dy: number): GameState | null {
  const { current } = state;
  if (collides(state.board, current.shape, current.x + dx, current.y + dy)) return null;
  return { ...state, current: { ...current, x: current.x + dx, y: current.y + dy } };
}

function rotate(state: GameState): GameState {
  const { current } = state;
  const shape = rotateClockwise(current.shape);
  // Simple wall kicks: try shifting horizontally, then up, to fit the rotated piece.
  const kicks: [number, number][] = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
  ];
  for (const [dx, dy] of kicks) {
    if (!collides(state.board, shape, current.x + dx, current.y + dy)) {
      return { ...state, current: { ...current, shape, x: current.x + dx, y: current.y + dy } };
    }
  }
  return state;
}

/** Locks the current piece in place, clears lines, and spawns the next piece. */
function lockPiece(state: GameState, rng: Rng): GameState {
  const merged = mergePiece(state.board, state.current);
  const { board, cleared } = clearLines(merged);
  const lines = state.lines + cleared;
  const score = state.score + LINE_SCORES[cleared] * state.level;
  const level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  const current = spawnPiece(state.next);
  const upcoming = draw(state.bag, rng);
  const lockedAboveTop = state.current.shape.some(
    (row, r) => row.some(Boolean) && state.current.y + r < 0,
  );
  const status: Status =
    lockedAboveTop || collides(board, current.shape, current.x, current.y) ? 'over' : 'playing';
  return { ...state, board, current, next: upcoming.type, bag: upcoming.bag, score, lines, level, status };
}

export function createReducer(rng: Rng = Math.random) {
  return function reducer(state: GameState, action: Action): GameState {
    if (action.type === 'RESTART') return createGame(rng);
    if (action.type === 'TOGGLE_PAUSE') {
      if (state.status === 'over') return state;
      return { ...state, status: state.status === 'paused' ? 'playing' : 'paused' };
    }
    if (state.status !== 'playing') return state;

    switch (action.type) {
      case 'MOVE_LEFT':
        return tryMove(state, -1, 0) ?? state;
      case 'MOVE_RIGHT':
        return tryMove(state, 1, 0) ?? state;
      case 'ROTATE':
        return rotate(state);
      case 'SOFT_DROP': {
        const moved = tryMove(state, 0, 1);
        return moved ? { ...moved, score: moved.score + 1 } : lockPiece(state, rng);
      }
      case 'TICK':
        return tryMove(state, 0, 1) ?? lockPiece(state, rng);
      case 'HARD_DROP': {
        const y = dropY(state.board, state.current);
        const distance = y - state.current.y;
        const dropped = { ...state, current: { ...state.current, y }, score: state.score + distance * 2 };
        return lockPiece(dropped, rng);
      }
    }
  };
}
