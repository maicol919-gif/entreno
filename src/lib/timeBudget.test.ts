import { describe, expect, it } from 'vitest'
import { planToTime, LONG_REST_SEC, CORE_COUNT, MIN_SETS, cardioReserve, exerciseMinutes, fitToTime, type BudgetItem } from './timeBudget'

const day = (sets: number[]): BudgetItem[] => sets.map((s, i) => ({ id: `e${i + 1}`, sets: s, position: i + 1 }))

// Día 3 (hombros y brazos): 7 ejercicios, 18 series
const dia3 = day([3, 3, 2, 3, 2, 3, 2])

describe('fitToTime', () => {
  it('sin límite o si cabe: no cambia nada', () => {
    expect(fitToTime(dia3, null, 25).trimmed).toBe(false)
    const r = fitToTime(day([3, 3, 3]), 120, 25)
    expect(r.trimmed).toBe(false)
    expect(r.sets).toEqual({ e1: 3, e2: 3, e3: 3 })
  })

  it('el cardio opcional no reserva tiempo', () => {
    expect(cardioReserve(0)).toBe(0)
    expect(cardioReserve(25)).toBe(27)
  })

  it('con 90 min y cardio de 25 min, el Día 3 se recorta un poco (96 min sin recortar)', () => {
    const full = fitToTime(dia3, null, 25)
    expect(full.totalMin).toBeGreaterThan(90)
    const r = fitToTime(dia3, 90, 25)
    expect(r.trimmed).toBe(true)
    expect(r.totalMin).toBeLessThanOrEqual(90)
    // los 3 principales no se tocan con un recorte pequeño
    expect(r.sets.e1).toBe(3)
    expect(r.sets.e2).toBe(3)
  })

  it('primero baja a 2 las series de los últimos ejercicios y solo después omite alguno; nunca deja 1 serie', () => {
    const r = fitToTime(dia3, 90, 25)
    expect(r.sets.e4).toBe(2)
    expect(r.sets.e6).toBe(2)
    for (const id of ['e4', 'e5', 'e6', 'e7']) expect(r.sets[id] === 0 || r.sets[id] >= MIN_SETS).toBe(true)
  })

  it('con poco tiempo omite ejercicios del final y conserva los principales', () => {
    const r = fitToTime(dia3, 60, 25)
    expect(r.totalMin).toBeLessThanOrEqual(60)
    expect(r.sets.e7).toBe(0)
    for (let i = 1; i <= CORE_COUNT; i++) expect(r.sets[`e${i}`]).toBeGreaterThan(0)
  })

  it('con tiempo muy escaso baja los principales a 2 series y avisa si no llega', () => {
    const r = fitToTime(dia3, 30, 25)
    expect(r.trimmed).toBe(true)
    expect(r.overBudget).toBe(true)
    for (let i = 1; i <= CORE_COUNT; i++) expect(r.sets[`e${i}`]).toBe(MIN_SETS)
  })

  it('120 min dan margen de sobra para todo el día', () => {
    expect(fitToTime(dia3, 120, 25).trimmed).toBe(false)
  })

  it('modelo de tiempo: 2 min de preparación + 3,2 por serie', () => {
    expect(exerciseMinutes(3)).toBeCloseTo(11.6)
    expect(exerciseMinutes(0)).toBe(0)
  })
})

describe('planToTime (aprovechar el tiempo que sobra)', () => {
  const opts = { restSec: 120, isLegDay: false, cardioOptional: false }
  it('sin límite no añade nada', () => {
    const r = planToTime(dia3, null, 25, opts)
    expect(r.extras).toEqual([])
    expect(r.longRest).toEqual([])
  })
  it('si no cabe, solo recorta (no añade extras)', () => {
    const r = planToTime(dia3, 60, 25, opts)
    expect(r.trimmed).toBe(true)
    expect(r.extras).toEqual([])
  })
  it('con tiempo de sobra añade extras y nunca pasa del tiempo marcado', () => {
    for (const avail of [90, 105, 120]) {
      const r = planToTime(dia3, avail, 25, opts)
      expect(r.totalMin).toBeLessThanOrEqual(avail)
    }
    const r = planToTime(dia3, 120, 25, opts)
    expect(r.longRest.length).toBe(CORE_COUNT)
    expect(r.extras.length).toBeGreaterThan(1)
    expect(LONG_REST_SEC).toBe(180)
  })
  it('el orden de prioridad: primero descanso largo y aproximación', () => {
    const r = planToTime(day([3, 3, 3, 2, 2]), 100, 25, opts)
    expect(r.extras[0]).toContain('Descanso')
  })
  it('en día de piernas no añade series y recomienda cardio si es opcional', () => {
    const legs = planToTime(day([3, 3, 3, 2, 3, 3]), 105, 0, { restSec: 120, isLegDay: true, cardioOptional: true }, 0)
    expect(legs.sets).toEqual({ e1: 3, e2: 3, e3: 3, e4: 2, e5: 3, e6: 3 })
    expect(legs.extraCardioMin).toBeGreaterThan(0)
    expect(legs.totalMin).toBeLessThanOrEqual(105)
  })
  it('máximo 4 series por principal', () => {
    const r = planToTime(day([4, 4, 4]), 120, 0, opts)
    for (const id of ['e1', 'e2', 'e3']) expect(r.sets[id]).toBeLessThanOrEqual(4)
  })
})
