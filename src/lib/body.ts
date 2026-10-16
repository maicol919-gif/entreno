export interface BodyPoint {
  date: string
  kg: number | null
  waist_cm: number | null
}

const DAY = 86400000

function dayNumber(date: string): number {
  return Math.round(new Date(date + 'T00:00:00Z').getTime() / DAY)
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

/** Relación cintura/altura: por debajo de 0,5 es el objetivo de salud; sirve como indicador de grasa visceral. */
export function whtr(waistCm: number, heightCm: number): number {
  return waistCm / heightCm
}

export type WaistZone = 'ok' | 'limite' | 'alto'

/** Bandas de NICE (adultos con IMC < 35): <0,5 bien · 0,5-0,59 aumentado · ≥0,6 alto. Umbral 0,5 respaldado por Browning, Hsieh y Ashwell 2010 (revisión de 78 estudios). */
export function whtrZone(ratio: number): WaistZone {
  if (ratio < 0.5) return 'ok'
  if (ratio < 0.6) return 'limite'
  return 'alto'
}

/** Cintura objetivo para quedar en cintura/altura < 0,5 (un punto por debajo del límite). */
export function waistGoalCm(heightCm: number): number {
  return Math.ceil(heightCm * 0.5) - 1
}

/** Media de los valores de los 7 días que terminan en `endDate` (incluido). Ignora los nulos. */
export function windowMean(points: BodyPoint[], field: 'kg' | 'waist_cm', endDate: string, days = 7): number | null {
  const end = dayNumber(endDate)
  const vals = points
    .filter((p) => p[field] != null && dayNumber(p.date) <= end && dayNumber(p.date) > end - days)
    .map((p) => p[field] as number)
  return mean(vals)
}

/** Última fecha con valor para el campo (null si nunca se registró). */
export function lastDate(points: BodyPoint[], field: 'kg' | 'waist_cm'): string | null {
  const dates = points.filter((p) => p[field] != null).map((p) => p.date).sort()
  return dates.length ? dates[dates.length - 1] : null
}

export interface Trend {
  current: number
  previous: number | null
  delta: number | null
  /** % de cambio sobre la semana anterior (solo para el peso) */
  pct: number | null
}

/** Media de la última semana registrada contra la semana anterior. */
export function trend(points: BodyPoint[], field: 'kg' | 'waist_cm'): Trend | null {
  const end = lastDate(points, field)
  if (!end) return null
  const current = windowMean(points, field, end)
  if (current == null) return null
  const prevEnd = new Date((dayNumber(end) - 7) * DAY).toISOString().slice(0, 10)
  const previous = windowMean(points, field, prevEnd)
  const delta = previous == null ? null : current - previous
  const pct = previous == null || previous === 0 ? null : ((current - previous) / previous) * 100
  return { current, previous, delta, pct }
}

export type PaceVerdict = 'sin-datos' | 'rapido' | 'bien' | 'lento' | 'sube'

/**
 * Ritmo de pérdida de peso (media 7 días contra la anterior), según el plan:
 * baja >1 %/semana = muy rápido (subir calorías) · 0,3-1 % = bien · casi plano o sube = lento.
 * Base: Garthe 2011 (~0,7 %/semana conservó mejor la masa magra que ~1,4 %) y las pautas de Helms 2014.
 */
export function paceVerdict(t: Trend | null): PaceVerdict {
  if (!t || t.pct == null) return 'sin-datos'
  const loss = -t.pct
  if (loss > 1) return 'rapido'
  if (loss >= 0.3) return 'bien'
  if (loss > -0.3) return 'lento'
  return 'sube'
}
