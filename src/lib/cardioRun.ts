import type { IntervalConfig, LegsFeel } from './treadmill'

const KEY = 'entreno.cardio.run'
/** Un cardio en curso se considera abandonado pasadas 12 h. */
const MAX_AGE_MS = 12 * 3600 * 1000

export interface Run {
  start: number
  mode: 'intervalos' | 'recuperacion'
  cfg: IntervalConfig
  reduced: boolean
  sessionId: string
  feel: LegsFeel | null
}

/** Cardio guiado en curso. Se guarda la hora de inicio: el tiempo sigue corriendo aunque la página se recargue. */
export function readRun(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Run | null
    return r && Date.now() - r.start < MAX_AGE_MS ? r : null
  } catch {
    return null
  }
}

export function writeRun(r: Run | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r))
    else localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: el cronómetro sigue en memoria */
  }
}
