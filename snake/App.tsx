import { useEffect } from 'react'
import { useInput } from './stores'
import { useDisplay } from './wiring'
import { COLS, ROWS, CELL_PX, TICK_MS } from './types'

const KEY_DIR: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',    w: 'up',
  ArrowDown: 'down', s: 'down',
  ArrowLeft: 'left', a: 'left',
  ArrowRight: 'right', d: 'right',
}

// Action refs are stable — created once at store initialisation
const { tick, setDir, start, pause } = useInput.getState()

export function App() {
  const { snake, food, status, score, best } = useDisplay()

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [status])

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (dir) { e.preventDefault(); setDir(dir); return }
      if (e.key === ' ') { e.preventDefault(); pause() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Render helpers ────────────────────────────────────────────────────────
  const snakeCells = new Set(snake.map(p => `${p.x},${p.y}`))
  const head = snake[0]

  const cellColor = (x: number, y: number): string => {
    if (head?.x === x && head?.y === y) return '#74c69d'
    if (snakeCells.has(`${x},${y}`))    return '#2d6a4f'
    if (food.x === x && food.y === y)   return '#e63946'
    return '#12122a'
  }

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>SNAKE</span>
        <div style={styles.scores}>
          <span>SCORE <b>{score}</b></span>
          <span>BEST <b>{best}</b></span>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        ...styles.grid,
        gridTemplateColumns: `repeat(${COLS}, ${CELL_PX}px)`,
        gridTemplateRows:    `repeat(${ROWS}, ${CELL_PX}px)`,
        opacity: status === 'paused' ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}>
        {Array.from({ length: ROWS }, (_, y) =>
          Array.from({ length: COLS }, (_, x) => (
            <div
              key={`${x},${y}`}
              style={{ ...styles.cell, background: cellColor(x, y) }}
            />
          ))
        )}
      </div>

      {/* Overlay */}
      {status !== 'running' && (
        <div style={styles.overlay}>
          {status === 'over'   && <div style={styles.gameOver}>GAME OVER</div>}
          {status === 'paused' && <div style={styles.pauseMsg}>PAUSED</div>}
          <button
            style={styles.btn}
            onClick={status === 'paused' ? pause : start}
          >
            {status === 'idle'   ? 'START'
           : status === 'paused' ? 'RESUME'
           : 'RESTART'}
          </button>
        </div>
      )}

      {/* Controls hint */}
      <div style={styles.hint}>
        WASD / ↑↓←→ — move &nbsp;·&nbsp; Space — pause
        &nbsp;·&nbsp; <span style={{ color: '#52b788' }}>поле торическое</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      '100vh',
    fontFamily:     '"Courier New", monospace',
    color:          '#e0e0e0',
    userSelect:     'none' as const,
    position:       'relative' as const,
  },
  header: {
    display:     'flex',
    alignItems:  'baseline',
    gap:         32,
    marginBottom: 16,
  },
  title: {
    fontSize:     28,
    fontWeight:   700,
    letterSpacing: 6,
    color:        '#74c69d',
  },
  scores: {
    display:  'flex',
    gap:      24,
    fontSize: 14,
    color:    '#888',
  },
  grid: {
    display:      'grid',
    gap:          1,
    background:   '#1e1e3a',
    border:       '2px solid #1e1e3a',
    borderRadius: 4,
    position:     'relative' as const,
  },
  cell: {
    width:        CELL_PX,
    height:       CELL_PX,
    borderRadius: 2,
    transition:   'background 0.04s',
  },
  overlay: {
    position:       'absolute' as const,
    inset:          0,
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            16,
  },
  gameOver: {
    fontSize:      36,
    fontWeight:    700,
    color:         '#e63946',
    letterSpacing: 4,
    textShadow:    '0 0 20px #e6394680',
  },
  pauseMsg: {
    fontSize:      28,
    color:         '#f4a261',
    letterSpacing: 4,
  },
  btn: {
    padding:       '10px 36px',
    background:    '#2d6a4f',
    border:        'none',
    borderRadius:  4,
    color:         '#fff',
    fontSize:      16,
    letterSpacing: 2,
    cursor:        'pointer',
  },
  hint: {
    marginTop:     14,
    fontSize:      12,
    color:         '#444',
    letterSpacing: 1,
  },
} as const
