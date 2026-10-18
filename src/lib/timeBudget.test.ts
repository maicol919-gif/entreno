import { describe, expect, it } from 'vitest'
import { CORE_COUNT, MIN_SETS, cardioReserve, exerciseMinutes, fitToTime, type BudgetItem } from './timeBudget'

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
