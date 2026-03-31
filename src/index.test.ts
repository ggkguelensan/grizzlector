import { describe, it, expect } from 'vitest'
import { createSamplable, sample, combine } from './index'

// ─── createSamplable ─────────────────────────────────────────────────────────

describe('createSamplable', () => {
  it('preserves initial state and action behaviour', () => {
    const useStore = createSamplable((set) => ({
      count: 0,
      inc: () => set((s: any) => ({ count: s.count + 1 })),
    }))

    expect(useStore.getState().count).toBe(0)
    useStore.getState().inc()
    expect(useStore.getState().count).toBe(1)
  })

  it('exposes clock / source / target descriptor factories', () => {
    const useStore = createSamplable((set) => ({
      x: 0,
      setX: (v: number) => set({ x: v }),
    }))

    expect(useStore.clock('setX')).toMatchObject({ _name: 'setX' })
    expect(useStore.source('x')).toMatchObject({ _key: 'x' })
    expect(useStore.target('setX')).toMatchObject({ _name: 'setX' })
  })
})

// ─── sample ──────────────────────────────────────────────────────────────────

describe('sample', () => {
  it('forwards clock payload to target when source is omitted', () => {
    const useStore = createSamplable((set) => ({
      last: '' as string,
      push:    (v: string) => {},
      setLast: (v: string) => set({ last: v }),
    }))

    sample({
      clock:  useStore.clock('push'),
      target: useStore.target('setLast'),
    })

    useStore.getState().push('hello')
    expect(useStore.getState().last).toBe('hello')
  })

  it('reads source state after action completes', () => {
    const useStore = createSamplable((set) => ({
      a: 0,
      b: 0,
      incA:  () => set((s: any) => ({ a: s.a + 1 })),
      setB:  (v: number) => set({ b: v }),
    }))

    sample({
      clock:  useStore.clock('incA'),
      source: useStore.source('a'),
      target: useStore.target('setB'),
    })

    useStore.getState().incA()
    expect(useStore.getState().b).toBe(1)   // a was already 1 when sampled

    useStore.getState().incA()
    expect(useStore.getState().b).toBe(2)
  })

  it('skips target when filter returns false', () => {
    const useStore = createSamplable((set) => ({
      a:   0,
      log: [] as number[],
      incA:      () => set((s: any) => ({ a: s.a + 1 })),
      appendLog: (v: number) => set((s: any) => ({ log: [...s.log, v] })),
    }))

    sample({
      clock:  useStore.clock('incA'),
      source: useStore.source('a'),
      filter: (a) => (a as number) > 2,
      target: useStore.target('appendLog'),
    })

    useStore.getState().incA() // a = 1  — filtered out
    useStore.getState().incA() // a = 2  — filtered out
    useStore.getState().incA() // a = 3  — passes

    expect(useStore.getState().log).toEqual([3])
  })

  it('transforms value with fn before forwarding', () => {
    const useStore = createSamplable((set) => ({
      multiplier: 5,
      result:     0,
      trigger:    () => {},
      setResult:  (v: number) => set({ result: v }),
    }))

    sample({
      clock:  useStore.clock('trigger'),
      source: useStore.source('multiplier'),
      fn:     (mult) => (mult as number) * 2,
      target: useStore.target('setResult'),
    })

    useStore.getState().trigger()
    expect(useStore.getState().result).toBe(10)
  })

  it('fn receives both source value and clock payload', () => {
    const useStore = createSamplable((set) => ({
      stock:   100,
      log:     [] as string[],
      consume: (n: number) => set((s: any) => ({ stock: s.stock - n })),
      addLog:  (msg: string) => set((s: any) => ({ log: [...s.log, msg] })),
    }))

    sample({
      clock:  useStore.clock('consume'),
      source: useStore.source('stock'),
      fn:     (stock, consumed) => `remaining: ${stock}, consumed: ${consumed}`,
      target: useStore.target('addLog'),
    })

    useStore.getState().consume(30)
    expect(useStore.getState().log).toEqual(['remaining: 70, consumed: 30'])
  })

  it('triggers all targets in the array', () => {
    const useStore = createSamplable((set) => ({
      x: 0, y: 0,
      fire:  () => {},
      setX:  (v: number) => set({ x: v }),
      setY:  (v: number) => set({ y: v }),
    }))

    sample({
      clock:  useStore.clock('fire'),
      fn:     () => 42,
      target: [useStore.target('setX'), useStore.target('setY')],
    })

    useStore.getState().fire()
    expect(useStore.getState().x).toBe(42)
    expect(useStore.getState().y).toBe(42)
  })

  it('subscribes to multiple clocks', () => {
    const useStore = createSamplable((set) => ({
      count: 0,
      a: () => {},
      b: () => {},
      inc: () => set((s: any) => ({ count: s.count + 1 })),
    }))

    sample({
      clock:  [useStore.clock('a'), useStore.clock('b')],
      target: useStore.target('inc'),
    })

    useStore.getState().a()
    useStore.getState().b()
    expect(useStore.getState().count).toBe(2)
  })

  it('stops reacting after unsubscribe', () => {
    const useStore = createSamplable((set) => ({
      a: 0,
      b: 0,
      incA:  () => set((s: any) => ({ a: s.a + 1 })),
      setB:  (v: number) => set({ b: v }),
    }))

    const [unsub] = sample({
      clock:  useStore.clock('incA'),
      source: useStore.source('a'),
      target: useStore.target('setB'),
    })

    useStore.getState().incA()
    expect(useStore.getState().b).toBe(1)

    unsub()
    useStore.getState().incA()
    expect(useStore.getState().b).toBe(1) // unchanged
  })
})

// ─── combine ─────────────────────────────────────────────────────────────────

describe('combine', () => {
  it('reflects initial state of all sources', () => {
    const useStore = createSamplable((set) => ({
      bears:  3,
      salmon: 50,
      noop:   () => {},
    }))

    const useSummary = combine({
      bears:  useStore.source('bears'),
      salmon: useStore.source('salmon'),
    })

    expect(useSummary.getState()).toEqual({ bears: 3, salmon: 50 })
  })

  it('updates when any source store changes', () => {
    const useStore = createSamplable((set) => ({
      bears:  0,
      salmon: 100,
      addBear:   () => set((s: any) => ({ bears:  s.bears  + 1 })),
      eatSalmon: () => set((s: any) => ({ salmon: s.salmon - 10 })),
    }))

    const combined = combine({
      bears:  useStore.source('bears'),
      salmon: useStore.source('salmon'),
    })

    useStore.getState().addBear()
    expect(combined.getState().bears).toBe(1)

    useStore.getState().eatSalmon()
    expect(combined.getState().salmon).toBe(90)
  })

  it('can be used as source in sample', () => {
    const useStore = createSamplable((set) => ({
      value:  10,
      result: 0,
      trigger:   () => {},
      setValue:  (v: number) => set({ value: v }),
      setResult: (v: number) => set({ result: v }),
    }))

    const combined = combine({ value: useStore.source('value') })

    sample({
      clock:  useStore.clock('trigger'),
      source: combined.source('value'),
      fn:     (v) => (v as number) * 3,
      target: useStore.target('setResult'),
    })

    useStore.getState().trigger()
    expect(useStore.getState().result).toBe(30)

    useStore.getState().setValue(20)
    useStore.getState().trigger()
    expect(useStore.getState().result).toBe(60)
  })

  it('combines sources from different stores', () => {
    const useA = createSamplable((set) => ({
      x: 1,
      setX: (v: number) => set({ x: v }),
    }))
    const useB = createSamplable((set) => ({
      y: 2,
      setY: (v: number) => set({ y: v }),
    }))

    const combined = combine({ x: useA.source('x'), y: useB.source('y') })

    useA.getState().setX(10)
    useB.getState().setY(20)

    expect(combined.getState()).toEqual({ x: 10, y: 20 })
  })
})

// ─── combine — new forms ──────────────────────────────────────────────────────

describe('combine — object + fn', () => {
  it('derives a single value from the combined object', () => {
    const useStore = createSamplable((set) => ({
      x: 3,
      y: 4,
      setX: (v: number) => set({ x: v }),
    }))

    const useHyp = combine(
      { x: useStore.source('x'), y: useStore.source('y') },
      ({ x, y }: { x: number; y: number }) => Math.hypot(x, y),
    )

    expect(useHyp.getState()).toEqual({ value: 5 })

    useStore.getState().setX(0)
    expect(useHyp.getState()).toEqual({ value: 4 })
  })

  it('can be used as source in sample', () => {
    const useStore = createSamplable((set) => ({
      a: 10,
      b: 3,
      result: 0,
      fire:      () => {},
      setA:      (v: number) => set({ a: v }),
      setResult: (v: number) => set({ result: v }),
    }))

    const useRatio = combine(
      { a: useStore.source('a'), b: useStore.source('b') },
      ({ a, b }: { a: number; b: number }) => a / b,
    )

    sample({
      clock:  useStore.clock('fire'),
      source: useRatio.source(),   // .source() with no arg — convenience alias for 'value'
      fn:     (ratio) => Math.round(ratio as number * 100) / 100,
      target: useStore.target('setResult'),
    })

    useStore.getState().fire()
    expect(useStore.getState().result).toBeCloseTo(3.33)

    useStore.getState().setA(6)
    useStore.getState().fire()
    expect(useStore.getState().result).toBe(2)
  })
})

describe('combine — array form', () => {
  it('state is { value: [v1, v2, ...] } reflecting source order', () => {
    const useA = createSamplable((set) => ({ x: 1, setX: (v: number) => set({ x: v }) }))
    const useB = createSamplable((set) => ({ y: 2, setY: (v: number) => set({ y: v }) }))

    const combined = combine([useA.source('x'), useB.source('y')])

    expect(combined.getState()).toEqual({ value: [1, 2] })

    useA.getState().setX(10)
    expect(combined.getState()).toEqual({ value: [10, 2] })

    useB.getState().setY(20)
    expect(combined.getState()).toEqual({ value: [10, 20] })
  })

  it('array + fn transforms the tuple', () => {
    const useA = createSamplable((set) => ({ x: 3, setX: (v: number) => set({ x: v }) }))
    const useB = createSamplable((set) => ({ y: 4, setY: (v: number) => set({ y: v }) }))

    const useSum = combine(
      [useA.source('x'), useB.source('y')],
      ([x, y]: number[]) => x + y,
    )

    expect(useSum.getState()).toEqual({ value: 7 })

    useA.getState().setX(10)
    expect(useSum.getState()).toEqual({ value: 14 })
  })

  it('array combined store can be used as source in sample', () => {
    const useA = createSamplable((set) => ({ x: 5, setX: (v: number) => set({ x: v }) }))
    const useB = createSamplable((set) => ({
      y:         2,
      result:    0,
      fire:      () => {},
      setResult: (v: number) => set({ result: v }),
    }))

    const combined = combine(
      [useA.source('x'), useB.source('y')],
      ([x, y]: number[]) => x * y,
    )

    sample({
      clock:  useB.clock('fire'),
      source: combined.source(),
      target: useB.target('setResult'),
    })

    useB.getState().fire()
    expect(useB.getState().result).toBe(10)

    useA.getState().setX(3)
    useB.getState().fire()
    expect(useB.getState().result).toBe(6)
  })
})
