import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  type Action,
  type Board as BoardType,
  type PieceType,
  BOARD_WIDTH,
  SHAPES,
  createGame,
  createReducer,
  dropY,
  mergePiece,
  tickInterval,
} from './game/tetris';

const reducer = createReducer();

const KEY_ACTIONS: Record<string, Action['type']> = {
  ArrowLeft: 'MOVE_LEFT',
  ArrowRight: 'MOVE_RIGHT',
  ArrowDown: 'SOFT_DROP',
  ArrowUp: 'ROTATE',
  ' ': 'HARD_DROP',
  p: 'TOGGLE_PAUSE',
  P: 'TOGGLE_PAUSE',
  Escape: 'TOGGLE_PAUSE',
  r: 'RESTART',
  R: 'RESTART',
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createGame());
  const { board, current, next, score, level, lines, status } = state;

  const send = useCallback((type: Action['type']) => dispatch({ type } as Action), []);

  // Keyboard controls.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = KEY_ACTIONS[event.key];
      if (!action) return;
      event.preventDefault();
      // Holding space would otherwise hard-drop several pieces in a row.
      if (action === 'HARD_DROP' && event.repeat) return;
      send(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [send]);

  // Gravity.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = window.setInterval(() => send('TICK'), tickInterval(level));
    return () => window.clearInterval(id);
  }, [status, level, send]);

  // Auto-pause when the tab loses focus.
  useEffect(() => {
    const onBlur = () => {
      if (status === 'playing') send('TOGGLE_PAUSE');
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [status, send]);

  const display = useMemo(() => {
    const ghost = { ...current, y: dropY(board, current) };
    const withGhost: (PieceType | 'ghost' | null)[][] = board.map((row) => [...row]);
    ghost.shape.forEach((row, r) =>
      row.forEach((filled, c) => {
        const y = ghost.y + r;
        if (filled && y >= 0 && !withGhost[y][ghost.x + c]) withGhost[y][ghost.x + c] = 'ghost';
      }),
    );
    const merged: BoardType = mergePiece(board, current);
    return withGhost.map((row, y) => row.map((cell, x) => merged[y][x] ?? cell));
  }, [board, current]);

  return (
    <main className="app">
      <h1 className="title">Tetris</h1>
      <div className="game">
        <div className="board-wrap">
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)` }}
            role="grid"
            aria-label="Tetris board"
          >
            {display.flatMap((row, y) =>
              row.map((cell, x) => <div key={`${y}-${x}`} className={`cell ${cell ? `cell-${cell}` : ''}`} />),
            )}
          </div>
          {status !== 'playing' && (
            <div className="overlay" role="dialog" aria-live="assertive">
              <h2>{status === 'over' ? 'Game Over' : 'Paused'}</h2>
              {status === 'over' && <p>Final score: {score}</p>}
              <button onClick={() => send(status === 'over' ? 'RESTART' : 'TOGGLE_PAUSE')}>
                {status === 'over' ? 'Play again' : 'Resume'}
              </button>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="panel">
            <h3>Next</h3>
            <NextPiece type={next} />
          </div>
          <div className="panel stats">
            <Stat label="Score" value={score} />
            <Stat label="Level" value={level} />
            <Stat label="Lines" value={lines} />
          </div>
          <div className="panel buttons">
            <button onClick={() => send('TOGGLE_PAUSE')} disabled={status === 'over'}>
              {status === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button onClick={() => send('RESTART')}>Restart</button>
          </div>
          <div className="panel help">
            <h3>Controls</h3>
            <ul>
              <li><kbd>←</kbd> <kbd>→</kbd> Move</li>
              <li><kbd>↑</kbd> Rotate</li>
              <li><kbd>↓</kbd> Soft drop</li>
              <li><kbd>Space</kbd> Hard drop</li>
              <li><kbd>P</kbd> Pause · <kbd>R</kbd> Restart</li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="touch-controls" aria-label="Touch controls">
        <button aria-label="Move left" onClick={() => send('MOVE_LEFT')}>←</button>
        <button aria-label="Rotate" onClick={() => send('ROTATE')}>⟳</button>
        <button aria-label="Move right" onClick={() => send('MOVE_RIGHT')}>→</button>
        <button aria-label="Soft drop" onClick={() => send('SOFT_DROP')}>↓</button>
        <button aria-label="Hard drop" onClick={() => send('HARD_DROP')}>⤓</button>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function NextPiece({ type }: { type: PieceType }) {
  const rows = SHAPES[type].filter((row) => row.some(Boolean));
  return (
    <div className="next" style={{ gridTemplateColumns: `repeat(${rows[0].length}, 1fr)` }} aria-label={`Next piece: ${type}`}>
      {rows.flatMap((row, y) =>
        row.map((filled, x) => <div key={`${y}-${x}`} className={`cell ${filled ? `cell-${type}` : 'cell-empty'}`} />),
      )}
    </div>
  );
}
