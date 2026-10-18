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
