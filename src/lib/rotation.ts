import type { Exercise, RoutineItem } from '../types'

/** Ciclos por bloque: cada 3 ciclos se cambia de bloque (A → B → C → A…). */
export const CYCLES_PER_BLOCK = 3
export type Block = 'A' | 'B' | 'C'
const BLOCKS: Block[] = ['A', 'B', 'C']

/** Bloque que toca en el ciclo `week` (1 = primer ciclo). */
export const blockFor = (week: number): Block => BLOCKS[Math.floor((Math.max(1, week) - 1) / CYCLES_PER_BLOCK) % BLOCKS.length]

/** Primer ciclo del bloque siguiente. */
export const nextBlockStart = (week: number): number => (Math.floor((Math.max(1, week) - 1) / CYCLES_PER_BLOCK) + 1) * CYCLES_PER_BLOCK + 1

/**
 * Ejercicios del día: los fijos (sin bloque) siempre; en los huecos que rotan, el del bloque actual.
 * Si el ejercicio del bloque no está disponible en el gimnasio, se usa el del bloque A.
 */
export function itemsForBlock(items: RoutineItem[], exercises: Exercise[], block: Block): RoutineItem[] {
  const available = new Set(exercises.filter((e) => e.available).map((e) => e.id))
  const fixed = items.filter((i) => !i.block)
  const slots = new Map<string, RoutineItem[]>()
  for (const i of items) if (i.block) slots.set(`${i.day_id}:${i.position}`, [...(slots.get(`${i.day_id}:${i.position}`) ?? []), i])
  const picked: RoutineItem[] = []
  for (const options of slots.values()) {
    const wanted = options.find((o) => o.block === block && available.has(o.exercise_id))
    picked.push(wanted ?? options.find((o) => o.block === 'A') ?? options[0])
  }
  return [...fixed, ...picked]
}
