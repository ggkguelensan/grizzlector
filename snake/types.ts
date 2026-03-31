// ─── Domain types ─────────────────────────────────────────────────────────────

export type Point     = { x: number; y: number }
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Status    = 'idle' | 'running' | 'paused' | 'over'

export type StepResult =
  | { type: 'move'; snake: Point[]; direction: Direction }
  | { type: 'ate';  snake: Point[]; direction: Direction; food: Point }
  | { type: 'over' }

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLS    = 20
export const ROWS    = 20
export const CELL_PX = 26
export const TICK_MS = 120

export const INITIAL_SNAKE: Point[] = [
  { x: 11, y: 10 },
  { x: 10, y: 10 },
  { x:  9, y: 10 },
]

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
}

const DELTA: Record<Direction, Point> = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function randomFood(snake: Point[]): Point {
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

/**
 * Computes one game tick on a toroidal field — edges wrap, no wall death.
 * Only self-collision causes game over.
 */
export function computeStep(
  snake: Point[],
  dir: Direction,
  food: Point,
): StepResult {
  const d = DELTA[dir]
  const head: Point = {
    x: ((snake[0].x + d.x) + COLS) % COLS,
    y: ((snake[0].y + d.y) + ROWS) % ROWS,
  }

  // Self-collision: exclude the tail tip because it vacates this frame
  if (snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y)) {
    return { type: 'over' }
  }

  const ate      = head.x === food.x && head.y === food.y
  const newSnake = ate ? [head, ...snake] : [head, ...snake.slice(0, -1)]

  if (ate) return { type: 'ate', snake: newSnake, direction: dir, food: randomFood(newSnake) }
  return            { type: 'move', snake: newSnake, direction: dir }
}
