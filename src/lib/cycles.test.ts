import { describe, expect, it } from 'vitest'
import { computeCycles, nextPendingDay, type CycleSession } from './cycles'

const s = (id: string, date: string, dayNumber: number): CycleSession => ({ id, date, startedAt: date + 'T20:00:00Z', dayNumber })

// tus sesiones reales (1 al 17 de octubre)
const real: CycleSession[] = [
  s('a', '2026-10-01', 3),
  s('b', '2026-10-05', 4),
  s('c', '2026-10-06', 5),
  s('d', '2026-10-07', 1),
  s('e', '2026-10-08', 3),
  s('f', '2026-10-13', 3),
  s('g', '2026-10-14', 4),
  s('h', '2026-10-15', 5),
  s('i', '2026-10-16', 2),
  s('j', '2026-10-17', 3),
]

describe('ciclos por 5 días distintos', () => {
  it('sin sesiones: ciclo vacío', () => {
    const st = computeCycles([])
    expect(st.completed).toBe(0)
    expect(st.lastDay).toBeNull()
    expect(Object.keys(st.current.days)).toHaveLength(0)
  })

  it('tu historial: un ciclo completado el 16 de octubre y el segundo en curso con el Día 3', () => {
    const st = computeCycles(real)
    expect(st.completed).toBe(1)
    expect(st.last?.endedOn).toBe('2026-10-16')
    expect(st.last?.sessionIds).toHaveLength(9)
    expect(Object.keys(st.current.days).map(Number)).toEqual([3])
    expect(st.lastDay).toBe(3)
  })

  it('un día repetido no cuenta doble: el ciclo no se cierra con 5 sesiones si hay repetidos', () => {
    const st = computeCycles([s('1', '2026-10-01', 3), s('2', '2026-10-02', 3), s('3', '2026-10-03', 3), s('4', '2026-10-04', 4), s('5', '2026-10-05', 5)])
    expect(st.completed).toBe(0)
  })

  it('el orden de los días no importa', () => {
    const st = computeCycles([s('1', '2026-10-01', 5), s('2', '2026-10-02', 3), s('3', '2026-10-03', 1), s('4', '2026-10-04', 4), s('5', '2026-10-05', 2)])
    expect(st.completed).toBe(1)
    expect(st.current.sessionIds).toHaveLength(0)
  })

  it('ordena por fecha y hora aunque lleguen desordenadas', () => {
    const st = computeCycles([...real].reverse())
    expect(st.completed).toBe(1)
    expect(st.lastDay).toBe(3)
  })

  it('al completar dos ciclos cuenta dos', () => {
    const second = [s('k', '2026-10-20', 4), s('l', '2026-10-21', 5), s('m', '2026-10-22', 1), s('n', '2026-10-23', 2)]
    const st = computeCycles([...real, ...second])
    expect(st.completed).toBe(2)
    expect(st.last?.endedOn).toBe('2026-10-23')
  })
})

describe('siguiente día pendiente', () => {
  it('sin historial: Día 1', () => {
    expect(nextPendingDay(null, new Set())).toBe(1)
  })
  it('tras el Día 3 con el 3 hecho: Día 4', () => {
    expect(nextPendingDay(3, new Set([3]))).toBe(4)
  })
  it('salta los días ya hechos en el ciclo', () => {
    expect(nextPendingDay(3, new Set([3, 4, 5]))).toBe(1)
  })
  it('tras el Día 5 vuelve al 1', () => {
    expect(nextPendingDay(5, new Set([5]))).toBe(1)
  })
  it('no repite un día hecho aunque sea el siguiente', () => {
    expect(nextPendingDay(1, new Set([1, 2]))).toBe(3)
  })
})
