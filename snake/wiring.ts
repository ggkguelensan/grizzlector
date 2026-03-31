import { sample, combine } from '../src/index'
import { useInput, useBody, useFood, useDir, useStatus, useStep } from './stores'
import { computeStep, randomFood, INITIAL_SNAKE, OPPOSITE, type Direction, type StepResult } from './types'

// ─── Input: direction ─────────────────────────────────────────────────────────
// Guard against 180° reversals: compare incoming direction with last committed.

sample({
  clock:  useInput.clock('setDir'),
  source: useDir.source('direction'),
  filter: (current, next) => OPPOSITE[next as Direction] !== (current as Direction),
  fn:     (_, next) => next as Direction,
  target: useDir.target('setPending'),
})

// ─── Input: start ─────────────────────────────────────────────────────────────

sample({
  clock:  useInput.clock('start'),
  target: [useStatus.target('setRunning'), useDir.target('reset')],
})

sample({
  clock:  useInput.clock('start'),
  fn:     () => INITIAL_SNAKE,
  target: useBody.target('setSnake'),
})

sample({
  clock:  useInput.clock('start'),
  fn:     () => randomFood(INITIAL_SNAKE),
  target: useFood.target('setFood'),
})

// ─── Input: pause ─────────────────────────────────────────────────────────────

sample({
  clock:  useInput.clock('pause'),
  target: useStatus.target('togglePause'),
})

// ─── Tick → compute step ──────────────────────────────────────────────────────
// Only fires when status is 'running'. Reads all required state, produces
// a StepResult that the bus then fans out to the individual stores below.

sample({
  clock:  useInput.clock('tick'),
  source: [
    useBody.source('snake'),
    useDir.source('pending'),
    useFood.source('food'),
    useStatus.source('status'),
  ],
  filter: ([, , , status]) => status === 'running',
  fn:     ([snake, dir, food]) =>
    computeStep(snake as any, dir as Direction, food as any),
  target: useStep.target('_emit'),
})

// ─── Step fan-out ─────────────────────────────────────────────────────────────
// Each sample below reads StepResult directly from the clock payload
// (no source needed — when source is omitted our library passes payload as value).

const stepClock = useStep.clock('_emit')

// Update snake body on move or eat
sample({
  clock:  stepClock,
  filter: (r) => (r as StepResult).type !== 'over',
  fn:     (r) => (r as StepResult).snake!,
  target: useBody.target('setSnake'),
})

// Commit the direction that was actually used
sample({
  clock:  stepClock,
  filter: (r) => (r as StepResult).type !== 'over',
  fn:     (r) => (r as StepResult).direction!,
  target: useDir.target('commit'),
})

// Spawn new food when the snake ate
sample({
  clock:  stepClock,
  filter: (r) => (r as StepResult).type === 'ate',
  fn:     (r) => (r as StepResult).food!,
  target: useFood.target('setFood'),
})

// Add score when the snake ate
sample({
  clock:  stepClock,
  filter: (r) => (r as StepResult).type === 'ate',
  fn:     () => 10,
  target: useStatus.target('addScore'),
})

// Trigger game-over on collision
sample({
  clock:  stepClock,
  filter: (r) => (r as StepResult).type === 'over',
  target: useStatus.target('over'),
})

// ─── Display store (combined read model) ─────────────────────────────────────

export const useDisplay = combine({
  snake:  useBody.source('snake'),
  food:   useFood.source('food'),
  status: useStatus.source('status'),
  score:  useStatus.source('score'),
  best:   useStatus.source('best'),
})
