import type { RoutineItem } from '../types'

export const LEG_MUSCLES = ['Cuádriceps', 'Isquiotibiales', 'Glúteos']
export const CYCLE_LENGTH = 7 // 6 semanas de trabajo + 1 de descarga

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Lunes = 1 ... Domingo = 7 */
export function weekdayOf(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

/** Semana del mesociclo (1, 2, 3...) a partir del lunes de inicio. */
export function mesocycleWeek(startISO: string, today: Date): number {
  const start = new Date(startISO + 'T00:00:00')
  const t = new Date(toISODate(today) + 'T00:00:00')
  const days = Math.round((t.getTime() - start.getTime()) / 86400000)
  return Math.max(1, Math.floor(days / 7) + 1)
}

export function isDeload(week: number): boolean {
  return week % CYCLE_LENGTH === 0
}

export interface Prescription {
  sets: number
  rirTarget: number
  repMin: number
  repMax: number
  label: string | null
}

/**
 * Series y RIR objetivo del día según la semana.
 * - Piernas: semanas 1-3 con 2 series y RIR 3; semana 4 series completas con RIR 3; desde la 5 RIR objetivo normal.
 * - Descarga (cada 7ª semana): mitad de series y RIR >= 3.
 */
export function prescribe(item: RoutineItem, musclePrimary: string, week: number): Prescription {
  let sets = item.sets
  let rirTarget = item.rir_target
  let label: string | null = null
  const isLeg = LEG_MUSCLES.includes(musclePrimary)
  if (isDeload(week)) {
    sets = Math.max(1, Math.ceil(item.sets / 2))
    rirTarget = Math.max(3, item.rir_target)
    label = 'Descarga'
  } else if (isLeg && week <= 4) {
    rirTarget = Math.max(3, item.rir_target)
    if (week <= 3) {
      sets = Math.min(item.sets, 2)
      label = 'Arranque suave'
    } else {
      label = 'Arranque suave (series completas)'
    }
  }
  return { sets, rirTarget, repMin: item.rep_min, repMax: item.rep_max, label }
}

/** Ajuste de series de pierna según agujetas (0-10) de la sesión de pierna anterior. */
export function adjustForSoreness(sets: number, lastSoreness: number | null): number {
  if (lastSoreness == null) return sets
  if (lastSoreness >= 7) return Math.max(1, Math.round(sets * 0.7))
  return sets
}

export interface CardioPlan {
  kind: 'intervalos' | 'recuperacion'
  minutes: number
  title: string
  detail: string
  optional: boolean
}

/**
 * Cardio en cinta al final de la sesión de fuerza (protocolo configurable de intervalos).
 * - Días 1, 3 y 5 (torso): intervalos (la regla de no repetir en días seguidos se valida con las fechas reales).
 * - Días 2 y 4 (pierna): caminata suave en cuesta, opcional.
 * - Semana de descarga: solo caminata suave.
 */
export function cardioFor(weekday: number, week: number): CardioPlan | null {
  const soft: CardioPlan = {
    kind: 'recuperacion',
    minutes: 15,
    title: 'Caminata en cuesta 15 min',
    detail: 'Día suave: frases completas todo el rato. Inclinación de 1 a 5 %, velocidad 4,5-5,5 km/h.',
    optional: weekday === 2 || weekday === 4,
  }
  if (weekday === 6 || weekday === 7) return null
  if (isDeload(week) || weekday === 2 || weekday === 4) return soft
  return {
    kind: 'intervalos',
    minutes: 15,
    title: 'Intervalos en cinta',
    detail: '4 bloques de 2 min rápidos (9,5-10,0 km/h, 1 %) con recuperación a 5,5 km/h. Test de habla al final.',
    optional: false,
  }
}

/**
 * Días del ciclo que quedaron sin hacer entre el primero y el último entrenados.
 * Ej.: hiciste el Día 1 y el 3 → pendiente el 2. (Lo anterior al primero se da por hecho: el ciclo empezó ahí.)
 */
export function pendingDays(doneNumbers: number[]): number[] {
  if (doneNumbers.length === 0) return []
  const first = Math.min(...doneNumbers)
  const last = Math.max(...doneNumbers)
  const out: number[] = []
  for (let n = first + 1; n < last; n++) if (!doneNumbers.includes(n)) out.push(n)
  return out
}
