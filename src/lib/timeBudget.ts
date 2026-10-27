/**
 * Ajuste de la sesión al tiempo disponible (incluye el cardio).
 * Modelo de tiempo (calibrado con tus sesiones reales): cada ejercicio cuesta ~2 min de preparación
 * y cada serie ~3,2 min (ejecución + descanso de 2 min).
 * Se recorta de lo menos importante a lo más importante: primero series de los últimos ejercicios (hasta 2 series),
 * luego se omiten los últimos ejercicios; los 3 primeros ejercicios del día (los principales) se tocan al final.
 */
export const SETUP_MIN = 2
export const MIN_PER_SET = 3.2
export const MIN_SETS = 2
/** número de ejercicios del día que se consideran principales */
export const CORE_COUNT = 3
/** minutos de transición entre las pesas y el cardio */
export const CARDIO_TRANSITION_MIN = 2

export interface BudgetItem {
  id: string
  sets: number
  position: number
}

export interface BudgetResult {
  /** id del ejercicio -> series (0 = omitido por tiempo) */
  sets: Record<string, number>
  strengthMin: number
  cardioMin: number
  totalMin: number
  trimmed: boolean
  /** true si aun recortando no se llega al tiempo disponible */
  overBudget: boolean
}

export const exerciseMinutes = (sets: number): number => (sets > 0 ? SETUP_MIN + sets * MIN_PER_SET : 0)

const strengthMinutes = (sets: Record<string, number>): number => Object.values(sets).reduce((a, n) => a + exerciseMinutes(n), 0)

/** Minutos que se reservan para el cardio (0 si hoy es opcional). */
export const cardioReserve = (cardioMin: number): number => (cardioMin > 0 ? cardioMin + CARDIO_TRANSITION_MIN : 0)

export function fitToTime(items: BudgetItem[], availableMin: number | null, cardioMin: number): BudgetResult {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  const sets: Record<string, number> = Object.fromEntries(sorted.map((i) => [i.id, i.sets]))
  const reserve = cardioReserve(cardioMin)
  const total = () => strengthMinutes(sets) + reserve
  const result = (trimmed: boolean): BudgetResult => ({
    sets,
    strengthMin: Math.round(strengthMinutes(sets)),
    cardioMin: reserve,
    totalMin: Math.round(total()),
    trimmed,
    overBudget: availableMin != null && total() > availableMin,
  })
  if (availableMin == null || total() <= availableMin) return result(false)

  const tail = [...sorted].reverse() // de menos a más importante
  const optional = tail.filter((_, idx) => idx < Math.max(0, sorted.length - CORE_COUNT))

  // 1) bajar series de los ejercicios no principales, de uno en uno, empezando por el último
  let changed = true
  while (total() > availableMin && changed) {
    changed = false
    for (const it of optional) {
      if (sets[it.id] > MIN_SETS) {
        sets[it.id] -= 1
        changed = true
        if (total() <= availableMin) break
      }
    }
  }
  // 2) omitir ejercicios no principales, del último al primero
  for (const it of optional) {
    if (total() <= availableMin) break
    sets[it.id] = 0
  }
  // 3) bajar series de los ejercicios principales hasta el mínimo
  changed = true
  while (total() > availableMin && changed) {
    changed = false
    for (const it of tail.filter((t) => sets[t.id] > MIN_SETS)) {
      sets[it.id] -= 1
      changed = true
      if (total() <= availableMin) break
    }
  }
  return result(true)
}

export const TIME_OPTIONS = [60, 75, 90, 105, 120]

/** Descanso largo en los ejercicios principales (s): mejora el rendimiento de las series siguientes. */
export const LONG_REST_SEC = 180
/** minutos de una serie de aproximación */
export const WARMUP_MIN = 1.5
/** máximo de minutos de caminata suave extra tras el cardio */
export const MAX_EXTRA_CARDIO_MIN = 20
/** máximo de series por ejercicio principal al añadir volumen */
export const MAX_CORE_SETS = 4

export interface ExpandOptions {
  /** descanso habitual entre series (s) */
  restSec: number
  /** en día de piernas no se añaden series */
  isLegDay: boolean
  /** el cardio de hoy es opcional (día de pierna): si sobra tiempo se recomienda igualmente */
  cardioOptional: boolean
}

export interface ExpandResult extends BudgetResult {
  /** ids de los ejercicios con descanso largo */
  longRest: string[]
  /** id -> series de aproximación (no se registran) */
  warmup: Record<string, number>
  /** minutos de caminata suave extra para después del cardio */
  extraCardioMin: number
  /** textos para mostrar lo que se añadió */
  extras: string[]
}

/**
 * Ajusta la sesión al tiempo marcado: si no cabe, recorta (fitToTime); si sobra, lo aprovecha en este orden:
 * 1) descanso largo en los 3 principales, 2) series de aproximación, 3) más cardio suave, 4) una serie extra en los principales
 * (solo en días que no son de piernas). Nunca se pasa del tiempo marcado.
 */
export function planToTime(items: BudgetItem[], availableMin: number | null, cardioMin: number, opts: ExpandOptions, cardioBase = cardioMin): ExpandResult {
  const base = fitToTime(items, availableMin, cardioMin)
  const none: ExpandResult = { ...base, longRest: [], warmup: {}, extraCardioMin: 0, extras: [] }
  if (availableMin == null || base.trimmed || base.overBudget) return none

  const sorted = [...items].sort((a, b) => a.position - b.position)
  const sets = { ...base.sets }
  const core = sorted.slice(0, CORE_COUNT).filter((i) => sets[i.id] > 0)
  let used = Object.values(sets).reduce((a, n) => a + exerciseMinutes(n), 0) + cardioReserve(cardioMin)
  let slack = availableMin - used
  const extras: string[] = []
  const longRest: string[] = []
  const warmup: Record<string, number> = {}
  let extraCardioMin = 0
  const longExtra = Math.max(0, (LONG_REST_SEC - opts.restSec) / 60)

  // 1) descanso largo en los principales
  const restCost = core.reduce((a, i) => a + sets[i.id] * longExtra, 0)
  if (longExtra > 0 && core.length > 0 && slack >= restCost && restCost > 0) {
    core.forEach((i) => longRest.push(i.id))
    slack -= restCost
    used += restCost
    extras.push('Descanso de ' + LONG_REST_SEC / 60 + ' min en los ' + core.length + ' principales (+' + Math.round(restCost) + ' min)')
  }

  // 2) series de aproximación en los dos primeros principales
  const wu: Record<string, number> = {}
  if (core[0]) wu[core[0].id] = 2
  if (core[1]) wu[core[1].id] = 1
  const wuCount = Object.values(wu).reduce((a, n) => a + n, 0)
  if (wuCount > 0 && slack >= wuCount * WARMUP_MIN) {
    Object.assign(warmup, wu)
    slack -= wuCount * WARMUP_MIN
    used += wuCount * WARMUP_MIN
    extras.push('Series de aproximación en los primeros principales (+' + Math.round(wuCount * WARMUP_MIN) + ' min)')
  }

  // 3) más cardio suave (si el cardio es opcional, se recomienda hasta 25 min)
  const cap = cardioBase > 0 ? MAX_EXTRA_CARDIO_MIN : 25
  // en días con series extra posibles se deja tiempo para ellas
  const keepForSets = !opts.isLegDay && core.length > 0 ? Math.min(slack / 2, core.length * (MIN_PER_SET + longExtra)) : 0
  extraCardioMin = Math.floor(Math.min(cap, Math.max(0, slack - keepForSets)) / 5) * 5
  if (extraCardioMin >= 5) {
    slack -= extraCardioMin
    used += extraCardioMin
    extras.push(cardioBase > 0 ? 'Caminata suave extra de ' + extraCardioMin + ' min tras el cardio' : 'Cardio recomendado: ' + extraCardioMin + ' min (suave)')
  } else {
    extraCardioMin = 0
  }

  // 4) una serie extra en los principales (no en días de piernas)
  if (!opts.isLegDay) {
    let added = 0
    for (const i of core) {
      const cost = MIN_PER_SET + (longRest.includes(i.id) ? longExtra : 0)
      if (sets[i.id] < MAX_CORE_SETS && slack >= cost) {
        sets[i.id] += 1
        slack -= cost
        used += cost
        added += 1
      }
    }
    if (added > 0) extras.push('+1 serie en ' + added + ' principal' + (added === 1 ? '' : 'es'))
  }

  return {
    ...base,
    sets,
    strengthMin: Math.round(used - cardioReserve(cardioMin) - extraCardioMin),
    cardioMin: cardioReserve(cardioMin) + extraCardioMin,
    totalMin: Math.round(used),
    overBudget: false,
    longRest,
    warmup,
    extraCardioMin,
    extras,
  }
}
