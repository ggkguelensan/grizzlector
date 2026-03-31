import { createSamplable } from '../src/index'
import { INITIAL_SNAKE, type Direction, type Point, type Status, type StepResult } from './types'

// ─── Public input events ───────────────────────────────────────────────────────
// Pure clocks: they carry no internal logic, just signal that something happened.

export const useInput = createSamplable(() => ({
  tick:   () => {},
  setDir: (_dir: Direction) => {},
  start:  () => {},
  pause:  () => {},
}))

// ─── Atomic state stores ───────────────────────────────────────────────────────

/** Snake body — ordered list of segments, head first */
export const useBody = createSamplable((set) => ({
  snake: INITIAL_SNAKE as Point[],
  setSnake: (s: Point[]) => set({ snake: s }),
}))

/** Food position */
export const useFood = createSamplable((set) => ({
  food: { x: 15, y: 10 } as Point,
  setFood: (f: Point) => set({ food: f }),
}))

/** Current and buffered direction */
export const useDir = createSamplable((set) => ({
  direction: 'right' as Direction,  // last committed direction (used for 180° guard)
  pending:   'right' as Direction,  // queued direction for the next tick
  setPending: (d: Direction) => set({ pending: d }),
  commit:    (d: Direction) => set({ direction: d }),
  reset:     ()             => set({ direction: 'right', pending: 'right' }),
}))

/** Game lifecycle and score */
export const useStatus = createSamplable((set) => ({
  status: 'idle' as Status,
  score:  0,
  best:   0,
  setRunning:   ()           => set({ status: 'running', score: 0 }),
  togglePause:  ()           => set(s => ({ status: s.status === 'paused' ? 'running' : 'paused' })),
  addScore:     (n: number)  => set(s => ({ score: s.score + n })),
  over:         ()           => set(s => ({ status: 'over', best: Math.max(s.best, s.score) })),
}))

// ─── Internal game-step bus ────────────────────────────────────────────────────
// Receives the computed StepResult each tick; downstream samples fan it out.

export const useStep = createSamplable((set) => ({
  _last: null as StepResult | null,
  _emit: (r: StepResult) => set({ _last: r }),
}))
