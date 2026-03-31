import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ─── Internal event bus ───────────────────────────────────────────────────────

type Listener = (payload: unknown) => void
const _bus = new WeakMap<object, Map<string, Set<Listener>>>()

function emit(store: object, name: string, payload: unknown): void {
  _bus.get(store)?.get(name)?.forEach(cb => cb(payload))
}

function on(store: object, name: string, cb: Listener): () => void {
  if (!_bus.has(store)) _bus.set(store, new Map())
  const bus = _bus.get(store)!
  if (!bus.has(name)) bus.set(name, new Set())
  bus.get(name)!.add(cb)
  return () => { bus.get(name)?.delete(cb) }
}

// ─── Descriptor types ─────────────────────────────────────────────────────────

export type ClockDescriptor = {
  readonly _store: object
  readonly _name: string
}

export type SourceDescriptor<T = unknown> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly _store: { getState(): any; subscribe(sel: any, cb: any): () => void }
  readonly _key: string
  readonly _phantom?: T
}

export type TargetDescriptor = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly _store: { getState(): any }
  readonly _name: string
}

// ─── createSamplable ──────────────────────────────────────────────────────────

export type SamplableStore<S extends Record<string, unknown>> =
  UseBoundStore<StoreApi<S>> & {
    /** Clock descriptor — fires when the named action is called */
    clock(name: keyof S & string): ClockDescriptor
    /** Source descriptor — reads the named state key */
    source<K extends keyof S & string>(key: K): SourceDescriptor<S[K]>
    /** Target descriptor — calls the named action */
    target(name: keyof S & string): TargetDescriptor
  }

export function createSamplable<S extends Record<string, unknown>>(
  init: (set: any, get: () => S, api: any) => S,
): SamplableStore<S> {
  // Forward-declare so the wrapped actions can close over `store`
  let store: SamplableStore<S>

  store = create<S>()(
    subscribeWithSelector((set, get, api) => {
      const state = init(set, get, api)
      return Object.fromEntries(
        Object.entries(state as object).map(([k, v]) =>
          typeof v !== 'function'
            ? [k, v]
            : [k, (...args: unknown[]) => {
                (v as (...a: unknown[]) => unknown)(...args)
                emit(store, k, args[0])
              }],
        ),
      ) as S
    }),
  ) as unknown as SamplableStore<S>

  store.clock  = (name)  => ({ _store: store, _name: name })
  store.source = (key)   => ({ _store: store, _key: key })
  store.target = (name)  => ({ _store: store, _name: name })

  return store
}

// ─── sample ───────────────────────────────────────────────────────────────────

type MaybeArray<T> = T | readonly T[]

function toArray<T>(v: MaybeArray<T>): T[] {
  return Array.isArray(v) ? (v as T[]) : [v as T]
}

export type SampleOptions<Src = unknown, Payload = unknown, Out = unknown> = {
  clock:    MaybeArray<ClockDescriptor>
  source?:  MaybeArray<SourceDescriptor<Src>>
  filter?:  (source: Src, payload: Payload) => boolean
  fn?:      (source: Src, payload: Payload) => Out
  target:   MaybeArray<TargetDescriptor>
}

/**
 * When clock fires:
 *  1. Read source (or use clock payload when source is omitted)
 *  2. Skip if filter returns false
 *  3. Transform with fn (optional)
 *  4. Forward result to every target action
 *
 * Returns an array of unsubscribe functions (one per clock).
 */
export function sample<Src = unknown, Payload = unknown, Out = unknown>(
  options: SampleOptions<Src, Payload, Out>,
): Array<() => void> {
  const { clock, source, filter, fn, target } = options
  const clocks  = toArray(clock)
  const sources = source ? toArray(source) : []
  const targets = toArray(target)

  return clocks.map(c =>
    on(c._store, c._name, (payload) => {
      // Read source value(s)
      const srcVal: unknown =
        sources.length === 0 ? payload
        : sources.length === 1 ? sources[0]._store.getState()[sources[0]._key]
        : sources.map(s => s._store.getState()[s._key])

      if (filter && !(filter as any)(srcVal, payload)) return

      const data = fn ? (fn as any)(srcVal, payload) : srcVal
      targets.forEach(t => (t._store.getState() as any)[t._name](data))
    }),
  )
}

// ─── combine ──────────────────────────────────────────────────────────────────

export type SourceMap = Record<string, SourceDescriptor<any>>

type ExtractSourceValues<M extends SourceMap> = {
  [K in keyof M]: M[K] extends SourceDescriptor<infer T> ? T : never
}

// Preserves tuple types: [SourceDescriptor<A>, SourceDescriptor<B>] → [A, B]
type ExtractSourceArray<S extends ReadonlyArray<SourceDescriptor<any>>> = {
  [K in keyof S]: S[K] extends SourceDescriptor<infer T> ? T : never
}

/**
 * Plain object form — state mirrors the source map shape.
 * Access individual keys via .source('key').
 */
export type CombinedStore<M extends SourceMap> =
  UseBoundStore<StoreApi<ExtractSourceValues<M>>> & {
    source<K extends keyof M & string>(key: K): SourceDescriptor<ExtractSourceValues<M>[K]>
    destroy(): void
  }

/**
 * Derived form (fn or array) — state is `{ value: R }`.
 * Access the derived value via .source('value') or .source().
 */
export type CombinedValueStore<R> =
  UseBoundStore<StoreApi<{ value: R }>> & {
    source(key?: 'value'): SourceDescriptor<R>
    destroy(): void
  }

// ── Overloads ─────────────────────────────────────────────────────────────────

/** Plain object — state mirrors source map */
export function combine<M extends SourceMap>(
  sources: M,
): CombinedStore<M>

/** Object + fn — derives a single value */
export function combine<M extends SourceMap, R>(
  sources: M,
  fn: (values: ExtractSourceValues<M>) => R,
): CombinedValueStore<R>

/** Array — state is `{ value: [T1, T2, ...] }` preserving tuple */
export function combine<S extends ReadonlyArray<SourceDescriptor<any>>>(
  sources: S,
): CombinedValueStore<ExtractSourceArray<S>>

/** Array + fn — derives a single value from the tuple */
export function combine<S extends ReadonlyArray<SourceDescriptor<any>>, R>(
  sources: S,
  fn: (values: ExtractSourceArray<S>) => R,
): CombinedValueStore<R>

// ── Implementation ────────────────────────────────────────────────────────────

export function combine(
  sources: SourceMap | ReadonlyArray<SourceDescriptor<any>>,
  fn?: (values: any) => any,
): any {
  const isArray = Array.isArray(sources)

  // ── Array form  or  Object + fn  →  { value: R } ──────────────────────────
  if (isArray || fn !== undefined) {
    const srcEntries: Array<[string, SourceDescriptor<any>]> = isArray
      ? (sources as ReadonlyArray<SourceDescriptor<any>>).map((s, i) => [String(i), s])
      : Object.entries(sources as SourceMap)

    const readValues = (): any =>
      isArray
        ? (sources as ReadonlyArray<SourceDescriptor<any>>).map(s => s._store.getState()[s._key])
        : Object.fromEntries(srcEntries.map(([k, s]) => [k, s._store.getState()[s._key]]))

    const compute = () => ({ value: fn ? fn(readValues()) : readValues() })

    const store = create<{ value: unknown }>()(subscribeWithSelector(compute))

    const unsubs = srcEntries.map(([, s]) =>
      (s._store as any).subscribe(
        (state: any) => state[s._key],
        () => store.setState(compute()),
      ),
    )

    const combined = store as unknown as CombinedValueStore<any>
    combined.source  = () => ({ _store: store as any, _key: 'value' })
    combined.destroy = () => unsubs.forEach(u => u())
    return combined
  }

  // ── Plain object form  →  { [key]: value } ────────────────────────────────
  const sourcesMap = sources as SourceMap
  type Combined = ExtractSourceValues<typeof sourcesMap>

  const snapshot = (): Combined =>
    Object.fromEntries(
      Object.entries(sourcesMap).map(([k, s]) => [k, s._store.getState()[s._key]]),
    ) as Combined

  const store = create<Combined>()(subscribeWithSelector(snapshot))

  const unsubs = Object.entries(sourcesMap).map(([k, s]) =>
    (s._store as any).subscribe(
      (state: Record<string, unknown>) => state[s._key],
      (val: unknown) => store.setState(prev => ({ ...prev, [k]: val })),
    ),
  )

  const combined = store as unknown as CombinedStore<typeof sourcesMap>
  combined.source  = (key: any) => ({ _store: store as any, _key: key })
  combined.destroy = () => unsubs.forEach(u => u())
  return combined
}
