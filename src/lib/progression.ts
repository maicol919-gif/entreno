import type { LoadType, PastSession } from '../types'

export interface Target {
  reps: number
  load_kg: number | null
}

export interface Suggestion {
  kind: 'new' | 'raise' | 'repeat'
  message: string
  targets: Target[]
}

interface Params {
  last: PastSession | null
  sets: number
  repMin: number
  repMax: number
  rirTarget: number
  loadType: LoadType
  increment: number
}

/**
 * Carga base a partir de la última sesión (series rectas con el mismo peso):
 * el peso más exigente que usaste en al menos 2 series (en ejercicios con ayuda, la menor ayuda).
 * Si ninguno se repitió, el más exigente con reps dentro de rango; si no, el más ligero.
 */
export function baseLoad(sets: PastSession['sets'], repMin: number, loadType: LoadType): number | null {
  const withLoad = sets.filter((s) => s.load_kg != null)
  if (withLoad.length === 0) return null
  const hardFirst = loadType === 'assistance' ? (a: number, b: number) => a - b : (a: number, b: number) => b - a
  const loads = [...new Set(withLoad.map((s) => s.load_kg as number))].sort(hardFirst)
  const repeated = loads.find((l) => withLoad.filter((s) => s.load_kg === l).length >= 2)
  if (repeated != null) return repeated
  const inRange = loads.find((l) => withLoad.some((s) => s.load_kg === l && (s.reps == null || s.reps >= repMin)))
  return inRange ?? loads[loads.length - 1]
}

/**
 * Doble progresión con series rectas.
 * - Base: la carga calculada de la última sesión; reps objetivo = promedio de reps a esa carga + 1 (dentro del rango).
 * - Si en la última sesión TODAS las series prescritas llegaron al tope de reps con RIR suficiente:
 *   sube carga y vuelve al mínimo de reps (en ejercicios con ayuda la carga BAJA).
 */
export function suggest(p: Params): Suggestion {
  const past = p.last?.sets ?? []
  const load = p.last ? baseLoad(past, p.repMin, p.loadType) : null
  if (!p.last || past.length === 0 || (load == null && past.every((s) => s.reps == null))) {
    return {
      kind: 'new',
      message: `Sin historial: elige una carga con la que llegues a ${p.repMin}-${p.repMax} reps dejando ${p.rirTarget} en reserva.`,
      targets: Array.from({ length: p.sets }, () => ({ reps: p.repMin, load_kg: null })),
    }
  }

  const atLoad = load == null ? past : past.filter((s) => s.load_kg === load)
  const reps = atLoad.map((s) => s.reps).filter((r): r is number => r != null)
  const meanReps = reps.length ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : p.repMin
  const rirOk = atLoad.every((s) => s.rir == null || s.rir >= p.rirTarget)
  const allAtTop = reps.length >= p.sets && reps.every((r) => r >= p.repMax)
  const when = p.last.date

  if (allAtTop && rirOk && load != null) {
    const sign = p.loadType === 'assistance' ? -1 : 1
    const next = Math.max(0, round(load + sign * p.increment))
    return {
      kind: 'raise',
      message:
        p.loadType === 'assistance'
          ? `Última vez (${when}) hiciste el tope de reps con ${load} kg de ayuda: baja la ayuda.`
          : `Última vez (${when}) hiciste el tope de reps con ${load} kg y RIR suficiente: sube la carga.`,
      targets: Array.from({ length: p.sets }, () => ({ reps: p.repMin, load_kg: next })),
    }
  }

  const reptarget = Math.min(p.repMax, Math.max(p.repMin, meanReps + 1))
  const sets = atLoad.length
  return {
    kind: 'repeat',
    message:
      load == null
        ? `Última vez (${when}) sin carga registrada: mantén el esfuerzo y suma una repetición.`
        : `Base: ${load} kg, tu carga más exigente de la última vez (${when}, ${sets} serie${sets === 1 ? '' : 's'}). Intenta ${reptarget} reps en todas.`,
    targets: Array.from({ length: p.sets }, () => ({ reps: reptarget, load_kg: load })),
  }
}

export function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Carga total equivalente según el tipo de carga (para comparar y calcular volumen). */
export function totalLoad(load: number | null, type: LoadType, barKg: number): number | null {
  if (load == null) return null
  switch (type) {
    case 'per_side':
      return load * 2
    case 'plates_per_side_plus_bar':
      return load * 2 + barKg
    default:
      return load
  }
}
