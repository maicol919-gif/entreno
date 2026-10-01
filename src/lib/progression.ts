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
 * Doble progresión.
 * - Si todas las series llegaron al tope de reps con RIR >= objetivo: sube carga y vuelve al mínimo de reps
 *   (en ejercicios con ayuda la carga BAJA).
 * - Si no: misma carga, una repetición más por serie (hasta el tope).
 */
export function suggest(p: Params): Suggestion {
  const past = p.last?.sets.filter((s) => s.reps != null) ?? []
  if (!p.last || past.length === 0) {
    return {
      kind: 'new',
      message: `Sin historial: elige una carga con la que llegues a ${p.repMin}-${p.repMax} reps dejando ${p.rirTarget} en reserva.`,
      targets: Array.from({ length: p.sets }, () => ({ reps: p.repMin, load_kg: null })),
    }
  }
  const lastSets = past.slice(0, p.sets).length >= p.sets ? past.slice(0, p.sets) : past
  const allAtTop = lastSets.every((s) => (s.reps ?? 0) >= p.repMax)
  const rirOk = lastSets.every((s) => s.rir == null || s.rir >= p.rirTarget)
  const targets: Target[] = Array.from({ length: p.sets }, (_, i) => {
    const ref = lastSets[Math.min(i, lastSets.length - 1)]
    return { reps: ref.reps ?? p.repMin, load_kg: ref.load_kg }
  })

  if (allAtTop && rirOk) {
    const sign = p.loadType === 'assistance' ? -1 : 1
    const raised = targets.map((t) => ({
      reps: p.repMin,
      load_kg: t.load_kg == null ? null : Math.max(0, round(t.load_kg + sign * p.increment)),
    }))
    return {
      kind: 'raise',
      message:
        p.loadType === 'assistance'
          ? 'Cumpliste el tope de reps: baja la ayuda.'
          : 'Cumpliste el tope de reps con RIR suficiente: sube la carga.',
      targets: raised,
    }
  }
  return {
    kind: 'repeat',
    message: 'Misma carga: intenta una repetición más por serie.',
    targets: targets.map((t) => ({ reps: Math.min(p.repMax, t.reps + 1), load_kg: t.load_kg })),
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
