import type { Exercise } from '../types'

export const DISCOMFORT_REASONS: { id: string; label: string }[] = [
  { id: 'pies', label: 'Los pies resbalan / falta apoyo' },
  { id: 'dolor', label: 'Dolor o molestia' },
  { id: 'tecnica', label: 'Técnica difícil' },
  { id: 'maquina', label: 'Máquina ocupada o ajuste incómodo' },
  { id: 'otro', label: 'Otro motivo' },
]

export function reasonLabel(id: string | null): string {
  return DISCOMFORT_REASONS.find((r) => r.id === id)?.label ?? 'Te incomodó'
}

const has = (e: Exercise, word: string) => (e.equipment ?? '').toLowerCase().includes(word)

/**
 * Reemplazos posibles para un ejercicio que incomodó: mismo músculo principal, disponibles,
 * que no estén ya en el día. Si el problema es apoyo/dolor/ajuste, se prefieren máquinas y poleas
 * (trayectoria guiada, sin banco) y se evita el banco.
 */
export function alternatives(ex: Exercise, all: Exercise[], dayExerciseIds: string[], reason: string | null, limit = 3): Exercise[] {
  const guidedBetter = reason === 'pies' || reason === 'dolor' || reason === 'maquina'
  return all
    .filter((e) => e.id !== ex.id && e.available && !dayExerciseIds.includes(e.id) && e.muscle_primary === ex.muscle_primary)
    .map((e) => {
      let score = 0
      if (guidedBetter && (has(e, 'máquina') || has(e, 'polea'))) score += 3
      if (reason === 'pies' && has(e, 'banco')) score -= 2
      if (reason === 'tecnica' && (has(e, 'máquina') || has(e, 'smith'))) score += 2
      if (e.muscles_secondary.some((m) => ex.muscles_secondary.includes(m))) score += 1
      if (e.load_type === ex.load_type) score += 1
      return { e, score }
    })
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e)
}
