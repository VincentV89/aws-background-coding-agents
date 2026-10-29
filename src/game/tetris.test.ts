import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  type GameState,
  clearLines,
  collides,
  createEmptyBoard,
  createGame,
  createReducer,
  rotateClockwise,
  spawnPiece,
} from './tetris';

const seeded = () => {
  let s = 42;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

describe('tetris logic', () => {
  it('creates a playing game with an empty board', () => {
    const g = createGame(seeded());
    expect(g.status).toBe('playing');
    expect(g.board).toHaveLength(BOARD_HEIGHT);
    expect(g.board.every((r) => r.length === BOARD_WIDTH && r.every((c) => c === null))).toBe(true);
    expect(g.score).toBe(0);
    expect(g.level).toBe(1);
  });

  it('rotates a shape clockwise', () => {
    expect(rotateClockwise([[1, 0], [1, 1]])).toEqual([[1, 1], [1, 0]]);
  });

  it('detects wall collisions', () => {
    const board = createEmptyBoard();
    expect(collides(board, [[1]], -1, 0)).toBe(true);
    expect(collides(board, [[1]], BOARD_WIDTH, 0)).toBe(true);
    expect(collides(board, [[1]], 0, BOARD_HEIGHT)).toBe(true);
    expect(collides(board, [[1]], 0, 0)).toBe(false);
  });

  it('clears full lines', () => {
    const board = createEmptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill('I');
    const { board: next, cleared } = clearLines(board);
    expect(cleared).toBe(1);
    expect(next[BOARD_HEIGHT - 1].every((c) => c === null)).toBe(true);
  });

  it('moves left and right but not through walls', () => {
    const reducer = createReducer(seeded());
    let g = createGame(seeded());
    const x = g.current.x;
    g = reducer(g, { type: 'MOVE_LEFT' });
    expect(g.current.x).toBe(x - 1);
    for (let i = 0; i < 20; i++) g = reducer(g, { type: 'MOVE_LEFT' });
    expect(collides(g.board, g.current.shape, g.current.x, g.current.y)).toBe(false);
    expect(collides(g.board, g.current.shape, g.current.x - 1, g.current.y)).toBe(true);
  });

  it('hard drop locks the piece at the bottom and spawns the next piece', () => {
    const reducer = createReducer(seeded());
    const g = createGame(seeded());
    const after = reducer(g, { type: 'HARD_DROP' });
    expect(after.current.type).toBe(g.next);
    expect(after.board[BOARD_HEIGHT - 1].some((c) => c !== null)).toBe(true);
    expect(after.score).toBeGreaterThan(0);
  });

  it('scores a line clear and levels up after 10 lines', () => {
    const reducer = createReducer(seeded());
    const board = createEmptyBoard();
    board[BOARD_HEIGHT - 1] = [...Array(BOARD_WIDTH - 4).fill('O'), null, null, null, null];
    const state: GameState = {
      ...createGame(seeded()),
      board,
      current: { ...spawnPiece('I'), x: BOARD_WIDTH - 4 },
      lines: 9,
    };
    const after = reducer(state, { type: 'HARD_DROP' });
    expect(after.lines).toBe(10);
    expect(after.level).toBe(2);
    expect(after.board[BOARD_HEIGHT - 1].every((c) => c === null)).toBe(true);
    expect(after.score).toBeGreaterThanOrEqual(100);
  });

  it('pauses and ignores input while paused', () => {
    const reducer = createReducer(seeded());
    let g = reducer(createGame(seeded()), { type: 'TOGGLE_PAUSE' });
    expect(g.status).toBe('paused');
    const x = g.current.x;
    g = reducer(g, { type: 'MOVE_LEFT' });
    g = reducer(g, { type: 'TICK' });
    expect(g.current.x).toBe(x);
    expect(reducer(g, { type: 'TOGGLE_PAUSE' }).status).toBe('playing');
  });

  it('ends the game when pieces stack to the top, and restart resets', () => {
    const reducer = createReducer(seeded());
    let g = createGame(seeded());
    for (let i = 0; i < 100 && g.status === 'playing'; i++) g = reducer(g, { type: 'HARD_DROP' });
    expect(g.status).toBe('over');
    expect(reducer(g, { type: 'MOVE_LEFT' })).toBe(g);
    const restarted = reducer(g, { type: 'RESTART' });
    expect(restarted.status).toBe('playing');
    expect(restarted.score).toBe(0);
  });
});
