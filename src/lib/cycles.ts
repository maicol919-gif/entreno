/**
 * Ciclos de entrenamiento: un ciclo se completa cuando se han hecho los 5 días de la rutina, en cualquier orden.
 * Un día repetido dentro del mismo ciclo no cuenta doble.
 */
export const DAYS_PER_CYCLE = 5

export interface CycleSession {
  id: string
  date: string
  startedAt: string
  /** número del día de la rutina (1 a 5) */
  dayNumber: number
}

export interface Cycle {
  sessionIds: string[]
  /** número de día -> fecha en la que se hizo por primera vez en este ciclo */
  days: Record<number, string>
  /** fecha en que se completó (null si sigue en curso) */
  endedOn: string | null
}

export interface CycleState {
  completed: number
  current: Cycle
  last: Cycle | null
  /** número del último día entrenado */
  lastDay: number | null
}

const emptyCycle = (): Cycle => ({ sessionIds: [], days: {}, endedOn: null })

export function computeCycles(sessions: CycleSession[], total = DAYS_PER_CYCLE): CycleState {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))
  let cur = emptyCycle()
  let last: Cycle | null = null
  let completed = 0
  for (const s of sorted) {
    cur.sessionIds.push(s.id)
    if (!(s.dayNumber in cur.days)) cur.days[s.dayNumber] = s.date
    if (Object.keys(cur.days).length >= total) {
      cur.endedOn = s.date
      last = cur
      completed += 1
      cur = emptyCycle()
    }
  }
  return { completed, current: cur, last, lastDay: sorted.length ? sorted[sorted.length - 1].dayNumber : null }
}

/** Primer día pendiente después del último entrenado (con vuelta al 1). Sin historial, el Día 1. */
export function nextPendingDay(lastDay: number | null, done: Set<number>, total = DAYS_PER_CYCLE): number {
  const base = lastDay ?? 0
  for (let i = 0; i < total; i++) {
    const n = ((base + i) % total) + 1
    if (!done.has(n)) return n
  }
  return (base % total) + 1
}
