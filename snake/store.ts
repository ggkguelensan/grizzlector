import { createSamplable, sample, combine } from '../src/index'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Point     = { x: number; y: number }
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Status    = 'idle' | 'running' | 'paused' | 'over'

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLS    = 20
export const ROWS    = 20
export const CELL_PX = 26
export const TICK_MS = 120

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
}

const DELTA: Record<Direction, Point> = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
}

const INITIAL_SNAKE: Point[] = [
  { x: 11, y: 10 },
  { x: 10, y: 10 },
  { x:  9, y: 10 },
]

function randomFood(snake: Point[]): Point {
  const taken = new Set(snake.map(p => `${p.x},${p.y}`))
  let pt: Point
  do {
    pt = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    }
  } while (taken.has(`${pt.x},${pt.y}`))
  return pt
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSnake = createSamplable((set, get) => ({
  snake:      INITIAL_SNAKE as Point[],
  food:       { x: 15, y: 10 } as Point,
  direction:  'right' as Direction,
  pendingDir: 'right' as Direction,
  status:     'idle' as Status,
  score:      0,
  best:       0,

  // ── Clocks (triggers, carry no internal logic) ───────────────────────────
  tick:   () => {},
  setDir: (_dir: Direction) => {},

  // ── Internal actions ─────────────────────────────────────────────────────
  _applyDir: (dir: Direction) => set({ pendingDir: dir }),

  _move: () => {
    const s = get()
    const dir  = s.pendingDir
    const dx   = DELTA[dir]
    const head = { x: s.snake[0].x + dx.x, y: s.snake[0].y + dx.y }

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      set(st => ({ status: 'over', best: Math.max(st.best, st.score) }))
      return
    }

    // Self collision (exclude tail tip — it will vacate this frame)
    const hitSelf = s.snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y)
    if (hitSelf) {
      set(st => ({ status: 'over', best: Math.max(st.best, st.score) }))
      return
    }

    const ate = head.x === s.food.x && head.y === s.food.y
    set({
      direction: dir,
      snake: ate ? [head, ...s.snake]             : [head, ...s.snake.slice(0, -1)],
      food:  ate ? randomFood([head, ...s.snake]) : s.food,
      score: ate ? s.score + 10                   : s.score,
    })
  },

  // ── Public actions ────────────────────────────────────────────────────────
  start: () => set(s => ({
    status:     'running',
    snake:      INITIAL_SNAKE,
    food:       randomFood(INITIAL_SNAKE),
    direction:  'right',
    pendingDir: 'right',
    score:      0,
    best:       s.best,
  })),

  pause: () => set(s => ({
    status: s.status === 'paused' ? 'running' : 'paused',
  })),
}))

// ─── Wiring ───────────────────────────────────────────────────────────────────

// Block 180° reversals: only accept direction changes that aren't the opposite
sample({
  clock:  useSnake.clock('setDir'),
  source: useSnake.source('direction'),
  filter: (current, next) => OPPOSITE[next as Direction] !== (current as Direction),
  fn:     (_, next) => next as Direction,
  target: useSnake.target('_applyDir'),
})

// Advance game only while running
sample({
  clock:  useSnake.clock('tick'),
  source: useSnake.source('status'),
  filter: (status) => status === 'running',
  target: useSnake.target('_move'),
})

// ─── Combined display store ───────────────────────────────────────────────────

export const useDisplay = combine({
  snake:  useSnake.source('snake'),
  food:   useSnake.source('food'),
  status: useSnake.source('status'),
  score:  useSnake.source('score'),
  best:   useSnake.source('best'),
})
